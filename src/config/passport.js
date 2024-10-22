import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logInfo, logError } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
import validator from 'validator'

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
      if (!validator.isEmail(email)) {
        return done(null, false, { message: 'Invalid email format' });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        logInfo(`No user found with email: ${email}`, path.basename(__filename), 'LocalStrategy');
        return done(null, false, { message: 'Enter a correct email id.' });
      }


      if (!validator.isStrongPassword(password, {
        minLength: 6,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      })) {
        return done(null, false, { message: ' Weak password !Please enter correct password' });
      }

      if (user.googleId) {
        logInfo('User authenticated with Google attempting local login', path.basename(__filename), 'LocalStrategy');
        return done(null, false, { message: 'User authenticated with Google. Please use Google login.' });
      }


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
  callbackURL: 'https://api.voiceblogify.in/auth/google/callback',
  //callbackURL: 'http://localhost:4000/auth/google/callback',

  scope: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/blogger'],
}, async (token, refreshToken, profile, done) => {
  try {
    const { id: googleId, displayName: name, emails, photos } = profile;
    const email = emails?.[0]?.value;

    logInfo(`Authenticating user with profile id ${googleId} or ${email}`, path.basename(__filename), 'GoogleStrategy');


    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          name,
          profilepic: photos?.[0]?.value,
          userAccessToken: token,
          isVerified: true,
          RefreshToken: refreshToken,
          lastActiveDay: new Date()
        },
      });
    } else {

      user = await prisma.user.create({
        data: {
          googleId,
          name,
          email,
          profilepic: photos?.[0]?.value,
          isVerified: true,
          userAccessToken: token,
          RefreshToken: refreshToken
        },
      });


      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: 'FREE',

          status: 'ACTIVE',


          startDate: new Date(),
          remainingPosts: 3,

        },
      });
    }

    return done(null, user);
  } catch (err) {
    logError(err, path.basename(__filename));
    return done(err);
  }
}));




passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {


    const user = await prisma.user.findUnique({
      where: { id }, select: {
        id: true,
        email: true,
        googleId: true,
        name: true,
        profilepic: true,
        blogCount: true,
        isVerified: true,
        subscriptions: {
          select: {
            remainingPosts: true,
            plan: true,
          },
        },
      }
    });


    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
