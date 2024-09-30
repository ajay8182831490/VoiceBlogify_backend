import express from 'express'


const router = express.Router();
import rateLimit from 'express-rate-limit';
import { ensureAuthenticated } from '../../middleware/authMiddleware.js';

const RequestRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 4,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many request, please try again later." });
    }
})


import checkAuthBlogger from '../middleware/bloggerMiddleware.js';
import { createBlog, getBlogId, getBloggerPost, deleteBloggerPost } from '../controller/bloggerController.js';

router.get('/blogger/getBlogId', ensureAuthenticated, checkAuthBlogger, getBlogId);
router.post('/blogger/createPost', RequestRateLimiter, ensureAuthenticated, checkAuthBlogger, createBlog);
router.delete('/blogger/posts/:blogId/:postId', RequestRateLimiter, ensureAuthenticated, checkAuthBlogger, deleteBloggerPost)
router.get('/blogger/posts/:blogId', RequestRateLimiter, ensureAuthenticated, checkAuthBlogger, getBloggerPost)



export default router;