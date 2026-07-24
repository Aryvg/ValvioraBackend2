const ChannelData = require('../model/ChannelApi');

// Same helper channelApisController.js uses: Cloudinary URLs (http/https)
// pass through untouched; legacy relative paths get resolved against the host.
const makeImageUrl = (imgPath, req) => {
    if (!imgPath) return '';
    if (typeof imgPath !== 'string') return '';
    const trimmed = imgPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    const clean = trimmed.replace(/^\/+/, '');
    return `${req.protocol}://${req.get('host')}/${clean}`;
}

// GET /subscribedChannelsApi
// Requires verifyJWT (sets req.user to the logged-in username, same as
// channelApisController.checkUserChannel does).
// Queries ChannelApi directly and live on every request — no separate
// collection, no cache — so channel name/picture/subscriber changes show
// up immediately without any extra sync step.
const getSubscribedChannels = async (req, res) => {
    try {
        if (!req?.user) return res.sendStatus(401);

        const channels = await ChannelData
            .find({ 'subscribers.username': req.user })
            .select('channelId channelname profilePicture')
            .lean();

        if (!channels || channels.length === 0) {
            return res.status(204).json({ message: 'No subscribed channels found.' });
        }

        const mapped = channels.map(channel => ({
            channelId: channel.channelId,
            channelname: channel.channelname,
            profilePicture: makeImageUrl(channel.profilePicture, req)
        }));

        return res.json(mapped);
    } catch (err) {
        console.error('getSubscribedChannels error:', err?.message || err);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getSubscribedChannels
};
