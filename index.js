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
import MongoStore from 'connect-mongo';
import { MongoClient } from 'mongodb';

dotenv.config();

const port = process.env.PORT || 3000; // Ensure to use uppercase PORT
const app = express();


const mongoUrl = process.env.MONGODB_URI; // Your MongoDB connection string
const client = new MongoClient(mongoUrl);

async function connectToDatabase() {
  await client.connect();
  console.log('Connected to MongoDB');
}

connectToDatabase();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.get('/keep-alive', (req, res) => {
  res.send('Alive!');
});

const job = new CronJob('*/5 * * * *', async () => {
  try {
    await fetch('https://voiceblogify-backend.onrender.com/keep-alive', { timeout: 10000 });
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
  store: MongoStore.create({
    client: client,
    dbName: 'voiceBlogify', // Replace with your database name
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  console.log('Session:', req.session);
  console.log('User:', req.user);
  next();
});
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
