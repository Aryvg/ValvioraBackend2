const Registered = require('../model/Registered');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const handleLogin = async (req, res) => {
    try {
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
        if (password.length > 64) {
            return res.status(400).json({ message: 'Password must be 64 characters or less.' });
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

        if (!match) return res.sendStatus(401);

        // find the role(s) of the user (user/editor/admin). Defaulting to {}
        // means an account with a missing/broken roles field can never crash
        // login - it just comes back with no special roles instead of
        // failing the whole request.
        const roles = Object.values(foundUser.roles || {}).filter(Boolean);

        // Access token: short-lived (15m), readable by frontend JS, sent with
        // requests that need auth. Contains username + roles, never the password.
        const accessToken = jwt.sign(
            {
                "UserInfo": {
                    "username": foundUser.username,
                    "roles": roles
                }
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        );

        // Refresh token: longer-lived (1d), stored in an httpOnly cookie so JS
        // can't read it. Used to silently mint new access tokens.
        const refreshToken = jwt.sign(
            { "username": foundUser.username },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '1d' }
        );

        if (process.env.NODE_ENV !== 'production') {
            try { console.log('Generated refreshToken for:', foundUser.username); } catch (e) {}
        }

        // persist refreshToken without validating the whole document
        await Registered.updateOne({ _id: foundUser._id }, { $set: { refreshToken } }).exec();

        res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge: 24 * 60 * 60 * 1000 });

        // Send authorization roles and access token to the frontend
        res.json({ roles, accessToken });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Server error during login.' });
    }
}

module.exports = { handleLogin };
