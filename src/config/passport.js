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
  async (username, password, done) => {
    try {
      logInfo(`Going to create an acccount for user with email ${username}`, path.basename(__filename), 'LocalStrategy');
      const user = await prisma.user.findUnique({ where: { email: username } });
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }
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
      user = await prisma.user.create({
        data: {
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails && profile.emails[0] && profile.emails[0].value,
          profilepic: profile.photos && profile.photos[0] && profile.photos[0].value
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
