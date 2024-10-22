import { logError, logInfo } from "../../utils/logger.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();
import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify';
const window = (new JSDOM('')).window;
const purify = DOMPurify(window);




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

    logInfo(`Going to disconnect LinkedIn for user ${userId}`, path.basename(__filename));

    try {
        const res1 = await prisma.token.delete({
            where: {
                userId_platform: {
                    userId: userId,
                    platform: 'LINKEDIN'
                }
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
    logInfo(`going to disconnect the medium for user ${req.userId}`, path.basename(__filename));

    try {
        await prisma.token.delete({
            where: {
                userId_platform: {
                    userId: userId,
                    platform: 'MEDIUM'

                }
            },

        });


        res.status(200).json({ message: "Successfully disconnected from Medium." });
    } catch (error) {
        logError(error, path.basename(__filename), disconnect_medium);
        res.status(500).json({ message: "Internal server error" });
    }
}


export const feedBack = async (req, res) => {
    logInfo(`going to add the feedback from user ${req.userId}`, path.basename(__filename), feedBack);
    try {

        let { content } = req.body;

        content = purify.sanitize(content);
        if (!content) {
            res.status(400).json({ message: "missing field required" });

        }

        await prisma.feedBack.create({ data: { userId: req.userId, content: content } });
        res.status(200).json({ message: "thanks for your feedback" })


    } catch (error) {
        res.status(500).json({ message: "internal server error" });
    }
}

