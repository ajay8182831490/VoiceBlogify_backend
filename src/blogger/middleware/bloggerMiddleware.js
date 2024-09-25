



const checkAuthBlogger = async (req, res, next) => {
    if (req.isAuthenticated()) {

        if (req.user.googleId) {


            return next();
        } else {

            console.log('User is authenticated with local email.');
            req.session.returnTo = req.originalUrl;
            return res.redirect('/auth/google');
        }
    } else {

        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/google');
    }
}
export default checkAuthBlogger