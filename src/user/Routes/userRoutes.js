import express from 'express'

const router = express.Router();
import { ensureAuthenticated } from '../../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import { getUserProfile } from '../controller/userController.js'

const RequestRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 4,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many request, please try again later." });
    }
})

router.get('/user/profile', RequestRateLimiter, ensureAuthenticated, getUserProfile);




export default router

