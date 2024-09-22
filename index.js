import express from 'express';
import session from 'express-session';
import passport from './src/config/passport.js';
import authRoutes from './src/routes/authRoutes.js';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { CronJob } from 'cron';
import linkdeinRoutes from './src/linkedin/routes/LinkedinRoutes.js';
import redditRoutes from './src/Reddit/routes/RedditRoutes.js';
import transcriptionRoutes from './src/main_feature/transcription/routes/transcriptionRoutes.js';
import postOperation from './src/postOperation/postRoutes.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

const port = process.env.port || 3000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet()); 
app.set('trust proxy', 1);// Security headers

// Rate limiter for all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
//app.use(limiter);

app.get('/keep-alive', (req, res) => {
  res.send('Alive!');
});

// Cron job to keep the server alive
const job = new CronJob('*/5 * * * *', async () => {
  try {
    const response = await fetch('https://voiceblogify-backend.onrender.com/keep-alive', {
      timeout: 10000,
    });
  
  } catch (error) {
    console.error('Error keeping alive:', error);
  }
});

job.start();

const corsOptions = {
  origin: ['https://voiceblogify.netlify.app'], 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'], 
};

app.use(cors(corsOptions));

app.use(session({
  secret: process.env.SECRET_SESSION_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production', 
    httpOnly: true,
    sameSite:  'None'
  },
}));

app.use(passport.initialize());
app.use(passport.session());


app.use(authRoutes);
app.use(linkdeinRoutes);
app.use(redditRoutes);
app.use(transcriptionRoutes);
app.use(postOperation);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

app.listen(port, () => {
  console.log("Server is running on port", port);
});
