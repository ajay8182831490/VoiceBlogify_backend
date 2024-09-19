

export const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    // Attach the userId to the request
    req.userId = req.user.id;


    return next();
  }


  res.redirect('/login');
};
