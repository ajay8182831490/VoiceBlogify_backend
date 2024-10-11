

const attachUserId = (req, res, next) => {
    if (req.isAuthenticated() && req.user && req.user.isVerified) {



        return next();
    }
    res.redirect('https://voiceblogify.in/verfied')
};

export default attachUserId;