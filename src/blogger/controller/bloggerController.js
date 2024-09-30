import { logError, logInfo } from "../../utils/logger.js";
import path from 'path'
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);

import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify';
const window = (new JSDOM('')).window;
const purify = DOMPurify(window);




const getBlogId = async (req, res) => {
    logInfo(`going to access the getBlog of user ${req.userId}`, path.basename(__filename), getBlogId)
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



        res.status(200).json(extractedData);
    } catch (error) {

        logError(error, path.basename(__filename), getBlogId);
        res.status(500).send('Error fetching blogs');
    }
}

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