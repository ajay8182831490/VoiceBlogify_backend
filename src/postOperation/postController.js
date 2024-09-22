import { logInfo, logError } from "../utils/logger.js"

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);




const getAllPost = async (req, res) => {
    logInfo(`Fetching all posts for user id ${req.userId}`, path.basename(__filename), getAllPost);

    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const posts = await prisma.post.findMany({
            where: {
                userId: req.userId
            },
            take: limit,
            skip: skip
        });


        if (!posts || posts.length === 0) {
            return res.status(404).json({ message: "No posts found for this user." });
        }

        res.status(200).json(posts);
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
}

const getUserPost = async (req, res) => {
    const { postId } = req.params;
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
    const { postId } = req.params;
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
    const { postId } = req.params;
    logInfo(`Going to update the user post of user id ${req.userId} with postId ${postId}`, path.basename(__filename), updateUserPost);

    try {
        const { title, subtitle, tag, content } = req.body;

        // Check if the post exists
        const existingPost = await prisma.post.findUnique({
            where: {
                id: postId,
                userId: req.userId // Ensure the post belongs to the user
            }
        });

        if (!existingPost) {
            return res.status(404).json({ message: "Post not found or you do not have permission to update it." });
        }

        // Prepare the update data
        const updateData = {
            ...(title && { title }),
            ...(subtitle && { subtitle }),
            ...(tag && { tag }), // Assuming tag is an array
            ...(content && { content })
        };

        // Update the post
        await prisma.post.update({
            where: {
                id: postId,
                userId: req.userId
            },
            data: updateData
        });

        res.status(200).json({ message: "Post updated successfully." });
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
}


export { getUserPost, getAllPost, deleteUserPost, updateUserPost }