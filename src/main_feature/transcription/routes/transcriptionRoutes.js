import express from "express";
import rateLimit from "express-rate-limit";
const router = express.Router();


import { ensureAuthenticated } from "../../../middleware/authMiddleware.js";
import { recordTranscription,urlTranscription } from "../controller/transcriptionController.js";
import attachUserId from "../../../middleware/atttachedUser.js";
import multer from 'multer';
const RateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 2,
    handler: (req, res) => {
        res.status(429).json({ message: "Too many request please try again ." });
    }

});


const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {





        const acceptedMimeTypes = ['audio/mpeg', 'audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-aiff', 'video/mp4', 'video/x-msvideo', 'video/x-m4v', 'video/ogg', 'video/webm'];

        if (acceptedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload audio or video files.'), false);
        }
    }
})



router.post('/transcription/audioRecord', RateLimiter, ensureAuthenticated, attachUserId, upload.single('audio'), recordTranscription);
router.post('/transcription/audiofile', RateLimiter, ensureAuthenticated, attachUserId, upload.single('file'), recordTranscription);
router.post('/transcription/url', urlTranscription);

export default router;
