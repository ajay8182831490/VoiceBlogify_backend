import express from 'express';
import session from 'express-session';
import passport from './src/config/passport.js';
import authRoutes from './src/routes/authRoutes.js';
import dotenv from 'dotenv';
import cors from 'cors'
import linkdeinRoutes from './src/linkedin/routes/LinkedinRoutes.js'


import fileUpload from 'express-fileupload';


dotenv.config();

const port = process.env.port || 3000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(fileUpload());
app.use(session({
  secret: process.env.SECRET_SESSION_KEY,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(authRoutes);
app.use(linkdeinRoutes)

app.listen(port, () => {
  console.log("Server is running on port", port);
});
