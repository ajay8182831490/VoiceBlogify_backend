import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
import { PrismaClient } from "@prisma/client";
import { logError, logInfo } from "../../utils/logger.js";
import axios from "axios";
import path from "path";

const prisma = new PrismaClient();


const mediumUrl = async (req, res, next) => {
    logInfo(`Connecting to Medium for user ${req.userId}`, path.basename(__filename));

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




        req.mediumApi = mediumApi;
        req.mediumUserId = mediumUserId;

        next();
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

export default mediumUrl





