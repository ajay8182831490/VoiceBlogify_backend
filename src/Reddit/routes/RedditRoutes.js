import path from 'path';
import { ensureAuthenticated } from '../../middleware/authMiddleware.js';
import attachUserId from '../../middleware/atttachedUser.js';
import { connect_to_reddit, to_reddit, check, fetchFlairTemplates } from '../controlller/RedditController.js';

import { checkAndRenewRedditToken, submitRedditPost, getRedditPostAnalytics, getUserSubscribedSubreddits, } from '../middleware/RedditMiddleware.js';

import express from 'express';


const router = express.Router();

router.get('/auth/reddit', ensureAuthenticated, attachUserId, to_reddit);
router.get('/auth/reddit/callback', ensureAuthenticated, attachUserId, checkAndRenewRedditToken, connect_to_reddit)
router.post('/reddit/submit', /*ensureAuthenticated, checkAndRenewRedditToken,*/ submitRedditPost);
router.get('/reddit/analytics/:postId', ensureAuthenticated, attachUserId, checkAndRenewRedditToken, getRedditPostAnalytics);
router.get('/reddit/subscribed', ensureAuthenticated, attachUserId, checkAndRenewRedditToken, getUserSubscribedSubreddits);

router.get('/reddit/flair', ensureAuthenticated, attachUserId, checkAndRenewRedditToken, fetchFlairTemplates)


export default router;