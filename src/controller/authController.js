
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hashPassword.js';
import { logError, logInfo } from '../utils/logger.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const prisma = new PrismaClient();

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

    const { otp, email } = req.body;


  } catch (ex) {
    logError(ex, path.basename(__filename));
    res.status(500).json({ message: "error occur during reseting the passowrd" })

  }
}
