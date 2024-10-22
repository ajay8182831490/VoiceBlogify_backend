import express from 'express';
import passport from './src/config/passport.js';
import authRoutes from './src/routes/authRoutes.js';
import dotenv from 'dotenv';
import cors from 'cors';
import { CronJob } from 'cron';
import linkdeinRoutes from './src/linkedin/routes/LinkedinRoutes.js';
import transcriptionRoutes from './src/main_feature/transcription/routes/transcriptionRoutes.js';
import postOperation from './src/postOperation/postRoutes.js';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import connectMongoDBSession from 'connect-mongodb-session';
import mongoose from 'mongoose';
import mediumRoutes from './src/medium/routes/mediumRoutes.js';
import bloggerRoutes from './src/blogger/routes/bloggerRoutes.js';
import userRouter from './src/user/Routes/userRoutes.js';
import paypalpayment from './src/subscription/payment/controller/PaymentController.js';
import helmet from 'helmet';
import csurf from 'csurf';
import cron from './src/utils/cronjob.js'

dotenv.config();

const port = process.env.PORT || 4000;
const app = express();

// Security middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet()); // Apply Helmet for security headers

app.set('trust proxy', 1);
// Content Security Policy (CSP) Configuration
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],  // Only load content from your own domain
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts if needed
    styleSrc: ["'self'", "'unsafe-inline'"],  // Allow inline styles
    imgSrc: ["'self'", "data:", "https:"],  // Allow images from your domain, HTTPS, and data URIs
    connectSrc: ["'self'", "https:"],  // Allow connections to your own domain and HTTPS resources
    fontSrc: ["'self'", "https:", "data:"],  // Allow fonts from your domain and data URIs
    objectSrc: ["'none'"],  // Prevent plugins (like Flash) from being used
    upgradeInsecureRequests: [],  // Automatically upgrade HTTP requests to HTTPS

  },
};
app.use(helmet.contentSecurityPolicy(cspConfig));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});


// Security headers for protection against XSS, clickjacking, etc.
app.use(helmet.noSniff());  // X-Content-Type-Options: nosniff
app.use(helmet.frameguard({ action: 'deny' }));  // X-Frame-Options: DENY (Clickjacking protection)
app.use(helmet.xssFilter());  // X-XSS-Protection header for XSS protection

app.use(helmet.hsts({
  maxAge: 31536000,  // 1 year
  includeSubDomains: true,
  preload: true,
}));
app.use(helmet.referrerPolicy({ policy: 'no-referrer' })); // Referrer-Policy header
app.disable('x-powered-by');  // Disable X-Powered-By header

// Rate limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

const allowedOrigins = ['https://www.voiceblogify.in'];

app.use((req, res, next) => {
  const origin = req.headers.origin;


  // Check if the origin is allowed
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204); // No Content for preflight
  }

  next();
});

// Session store using MongoDB
const mongoUrl = process.env.MONGODB_URI;
mongoose.connect(mongoUrl)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));


const MongoDBStore = connectMongoDBSession(session);
const store = new MongoDBStore({
  uri: mongoUrl,
  collection: 'mySessions',
});


store.on('error', (error) => {
  console.error('Session store error:', error);
});

// Session configuration
// app.use(session({
//   secret: process.env.SECRET_SESSION_KEY,
//   resave: false,
//   saveUninitialized: false,
//   store: store,
//   name: 'voiceblogify',
//   cookie: {
//     secure: true,
//     httpOnly: true,
//     maxAge: 1000 * 60 * 60 * 24, // 1 day
//     sameSite: 'none',
//    // path: '/',
//    // domain: '.voiceblogify.in'  // Note the dot prefix for subdomain support
//   },
//   proxy: true
// }))
app.use(session({
  secret: process.env.SECRET_SESSION_KEY,
  resave: false,
  saveUninitialized: false,
  store: store,
  name: 'voiceblogify',
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: 'none',
    path: '/',
    domain: '.voiceblogify.in'  // Note the dot prefix for subdomain support
  },
  proxy: true
}))

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());
cron.start()








// Keep-alive cron job to prevent server sleep



// Define routes
app.use(authRoutes);
app.use(linkdeinRoutes);
app.use(mediumRoutes);
// app.use(redditRoutes); 
app.use(transcriptionRoutes);
app.use(postOperation);
app.use(bloggerRoutes);
app.use(userRouter);
app.use(paypalpayment);
app.get('/keep-alive', (req, res) => {
  res.status(200).json({ message: "i am alive" })
})

// Keep-alive cron job to prevent server sleep
const job = new CronJob('*/5 * * * *', async () => {
  try {
    await fetch('https://api.voiceblogify.in/keep-alive', { timeout: 10000 });
  } catch (error) {
    console.error('Error keeping alive:', error);
  }
});
job.start();


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// Start the server
const init = async () => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};


init();


