import { logError, logInfo } from "../../utils/logger.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();



const remainingPostsByPlan = {
    FREE: 1,
    BASIC: 10,
    PREMIUM: 20,
    BUSINESS: 60,
};





export const getUserProfile = async (req, res) => {
    logInfo(`going to fetch the user profile information of user ${req.userId}`, path.basename(__filename), getUserProfile);

    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: {
                subscriptions: {
                    select: {
                        plan: true,
                        status: true,
                        nextDueDate: true,
                        remainingPosts: true,
                    },
                },
                tokens: {
                    select: {
                        mediumApi: true,
                        mediumUserId: true,
                        platform: true,
                        accessToken: true
                    },
                },
                payments: {
                    orderBy: {
                        paymentDate: 'desc',
                    },
                    take: 1,
                },
            },
        });


        const linkedInTokenExists = user.tokens.some(token => {
            return token.platform === 'LINKEDIN' && token.accessToken !== null
        });


        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const today = new Date();
        const nextDueDate = new Date(today);
        nextDueDate.setDate(today.getDate() + 7);

        const validToken = user.tokens.find(token => token.mediumApi !== null && token.mediumUserId !== null);

        const response = {
            name: user.name,
            email: user.email,
            profilePicUrl: user.profilepic,
            isVerified: user.isVerified,
            totalBlogsCreated: user.blogCount,
            totalRemainingPosts: user.subscriptions.length > 0 ? user.subscriptions[0].remainingPosts : 0,
            nextDueDate: user.subscriptions.length > 0 && user.subscriptions[0].plan === 'FREE'
                ? today.toISOString()
                : user.subscriptions.length > 0 ? user.subscriptions[0].nextDueDate : nextDueDate.toISOString(),
            planPurchased: user.subscriptions.length > 0 ? user.subscriptions[0].plan : null,
            lastPaymentDate: user.payments.length > 0 ? user.payments[0].paymentDate : null,
            status: user.subscriptions.length > 0 ? user.subscriptions[0].status : null,
            MediumUrl: validToken ? validToken.mediumApi : undefined,
            MediumPersonId: validToken ? validToken.mediumUserId : undefined,

            linkedInTokenExists
        };




        return res.status(200).json(response);
    } catch (error) {
        logError(error, path.basename(__filename));

        if (!res.headersSent) {
            return res.status(500).json({ message: "Internal server error" });
        }
    }
};

export const disconnect_linkedin = async (req, res) => {
    const { userId } = req;

    try {
        await prisma.token.update({
            where: { userId: userId, platform: 'LINKEDIN' },
            data: {
                accessToken: ""
            }
        });

        res.status(200).json({ message: "Successfully disconnected from LinkedIn." });
    } catch (error) {
        logError(error, path.basename(__filename), disconnect_linkedin);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const disconnect_medium = async (req, res) => {
    const { userId } = req;

    try {
        await prisma.token.update({
            where: { userId: userId },
            data: {
                mediumApi: "",
                mediumUserId: ''
            }
        });

        res.status(200).json({ message: "Successfully disconnected from Medium." });
    } catch (error) {
        logError(error, path.basename(__filename), disconnect_medium);
        res.status(500).json({ message: "Internal server error" });
    }
}

