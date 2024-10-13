import express from 'express'

const router = express.Router();
import { ensureAuthenticated } from '../../middleware/authMiddleware.js';

import { getUserProfile, disconnect_medium, disconnect_linkedin, feedBack } from '../controller/userController.js'



router.get('/user/profile', ensureAuthenticated, getUserProfile);
router.post('/user/feedback', ensureAuthenticated, feedBack);

router.put('/user/disconnect/linkedin', ensureAuthenticated, disconnect_linkedin)
router.put('/user/disconnect/medium', ensureAuthenticated, disconnect_medium)




export default router

