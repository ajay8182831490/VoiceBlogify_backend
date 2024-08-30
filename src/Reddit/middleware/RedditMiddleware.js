import { PrismaClient } from "@prisma/client";
import { logInfo, logError } from "../../utils/logger.js";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
import { getRedditToken } from "../controlller/RedditController.js";

const prisma = new PrismaClient();

const checkAndRenewRedditToken = async (req, res, next) => {
    const { userId } = req;


    const { code } = req.query; // Ensure code is extracted from query params

    logInfo(
        `Verifying Reddit token for user ${userId}`,
        path.basename(__filename),
        checkAndRenewRedditToken
    );

    try {
        // Check if token exists for the Reddit platform
        const existingRedditToken = await prisma.token.findFirst({
            where: {
                userId: userId,
                platform: "REDDIT",
            },
        });

        if (existingRedditToken) {
            const isTokenExpired = checkIfTokenExpired(
                existingRedditToken.expiryTime
            );

            if (isTokenExpired) {
                // Renew the token if expired
                const newTokenData = await renewRedditToken(
                    existingRedditToken.refreshToken
                );

                if (!newTokenData) {
                    throw new Error("Failed to renew Reddit token");
                }

                // Update the token in the database
                await prisma.token.update({
                    where: {
                        userId: userId,
                        platform: "REDDIT",
                    },
                    data: {
                        accessToken: newTokenData.access_token,
                        refreshToken: newTokenData.refresh_token,
                        expiryTime: new Date(
                            Date.now() + newTokenData.expires_in * 1000
                        ).toISOString(),
                    },
                });

                req.Reddit_accessToken = newTokenData.access_token;

                logInfo(
                    "Reddit token renewed successfully",
                    path.basename(__filename),
                    checkAndRenewRedditToken
                );
            } else {
                req.Reddit_accessToken = existingRedditToken.accessToken;
            }



        } else {
            // Ensure code is provided before calling getRedditToken
            if (!code) {
                const redirectUri = "http://localhost:4000/auth/reddit/callback";
                const redditAuthUrl = `https://www.reddit.com/api/v1/authorize?client_id=${process.env.REDDIT_CLIENT
                    }&response_type=code&state=${userId}&redirect_uri=${encodeURIComponent(
                        redirectUri
                    )}&duration=permanent&scope=read,submit,flair,identity,mysubreddits,subscribe,modflair`;

                logInfo(
                    `Redirecting user ${userId} to Reddit authorization`,
                    path.basename(__filename),
                    checkAndRenewRedditToken
                );
                return res.redirect(redditAuthUrl);
            }

            const newRedditAccessToken = await getRedditToken(code, userId);

            if (!newRedditAccessToken) {
                return res
                    .status(400)
                    .json({ message: "Failed to get Reddit access token." });
            }



            req.Reddit_accessToken = newRedditAccessToken;
        }
        console.log(req.Reddit_accessToken)
        next();
    } catch (error) {
        logError(error, path.basename(__filename), checkAndRenewRedditToken);
        res.status(500).json({ message: "Internal server error" });
    }
};

const checkIfTokenExpired = (expiryTime) => {
    return new Date() > new Date(expiryTime);
};

const renewRedditToken = async (refreshToken) => {
    logInfo("Renewing Reddit token", path.basename(__filename), renewRedditToken);

    try {
        const response = await fetch("https://www.reddit.com/api/v1/access_token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${Buffer.from(
                    `${process.env.REDDIT_CLIENT}:${process.env.REDDIT_SECRET}`
                ).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            logError(
                "Failed to renew Reddit token: " + response.statusText,
                path.basename(__filename),
                renewRedditToken
            );
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

export const submitRedditPost = async (req, res) => {

    logInfo(`Attempting to post on Reddit for user ${req.userId}`, path.basename(__filename), submitRedditPost);

    const {
        subreddit, title, text, kind = 'self', url = "", nsfw = false, spoiler = false, sendreplies = true, flairId, flairText,
    } = req.body;

    const { Reddit_accessToken } = req.body;

    const modhash = req.headers['x-modhash'] || '';
    try {
        const params = new URLSearchParams({
            api_type: 'json',
            sr: subreddit, // Only include subreddit if present
            title: title,
            kind: kind,
            nsfw: nsfw,
            spoiler: spoiler,
            sendreplies: sendreplies,
        });


        if (kind === 'self') {
            params.append('text', text); // Add text for self-posts
        } else if (kind === 'link' && url) {
            params.append('url', url); // Add URL for link posts
        }

        if (modhash) {
            params.append('uh', modhash);
        }


        if (subreddit && flairId && flairText) {
            params.append('flair_id', flairId);
            params.append('flair_text', flairText);
        }

        const response = await fetch('https://oauth.reddit.com/api/submit', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Reddit_accessToken}`,
                'User-Agent': process.env.USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        console.log(`Response Status: ${response.status}`);
        console.log(`Response Headers: ${JSON.stringify([...response.headers])}`);

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            const errorText = contentType && contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            logError(`Failed to post on Reddit: ${response.status} - ${response.statusText} - ${JSON.stringify(errorText)}`, path.basename(__filename));
            return res.status(response.status).json({ message: `Failed to post on Reddit: ${response.statusText}`, error: errorText });
        }

        const responseData = await response.json();
        console.log(`Response Data: ${JSON.stringify(responseData)}`);

        if (responseData && responseData.json && responseData.json.errors && responseData.json.errors.length > 0) {
            logError(`Reddit API error: ${JSON.stringify(responseData.json.errors)}`, path.basename(__filename), submitRedditPost);
            return res.status(400).json({ message: "Error from Reddit API", errors: responseData.json.errors });
        }

        logInfo(`Successfully submitted post to Reddit: ${responseData.json.data.url}`, path.basename(__filename), submitRedditPost);
        res.status(201).json({ message: "Post submitted successfully", url: responseData.json.data.url });
    } catch (error) {
        logError(`Error submitting post to Reddit: ${error.message}`, path.basename(__filename));
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


export const getRedditPostAnalytics = async () => {

}
export const getUserSubscribedSubreddits = async (req, res) => {
    const { Reddit_accessToken } = req;


    try {
        const response = await fetch('https://oauth.reddit.com/subreddits/mine/subscriber', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${Reddit_accessToken}`,
                'User-Agent': process.env.USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });


        if (!response.ok) {
            const errorText = await response.text();
            logError(`Failed to fetch subscribed subreddits: ${response.status} - ${response.statusText} - ${errorText}`, path.basename(__filename), getUserSubscribedSubreddits);
            return res.status(response.status).json({ message: `Failed to fetch subscribed subreddits: ${response.statusText}` });
        }


        const data = await response.json();


        const subreddits = data.data.children.map(subreddit => ({
            name: subreddit.data.display_name,
            title: subreddit.data.title,



        }));


        res.status(200).json({ subreddits });

    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
};