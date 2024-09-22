import express from 'express';
import session from 'express-session';
import passport from './src/config/passport.js';
import authRoutes from './src/routes/authRoutes.js';
import { CronJob } from 'cron';
import dotenv from 'dotenv';
import cors from 'cors';
import linkedinRoutes from './src/linkedin/routes/LinkedinRoutes.js';
import redditRoutes from './src/Reddit/routes/RedditRoutes.js';
import transcriptionRoutes from './src/main_feature/transcription/routes/transcriptionRoutes.js';
import postOperation from './src/postOperation/postRoutes.js';

dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ['https://voiceblogify.netlify.app', 'http://localhost:5173'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,  // Allow cookies to be sent with cross-origin requests
};


app.use(cors(corsOptions));




app.get('/keep-alive', (req, res) => {
  res.send('Alive!');
});

// Cron job to keep the server alive
const job = new CronJob('*/5 * * * *', async () => {
  try {
    const response = await fetch('https://voiceblogify-backend.onrender.com/keep-alive', {
      timeout: 10000,
    });
    console.log('Kept alive, status:', response.status);
  } catch (error) {
    console.error('Error keeping alive:', error);
  }
});

job.start();


console.log("session secet", process.env.SECRET_SESSION_KEY)

app.use(session({
  secret: process.env.SECRET_SESSION_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production',  // Only set to secure in production (HTTPS)
    httpOnly: true,  // Prevent client-side JS from accessing the cookie
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',  // Cross-site cookie handling
  }
}));
app.use((req, res, next) => {
  console.log('Session created:', req.session);
  next();
});
console.log(process.env.NODE_ENV)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log('Session created:', req.session);
    next();
  });
}






app.use(passport.initialize());
app.use(passport.session());

// Route middleware
app.use(authRoutes);
app.use(linkedinRoutes);
app.use(redditRoutes);
app.use(transcriptionRoutes);
app.use(postOperation);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});


app.listen(port, () => {
  console.log("Server is running on port", port);
});
