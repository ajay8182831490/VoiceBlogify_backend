import { PrismaClient } from "@prisma/client";
import { logError, logInfo } from "../../utils/logger.js";
import { getAccessToken } from "../controller/LinkedinController.js";
import path from 'path'
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const prisma = new PrismaClient();

export const linkedinMiddleware = async (req, res, next) => {
    logInfo(`going to connect the user with linkedin ${req.userId}`, path.basename(__filename), linkedinMiddleware)
    try {
        const existingToken = await prisma.token.findFirst({
            where: {
                userId: req.userId,
                platform: "LINKEDIN",
            },
        });



        if (existingToken) {
            const response = await fetch("https://api.linkedin.com/v2/userinfo", {
                headers: {
                    Authorization: `Bearer ${existingToken.accessToken}`,
                },
            });

            if (response.ok) {
                req.personId = existingToken.platformUserId;
                req.linkedinToken = existingToken.accessToken;

                return next();
            } else {
                const authorizationCode = req.query.code;
                const newAccessToken = await getAccessToken(authorizationCode);
                req.linkedinToken = newAccessToken;

                // Call the API for user info to validate the new token
                const userInfoResponse = await fetch(
                    "https://api.linkedin.com/v2/userinfo",
                    {
                        headers: {
                            Authorization: `Bearer ${newAccessToken}`,
                        },
                    }
                );

                if (userInfoResponse.ok) {
                    const data = await userInfoResponse.json();
                    await prisma.token.update({
                        where: {
                            id: existingToken.id,
                        },
                        data: {
                            accessToken: newAccessToken,
                            platformUserId: data.sub,
                        },
                    });

                    req.personId = data.sub;

                    return next();
                } else {
                    return res
                        .status(401)
                        .json({ message: "Failed to retrieve user info with new token" });
                }
            }
        } else {


            const authorizationCode = req.query.code;

            if (!authorizationCode) {
                return res.redirect('/auth/linkedin'); // Redirect to login if no authorization code
            }

            const newAccessToken = await getAccessToken(authorizationCode);
            req.linkedinToken = newAccessToken;

            // Call the API for user info
            const response = await fetch("https://api.linkedin.com/v2/userinfo", {
                headers: {
                    Authorization: `Bearer ${newAccessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                await prisma.token.create({
                    data: {
                        userId: req.userId,
                        platform: "LINKEDIN",
                        accessToken: newAccessToken,
                        platformUserId: data.sub,
                    },
                });

                req.personId = data.sub;

                next();
            } else {
                res
                    .status(401)
                    .json({
                        message: "Failed to retrieve user info, please try again later",
                    });
            }
        }
    } catch (error) {
        logError(
            `Error in LinkedIn middleware: ${error.message}`,
            path.basename(__filename)
        );
        res.status(500).json({ message: "Internal error in LinkedIn middleware" });
    }
};
