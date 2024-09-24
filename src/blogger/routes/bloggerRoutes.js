import express from 'express'


const router = express.Router();
import rateLimit from 'express-rate-limit';

const RequestRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 4,
    message: "Too many request try again later ."
})


import checkAuthBlogger from '../middleware/bloggerMiddleware.js';
import { createBlog, getBlOgId, getBloggerPost, deleteBloggerPost } from '../controller/bloggerController.js';

router.get('/blogger/getBlogId', checkAuthBlogger, getBlOgId);
router.post('/blogger/createPost', RequestRateLimiter, checkAuthBlogger, createBlog);
router.delete('/blogger/posts/:blogId/:postId', RequestRateLimiter, checkAuthBlogger, deleteBloggerPost)
router.get('/blogger/posts/:blogId', RequestRateLimiter, checkAuthBlogger, getBloggerPost)



export default router;