import express from "express";

const router = express.Router();

import attachUserId from "../../../middleware/atttachedUser.js";
import { ensureAuthenticated } from "../../../middleware/authMiddleware.js";
import { urlTranscription, recordTranscription } from "../controller/transcriptionController.js";
import multer from 'multer';


const storage = multer.memoryStorage();
const upload = multer({ storage });

// 3 url one for link paste ,2nd for upload file and third for audio record
// free ,basic ,premium ,buisness

router.post('/transcription/url', ensureAuthenticated, urlTranscription);
router.post('/transcription/audioRecord', ensureAuthenticated, upload.single('audio'), recordTranscription);

export default router;