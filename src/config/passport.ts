import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

passport.use(new LocalStrategy(
  async (username: string, password: string, done: any) => {
    try {
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
      return done(err);
    }
  }
));

passport.use(new GoogleStrategy({
  clientID: process.env.clientid!,
  clientSecret: process.env.clientsecret!,
  callbackURL: 'https://medium-f2ly.onrender.com/auth/google/callback'
}, async (token: string, tokenSecret: string, profile: any, done: any) => {
  try {


    let user = await prisma.user.findUnique(
      {
        where:
          { googleId: profile.id }
      });
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: profile.id,
          name: profile.displayName,


        }
      });
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done: any) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
