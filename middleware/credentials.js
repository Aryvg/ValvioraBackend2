const allowedOrigins = require('../config/allowedOrigins');

const credentials = (req, res, next) => {
    const origin = req.headers.origin;
    // Always allow credentials for development so `credentials: 'include'` works
    // The `cors` middleware will echo the request origin in `Access-Control-Allow-Origin`.
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
}

module.exports = credentials;