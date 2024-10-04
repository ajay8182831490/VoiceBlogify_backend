


export const ensureAuthenticated = async (req, res, next) => {

  if (req.isAuthenticated() && req.user) {
    req.userId = req.user.id;
    return next(); // Ensure you return after calling next()
  }


  return res.redirect('/login'); // Return after sending a response
};