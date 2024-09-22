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

const port = process.env.PORT || 3000;
const app = express();

const mongoUrl = process.env.MONGODB_URI;
const client = new MongoClient(mongoUrl);

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Now, setup the session store after MongoDB is connected
    app.use(session({
      secret: process.env.SECRET_SESSION_KEY,
      store: MongoStore.create({
        client: client,  // Pass the connected client
        dbName: 'voiceBlogify',
      }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }));

    // Initialize Passport session after session middleware
    app.use(passport.initialize());
    app.use(passport.session());

    // Start listening after database connection is successful
    app.listen(port, () => {
      console.log("Server is running on port", port);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
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

// Debugging to check session and user
app.use((req, res, next) => {
  console.log('Session:', req.session);
  console.log('User:', req.user);
  next();
});

// Routes
app.use(authRoutes);
app.use(linkdeinRoutes);
app.use(redditRoutes);
app.use(transcriptionRoutes);
app.use(postOperation);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});
