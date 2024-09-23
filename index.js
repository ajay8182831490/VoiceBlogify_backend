import express from 'express';
import passport from './src/config/passport.js';
import authRoutes from './src/routes/authRoutes.js';
import dotenv from 'dotenv';
import cors from 'cors';
import { CronJob } from 'cron';
import linkdeinRoutes from './src/linkedin/routes/LinkedinRoutes.js';
import redditRoutes from './src/Reddit/routes/RedditRoutes.js';
import transcriptionRoutes from './src/main_feature/transcription/routes/transcriptionRoutes.js';
import postOperation from './src/postOperation/postRoutes.js';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import connectMongoDBSession from 'connect-mongodb-session';
import mongoose from 'mongoose';

dotenv.config();

const port = process.env.PORT || 3000;
const app = express();
//import cookieParser from 'cookie-parser';

// Add this line after you set up express.json()
//app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());



const mongoUrl = process.env.MONGODB_URI;
mongoose.connect(mongoUrl)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });


const MongoDBStore = connectMongoDBSession(session);

const store = new MongoDBStore({
  uri: mongoUrl,
  collection: 'mySessions'
});

store.on('error', (error) => {
  console.error('Session store error:', error);
});
app.set("trust proxy", 1);
// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// CORS options
const corsOptions = {
  origin: ['https://voiceblogify.netlify.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true, // Allows sending cookies
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'], // Expose Set-Cookie header
};
app.use(cors(corsOptions));


// Session setup with MongoDB store
app.use(session({
    secret: process.env.SECRET_SESSION_KEY,
    resave: false,
    saveUninitialized: false,
    store: store,
    name: "voiceblogify",
    cookie: {
        secure: true, // Set to true in production
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        sameSite: 'none',
    },
    proxy: true, // Move this line here
}));


app.use(passport.initialize());
app.use(passport.session());

/*app.use((req, res, next) => {
    console.log('Session:', req.session);
    console.log('Cookies:', req.cookies);
    next();
});*/


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


app.use(authRoutes);
app.use(linkdeinRoutes);
app.use(redditRoutes);
app.use(transcriptionRoutes);
app.use(postOperation);


app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// Start server
app.listen(port, () => {
  console.log("Server is running on port", port);
});
