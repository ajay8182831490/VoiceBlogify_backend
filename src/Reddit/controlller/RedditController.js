import { PrismaClient } from "@prisma/client";
import { logError, logInfo } from "../../utils/logger.js";
import path from 'path';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

export const connect_to_reddit = async (req, res) => {

    logInfo(`Connecting user ${req.userId} to Reddit platform`, path.basename(__filename), connect_to_reddit);

    try {
        const Reddit_accessToken = req.Reddit_accessToken;
        res.status(201).json({ message: "connected successully", Reddit_accessToken });
    } catch (error) {
        logError(error, path.basename(__filename), connect_to_reddit);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const to_reddit = async (req, res) => {
    const { userId } = req;

    const redirectUri = 'http://localhost:4000/auth/reddit/callback';
    const redditAuthUrl = `https://www.reddit.com/api/v1/authorize?client_id=${process.env.REDDIT_CLIENT}&response_type=code&state=${userId}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=read,submit`;

    logInfo(`Redirecting user ${userId} to Reddit authorization`, path.basename(__filename), to_reddit);
    res.redirect(redditAuthUrl);
}
export const check = async (req, res) => {
    res.json("helo");
}


export const getRedditToken = async (code, userId) => {
    console.log("inside getRedditToken");
    console.log(code, "code");

    try {
        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT}:${process.env.REDDIT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'http://localhost:4000/auth/reddit/callback'
            })
        });

        console.log("response", response);

        if (!response.ok) {
            const errorText = await response.text();
            logError(`Failed to get access token from Reddit: ${response.statusText} - ${errorText}`, path.basename(__filename), getRedditToken);
            return null;
        }

        const data = await response.json();

        if (data.access_token) {
            await prisma.token.create({
                data: {
                    userId: userId,
                    platform: 'REDDIT',
                    expiryTime: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token
                }
            });

            logInfo(`Successfully connected user ${userId} to Reddit`, path.basename(__filename), getRedditToken);
            return data.access_token;
        } else {
            logError('Access token not found in Reddit response.', path.basename(__filename), getRedditToken);
            return null;
        }
    } catch (error) {
        logError(error, path.basename(__filename), getRedditToken);
        return null;
    }
};