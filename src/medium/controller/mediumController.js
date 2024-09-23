import { fileURLToPath } from "url";
import { validationResult, param, body } from "express-validator";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { logError, logInfo } from "../../utils/logger.js";
import path from "path";
import FormData from "form-data"; // Ensure you import FormData

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);

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
        await req.mediumApi.delete(`/posts/${postId}`);
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
        const post = await req.mediumApi.get(`/posts/${postId}`);
        res.status(200).json(post.data);
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Error fetching post", error: error.message });
    }
};

const uploadPost = async (req, res) => {
    logInfo(`Attempting to upload a post to Medium for user ${req.userId}`, 'uploadPost', uploadPost);

    handleValidationErrors(req, res);

    try {
        const { title, content, canonicalUrl, tags, publishStatus = 'public' } = req.body;

        const response = await req.mediumApi.post(`/users/${req.mediumUserId}/posts`, {
            title,
            contentFormat: 'html',
            content,
            canonicalUrl,
            tags,
            publishStatus
        });

        res.status(201).json({
            message: 'Post uploaded successfully to Medium',
            data: response.data
        });
    } catch (error) {
        logError(error, 'uploadPost');
        res.status(500).json({ message: 'Error uploading post', error: error.message });
    }
};

const uploadImage = async (req, res) => {
    logInfo(`Uploading image to Medium for user ${req.userId}`, path.basename(__filename), uploadImage);

    try {
        const formData = new FormData();
        formData.append("image", req.file.buffer, req.file.originalname);

        const imageResponse = await req.mediumApi.post("/images", formData, {
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
