import express from "express";

const router = express.Router();

import attachUserId from "../../../middleware/atttachedUser.js";
import { ensureAuthenticated } from "../../../middleware/authMiddleware.js";
import { recordTranscription } from "../controller/transcriptionController.js";
import multer from 'multer';


const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {

        const acceptedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-aiff', 'video/mp4', 'video/x-msvideo', 'video/x-m4v', 'video/ogg', 'video/webm'];

        if (acceptedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload audio or video files.'), false);
        }
    }
})


router.post('/transcription/audioRecord', ensureAuthenticated, upload.single('file'), recordTranscription);

export default router;