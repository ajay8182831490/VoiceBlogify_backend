import { Request, Response, NextFunction } from 'express';

const attachUserId = (req, res, next) => {
    if (req.isAuthenticated() && req.user) {


        req.userId = (req.user).id;
        return next();
    }
    res.status(401).send('Unauthorized');
};

export default attachUserId;