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

    if (err) {

      return next(err);
    }



    // Log the failure message
    if (!user) {

      return res.status(401).json({ message: info.message || 'Authentication failed' });
    }

    req.logIn(user, (err) => {
      if (err) {

        return next(err);
      }


      return res.status(200).json({ message: 'Login successful', authenticated: true, name: user.name, id: user.id, profilepic: user.profilepic, blogCount: user.blogCount });
    });
  })(req, res, next);
});



router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'https://voiceblogify.netlify.app/login' }),
  (req, res) => {
    res.redirect('https://voiceblogify.netlify.app/?login=success');
  });


router.post('/register', registerUser);
router.get('/logout', ensureAuthenticated, logoutUser);
router.post('/otpGenrator', otpRateLimiter, otpGeneration)
router.put('/resetPassword', otpRateLimiter, resetPassword)
router.get('/status', checkAuth);
router.patch('/passwordChange', ensureAuthenticated, otpRateLimiter, passwordChange)
router.get('/test-auth', checkAuth, (req, res) => {
  res.send('You are authenticated!');
});

export default router;
