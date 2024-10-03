import express from 'express'

const router = express.Router();
import { ensureAuthenticated } from '../../middleware/authMiddleware.js';

import { getUserProfile } from '../controller/userController.js'



router.get('/user/profile', ensureAuthenticated, getUserProfile);




export default router

