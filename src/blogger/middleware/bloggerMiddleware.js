
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();


const checkAuthBlogger = async (req, res, next) => {
    if (req.isAuthenticated()) {

        if (req.user.googleId) {

            const response = await prisma.user.findFirst({
                where: {
                    id: req.userId
                },
                select: {
                    userAccessToken: true
                }
            })
            if (response && response.userAccessToken) {
                req.BloggerAccessToken = response.userAccessToken;

                return next();
            }



            return next();
        } else {


            req.session.returnTo = req.originalUrl;
            return res.redirect('/auth/google');
        }
    } else {

        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/google');
    }
}
export default checkAuthBlogger