
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export const ensureAuthenticated = async (req, res, next) => {

  if (req.isAuthenticated() && req.user) {
    req.userId = req.user.id;

    try {



      return next();
    } catch (error) {

      return res.status(500).send("Internal Server Error");
    }
  }


  res.redirect('/login');
};