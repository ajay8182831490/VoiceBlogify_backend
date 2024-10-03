import { fileURLToPath } from "url";
import { validationResult, param, body } from "express-validator";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { logError, logInfo } from "../../utils/logger.js";
import path from "path";
import FormData from "form-data";

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify';
import { platform } from "os";
const window = (new JSDOM('')).window;
const purify = DOMPurify(window);

const handleValidationErrors = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
};



const deletePost = async (req, res) => {
    const { postId } = req.params;
    logInfo(`Deleting Medium post for user ${req.userId}`, path.basename(__filename), deletePost);

    handleValidationErrors(req, res);

    try {
        const mediumToken = await prisma.token.findFirst({
            where: {
                userId: req.userId,
                platform: 'MEDIUM'
            },
            select: {
                mediumApi: true
            }
        });


        if (!mediumToken) {
            return res.status(400).json({ message: "Please connect to Medium by providing an integration token." });
        }


        const mediumApi = axios.create({
            baseURL: 'https://api.medium.com/v1',
            headers: {
                Authorization: `Bearer ${mediumToken.mediumApi}`,
                'Content-Type': 'application/json',
            },
        });





        await mediumApi.delete(`/posts/${postId}`);
        res.status(200).json({
            message: "Post deleted successfully",
        });
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Error deleting post", error: error.message });
    }
};

const getPostById = async (req, res) => {
    logInfo(`Fetching Medium post for user ${req.userId}`, path.basename(__filename), getPostById);

    handleValidationErrors(req, res);

    try {
        const { postId } = req.params;
        const mediumToken = await prisma.token.findFirst({
            where: {
                userId: req.userId,
                platform: 'MEDIUM'
            },
            select: {
                mediumApi: true
            }
        });


        if (!mediumToken) {
            return res.status(400).json({ message: "Please connect to Medium by providing an integration token." });
        }


        const mediumApi = axios.create({
            baseURL: 'https://api.medium.com/v1',
            headers: {
                Authorization: `Bearer ${mediumToken.mediumApi}`,
                'Content-Type': 'application/json',
            },
        });



        const post = await mediumApi.get(`/posts/${postId}`);
        res.status(200).json({ message: "successfully fetch the post", data: post.data });
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Error fetching post", error: error.message });
    }
};

const uploadPost = async (req, res) => {
    logInfo(`Attempting to upload a post to Medium for user ${req.userId}`, 'uploadPost', uploadPost);

    // Handle validation errors
    const validationError = handleValidationErrors(req);
    if (validationError) {
        return res.status(400).json({ message: validationError });
    }

    try {
        const { title, content, tag, publishStatus = 'public' } = req.body;


        const sanitizedTitle = purify.sanitize(title);
        const sanitizedContent = purify.sanitize(content);
        const sanitizedTags = Array.isArray(tag) ? tag.map(t => purify.sanitize(t)) : [purify.sanitize(tag)];


        const mediumToken = await prisma.token.findFirst({
            where: {
                userId: req.userId,
                platform: 'MEDIUM'
            },
            select: {
                mediumApi: true
            }
        });


        if (!mediumToken) {
            return res.status(400).json({ message: "Please connect to Medium by providing an integration token." });
        }


        const mediumApi = axios.create({
            baseURL: 'https://api.medium.com/v1',
            headers: {
                Authorization: `Bearer ${mediumToken.mediumApi}`,
                'Content-Type': 'application/json',
            },
        });


        const response1 = await mediumApi.get('/me');
        const { id: mediumUserId } = response1.data.data;



        const response = await mediumApi.post(`/users/${mediumUserId}/posts`, {
            title: sanitizedTitle,
            contentFormat: 'html',
            content: sanitizedContent,
            tags: sanitizedTags,
            publishStatus
        });




        return res.status(201).json({
            message: 'Post uploaded successfully to Medium',
            data: response.data
        });
    } catch (error) {
        logError(error, 'uploadPost');
        return res.status(500).json({ message: 'Error uploading post', error: error.message });
    }
};

const uploadImage = async (req, res) => {
    logInfo(`Uploading image to Medium for user ${req.userId}`, path.basename(__filename), uploadImage);

    try {
        const formData = new FormData();
        formData.append("image", req.file.buffer, req.file.originalname);
        const mediumToken = await prisma.token.findFirst({
            where: {
                userId: req.userId,
                platform: 'MEDIUM'
            },
            select: {
                mediumApi: true
            }
        });


        if (!mediumToken) {
            return res.status(400).json({ message: "Please connect to Medium by providing an integration token." });
        }


        const mediumApi = axios.create({
            baseURL: 'https://api.medium.com/v1',
            headers: {
                Authorization: `Bearer ${mediumToken.mediumApi}`,
                'Content-Type': 'application/json',
            },
        });




        const imageResponse = await mediumApi.post("/images", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        res.status(201).json({
            message: "Image uploaded successfully",
            imageUrl: imageResponse.data.url,
        });
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Error uploading image", error: error.message });
    }
};


export { deletePost, getPostById, uploadPost, uploadImage };
