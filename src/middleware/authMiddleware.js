

export const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
   console.log(req.user);
    req.userId = req.user.id;
  console.log("not authenicated);

    return next();
  }
   console.log("not authenicated);

  res.redirect('/login');
};
