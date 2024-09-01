import { logError, logInfo } from "../../utils/logger";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export const userPlanSubcriptionInfo = async (req, res, next) => {
    logInfo(`Going to check the user plan for user id ${req.userId} `, path.basename(__filename), userPlanSubcriptionInfo);


    try {



    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "internal server error" });
    }
}