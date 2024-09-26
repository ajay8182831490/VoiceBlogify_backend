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
    logInfo(`going to fetch the user profile information of user ${req.userId}`, path.basename(__filename), getUserProfile)


    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: {
                subscriptions: {
                    select: {
                        plan: true,
                        status: true,
                        nextDueDate: true,
                        trialEndDate: true,
                        remainingPosts: true,
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

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }


        const totalBlogsCreated = user.blogCount;

        const response = {
            name: user.name,
            email: user.email,
            profilePicUrl: user.profilepic,
            isVerified: user.isVerified,
            totalBlogsCreated: totalBlogsCreated,
            totalRemainingPosts: user.subscriptions[0]?.remainingPosts || 0,
            nextDueDate: user.subscriptions[0]?.nextDueDate || null,
            planPurchased: user.subscriptions[0]?.plan || null,
            lastPaymentDate: user.payments[0]?.paymentDate || null,
            status: user.subscriptions[0]?.status || null,
            trialEndDate: user.subscriptions[0]?.trialEndDate || null,
        };

        res.json(response);
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json("internal server erro")
    }
}

