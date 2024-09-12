import express from 'express';
import passport from '../config/passport.js';

import rateLimit from 'express-rate-limit';
import { ensureAuthenticated } from '../middleware/authMiddleware.js';
import { registerUser, logoutUser, resetPassword, otpGeneration, checkAuth } from '../controller/authController.js';

const router = express.Router();
const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 2, // limit each IP to 5 requests per windowMs
  message: "Too many OTP requests from this IP, please try again after an hour"
});


router.get('/login', (req, res) => {
  res.send('<form action="/login" method="post"><input type="text" name="name" /><input type="email" name="email" /><input type="password" name="password" /><button type="submit">Login</button></form>');
});

router.post('/login', (req, res, next) => {
  console.log("Login endpoint called");

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.log("Error during authentication", err);
      return next(err);
    }

    console.log(user, info)

    // Log the failure message
    if (!user) {
      console.log("Authentication failed:", info);
      return res.status(401).json({ message: info.message || 'Authentication failed' });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.log("Error during req.logIn", err);
        return next(err);
      }

      console.log("User successfully logged in");
      return res.status(200).json({ message: 'Login successful', user });
    });
  })(req, res, next);
});



router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('http://localhost:5173');
  });


router.post('/register', registerUser);
router.get('/logout', ensureAuthenticated, logoutUser);
router.post('/otp', otpRateLimiter, otpGeneration)
router.put('/resetPassword', otpRateLimiter, resetPassword)
router.get('/status', checkAuth);

export default router;
