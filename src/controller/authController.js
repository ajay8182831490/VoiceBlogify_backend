
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hashPassword.js';
import { logError, logInfo } from '../utils/logger.js';
import { sendEmailforOtp } from '../utils/util.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const prisma = new PrismaClient();
//const rateLimit = require('express-rate-limit');
//
import rateLimit from 'express-rate-limit';
import exp from 'constants';
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
  const { email, password, name } = req.body;
  logInfo(`going to register a new account for user email ${email} `, path.basename(__filename), registerUser);
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: email }
    });

    if (existingUser) {
      return res.status(400).send('User already exists');
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.create({
      data: {

        email: email,
        password: hashedPassword,
        name: name
      }
    });

    res.send('User registered successfully');
  } catch (err) {
    logError(err, path.basename(__filename));
    res.status(500).send('Error registering user');
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
  logInfo(`going to reset the password for the user ${req.email}`, path.basename(__filename), resetPassword);

  try {
    // here firstle verify the user and  expiry time link and after that we will verify the otp

    const { otp, email, newPassword } = req.body;

    if (!otp || !email || newPassword) {
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
        data: { otp: "", expiryTime: null }
      });
      return res.status(402).json({ message: "OTP has expired. Please request a new one." });
    }

    if (otp !== storedOtp) {
      return res.status(401).json({ message: "Invalid OTP." });
    }

    // now here we will HASHED THE PASSWORD
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: {
        email
      }, data: {
        otp: "",
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


export const otpGeneration = async (req, res) => {

  logInfo(`Going to send the otp for the reset password for user ${req.email}`, path.basename(__filename), otpGeneration);
  try {

    const { email } = req.body;
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
        expiryTime: Date.now() + 3 * 60 * 1000,
      }
    }))

    res.status(200).json({ message: "otp has send successfully" });



  } catch (ex) {
    logError(ex, path.basename(__filename));
    res.status(500).json({ message: 'Internal error' });
  }

}
export const checkAuth = async (req, res, next) => {
  try {
    if (req.isAuthenticated()) {

      console.log(req.user);
      return res.status(200).json({ authenticated: true, user: req.user });
    }
    return res.status(401).json({ authenticated: false });
  } catch (ex) {
    logError(ex, path.basename(__filename));
    res.status(500).json({ message: 'Internal error' });
  }
}