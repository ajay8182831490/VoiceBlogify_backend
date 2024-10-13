import { logInfo, logError } from "../utils/logger.js"

import { Prisma, PrismaClient } from "@prisma/client";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify';
const window = (new JSDOM('')).window;
const purify = DOMPurify(window);
const prisma = new PrismaClient();




const getAllPost = async (req, res) => {
    logInfo(`Fetching all posts for user id ${req.userId}`, path.basename(__filename), getAllPost);

    try {

        //const page = parseInt(req.query.page) || 1;
        //const limit = parseInt(req.query.limit) || 5;
        //const skip = (page - 1) * limit;

        const posts = await prisma.post.findMany({
            where: {
                userId: req.userId
            },
            // take: limit,
            // skip: skip,
            orderBy: {
                dateOfCreation: 'desc'
            }
        });


        if (!posts || posts.length === 0) {
            return res.status(404).json({ message: "No posts found for this user." });
        }

        res.status(200).json({ posts: posts });
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
}

const getUserPost = async (req, res) => {
    const postId = parseInt(req.params.postId, 10);
    logInfo(`going to excess the user  post of user id ${req.userId} with postId ${postId}`, path.basename(__filename), getAllPost);

    try {

        const post = await prisma.post.findUnique({
            where: {
                id: postId
            }
        })
        if (!post) {
            return res.status(400).json({ message: "no post found" });
        }
        res.status(200).json(post);

    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json("internal server error");
    }


}
const deleteUserPost = async (req, res) => {
    const postId = parseInt(req.params.postId, 10);
    logInfo(`Going to delete the post of user id ${req.userId} with postId ${postId}`, path.basename(__filename), deleteUserPost);

    try {

        const deletedPost = await prisma.post.delete({
            where: {
                id: postId,
                userId: req.userId
            }
        });


        res.status(200).json({ message: "Post deleted successfully.", deletedPost });

    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Post not found or you do not have permission to delete it." });
        }
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
}

const updateUserPost = async (req, res) => {
    const postId = parseInt(req.params.postId, 10);
    logInfo(`Going to update the user post of user id ${req.userId} with postId ${postId}`, path.basename(__filename), updateUserPost);

    try {
        let { title, subtitle, tag, content } = req.body;








        if (!title && !subtitle && !tag && !content) {
            return res.status(400).json({ message: "At least one field must be provided for update." });
        }



        title = title ? purify.sanitize(title) : undefined;
        subtitle = subtitle ? purify.sanitize(subtitle) : undefined;
        const tags = tag ? Array.isArray(tag) ? tag.map(t => purify.sanitize(t)) : [purify.sanitize(tag)] : undefined;
        content = content ? purify.sanitize(content) : undefined;


        const existingPost = await prisma.post.findFirst({
            where: {
                id: postId,
                userId: req.userId
            }
        });



        if (!existingPost) {
            return res.status(404).json({ message: "Post not found or you do not have permission to update it." });
        }

        const updateData = {
            ...(title && { title }),
            ...(subtitle && { subtitle }),
            ...(tags && { tags }),
            ...(content && { content })
        };

        await prisma.post.update({
            where: {
                id: postId
            },
            data: updateData
        });


        res.status(200).json({ message: "Post updated successfully." });
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
}


const saveUserPost = async (req, res) => {
    logInfo(`Going to save the user post of user id ${req.userId}`, path.basename(__filename), saveUserPost);

    try {
        let { title, subtitle, tag, content } = req.body;


        if (!title && !subtitle && !tag && !content) {
            return res.status(400).json({ message: "At least one field must be provided for the post." });
        }


        title = title ? purify.sanitize(title) : undefined;
        subtitle = subtitle ? purify.sanitize(subtitle) : undefined;
        const tags = tag ? Array.isArray(tag) ? tag.map(t => purify.sanitize(t)) : [purify.sanitize(tag)] : undefined;
        content = content ? purify.sanitize(content) : undefined;


        const createData = {
            ...(title && { title }),
            ...(subtitle && { subtitle }),
            ...(tags && { tags }),
            ...(content && { content })
        };


        const newPost = await prisma.post.create({
            data: {
                userId: req.userId,
                ...createData
            }
        });

        res.status(201).json({ message: "Post created successfully.", postId: newPost.id }); // Return the new post ID
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
}



export { getUserPost, getAllPost, deleteUserPost, updateUserPost, saveUserPost }