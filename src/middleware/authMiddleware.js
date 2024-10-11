


export const ensureAuthenticated = async (req, res, next) => {

  if (req.isAuthenticated() && req.user) {

    req.userId = req.user.id;

    return next();
  }


  return res.redirect('/login');
};