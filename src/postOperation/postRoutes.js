import express from 'express'

const router = express.Router();
import { ensureAuthenticated } from '../middleware/authMiddleware.js';
import { getUserPost, getAllPost, deleteUserPost, updateUserPost, saveUserPost } from './postController.js'
import rateLimit from 'express-rate-limit';

const RequestRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 4,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many request, please try again later." });
    }
})

router.get('/user/post/:postId', RequestRateLimiter, ensureAuthenticated, getUserPost);
router.get('/user/postAll', RequestRateLimiter, ensureAuthenticated, getAllPost);
router.delete('/user/postDelete/:postId', RequestRateLimiter, ensureAuthenticated, deleteUserPost);
router.patch('/user/postUpdate/:postId', RequestRateLimiter, ensureAuthenticated, updateUserPost);
router.post('/user/savePost', RequestRateLimiter, ensureAuthenticated, saveUserPost);



export default router;