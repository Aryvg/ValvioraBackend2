const NotificationApi = require('../model/NotificationApi');

// GET /notificationApi
// Returns every notification whose isRead is true for the logged-in user only.
const getNotifications = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        const notifications = await NotificationApi.find({ user: req.user, isRead: true })
            .sort({ createdAt: 1 })
            .lean();

        const shaped = (notifications || []).map(n => ({
            videoId: n.videoId,
            channelId: n.channelId,
            profilePicture: n.profilePicture || '',
            title: n.title,
            image: n.image || '',
            timer: n.timer || '0:00',
            isRead: n.isRead,
            createdAt: n.createdAt
        }));

        return res.json({
            user: req.user,
            videoCount: shaped.length,
            notifications: shaped
        });
    } catch (err) {
        console.error('getNotifications error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch notifications. Please try again.' });
    }
};

// POST /notificationApi
// Body: { videoId, channelId, isRead }
// Updates one notification belonging to the logged-in user.
const updateNotificationReadStatus = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        const { videoId, channelId } = req.body || {};
        if (!videoId || !channelId) {
            return res.status(400).json({ message: 'videoId and channelId are required.' });
        }
        if (typeof req.body?.isRead === 'undefined') {
            return res.status(400).json({ message: 'isRead is required.' });
        }

        const record = await NotificationApi.findOne({ user: req.user, videoId, channelId }).exec();
        if (!record) {
            return res.status(204).json({ message: `No notification found for videoId ${videoId}.` });
        }

        record.isRead = req.body.isRead === true || req.body.isRead === 'true';
        await record.save();

        return res.json({ message: 'Notification updated.', videoId, isRead: record.isRead });
    } catch (err) {
        console.error('updateNotificationReadStatus error:', err?.message || err);
        res.status(500).json({ message: 'Failed to update notification. Please try again.' });
    }
};

module.exports = {
    getNotifications,
    updateNotificationReadStatus
};
