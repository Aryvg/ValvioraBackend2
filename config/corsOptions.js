const allowedOrigins = require('./allowedOrigins');

const corsOptions = {
    // For development: reflect the request origin (allow any origin).
    // This permits requests from file:// (null origin) and localhost origins.
    origin: true,
    optionsSuccessStatus: 200
};

module.exports = corsOptions;