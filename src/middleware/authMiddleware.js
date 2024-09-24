

export const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {

    req.userId = req.user.id;


    return next();
  }


  res.redirect('/login');
};
