

import { connect_to_linkedin, to_linkedin, share_linkedin } from "../controller/LinkedinController.js";
import express from "express";
import { ensureAuthenticated } from "../../middleware/authMiddleware.js";

import { linkedinMiddleware } from '../middleware/linkedinMiddleware.js';
import multer from 'multer';
import rateLimit from "express-rate-limit";
const RequestRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 4,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many  request, please try again later." });
    }
})

const storage = multer.memoryStorage();
const upload = multer({ storage });
const router = express.Router();

router.get('/linkedin/oauth/redirect', RequestRateLimiter, ensureAuthenticated, linkedinMiddleware, connect_to_linkedin);
router.get('/auth/linkedin', RequestRateLimiter, ensureAuthenticated, to_linkedin)
router.post('/linkedin/post', RequestRateLimiter, ensureAuthenticated, linkedinMiddleware, upload.fields([{ name: 'images', maxCount: 9 }, { name: 'video', maxCount: 1 }]), share_linkedin)

export default router;