
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


const refreshAccessToken = async (refreshToken) => {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    });

    if (!response.ok) {
        throw new Error('Failed to refresh access token');
    }

    return response.json();
};