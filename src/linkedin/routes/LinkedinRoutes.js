import path from 'path'

import { connect_to_linkedin, to_linkedin } from "../controller/LinkedinController.js";
import express from "express";
import { ensureAuthenticated } from "../../middleware/authMiddleware.js";
import attachUserId from "../../middleware/atttachedUser.js";
import { linkedinMiddleware } from '../middleware/linkedinMiddleware.js';

const router = express.Router();

router.get('/linkedin/oauth/redirect', ensureAuthenticated, attachUserId, linkedinMiddleware, connect_to_linkedin);
router.get('/auth/linkedin', attachUserId, to_linkedin)

export default router;