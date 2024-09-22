

export const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {

    req.userId = req.user.id;


    return next();
  }
  alert("not");

  res.redirect('/login');
};
