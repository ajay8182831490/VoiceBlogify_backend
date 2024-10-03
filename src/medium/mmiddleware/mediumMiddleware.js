import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
import { PrismaClient } from "@prisma/client";
import { logError, logInfo } from "../../utils/logger.js";
import axios from "axios";
import path from "path";

const prisma = new PrismaClient();


const mediumUrl = async (req, res) => {
    logInfo(`Connecting to Medium for user ${req.userId}`, path.basename(__filename), mediumUrl);

    try {
        const { integrationToken } = req.body;

        if (!integrationToken) {
            return res.status(401).json({ message: "Please enter a valid integration token key" });
        }

        const mediumApi = axios.create({
            baseURL: 'https://api.medium.com/v1',
            headers: {
                Authorization: `Bearer ${integrationToken}`,
                'Content-Type': 'application/json',
            },
        });

        const response = await mediumApi.get('/me');


        const { id: mediumUserId } = response.data.data;




        await prisma.token.upsert({
            where: {
                userId_platform: {
                    userId: req.userId,
                    platform: 'MEDIUM'
                }
            },
            update: {
                mediumUserId: mediumUserId,
                mediumApi: integrationToken
            },
            create: {
                userId: req.userId,
                platform: 'MEDIUM',
                mediumUserId: mediumUserId,
                mediumApi: integrationToken
            }
        });

        res.status(200).json({ message: "Connected to Medium successfully" });

    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

export default mediumUrl





