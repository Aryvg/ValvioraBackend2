const User = require('../model/User');
const Registered = require('../model/Registered');
const jwt = require('jsonwebtoken');

const handleRefreshToken = async (req, res) => {
    const cookies = req.cookies;// get all cookies from the browser
    if (!cookies?.jwt) return res.sendStatus(401);// if there is no cookie, the user is not allowed
    const refreshToken = cookies.jwt;// find the refreshToken which is inside the cookies

    // Try pending users first, then finalized registrations
    let foundUser = await User.findOne({ refreshToken }).exec(); //find which user owns this refreshToken
    if (!foundUser) {
        foundUser = await Registered.findOne({ refreshToken }).exec();
    }
    if (!foundUser) return res.sendStatus(403); //Forbidden 
    // evaluate jwt 
    jwt.verify(// check if the refreshToken is real and has not expired
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        (err, decoded) => {
            if (err || foundUser.username !== decoded.username) return res.sendStatus(403);// reject if the refreshToken is not valid or if the username in the refreshToken does not match the one in the db
            const roles = Object.values(foundUser.roles).filter(Boolean);// extract user roles from the db
            const accessToken = jwt.sign(// creates new accesstoken
                {
                    "UserInfo": {
                        "username": decoded.username,
                        "roles": roles
                    }
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '15m' }
            );
            res.json({ roles, accessToken })// the newly created access token will be sent back to the browser
        }
    );
}

module.exports = { handleRefreshToken }