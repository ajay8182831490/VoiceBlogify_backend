import path from 'path'

import { connect_to_linkedin, to_linkedin, share_linkedin } from "../controller/LinkedinController.js";
import express from "express";
import { ensureAuthenticated } from "../../middleware/authMiddleware.js";
import attachUserId from "../../middleware/atttachedUser.js";
import { linkedinMiddleware } from '../middleware/linkedinMiddleware.js';
import multer from 'multer';
const storage = multer.memoryStorage();
const upload = multer({ storage });
const router = express.Router();

router.get('/linkedin/oauth/redirect', ensureAuthenticated, attachUserId, linkedinMiddleware, connect_to_linkedin);
router.get('/auth/linkedin', attachUserId, to_linkedin)
router.post('/linkedin/post', /*ensureAuthenticated, attachUserId,*/ linkedinMiddleware, upload.fields([{ name: 'images', maxCount: 20 }, { name: 'video', maxCount: 1 }]), share_linkedin)

export default router;