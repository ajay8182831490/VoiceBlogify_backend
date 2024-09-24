import express from 'express';
import passport from '../config/passport.js';

import rateLimit from 'express-rate-limit';
import { ensureAuthenticated } from '../middleware/authMiddleware.js';
import { registerUser, logoutUser, resetPassword, otpGeneration, checkAuth, passwordChange } from '../controller/authController.js';
import { logInfo } from '../utils/logger.js';

const router = express.Router();
const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: "Too many OTP requests from this IP, please try again after an hour"
});
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 4,
  message: "Too many login attempts, please try again later."
})



router.post('/login', loginRateLimiter, (req, res, next) => {

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




/*router.get('/auth/google', loginRateLimiter, passport.authenticate('google', {
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/blogger']
}));

/*router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'https://voiceblogify.netlify.app/login' }),
  (req, res) => {


    if (req.user) {
      req.session.userId = req.user.id;
    } else {
      console.log('No user found, session will not be set');
    }

    res.redirect('https://voiceblogify.netlify.app/?login=success');
  }
)*/
/*router.get('/auth/google/callback',
  (req, res, next) => {
    // Check if the user is logged in locally before authenticating with Google
    if (req.isAuthenticated()) {

      return next();
    }
    // User is not authenticated locally, proceed with Google authentication
    passport.authenticate('google', { failureRedirect: '/https://voiceblogify.netlify.app/login' })(req, res, next);
  },
  (req, res) => {

    const redirectUrl = req.session.returnTo || 'https://voiceblogify.netlify.app/?login=success';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);*/

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
    
     console.log(req.user);
    const accessToken = req.user.userAccessToken; 
    console.log(accessToken)/// Assign access token from user object
    req.session.accessToken = accessToken; // Store the access token in session

    const redirectUrl = req.session.returnTo || 'https://voiceblogify.netlify.app/?login=success';
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
