import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logInfo, logError } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const prisma = new PrismaClient();

passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      logInfo(`Looking for user with email: ${email}`, path.basename(__filename), 'LocalStrategy');

      const user = await prisma.user.findUnique({ where: { email } });


      if (!user) {
        logInfo(`No user found with email: ${email}`, path.basename(__filename), 'LocalStrategy');
        return done(null, false, { message: 'Incorrect email.' }); // Adjusted message for clarity
      }
      if (user.googleId) {
        logInfo('User authenticated with Google attempting local login', path.basename(__filename), 'LocalStrategy');
        return done(null, false, { message: 'User authenticated with Google. Please use Google login.' });
      }

      // Check if the password matches
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        logInfo('Password mismatch', path.basename(__filename), 'LocalStrategy');
        return done(null, false, { message: 'Incorrect password.' });
      }

      logInfo('User authenticated successfully', path.basename(__filename), 'LocalStrategy');
      return done(null, user);

    } catch (err) {
      logError(err, path.basename(__filename));
      return done(err);
    }
  }
));

passport.use(new GoogleStrategy({
  clientID: process.env.clientid,
  clientSecret: process.env.clientsecret,
  callbackURL: 'http://localhost:4000/auth/google/callback',
  scope: ['openid', 'profile', 'email'],

}, async (token, tokenSecret, profile, done) => {
  try {
    logInfo(`Creating an account for user with profile id ${profile.id}`, path.basename(__filename), 'GoogleStrategy');


    let user = await prisma.user.findUnique({ where: { googleId: profile.id } });


    if (!user) {


      const email = profile.emails && profile.emails[0] && profile.emails[0].value;

      // Check if there is an existing user with the same email
      const existingUserWithEmail = await prisma.user.findUnique({ where: { email: email } });

      if (existingUserWithEmail) {
        // If a user with the same email exists but has no googleId, they signed up using email/password
        return done(null, false, { message: 'An account with this email already exists. Please log in using email and password.' });
      }
      user = await prisma.user.create({
        data: {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails && profile.emails[0] && profile.emails[0].value,
          profilepic: profile.photos && profile.photos[0] && profile.photos[0].value,
          isVerified: true
        }
      });
    }
    return done(null, user);
  } catch (err) {
    console.error('Error:', err);  // Improved error logging
    return done(err);
  }
}));


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
