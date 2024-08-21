import { logError, logInfo } from "../../utils/logger.js";
import axios from "axios";
import path from 'path'
import { fileURLToPath } from 'url';

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const clientId = process.env.lclientid;
const redirectUri = encodeURIComponent(process.env.lurl);
const state = encodeURIComponent(process.env.lstate);
const scope = encodeURIComponent(process.env.lscope);

const __filename = fileURLToPath(import.meta.url);
export const connect_to_linkedin = async (req, res) => {
    logInfo(`going to connect the user ${req.userId} with linkedin `, path.basename(__filename), connect_to_linkedin);

    try {
        const authorizationCode = req.query.code;
        const accessToken = await getAccessToken(authorizationCode);


        try {
            const response = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,

                },
            });
            console.log(response)
            if (response.ok) {
                const data = await response.json();
                console.log('User ID:', data);
                return data;
            } else {
                console.error('Error fetching user ID:', response.status, response.statusText);
                const errorData = await response.json();
                console.error('Error Details:', errorData);
            }
        } catch (error) {
            console.error('Error fetching user ID:', error.message);
        }




        // await prisma.user.create({
        //     where: { userId: req.userId }, data: {
        //         platform: 'likedin',
        //         token: accessToken.access_token,

        //     }
        // })
        console.log(userResponse)
        res.status(200).json({ Message: "succesfully connected" });
    } catch (ex) {
        logError(ex, path.basename(__filename));
        res.status(500).json("internal error");

    }
}



async function getAccessToken(authorizationCode) {
    const url = 'https://www.linkedin.com/oauth/v2/accessToken';
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: process.env.lurl,
        client_id: process.env.lclientid,
        client_secret: process.env.lclientsecret,
    });

    try {
        const response = await axios.post(url, params);
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.response.data);
    }
}

export const to_linkedin = async (req, res) => {
    try {


        logInfo(`going to connect the user ${req.userId}`, path.basename(__filename), to_linkedin);
        const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.lclientid}&redirect_uri=${encodeURIComponent(process.env.lurl)}&state=${encodeURIComponent(process.env.lstate)}&scope=${encodeURIComponent('openid profile email w_member_social')}`;
        ;

        res.redirect(authUrl);

    } catch (ex) {
        logError(ex, path.basename(__filename));
        res.status(500).json("internal error");

    }
}