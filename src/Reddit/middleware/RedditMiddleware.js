import { PrismaClient } from "@prisma/client";
import { logInfo, logError } from "../../utils/logger.js";
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
import { getRedditToken } from "../controlller/RedditController.js";

const prisma = new PrismaClient();

const checkAndRenewRedditToken = async (req, res, next) => {
    const { userId } = req;
    const { code } = req.query; // Ensure code is extracted from query params

    logInfo(`Verifying Reddit token for user ${userId}`, path.basename(__filename), checkAndRenewRedditToken);

    try {
        // Check if token exists for the Reddit platform
        const existingRedditToken = await prisma.token.findFirst({
            where: {
                userId: userId,
                platform: 'REDDIT',
            }
        });

        if (existingRedditToken) {
            const isTokenExpired = checkIfTokenExpired(existingRedditToken.expiryTime);

            if (isTokenExpired) {
                // Renew the token if expired
                const newTokenData = await renewRedditToken(existingRedditToken.refreshToken);

                if (!newTokenData) {
                    throw new Error('Failed to renew Reddit token');
                }

                // Update the token in the database
                await prisma.token.update({
                    where: {
                        userId: userId,
                        platform: 'REDDIT'
                    },
                    data: {
                        accessToken: newTokenData.access_token,
                        refreshToken: newTokenData.refresh_token,
                        expiryTime: new Date(Date.now() + (newTokenData.expires_in * 1000)).toISOString()
                    }
                });

                req.Reddit_accessToken = newTokenData.access_token;


                logInfo('Reddit token renewed successfully', path.basename(__filename), checkAndRenewRedditToken);
            } else {

                req.Reddit_accessToken = existingRedditToken.accessToken;
            }
        } else {
            // Ensure code is provided before calling getRedditToken
            if (!code) {
                const redirectUri = 'http://localhost:4000/auth/reddit/callback';
                const redditAuthUrl = `https://www.reddit.com/api/v1/authorize?client_id=${process.env.REDDIT_CLIENT}&response_type=code&state=${userId}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=read,submit`;

                logInfo(`Redirecting user ${userId} to Reddit authorization`, path.basename(__filename), checkAndRenewRedditToken);
                return res.redirect(redditAuthUrl);
            }

            const newRedditAccessToken = await getRedditToken(code, userId);

            if (!newRedditAccessToken) {
                return res.status(400).json({ message: 'Failed to get Reddit access token.' });
            }

            req.Reddit_accessToken = newRedditAccessToken;
        }

        next();
    } catch (error) {
        logError(error, path.basename(__filename), checkAndRenewRedditToken);
        res.status(500).json({ message: "Internal server error" });
    }
};

const checkIfTokenExpired = (expiryTime) => {
    return new Date() > new Date(expiryTime);
}

const renewRedditToken = async (refreshToken) => {
    logInfo('Renewing Reddit token', path.basename(__filename), renewRedditToken);

    try {
        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT}:${process.env.REDDIT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            logError('Failed to renew Reddit token: ' + response.statusText, path.basename(__filename), renewRedditToken);
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        logError(error, path.basename(__filename), renewRedditToken);
        return null;
    }
};

export { checkAndRenewRedditToken };
