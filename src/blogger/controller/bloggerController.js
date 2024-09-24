import { logError, logInfo } from "../../utils/logger.js";
import path from 'path'
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
import { PrismaClient } from "@prisma/client";




const getBlOgId = async (req, res) => {
    try {
        const accessToken = req.user.userAccessToken;
        const response = await axios.get('https://www.googleapis.com/blogger/v3/users/self/blogs', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const blogs = response.data.items;

        if (!blogs || blogs.length === 0) {
            return res.status(404).send('You need to create a blog before posting.');
        }


        res.status(200).json({ blogs });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching blogs');
    }
}

const createBlog = async (req, res) => {
    const { blogId, postContent } = req.body;

    try {
        const accessToken = req.user.userAccessToken; // Use the updated access token
        const response = await axios.post(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`, {
            kind: 'blogger#post',
            title: 'Your Post Title', // or take it from user input
            content: postContent,
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.status(201).send('Post created successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating post');
    }
}

const deleteBloggerPost = async (req, res) => {
    const { blogId, postId } = req.params;

    try {
        const accessToken = req.user.userAccessToken; // Get the access token from the user session
        await axios.delete(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.status(204).send(); // Successfully deleted the post
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting post');
    }
}
// Endpoint to fetch posts
const getBloggerPost = async (req, res) => {
    const { blogId } = req.params;

    try {
        const accessToken = req.user.userAccessToken; // Get the access token from the user session
        const response = await axios.get(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.status(200).json(response.data); // Return the fetched posts
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching posts');
    }
}

export { createBlog, getBlOgId, getBloggerPost, deleteBloggerPost };
