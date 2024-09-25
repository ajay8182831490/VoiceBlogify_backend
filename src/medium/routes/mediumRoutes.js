import express from 'express'
import rateLimit from 'express-rate-limit'
const router = express.Router();
import mediumUrl from '../mmiddleware/mediumMiddleware.js'
import { deletePost, getPostById, uploadPost, uploadImage } from '../controller/mediumController.js';
import { ensureAuthenticated } from '../../middleware/authMiddleware.js';
import multer from 'multer';
import { body } from "express-validator";
const RequestRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 4,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many  request, please try again later." });
    }
})
const upload = multer({
    //dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb('Error: File type not supported');
    }
});
const validatePost = [
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('publishStatus').isIn(['public', 'draft', 'unlisted']).withMessage('Invalid publish status'),
];
router.get('/url', mediumUrl);

router.delete('/medium/post/:postId', RequestRateLimiter, ensureAuthenticated, mediumUrl, deletePost);
router.get('/medium/getPost/:postId', RequestRateLimiter, ensureAuthenticated, mediumUrl, getPostById);
router.post('/medium/post', RequestRateLimiter, ensureAuthenticated, mediumUrl, validatePost, uploadPost);
router.post('/medium/uploadImage', RequestRateLimiter, ensureAuthenticated, upload.single('image'), mediumUrl, uploadImage);

export default router