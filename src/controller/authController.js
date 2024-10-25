
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hashPassword.js';
import { logError, logInfo } from '../utils/logger.js';
import { sendEmailforOtp } from '../utils/util.js';
import { fileURLToPath } from 'url';
import path from 'path'
import bcrypt from 'bcrypt';
import sanitizeHtml from 'sanitize-html';

const __filename = fileURLToPath(import.meta.url);
const prisma = new PrismaClient();
import validator from 'validator'
const generateOTP = () => {
  const otpLength = 6;
  const min = Math.pow(10, otpLength - 1);
  const max = Math.pow(10, otpLength) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};





export const registerUser = async (req, res) => {
  let { email, password, name } = req.body;
  logInfo(`Attempting to register a new account for user email: ${email}`, path.basename(__filename));

  try {
    name = sanitizeHtml(validator.trim(name));
    email = validator.normalizeEmail(email);
    password = validator.trim(password);

    if (!validator.isEmail(email)) {
      logInfo(`Invalid email format: ${email}`, path.basename(__filename));
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!validator.isStrongPassword(password, {
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })) {
      logInfo(`Weak password for email: ${email}`, path.basename(__filename));
      return res.status(400).json({ message: 'Weak password! Please enter a strong password' });
    }

    if (!name || name.length < 2 || !/^[A-Za-z\s'-]+$/.test(name)) {
      logInfo(`Invalid name provided for email: ${email}`, path.basename(__filename));
      return res.status(400).json({ message: 'Invalid name. Must be at least 2 characters and contain only letters, spaces, hyphens, and apostrophes.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email }
    });

    if (existingUser) {
      logInfo(`User already exists for email: ${email}`, path.basename(__filename));
      return res.status(400).json({ message: 'User already exists! Please try to login', authenticated: false });
    }

    const hashedPassword = await hashPassword(password);


    const user = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: name
      }
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: 'FREE',
        status: 'ACTIVE',

        startDate: new Date(),
        remainingPosts: 3,

      }
    });

    req.login(user, (err) => {
      if (err) {
        logError(err, path.basename(__filename));
        return res.status(500).json({ message: 'Login after signup failed' });
      }

      logInfo(`User registered and logged in successfully: ${email}`, path.basename(__filename));
      return res.status(201).json({
        message: 'User registered and logged in successfully',
        authenticated: true,
        name: user.name
      });
    });

  } catch (err) {
    logError(err, path.basename(__filename));
    return res.status(500).json({ message: 'Error occurred during registration' });
  }
};




export const logoutUser = async (req, res) => {
  req.logout(async (err) => {
    if (err) {
      return res.status(500).json({ message: 'Error occured during logout' });
    }

    try {

      await req.session.destroy();



      res.clearCookie('connect.sid');
      res.send('Logged out successfully');
    } catch (error) {
      return res.status(500).json({ message: 'Error destroying session' });
    }
  });
};


export const resetPassword = async (req, res) => {


  const { email } = req.body;
  logInfo(`going to reset the password for the user ${email}`, path.basename(__filename), resetPassword);

  try {



    let { otp, email, password } = req.body;
    if (!otp || !email || !password) {
      return res.status(400).json({ message: 'missing field required' });
    }
    email = validator.normalizeEmail(email);
    otp = validator.trim(otp);
    password = validator.trim(password);
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!validator.isStrongPassword(password, {
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })) {
      return res.status(400).json({ message: 'Weak password ! Please enter a strong passsowrd' });
    }
    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'OTP must be a 6-digit number.' });
    }






    const existingUser = await prisma.user.findUnique({
      where: {
        email
      }
    })
    if (!existingUser) {
      return res.status(402).json({ message: "user does not exist please enter the valid email or signup" });

    }
    const { expiryTime: storedExpiryTime, otp: storedOtp } = existingUser;

    if (Date.now() > storedExpiryTime) {
      await prisma.user.update({
        where: { email },
        data: { otp: null, expiryTime: null }
      });
      return res.status(402).json({ message: "OTP has expired. Please request a new one." });
    }

    if (otp != storedOtp) {
      return res.status(401).json({ message: "Invalid OTP." });
    }


    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: {
        email
      }, data: {
        otp: null,
        expiryTime: null,
        password: hashedPassword

      }
    })
    res.status(200).json({ message: "Password reset successful." });



  } catch (ex) {
    logError(ex, path.basename(__filename));
    res.status(500).json({ message: "error occur during reseting the passowrd" })

  }
}
export const passwordChange = async (req, res) => {
  logInfo(`Going to change the password of user ${req.userId}`, path.basename(__filename), passwordChange);

  try {
    const { oldPassword, newPassword } = req.body;

    const password = validator.trim(newPassword);
    const oPassword = validator.trim(oldPassword);

    if (!validator.isStrongPassword(password, {
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })) {
      return res.status(400).json({ message: 'Weak password ! Please enter a strong passsowrd' });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.userId
      },
      select: {
        password: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const newHashPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: {
        id: req.userId
      },
      data: {
        password: newHashPassword
      }
    });

    res.status(200).json({ message: "Password changed successfully" });

  } catch (ex) {
    logError(ex, path.basename(__filename));
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const otpGeneration = async (req, res) => {
  const { email } = req.body;
  logInfo(`Going to send the otp for the reset password for user ${email}`, path.basename(__filename), otpGeneration);
  try {


    if (!email || !validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email
      }
    });
    if (!existingUser) {
      return res.status(402).json({ message: "user not exist" });
    }
    const otp = generateOTP();
    try {
      await sendEmailforOtp(email, otp);
    } catch (emailError) {
      logError(emailError, path.basename(__filename));
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }
    await prisma.user.update(({
      where: { email }, data: {
        otp: otp,
        expiryTime: new Date(Date.now() + 3 * 60 * 1000),
      }
    }))

    res.status(200).json({ message: "otp has send successfully" });



  } catch (ex) {
    logError(ex, path.basename(__filename));
    res.status(500).json({ message: 'Internal error' });
  }

}
export const checkAuth = async (req, res, next) => {
  if (req.isAuthenticated()) {



    return res.status(200).json({

      authenticated: true,
      name: req.user.name,

      googleId: req.user.googleId ? true : false,
      profilepic: req.user.profilepic || null,
      isVerified: req.user.isVerified,
      isPaid: req.user.isPaid || false,
      email: req.user.email,

      remainingPosts: (req.user && req.user.subscriptions && req.user.subscriptions[0])
        ? req.user.subscriptions[0].remainingPosts
        : 0,

      plan: (req.user && req.user.subscriptions && req.user.subscriptions[0])
        ? req.user.subscriptions[0].plan
        : null


    });
  }

  return res.status(401).json({ authenticated: false });
};


export const AccountVerify = async (req, res, next) => {
  const { email } = req.body;
  logInfo(`going to verfify the account for the user ${email}`, path.basename(__filename), resetPassword);

  try {



    const { otp, email } = req.body;


    if (!otp || !email) {
      return res.status(400).json({ message: 'missing field required' });
    }
    const email1 = validator.normalizeEmail(email);
    const otp1 = validator.trim(otp);

    if (!validator.isEmail(email1)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!otp || !/^\d{6}$/.test(otp1)) {
      return res.status(410).json({ message: 'OTP must be a 6-digit number.' });
    }






    const existingUser = await prisma.user.findUnique({
      where: {
        email: email1
      }
    })
    if (!existingUser) {
      return res.status(404).json({ message: "user does not exist please enter the valid email or signup" });

    }
    const { expiryTime: storedExpiryTime, otp: storedOtp } = existingUser;

    if (Date.now() > storedExpiryTime) {
      await prisma.user.update({
        where: { email: email1 },
        data: { otp: null, expiryTime: null }
      });
      return res.status(410).json({ message: "OTP has expired. Please request a new one." });
    }

    if (otp1 != storedOtp) {
      return res.status(401).json({ message: "Invalid OTP." });
    }




    await prisma.user.update({
      where: {
        email: email1
      }, data: {
        otp: null,
        expiryTime: null,
        isVerified: true


      }
    })
    res.status(200).json({ message: 'Account Verified successfull ' })



  } catch (ex) {
    logError(ex, path.basename(__filename));
    res.status(500).json({ message: "error occur during verify the account" })

  }
}


