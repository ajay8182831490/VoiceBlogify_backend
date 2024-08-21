import { logError, logInfo } from "../../utils/logger.js";
import axios from "axios";
import path from 'path'
import { fileURLToPath } from 'url';

import { PrismaClient } from "@prisma/client";
import { linkedinMiddleware } from "../middleware/linkedinMiddleware.js";

const prisma = new PrismaClient();
const clientId = process.env.lclientid;
const redirectUri = encodeURIComponent(process.env.lurl);
const state = encodeURIComponent(process.env.lstate);
const scope = encodeURIComponent(process.env.lscope);

const __filename = fileURLToPath(import.meta.url);
export const connect_to_linkedin = async (req, res) => {
    logInfo(`Connecting user ${req.userId} with LinkedIn`, path.basename(__filename), connect_to_linkedin);

    try {
        const accessToken = req.linkedinToken; // Use the token set by the middleware
        const personId = req.personId; // Use the LinkedIn user ID set by the middleware

        res.status(200).json({ message: "Successfully connected to LinkedIn", personId, accessToken });
    } catch (error) {
        logError(`Error connecting to LinkedIn: ${error.message}`, path.basename(__filename));
        res.status(500).json({ error: "Internal error while connecting to LinkedIn" });
    }
};





export async function getAccessToken(authorizationCode) {
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