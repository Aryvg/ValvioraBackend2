const jwt = require('jsonwebtoken');
const Registered = require('../model/Registered');
const User = require('../model/User');

// List of protected page basenames (without extension)
const PROTECTED_PAGES = [
    'YoutubeHomePage', 'YoutubeSecondPage', 'WatchLater', 'Shorts', 'playlist', 'playlistStyle',
    'channel', 'dashboard', 'mainDashboard', 'createchannel', 'downloads', 'LikedPage', 'account', 'playlist'
];

function isProtectedPath(pathname) {
    if (!pathname) return false;
    const p = pathname.split('?')[0].replace(/^\//, '');
    const base = p.replace(/\.html?$/i, '');
    return PROTECTED_PAGES.some(name => name.toLowerCase() === base.toLowerCase());
}

module.exports = async function (req, res, next) {
    try {
        if (!isProtectedPath(req.path)) return next();

        // Prevent caching of protected pages
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const cookies = req.cookies || {};
        const refreshToken = cookies.jwt;
        if (!refreshToken) {
            return res.redirect('/index');
        }

        // Try pending users first, then finalized registrations
        let foundUser = await User.findOne({ refreshToken }).exec();
        if (!foundUser) {
            foundUser = await Registered.findOne({ refreshToken }).exec();
        }
        if (!foundUser) return res.redirect('/index');

        try {
            const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            if (decoded.username !== foundUser.username) return res.redirect('/index');
            return next();
        } catch (err) {
            return res.redirect('/index');
        }
    } catch (err) {
        console.error('requireAuthForPages error', err);
        return res.redirect('/index');
    }
};
