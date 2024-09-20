import express from 'express'

const router = express.Router();
import { ensureAuthenticated } from '../middleware/authMiddleware.js';
import { getUserPost, getAllPost, deleteUserPost, updateUserPost } from './postController.js'

router.get('/user/post:postId', ensureAuthenticated, getUserPost);
router.get('/user/postAll', ensureAuthenticated, getAllPost);
router.delete('/user/postDelete:postId', ensureAuthenticated, deleteUserPost);
router.patch('/user/postUpdate:postId', ensureAuthenticated, updateUserPost)



export default router