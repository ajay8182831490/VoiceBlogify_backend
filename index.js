import express from 'express';
import session from 'express-session';
import passport from './src/config/passport.js';
import authRoutes from './src/routes/authRoutes.js';
import { CronJob } from 'cron'
import dotenv from 'dotenv';
import cors from 'cors'
import linkdeinRoutes from './src/linkedin/routes/LinkedinRoutes.js'
import redditRoutes from './src/Reddit/routes/RedditRoutes.js'

import transcriptioRoutes from './src/main_feature/transcription/routes/transcriptionRoutes.js'
import postOperation from './src/postOperation/postRoutes.js'





dotenv.config();

const port = process.env.port || 3000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({
  origin: ['https://voiceblogify.netlify.app/', 'http://localhost:5173'],
  credentials: true,
}));
app.get('/keep-alive', (req, res) => {
  res.send('Alive!');
});


const job = new CronJob('*/5 * * * *', async () => {
  try {
    const response = await fetch('https://voiceblogify-backend.onrender.com/keep-alive', {
      timeout: 10000,
    });
    console.log('Kept alive');
  } catch (error) {
    console.error('Error keeping alive:', error);
  }
});

job.start();



app.use(session({
  secret: process.env.SECRET_SESSION_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true, // Prevent client-side JavaScript from accessing cookies
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(authRoutes);
app.use(linkdeinRoutes)
app.use(redditRoutes)
app.use(transcriptioRoutes)
app.use(postOperation)



app.listen(port, () => {
  console.log("Server is running on port", port);
});
