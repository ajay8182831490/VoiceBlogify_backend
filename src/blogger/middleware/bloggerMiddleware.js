



const checkAuthBlogger = async (req, res, next) => {
    if (req.isAuthenticated()) {

        if (req.user.googleId) {

            console.log('User is authenticated with Google.');
            return next(); // Proceed to create post
        } else {

            console.log('User is authenticated with local email.');
            req.session.returnTo = req.originalUrl; // Store the original URL
            return res.redirect('/auth/google');
        }
    } else {

        req.session.returnTo = req.originalUrl; // Save the original URL
        return res.redirect('/auth/google'); // Redirect to Google login
    }
}
export default checkAuthBlogger