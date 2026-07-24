const PlaylistHomeApi = require('../model/PlaylistHomeApi');
const ChannelData = require('../model/ChannelApi');
const crypto = require('crypto');
const path = require('path');

// copy makeImageUrl verbatim from channelApisController.js
const makeImageUrl = (imgPath, req) => {
    if (!imgPath) return '';
    if (typeof imgPath !== 'string') return '';
    const trimmed = imgPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    // ensure no leading slash duplication
    const clean = trimmed.replace(/^\/+/, '');
    return `${req.protocol}://${req.get('host')}/${clean}`;
}

// Helper: clean incoming thumbnail URLs that may be HTML-encoded or double-prefixed
const cleanImageUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    let decoded = url
        .replace(/&#x2F;/gi, '/')
        .replace(/&amp;/gi, '&')
        .replace(/&#x27;/gi, "'");
    const match = decoded.match(/https?:\/\/[^/]+\/(https?:\/\/.+)/);
    if (match) return match[1];
    return decoded;
};

const getAllPlaylistHomeApis = async (req, res) => {
    try {
        // Return ALL playlists from ALL channels so every user sees them on homepage
        const list = await PlaylistHomeApi.find({}).lean();
        if (!list || list.length === 0) return res.sendStatus(204);
        const mapped = list.map(p => ({
            ...p,
            thumbnail: cleanImageUrl(p.thumbnail || ''),
            ProfilePicture: makeImageUrl(p.ProfilePicture, req)
        }));
        return res.json(mapped);
    } catch (err) {
        console.error('getAllPlaylistHomeApis error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
}

const isPlaylistViewIncrementRequest = (body) => {
    if (!body || typeof body !== 'object') return false;
    const keys = Object.keys(body);
    return keys.length === 2 && body.playlistId && body.views === 1 && body.playlistTitle === undefined && body.thumbnail === undefined;
};

const createNewPlaylistHomeApi = async (req, res) => {
    try {
        if (!req?.user) return res.sendStatus(401);
        if (!req?.body?.playlistTitle) return res.status(400).json({ message: 'playlistTitle is required' });
        const title = req.body.playlistTitle;
        if (typeof title !== 'string' || title.trim().length === 0) return res.status(400).json({ message: 'playlistTitle is required' });
        if (title.trim().length > 100) return res.status(400).json({ message: 'playlistTitle must be 100 characters or fewer' });

        const channel = await ChannelData.findOne({ createdBy: req.user }).lean();
        if (!channel) return res.status(400).json({ message: 'You must have a channel before creating a playlist.' });

        const channelId = channel.channelId;
        const channelName = channel.channelname;
        const ProfilePicture = channel.profilePicture;

        const result = await PlaylistHomeApi.create({
            playlistId:    crypto.randomUUID(),
            channelId,
            playlistTitle: title.trim(),
            thumbnail:     req.body?.thumbnail || '',
            views:         0,
            time:          Date.now(),
            channelName,
            ProfilePicture,
            createdBy:     req.user
        });

        return res.status(201).json(result);
    } catch (err) {
        console.error('createNewPlaylistHomeApi error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
}

const updatePlaylistHomeApi = async (req, res) => {
    try {
        const playlistId = req.body?.playlistId || req.query?.playlistId || req.params?.playlistId;
        if (!playlistId) return res.status(400).json({ message: 'playlistId is required' });
        const item = await PlaylistHomeApi.findOne({ playlistId }).exec();
        if (!item) return res.sendStatus(204);

        const playlistViewIncrementRequest = isPlaylistViewIncrementRequest(req.body);
        if (playlistViewIncrementRequest) {
            if (!req.user) return res.sendStatus(401);
            if (!Array.isArray(item.viewedBy)) item.viewedBy = [];
            const normalizedUser = String(req.user).trim();
            if (normalizedUser && !item.viewedBy.includes(normalizedUser)) {
                item.views = (typeof item.views === 'number' ? item.views : 0) + 1;
                item.viewedBy.push(normalizedUser);
            }
            const saved = await item.save();
            return res.json(saved);
        }

        if (req.body?.playlistTitle) {
            const t = req.body.playlistTitle;
            if (typeof t !== 'string' || t.trim().length === 0) return res.status(400).json({ message: 'playlistTitle is required' });
            if (t.trim().length > 100) return res.status(400).json({ message: 'playlistTitle must be 100 characters or fewer' });
            item.playlistTitle = t.trim();
        }

        if (req.body?.views !== undefined) {
            const v = Number(req.body.views);
            if (Number.isNaN(v) || v < 0) return res.status(400).json({ message: 'views must be a non-negative number' });
            item.views = v;
        }

        if (typeof req.body?.thumbnail !== 'undefined') item.thumbnail = req.body.thumbnail;

        if (req.body?.isBanned !== undefined) {
            item.isBanned = (req.body.isBanned === true || req.body.isBanned === 'true');
        }

        const saved = await item.save();
        return res.json(saved);
    } catch (err) {
        console.error('updatePlaylistHomeApi error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
}

const deletePlaylistHomeApi = async (req, res) => {
    try {
        const playlistId = req.body?.playlistId || req.query?.playlistId || req.params?.playlistId;
        if (!playlistId) return res.status(400).json({ message: 'playlistId is required' });
        const item = await PlaylistHomeApi.findOne({ playlistId }).exec();
        if (!item) return res.sendStatus(204);
        await PlaylistHomeApi.deleteOne({ playlistId });
        return res.json({ message: 'Playlist deleted.', playlistId });
    } catch (err) {
        console.error('deletePlaylistHomeApi error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
}

const getPlaylistHomeApi = async (req, res) => {
    try {
        const playlistId = req.params?.playlistId || req.query?.playlistId || req.body?.playlistId;
        if (!playlistId) return res.status(400).json({ message: 'playlistId is required' });
        const item = await PlaylistHomeApi.findOne({ playlistId }).lean();
        if (!item) return res.sendStatus(204);
        item.ProfilePicture = makeImageUrl(item.ProfilePicture, req);
        return res.json(item);
    } catch (err) {
        console.error('getPlaylistHomeApi error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
}

module.exports = {
    getAllPlaylistHomeApis,
    createNewPlaylistHomeApi,
    updatePlaylistHomeApi,
    deletePlaylistHomeApi,
    getPlaylistHomeApi
};
