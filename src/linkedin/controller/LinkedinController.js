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
    logInfo(`Connecting user ${3/*req.userId*/} with LinkedIn`, path.basename(__filename), connect_to_linkedin);

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


export const share_linkedin = async (req, res) => {


    // what we will do here here we will validate the 

    try {



        const { linkedinToken, personId } = req;
        const { description } = req.body;
        const images = req.files?.images || []; // If no images, fallback to an empty array
        const video = req.files?.video;




        if (images.length && video) {
            return res.status(400).json({ message: "You can only post either images or a video, not both." });
        }

        let imageUrls = [];
        if (images.length > 0) {


            imageUrls = await Promise.all(images.map(async (image) => {

                const uploadResponse = await uploadImageToLinkedIn(linkedinToken, personId, image);

                return uploadResponse.mediaUrl;
            }));
        }



        let videoUrl = null;
        if (video) {
            const videoResponse = await uploadVideoToLinkedIn(linkedinToken, personId, video);
            videoUrl = videoResponse.mediaUrl;
        }

        const postResponse = await createLinkedInPost(linkedinToken, personId, description, imageUrls, videoUrl);



        res.status(200).json({ message: 'Post created successfully', postResponse });



    } catch (ex) {

        logError(ex, path.basename(__filename));
        res.status(500).json({ message: "internal server error" });

    }
}


const uploadImageToLinkedIn = async (accessToken, personId, image) => {
    try {



        const uploadUrlResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                registerUploadRequest: {
                    owner: `urn:li:person:${personId}`,
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                    serviceRelationships: [{
                        relationshipType: "OWNER",
                        identifier: "urn:li:userGeneratedContent"
                    }]
                }
            })
        });

        const uploadUrlData = await uploadUrlResponse.json();


        const { uploadUrl, asset } = uploadUrlData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"];

        await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': image.mimetype
            },
            body: image.buffer
        });

        return {
            mediaUrl: uploadUrlData.value.asset
        };
    } catch (error) {
        logError(`Error uploading image to LinkedIn: ${error.message}`, path.basename(__filename));
        throw new Error("Image upload failed");
    }
};

const uploadVideoToLinkedIn = async (accessToken, personId, video) => {
    try {


        const uploadUrlResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                registerUploadRequest: {
                    owner: `urn:li:person:${personId}`,
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
                    serviceRelationships: [{
                        relationshipType: "OWNER",
                        identifier: "urn:li:userGeneratedContent"
                    }]
                }
            })
        });



        const uploadUrlData = await uploadUrlResponse.json();


        const { uploadUrl } = uploadUrlData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"];

        await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': video.mimetype
            },
            body: video.buffer
        });

        return {
            mediaUrl: uploadUrlData.value.asset
        };
    } catch (error) {
        logError(`Error uploading video to LinkedIn: ${error.message}`, path.basename(__filename));
        throw new Error("Video upload failed");
    }
};

const createLinkedInPost = async (accessToken, personId, description, imageUrls = [], videoUrl = null) => {
    try {


        const postData = {
            author: `urn:li:person:${personId}`,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: {
                        text: description
                    },
                    shareMediaCategory: videoUrl
                        ? "VIDEO"
                        : imageUrls.length > 0
                            ? "IMAGE"
                            : "NONE",
                    media: videoUrl
                        ? [{
                            status: "READY",
                            media: videoUrl,
                            mediaType: "VIDEO"
                        }]
                        : imageUrls.map(imageUrl => ({
                            status: "READY",
                            media: imageUrl,
                            mediaType: "IMAGE"
                        }))
                }
            },
            visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        };



        const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify(postData)
        });




        if (response.ok) {
            return await response.json();
        } else {
            const errorData = await response.json();
            logError(`Error posting to LinkedIn: ${response.status} ${response.statusText}`, path.basename(__filename));
            logError(`Error Details: ${JSON.stringify(errorData)}`, path.basename(__filename));
            throw new Error("Failed to post on LinkedIn");
        }
    } catch (error) {
        logError(`Error in creating LinkedIn post: ${error.message}`, path.basename(__filename));
        throw new Error("LinkedIn post creation failed");
    }
};


