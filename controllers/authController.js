const Registered = require('../model/Registered');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const handleLogin = async (req, res) => {
    const username = (req.body.username || req.body.user || '').trim();
    const password = (req.body.password || req.body.pwd || '');

    if (!username || !password) return res.status(400).json({ 'message': 'Username and password are required.' });

    // Validate username length
    if (username.length > 50) {
        return res.status(400).json({ message: 'Username must be 50 characters or less.' });
    }

    // Validate username is a gmail address
    const emailRegex = /^[\w-.]+@gmail\.com$/;
    if (!emailRegex.test(username)) {
        return res.status(400).json({ message: 'Username must be a valid @gmail.com email.' });
    }

    // Validate password max length
    if (password.length > 12) {
        return res.status(400).json({ message: 'Password must be 12 characters or less.' });
    }

    const foundUser = await Registered.findOne({ username: username }).exec();
    if (!foundUser) return res.sendStatus(401); //Unauthorized 
    // evaluate password
    let match = false;
    try {
        match = await bcrypt.compare(password, foundUser.password);
    } catch (e) {
        match = false;
    }

    // Migration fallback: if stored password was plaintext (older records), accept and re-hash it
    if (!match && foundUser.password && password === foundUser.password) {
        try {
            const newHash = await bcrypt.hash(password, 10);
            // update only the password field to avoid triggering full-document validation
            await Registered.updateOne({ _id: foundUser._id }, { $set: { password: newHash } }).exec();
            foundUser.password = newHash;
            match = true;
        } catch (e) {
            // ignore migration error and treat as non-match
            match = false;
        }
    }

    if (match) {
        const roles = Object.values(foundUser.roles).filter(Boolean);// find the role of the user like user or admin or editor
        //What is acess token?
        //When a user logs in, he sends his username and password. then the server checks if the username and password that had been sent is similar to the one that is already located in the db. if the username and password the user sent is similar to the one in the db, the server verifies it and logs the person in. But when the server verifies the user, it creates what we call an access Token and sends it to the frontend(browser)- since it is stored on the browser, it can be read by the js. This access Token is useful because when the user forexample wants to give a comment on the webiste or upload videos or do what he is allowed to do, he does not have to send again his username and password to be allowed to do that but the acess Token stored in the frontend will be sent to let the user do all of that. And access Token does not contain password in it. but it contains roles and username within it. We have to make the access Token expire because if it does not expire and can be used forever, a hacker can steal it from the frontend in which it is stored and can access the user's account temporarily like viewing his profile, data and changing account setting like email, username and stuff. So 15 minutes is enough.

        //What is refresh token?
        //Refresh token is created by the server at the same time as access token. And it will be stored in the frontend or browser but in httponly cookie meaning that it can not be read by the js or there is no way we can read it from the frontend but access token can be read from the browser which make sit insecure and that is why we make it expire quickly.
        //what are cookies
        //a cookie is a container that a refresh token is stored in. it does not get created at the same time as refresh Token but gets created in the browser when the refresh Token is sent to the browser to store it. cookie is not a token but a container that refresh Token is stored in. cookie becomes secure if we make httpOnly:true so that it will not be read by the javascript. and when refresh token moves, it moves being inside the cookie. so cookie moves the refresh token to protect it.
        //How are access Token and referesh Token related?
        // When access Token expires, browser sends refresh Token to the server and the server checks if the refresh Token is valid and if the refresh token is valid, it creates a new access token and sends it to the browser. when we leave the website without logging out, we become logged in as long as the refersh token has not expired without entering our username and password. but we click log out, the r efersh token gets deleted. the refrsh token gets deleted everytime when it expires and we can not extend its expiry time unless we log out and log in again to make the expiry time start again.
        //accessToken and jwt or refershTokena and jwt are the same- but accessToken is the role but jwt is the format or sturcture
        // create JWTs
        const accessToken = jwt.sign(// jswt.sign means create a jwt token
            {
                "UserInfo": {// let this token that gets created contain the username and role of the user
                    "username": foundUser.username,
                    "roles": roles
                }
            },
            process.env.ACCESS_TOKEN_SECRET,// used to lock or protect the token so that no body can fake it or change it. so no body has to see the one we have in .env
            { expiresIn: '15m' }
        );// so this in genral creates an acess token like eyjh....

        const refreshToken = jwt.sign(
            { "username": foundUser.username },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '1d' }
        );
        // Log refreshToken in development only for debugging
        if (process.env.NODE_ENV !== 'production') {
            try { console.log('Generated refreshToken:', refreshToken); } catch (e) {}
        }
        // Saving refreshToken with current user
        // persist refreshToken without validating the whole document
        await Registered.updateOne({ _id: foundUser._id }, { $set: { refreshToken } }).exec();
        if (process.env.NODE_ENV !== 'production') {
            try { console.log('Stored refreshToken for user:', foundUser.username); } catch (e) {}
        }
        console.log(roles);
        

        res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge:  24 * 60 * 60 * 1000 });//this stores refrsh token in browser cookie

        // In production set `secure: true` and consider `sameSite: 'None'` when using cross-site requests.
        //maxAge: 24 * 60 * 60 * 1000 like
        //res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

        //httpOnly:true means js can not read it
        //samSite:'None'
        //secure:'true' means cookie is sent only  over https(safe internet)
        //maxAge: 30*1000 means after 30 seconds, cookie expires

        //know here
        // if refresh token expires faster than cookie, cookie exists but token inside it is invalid. so cookie is useless.
        // if cookie expires faster than refresh token, cookie is deleted from the browser, refresh token exists in the db but the user gets logged out because the browser can not send refresh token
        // generally, know that login only works if cookie and refershTokenare valid. if either one breaks, the user will be logged out.
        
        // Send authorization roles and access token to user
        res.json({ roles, accessToken });// sends data like roles and accessToken from server to frontend

    } else {
        res.sendStatus(401);
    }
}

module.exports = { handleLogin };