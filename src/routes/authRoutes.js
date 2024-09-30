import express from 'express';
import passport from '../config/passport.js';

import rateLimit from 'express-rate-limit';
import { ensureAuthenticated } from '../middleware/authMiddleware.js';
import { registerUser, logoutUser, resetPassword, otpGeneration, checkAuth, passwordChange } from '../controller/authController.js';


const router = express.Router();
const otpRateLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 3,
  handler: (req, res) => {
    res.status(429).json({ message: "Too many otp request attempts, please try again later." });
  }
});
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 4,
  handler: (req, res) => {
    res.status(429).json({ message: "Too many login attempts, please try again later." });
  }
})



router.post('/login', (req, res, next) => {

  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info.message || 'Authentication failed' });

    req.logIn(user, (err) => {
      if (err) return next(err);


      return res.status(200).json({
        message: 'Login successful',
        authenticated: true,
        name: user.name,

      });
    });
  })(req, res, next);
});





router.get('/auth/google', (req, res, next) => {

  req.session.returnTo = req.originalUrl;
  next();
}, passport.authenticate('google', {
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/blogger']
}));


router.get('/auth/google/callback',
  (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    passport.authenticate('google', { failureRedirect: '/login' })(req, res, next);
  },
  (req, res) => {


    const accessToken = req.user.userAccessToken;

    req.session.accessToken = accessToken;

    const redirectUrl = req.session.returnTo || 'http://voiceblogify.netlify.app/?login=success';

    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);



router.post('/register', loginRateLimiter, registerUser);
router.get('/logout', ensureAuthenticated, logoutUser);
router.post('/otpGenrator', otpRateLimiter, otpGeneration)
router.put('/resetPassword', otpRateLimiter, resetPassword)
router.get('/status', checkAuth);
router.patch('/passwordChange', ensureAuthenticated, otpRateLimiter, passwordChange)


export default router;
