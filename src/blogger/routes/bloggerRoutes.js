import express from 'express'

import { ensureAuthenticated } from '../../middleware/authMiddleware'
const router = express.Router();
import rateLimit from 'express-rate-limit';



export default router;