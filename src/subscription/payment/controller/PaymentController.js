import { logInfo, logError } from "../../../utils/logger.js";
import path from "path";
import express, { response } from "express";
const router = express.Router();
const base = "https://api-m.sandbox.paypal.com";
import { PrismaClient, Plan } from "@prisma/client";
import { _decodeChunks } from "openai/streaming.mjs";
const prisma = new PrismaClient();
import { ensureAuthenticated } from "../../../middleware/authMiddleware.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
const PLAN_PRICING = {
    BASIC: { MONTHLY: 999, YEARLY: 8988 },
    PREMIUM: { MONTHLY: 2999, YEARLY: 23988 },
    BUISNESS: { MONTHLY: 9999, YEARLY: 95988 },
};
const remainingPostsMap = {
    BASIC: {
        MONTHLY: 10,
        YEARLY: 120,
    },
    PREMIUM: {
        MONTHLY: 20,
        YEARLY: 240,
    },
    BUISNESS: {
        MONTHLY: 60,
        YEARLY: 720,
    },
};

const generateAccessToken = async () => {
    try {
        if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
            throw new Error("MISSING_API_CREDENTIALS");
        }
        const auth = Buffer.from(
            PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
        ).toString("base64");
        const response = await fetch(`${base}/v1/oauth2/token`, {
            method: "POST",
            body: "grant_type=client_credentials",
            headers: {
                Authorization: `Basic ${auth}`,
            },
        });

        const data = await response.json();

        return data.access_token;
    } catch (error) {
        console.error("Failed to generate Access Token:", error);
    }
};
const createOrder = async (cart) => {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders`;



    const payload = {
        intent: "CAPTURE",
        purchase_units: [
            {
                amount: {
                    currency_code: "USD",
                    value: cart[0].unit_amount.value,
                },
                description: `${cart[0].name} (${cart[0].billingCycle}) (${cart[0].id})`,
            },
        ],
    };

    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
        body: JSON.stringify(payload),
    });

    return handleResponse(response);
};
const captureOrder = async (orderID) => {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders/${orderID}/capture`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return handleResponse(response);
};

async function handleResponse(response) {
    try {
        const jsonResponse = await response.json();
        return {
            jsonResponse,
            httpStatusCode: response.status,
        };
    } catch (err) {
        const errorMessage = await response.text();
        throw new Error(errorMessage);
    }
}

router.post("/paypal/orders", ensureAuthenticated, async (req, res) => {
    logInfo(
        `going to create an order for the user ${req.userId}`,
        path.basename(__filename),
        createOrder
    );
    try {
        const now = new Date();

        const activeSubscription = await prisma.subscription.findFirst({
            where: {
                userId: req.userId,
                status: "ACTIVE",
                plan: {
                    not: Plan.FREE,
                },

                nextDueDate: {
                    gte: now,
                },
            },
        });

        if (activeSubscription) {
            return res.status(400).json({ message: "you have already plan exist" });
        }

        const { cart } = req.body;

        const { jsonResponse, httpStatusCode } = await createOrder(cart);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ error: "Failed to create order." });
    }
});

router.post(
    "/paypal/orders/:orderID/capture",
    ensureAuthenticated,
    async (req, res) => {
        const { orderID } = req.params;
        const { cart } = req.body;


        logInfo(
            `going to capture the order id for user ${req.userId}`,
            path.basename(__filename),
            captureOrder
        );

        try {
            const { jsonResponse, httpStatusCode } = await captureOrder(orderID);

            if (httpStatusCode === 201) {
                try {
                    await prisma.$transaction(async (prisma) => {
                        await handlePaymentSubcription(
                            jsonResponse,
                            req.userId,
                            cart,
                            prisma
                        );
                    });

                    return res.status(httpStatusCode).json(jsonResponse);
                } catch (dbError) {
                    logError(dbError, path.basename(__filename));

                    global.pendingPayments[jsonResponse.id] = {
                        jsonResponse,
                        userId: req.userId,
                        cart,
                    };

                    return res.status(500).json({
                        error:
                            "Payment processed successfully, but there was an issue with your subscription. Please contact support.",
                    });
                }
            } else {
                return res
                    .status(httpStatusCode)
                    .json({ error: "Payment capture failed.", details: jsonResponse });
            }
        } catch (error) {
            logError(error, path.basename(__filename));
            res
                .status(500)
                .json({
                    error:
                        "An unexpected error occurred while processing your payment. Please contact support.",
                });
        }
    }
);

function validatePaymentAndGetPlan(amount) {
    const intAmount = Math.round(parseFloat(amount) * 100);





    for (const [plan, pricing] of Object.entries(PLAN_PRICING)) {


        if (intAmount === pricing.MONTHLY) {

            return { plan, billingCycle: "MONTHLY" };
        } else if (intAmount === pricing.YEARLY) {

            return { plan, billingCycle: "YEARLY" };
        }
    }

    return null;
}


const handlePaymentSubcription = async (
    paypalResponse,
    userId,
    cart,
    prisma
) => {
    logInfo(
        `going to update the user information of subscription detail for user ${userId}`,
        path.basename(__filename),
        handlePaymentSubcription
    );



    try {
        const amount = parseFloat(
            paypalResponse.purchase_units[0].payments.captures[0].amount.value
        );

        await prisma.payment.create({
            data: {
                paymentDate: new Date(),
                userId: userId,
                amount: parseFloat(
                    paypalResponse.purchase_units[0].payments.captures[0].amount.value
                ),
                status: "COMPLETED",
                payerId: paypalResponse.payer.payer_id,
                paymentId: paypalResponse.id,
            },
        });



        const validate = validatePaymentAndGetPlan(amount);


        const { plan: planName, billingCycle } = validate;
        const remainingPosts = remainingPostsMap[planName][billingCycle];



        const currentDate = new Date();
        const endDate =
            billingCycle === "MONTHLY"
                ? new Date(currentDate.setMonth(currentDate.getMonth() + 1))
                : new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));

        await prisma.subscription.upsert({
            where: { userId: userId },
            update: {
                plan: planName,
                status: "ACTIVE",
                startDate: new Date(),
                nextDueDate: endDate,
                billingCycle: billingCycle,
                remainingPosts: remainingPosts,
            },
            create: {
                userId: userId,
                plan: planName,
                status: "ACTIVE",
                startDate: new Date(),
                nextDueDate: endDate,
                billingCycle: billingCycle,
                remainingPosts: remainingPosts,
            },
        });


    } catch (error) {
        logError(
            `Error handling payment subscription for user ${userId} ${error}:`, path.basename(__filename));


    }
};

validatePaymentAndGetPlan(959.88);

export default router;
