import express from 'express'

const router = express.Router();
import { ensureAuthenticated } from '../../middleware/authMiddleware.js';

import { getUserProfile, disconnect_medium, disconnect_linkedin, feedBack } from '../controller/userController.js'
import rateLimit from 'express-rate-limit'
const RequestRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 2,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many request, please try again later." });
    }
})




router.get('/user/profile', ensureAuthenticated, getUserProfile);
router.post('/user/feedback', RequestRateLimiter, ensureAuthenticated, feedBack);

router.put('/user/disconnect/linkedin', RequestRateLimiter, ensureAuthenticated, disconnect_linkedin)
router.put('/user/disconnect/medium', RequestRateLimiter, ensureAuthenticated, disconnect_medium)




export default router

