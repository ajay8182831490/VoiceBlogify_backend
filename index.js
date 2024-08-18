import express from 'express';
import session from 'express-session';
import passport from './src/config/passport.js';       // Add ".js" if needed
import authRoutes from './src/routes/authRoutes.js';  // Add ".js" if needed
import dotenv from 'dotenv';



dotenv.config();

const port = process.env.port || 3000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SECRET_SESSION_KEY,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(authRoutes);

app.listen(port, () => {
  console.log("Server is running on port", port);
});
