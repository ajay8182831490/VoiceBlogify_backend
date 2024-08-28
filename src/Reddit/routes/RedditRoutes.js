import path from 'path';
import { ensureAuthenticated } from '../../middleware/authMiddleware.js';
import attachUserId from '../../middleware/atttachedUser.js';
import { connect_to_reddit, to_reddit, check, } from '../controlller/RedditController.js';

import { checkAndRenewRedditToken } from '../middleware/RedditMiddleware.js';

import express from 'express';


const router = express.Router();

router.get('/auth/reddit', ensureAuthenticated, attachUserId, to_reddit);
router.get('/auth/reddit/callback', ensureAuthenticated, attachUserId, checkAndRenewRedditToken, connect_to_reddit)
router.get('/check', ensureAuthenticated, attachUserId, checkAndRenewRedditToken, check);




export default router;