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
                    )}&duration=permanent&scope=read,submit`;

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
    logInfo(`Attempting to post on Reddit for user ${/*req.user.id*/3}`, path.basename(__filename), submitRedditPost);

    // Destructure the request body
    const { subreddit, title, text, kind = 'self', url, nsfw = false, spoiler = false, sendreplies = true } = req.body;

    // The Reddit access token and modhash (if needed) should ideally be passed in the headers or retrieved securely.
    const Reddit_accessToken = /*req.headers.authorization || "your_access_token_here";*/ "eyJhbGciOiJSUzI1NiIsImtpZCI6IlNIQTI1NjpzS3dsMnlsV0VtMjVmcXhwTU40cWY4MXE2OWFFdWFyMnpLMUdhVGxjdWNZIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyIiwiZXhwIjoxNzI1MDEyNTI2Ljk1ODk5MSwiaWF0IjoxNzI0OTI2MTI2Ljk1ODk5LCJqdGkiOiJLWlZoSU94X2ZHRmc0Zng0X01DLWVPQlNKTzRlUnciLCJjaWQiOiJwMXRYSy12RjdnRWJQV3QxLVpSMWRBIiwibGlkIjoidDJfMTdsMnMzOHZqayIsImFpZCI6InQyXzE3bDJzMzh2amsiLCJsY2EiOjE3MjQ4MTk5OTczNTgsInNjcCI6ImVKeUtWaXBLVFV4UjBsRXFMazNLelN4UmlnVUVBQURfX3pGR0JaMCIsInJjaWQiOiJ3LUk0MGVHVzJ3Tjhuc1VTTlNBbEp2b0t6OThKSHozbEtma3hvUlNWT3FjIiwiZmxvIjo4fQ.e2QSOcHZKPpTF_btCAKGzI_yopEFT9JvY91p3MPwaf9Poi2xRCZ5ZrtUjJw6LUPrN0lhoDfDp_vFXmFSgHwwji8SsT7c8FUcaKB08CLyr8JX93LUWLMi92gRBTdQRmJ_qWKRHCH09h4UDUDCM0Yh7oI2Iq9tY-pEsQnY3vZSCKF8X9YMrHrjR3hW-GZPccPVaRCz8uOl2i2VxRbgK2dSfanqBo4THIBFry7w_T1QspVU89Di2TzSrqV_tIpeWO2jpJAPcrZc70pRObpuIS4RUD-RqBgEUGmNZl-x-9M2gIXfxbb_OJlJhDcGPnY7RppN8o6M6y23dJC_YfsouPcKuQ"
    const modhash = req.headers['x-modhash'] || ''; // Optionally include the modhash if provided

    try {
        // Create the parameters object for the request
        const params = new URLSearchParams({
            api_type: 'json',  // Required for Reddit API to expect a JSON response
            sr: subreddit,     // Subreddit name
            title: title,      // Title of the post
            kind: kind,        // Type of post ('link', 'self', 'image', 'video', 'videogif')
            nsfw: nsfw,        // NSFW flag
            spoiler: spoiler,  // Spoiler flag
            sendreplies: sendreplies  // Send comment replies to user's inbox
        });

        // Conditionally add text or URL based on the post type
        if (kind === 'self') {
            params.append('text', text); // Add text for self-posts
        } else if (kind === 'link' && url) {
            params.append('url', url); // Add URL for link posts
        }

        // Optionally add modhash if needed
        if (modhash) {
            params.append('uh', modhash); // Include modhash if it's provided
        }

        const response = await fetch('https://oauth.reddit.com/api/submit', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Reddit_accessToken}`,
                'User-Agent': 'web:saas:1.0 (by /u/your_username)',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        console.log(response)

        // Check if the response is not ok
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            const errorText = contentType && contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            logError(`Failed to post on Reddit: ${response.status} - ${response.statusText} - ${JSON.stringify(errorText)}`, path.basename(__filename));
            return res.status(response.status).json({ message: `Failed to post on Reddit: ${response.statusText}` });
        }

        // Parse the response body
        const responseData = await response.json();
        console.log(responseData);

        // Check if Reddit API responded with an error in the response body
        if (responseData && responseData.json && responseData.json.errors && responseData.json.errors.length > 0) {
            logError(`Reddit API error: ${JSON.stringify(responseData.json.errors)}`, path.basename(__filename), submitRedditPost);
            return res.status(400).json({ message: "Error from Reddit API", errors: responseData.json.errors });
        }

        logInfo(`Successfully submitted post to Reddit: ${responseData.json.data.url}`, path.basename(__filename), submitRedditPost);
        res.status(201).json({ message: "Post submitted successfully", url: responseData.json.data.url });

    } catch (error) {
        logError(`Error submitting post to Reddit: ${error.message}`, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
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
                'User-Agent': 'web:saas:1.0 (by /u/abhi_g003)',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log(response);
        if (!response.ok) {
            const errorText = await response.text();
            logError(`Failed to fetch subscribed subreddits: ${response.status} - ${response.statusText} - ${errorText}`, path.basename(__filename), getUserSubscribedSubreddits);
            return res.status(response.status).json({ message: `Failed to fetch subscribed subreddits: ${response.statusText}` });
        }


        const data = await response.json();
        console.log(data);
        const subreddits = data.data.children.map(subreddit => ({
            name: subreddit.data.display_name,
            // title: subreddit.data.title,
            // description: subreddit.data.public_description
        }));


        res.status(200).json({ subreddits });

    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
};