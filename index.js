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
import mediumRoutes from './src/medium/routes/mediumRoutes.js';
import bloggerRoutes from './src/blogger/routes/bloggerRoutes.js';
import userRouter from './src/user/Routes/userRoutes.js';

import paypalpayment from './src/subscription/payment/controller/PaymentController.js'

dotenv.config();

const port = process.env.PORT || 4000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


const mongoUrl = process.env.MONGODB_URI
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
  collection: 'mySessions',
});

store.on('error', (error) => {
  console.error('Session store error:', error);
});

app.set("trust proxy", 1);


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

const corsOptions = {
  origin: ['https://www.voiceblogify.in',
    'https://voiceblogify.netlify.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
};
app.use(cors(corsOptions));



app.use(session({
  secret: process.env.SECRET_SESSION_KEY,
  resave: false,
  saveUninitialized: false,
  store: store,
  name: "voiceblogify",
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'none',
  },
  proxy: true,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(limiter);


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

// Routes
app.use(authRoutes);
app.use(linkdeinRoutes);
app.use(mediumRoutes);
//app.use(redditRoutes); 
app.use(transcriptionRoutes);
app.use(postOperation);
app.use(bloggerRoutes);
app.use(userRouter);
app.use(paypalpayment)


app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});



app.listen(port, () => {
  console.log("Server is running on port", port);
});
