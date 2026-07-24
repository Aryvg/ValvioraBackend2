const NotInterested = require('../model/NotInterested');
const VideoContentApi = require('../model/Videocontentapi');
const ShortsContentApi = require('../model/ShortsContentApi');
const PlaylistHomeApi = require('../model/PlaylistHomeApi');

const { ensureUserScopedIndex } = NotInterested;

const markNotInterested = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });

        const contentId = req.body?.contentId;
        if (typeof contentId !== 'string' || !contentId.trim()) {
            return res.status(400).json({ message: 'contentId is required.' });
        }
        if (contentId.length > 100) {
            return res.status(400).json({ message: 'contentId must not exceed 100 characters.' });
        }
        if (typeof contentId !== 'string' || Array.isArray(req.body?.contentId) || (req.body && typeof req.body.contentId === 'object' && req.body.contentId !== null)) {
            return res.status(400).json({ message: 'contentId must be a plain string.' });
        }

        const videoDoc = await VideoContentApi.findOne({ videoId: contentId }).lean();
        const shortDoc = await ShortsContentApi.findOne({ shortId: contentId }).lean();
        const playlistDoc = await PlaylistHomeApi.findOne({ playlistId: contentId }).lean();
        let type = null;

        if (videoDoc) type = 'video';
        else if (shortDoc) type = 'short';
        else if (playlistDoc) type = 'playlist';
        else return res.status(404).json({ message: 'Content not found' });

        await ensureUserScopedIndex();

        const username = String(req.user || '').trim();
        const normalizedContentId = String(contentId).trim();
        const existing = await NotInterested.findOne({ username, contentId: normalizedContentId }).lean();
        if (existing) {
            return res.status(200).json({ message: 'Already marked not interested.' });
        }

        await NotInterested.create({ username, contentId: normalizedContentId, type });
        return res.status(201).json({ message: 'Marked not interested.', username, contentId: normalizedContentId, type });
    } catch (err) {
        if (err && err.code === 11000) {
            return res.status(200).json({ message: 'Already marked not interested.' });
        }
        console.error('markNotInterested error:', err?.message || err);
        return res.status(500).json({ message: 'Failed to mark not interested.' });
    }
};

const getNotInterested = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });

        const items = await NotInterested.find({ username: req.user }).lean();
        return res.status(200).json({
            username: req.user,
            notInterested: items.map(({ contentId, type }) => ({ contentId, type }))
        });
    } catch (err) {
        console.error('getNotInterested error:', err?.message || err);
        return res.status(500).json({ message: 'Failed to fetch not interested items.' });
    }
};

const removeNotInterested = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });

        const contentId = req.body?.contentId || req.query?.contentId || req.params?.contentId;
        if (typeof contentId !== 'string' || !contentId.trim()) {
            return res.status(400).json({ message: 'contentId is required.' });
        }

        const result = await NotInterested.deleteOne({ username: req.user, contentId });
        if (result.deletedCount === 0) {
            return res.status(204).json({ message: 'No such entry' });
        }
        return res.status(200).json({ message: 'Removed not interested entry.', contentId });
    } catch (err) {
        console.error('removeNotInterested error:', err?.message || err);
        return res.status(500).json({ message: 'Failed to remove not interested item.' });
    }
};

module.exports = {
    markNotInterested,
    getNotInterested,
    removeNotInterested
};
