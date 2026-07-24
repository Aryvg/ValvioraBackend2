const jwt = require('jsonwebtoken');

const verifyJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    // here req.headers.authorization is what the user sends like when he watches a video and it is the access token that will be sent which is like Bearer yijfkdjfkdjf. what we have by the right side of bearer is access token the frontend sends. and bearer is just a word that tells the server that what is being sent is a token.
    if (!authHeader) {
        // Allow unauthenticated access only to explicit public admin GET routes.
        if (req.method === 'GET' && (
            (req.path === '/channelApi' && req.query.public === '1') ||
            req.path.startsWith('/aggregatedApi/channel') ||
            req.path.startsWith('/playlistVideoApi/channel')
        )) {
            return next();
        }
        return res.sendStatus(401);// 401 means reject
    }

    // Accept either "Bearer <token>" or a bare token pasted into the Authorization header
    let token = null;
    if (typeof authHeader === 'string') {// if authheader is string
        const parts = authHeader.split(' ');// splits 'bearer abc12' to ['bearer', 'abc12']
        token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : authHeader;// removes the bearer and keeps the access token- means if the length of parts is 2 and if its first element in lowercase is bearer, take token to be the access token, otherwise let it be authheader which is bearer plus access token. in this case the first condition is true. so bearer is removed.
    }

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {// here the server checks the token the user sent-it checks if it is created by this server, if it has changed and if it has expired.
        // err means sth is wrong with the token 
        // decoded is the data inside the token like the username and roles and is like
        /*
         decoded={
            userInfo:{
               username:...,
               roles:...
            }
         }
         */
    
        if (err) return res.sendStatus(403);// if sth is wrong with the token, send 403(you are not allowed)


        // Support both payload shapes: { UserInfo: {...} } and { userInfo: {...} }
        const info = decoded.UserInfo || decoded.userInfo || null;
        if (!info) return res.sendStatus(401);// 401 means reject

        req.user = info.username;// attach username to the request
        req.roles = info.roles;// attach roles to the request
        // the importance of this is that when we send a request like to watch a video, the access Token will be sent and th server extracts what was bearer kshjfkdjfd to find the username and roles in the accessToen and know who we are and make us do what we have to do based on that.
        next();
    });
};

module.exports = verifyJWT;