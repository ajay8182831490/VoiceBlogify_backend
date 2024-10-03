import { logError, logInfo } from "../../utils/logger.js";
import path from 'path'
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);

import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify';
const window = (new JSDOM('')).window;
const purify = DOMPurify(window);

const refreshAccessToken = async (refreshToken) => {
    const response = await axios.post('https://oauth2.googleapis.com/token', null, {
        params: {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        },
    });

    if (!response.data.access_token) {
        throw new Error('Failed to refresh access token');
    }

    return response.data;
};

const getBlogId = async (req, res) => {
    logInfo(`Going to access the blogs of user ${req.userId}`, path.basename(__filename), getBlogId);
    try {
        const accessToken = req.BloggerAccessToken;

        const response = await axios.get('https://www.googleapis.com/blogger/v3/users/self/blogs', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const blogs = response.data.items;

        if (!blogs || blogs.length === 0) {
            return res.status(404).send('You need to create a blog before posting.');
        }

        const extractedData = blogs.map(blog => ({
            blogId: blog.id,
            name: blog.name
        }));

        return res.status(200).json(extractedData);
    } catch (error) {
        // Handle 401 Unauthorized error for access token
        if (error.response && error.response.status === 401) {
            try {
                // Fetch the user's refresh token from the database
                const userData = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { RefreshToken: true }
                });

                // Check if refreshToken is available
                if (!userData || !userData.RefreshToken) {
                    return res.status(401).send('Refresh token not found, please log in again.');
                }

                // Refresh the access token
                const tokenResponse = await refreshAccessToken(userData.RefreshToken);
                req.BloggerAccessToken = tokenResponse.access_token;

                // Update the new access token in the database
                await prisma.user.update({
                    where: { id: req.user.id },
                    data: { userAccessToken: tokenResponse.access_token }
                });

                // Retry the original API request with the new access token
                const retryResponse = await axios.get('https://www.googleapis.com/blogger/v3/users/self/blogs', {
                    headers: {
                        Authorization: `Bearer ${req.BloggerAccessToken}`,
                    },
                });

                const retryBlogs = retryResponse.data.items;

                if (!retryBlogs || retryBlogs.length === 0) {
                    return res.status(404).send('You need to create a blog before posting.');
                }

                const retryExtractedData = retryBlogs.map(blog => ({
                    blogId: blog.id,
                    name: blog.name
                }));

                return res.status(200).json(retryExtractedData);
            } catch (refreshError) {
                logError('Failed to refresh access token: ' + refreshError.message, path.basename(__filename), getBlogId);
                return res.status(500).send('Failed to refresh access token');
            }
        }

        logError('Error fetching blogs: ' + error.message, path.basename(__filename), getBlogId);
        return res.status(500).send('Error fetching blogs');
    }
};



const createBlog = async (req, res) => {
    logInfo(`going to post a blog on blooger for user ${req.userId}`, path.basename(__filename), createBlog)
    const { blogId, postContent, title } = req.body;

    if (!blogId || !postContent || !title) {
        return res.status(400).json({ message: "missind field required" });
    }

    try {

        const cleanHTML = purify.sanitize(postContent);
        const cleantitle = purify.sanitize(title)





        const accessToken = req.BloggerAccessToken;
        const response = await axios.post(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`, {
            kind: 'blogger#post',
            title: cleantitle,
            content: cleanHTML,
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.status(201).json({ message: 'Post created successfully!' });
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).send('Error creating post');
    }
}

const deleteBloggerPost = async (req, res) => {
    const { blogId, postId } = req.params;
    logInfo(`going to delete the blogger post ${postId} for user ${req.userId} `, path.basename(__filename), deleteBloggerPost)
    if (!postId) {
        return res.status(400).json("postId are required");
    }
    try {
        const accessToken = req.BloggerAccessToken
        await axios.delete(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.status(204).send();
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).send('Error deleting post');
    }
}

const getBloggerPost = async (req, res) => {
    const { blogId } = req.params;
    logInfo(`going to fetch the blogger  for user ${req.userId} `, path.basename(__filename), deleteBloggerPost)

    if (!blogId) {
        return res.status(400).json({ message: 'blogid are missing' });
    } try {
        const accessToken = req.BloggerAccessToken;
        const response = await axios.get(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.status(200).json(response.data);
    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).send('Error fetching posts');
    }
}

export { createBlog, getBlogId, getBloggerPost, deleteBloggerPost };