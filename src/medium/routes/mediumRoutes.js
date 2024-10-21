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
    max: 3,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many  request, please try again later." });
    }
})
const upload = multer({

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
router.post('/medium/url', RequestRateLimiter, ensureAuthenticated, mediumUrl);

router.delete('/medium/post/:postId', RequestRateLimiter, ensureAuthenticated, deletePost);
router.get('/medium/getPost/:postId', RequestRateLimiter, ensureAuthenticated, getPostById);
router.post('/medium/post', RequestRateLimiter, ensureAuthenticated, uploadPost);
router.post('/medium/uploadImage', RequestRateLimiter, ensureAuthenticated, upload.single('image'), uploadImage);

export default router