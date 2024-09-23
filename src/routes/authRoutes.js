import express from 'express';
import passport from '../config/passport.js';

import rateLimit from 'express-rate-limit';
import { ensureAuthenticated } from '../middleware/authMiddleware.js';
import { registerUser, logoutUser, resetPassword, otpGeneration, checkAuth, passwordChange } from '../controller/authController.js';
import { logInfo } from '../utils/logger.js';

const router = express.Router();
const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 2, // limit each IP to 5 requests per windowMs
  message: "Too many OTP requests from this IP, please try again after an hour"
});




router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info.message || 'Authentication failed' });

    req.logIn(user, (err) => {
      if (err) return next(err);
     // console.log('User logged in:', req.user);
     // console.log('Session:', req.session);
     // console.log('Set-Cookie header:', res.getHeaders()['set-cookie']); // Check if cookie is set

      return res.status(200).json({
        message: 'Login successful',
        authenticated: true,
        name: user.name,
        id: user.id,
        profilepic: user.profilepic,
        blogCount: user.blogCount,
      });
    });
  })(req, res, next);
});




router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'https://voiceblogify.netlify.app/login' }),
  (req, res) => {
    console.log('User object from Google callback:', req.user); // Log user info

    if (req.user) {
      req.session.userId = req.user.id; // Ensure user ID is set in session
      //console.log('Session after login:', req.session); // Log session info
    } else {
      console.log('No user found, session will not be set');
    }

    res.redirect('https://voiceblogify.netlify.app/?login=success');
  }
)


router.post('/register', registerUser);
router.get('/logout', ensureAuthenticated, logoutUser);
router.post('/otpGenrator', otpRateLimiter, otpGeneration)
router.put('/resetPassword', otpRateLimiter, resetPassword)
router.get('/status',checkAuth);
router.patch('/passwordChange', ensureAuthenticated, otpRateLimiter, passwordChange)
router.get('/test-auth', checkAuth, (req, res) => {
  res.send('You are authenticated!');
});

export default router;
