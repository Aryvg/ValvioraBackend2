const Registered = require('../model/Registered');

const handleLogout = async (req, res) => {
    // On client, also delete the accessToken

    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204); //No content
    const refreshToken = cookies.jwt;

    // Is refreshToken in db?
    const foundUser = await Registered.findOne({ refreshToken }).exec();
    if (!foundUser) {
        res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
        return res.sendStatus(204);
    }

    // Log current refresh token for debug (dev only)
    if (process.env.NODE_ENV !== 'production') {
        try { console.log('Logout request for user:', foundUser.username, 'refreshToken:', refreshToken); } catch(e){}
    }

    // remove refreshToken using targeted update to avoid full validation
    await Registered.updateOne({ _id: foundUser._id }, { $set: { refreshToken: '' } }).exec();

    if (process.env.NODE_ENV !== 'production') {
        try { console.log('Cleared refreshToken for user:', foundUser.username); } catch(e){}
    }

    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
    res.sendStatus(204);
}

module.exports = { handleLogout }