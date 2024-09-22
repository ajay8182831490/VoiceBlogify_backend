
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hashPassword.js';
import { logError, logInfo } from '../utils/logger.js';
import { sendEmailforOtp } from '../utils/util.js';
import { fileURLToPath } from 'url';
import path from 'path'
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const prisma = new PrismaClient();
//const rateLimit = require('express-rate-limit');
//
import rateLimit from 'express-rate-limit';
import exp from 'constants';
const generateOTP = () => {
  const otpLength = 4;
  const min = Math.pow(10, otpLength - 1);
  const max = Math.pow(10, otpLength) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const registerUser = async (req, res) => {
  const { email, password, name } = req.body;
  logInfo(`going to register a new account for user email ${email} `, path.basename(__filename), registerUser);

  try {
    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email }
    });

    if (existingUser) {
      return res.status(200).send({ message: 'User already exists', authenticated: false });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const user = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: name
      }
    });

    // Log in the user after successful signup
    req.login(user, (err) => {
      if (err) {
        logError(err, path.basename(__filename));
        return res.status(500).json({ message: 'Login after signup failed' });
      }

      // Return success response
      return res.status(201).json({
        message: 'User registered and logged in successfully',
        authenticated: true,
        user: {
          name: user.name,
          id: user.id,
          email: user.email
        }
      });
    });

  } catch (err) {
    logError(err, path.basename(__filename));
    return res.status(500).json({ messae: 'Error registering user' });
  }
};

export const logoutUser = (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).send('Error logging out');
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send('Error destroying session');
      }
      res.clearCookie('connect.sid'); // This clears the session cookie
      res.send('User logged out successfully');
    });
  });
};


export const resetPassword = async (req, res) => {


  const { email } = req.body;
  logInfo(`going to reset the password for the user ${email}`, path.basename(__filename), resetPassword);

  try {
    // here firstle verify the user and  expiry time link and after that we will verify the otp

    const { otp, email, password } = req.body;



    if (!otp || !email || !password) {
      return res.status(400).json({ message: 'missing field required' });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email
      }
    })
    if (!existingUser) {
      return res.status(402).json({ message: "user not exist" });

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

    // now here we will HASHED THE PASSWORD
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

    // Compare the provided old password with the stored password
    const isMatch = await bcrypt.compare(oldPassword, user.password);

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
  console.log('Authentication check:', req.user); // Log the user object
  console.log('Cookies:', req.cookies); // Log the cookies

  if (req.isAuthenticated()) {
    return res.status(200).json({
      authenticated: true,
      name: req.user.name,
      id: req.user.id,
      profilepic: req.user.profilepic,
    });
  }
  
  return res.status(401).json({ authenticated: false });
};

