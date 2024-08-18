import express from 'express';
import passport from '../config/passport';
import { registerUser, logoutUser } from '../controller/authController';

const router = express.Router();


router.get('/login', (req, res) => {
  res.send('<form action="/login" method="post"><input type="text" name="name" /><input type="email" name="email" /><input type="password" name="password" /><button type="submit">Login</button></form>');
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}));


router.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  });


router.post('/register', registerUser);
router.get('/logout', logoutUser);

export default router;
