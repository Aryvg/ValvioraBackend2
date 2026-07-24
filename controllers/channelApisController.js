const ChannelData = require('../model/ChannelApi');
const YoutubeHomepageApi = require('../model/YoutubeHomepageApi');
const AggregatedVideoApi = require('../model/Aggregatedvideoapi');
const AggregatedShortsApi = require('../model/AggregatedShortsApi');
const Videocontentapi = require('../model/Videocontentapi');
const Videosummaryapi = require('../model/Videosummaryapi');
const Thumbnailapi = require('../model/Thumbnailapi');
const ShortsContentApi = require('../model/ShortsContentApi');
const ShortsSummaryApi = require('../model/ShortsSummaryApi');
const PlaylistHomeApi = require('../model/PlaylistHomeApi');
const fs = require('fs');
const crypto = require('crypto'); // for generating channelId
const path = require('path');
const { ChannelApiSanitization, handleValidationErrors } = require('../middleware/sanitization');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');

// helper: upload buffer to cloudinary and return secure_url
const uploadBufferToCloudinary = async (file, folder = 'channels') => {
    if (!file) return null;
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const res = await cloudinary.uploader.upload(dataUri, { folder });
    return res.secure_url || res.url || null;
};

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

const makeMediaUrl = (mediaPath, req) => {
    if (!mediaPath) return '';
    if (typeof mediaPath !== 'string') return '';
    const trimmed = mediaPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    // if path contains directories, use basename and route through media controller
    const base = path.basename(trimmed);
    return `${req.protocol}://${req.get('host')}/media/file/${encodeURIComponent(base)}`;
}



const getAllChannelDatas = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        let token = null;
        if (authHeader && typeof authHeader === 'string') {
            const parts = authHeader.split(' ');
            token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : authHeader;
        }

        // If a valid token is provided, return only the channel created by that user
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
                const info = decoded.UserInfo || decoded.userInfo || null;
                if (info && info.username) {
                    const channel = await ChannelData.findOne({ createdBy: info.username }).lean();
                    if (!channel) return res.status(204).json({ 'message': 'No ChannelDatas found.' });
                    const mapped = {
                        ...channel,
                        profilePicture: makeImageUrl(channel.profilePicture, req),
                        channelBanner: makeImageUrl(channel.channelBanner, req)
                    };
                    return res.json([mapped]);
                }
            } catch (e) {
                console.warn('Invalid token in getAllChannelDatas:', e && e.message);
                return res.status(401).json({ message: 'Invalid access token.' });
            }
        }

        // No auth header or no token provided: return public list of all channels
        try {
            await ChannelData.updateMany({ subscribe: { $exists: false } }, { $set: { subscribe: 0 } });
        } catch (e) { /* ignore */ }

        const channels = await ChannelData.find({}).lean();
        if (!channels || channels.length === 0) {
            return res.status(204).json({ message: 'No ChannelDatas found.' });
        }

        const mappedChannels = channels.map(channel => ({
            ...channel,
            profilePicture: makeImageUrl(channel.profilePicture, req),
            channelBanner: makeImageUrl(channel.channelBanner, req)
        }));

        return res.json(mappedChannels);
    } catch (err) {
        console.error('getAllChannelDatas error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch channels.' });
    }
};

const createNewChannelData = async (req, res) => {
    // For multipart/form-data, fields are in req.body, files in req.files
    const hasProfile = (req.files?.profilePicture?.[0]) || req.body?.profilePicture;
    const hasBanner = (req.files?.channelBanner?.[0]) || req.body?.channelBanner;
    if (!req?.body?.channelname || !req?.body?.channelType || !req?.body?.Description || !hasProfile || !hasBanner || !req?.body?.contactEmail ) {
        return res.status(400).json({ 'message': 'You have not provided the infos required' }); //400 means bad request
    }
    // Validate field lengths
    if (req.body.channelname.length > 50) {
        return res.status(400).json({ message: 'Channel name must not exceed 50 characters.' });
    }
    if (req.body.channelType.length > 50) {
        return res.status(400).json({ message: 'Channel type must not exceed 50 characters.' });
    }
    if (req.body.Description.length > 200) {
        return res.status(400).json({ message: 'Description must not exceed 200 characters.' });
    }
     if (req.body.contactEmail.length > 70) {
        return res.status(400).json({ message: 'Contact email must not exceed 70 characters.' });
    }

    // require Gmail address specifically
    if (!/^[^\s@]+@gmail\.com$/i.test(req.body.contactEmail)) {
        return res.status(400).json({ message: 'Contact email must end with @gmail.com' });
    }

    // Validate uploaded images: only jpg/jpeg/png and max 2MB
    const checkImageFile = (file, fieldName) => {
        if (!file) return { ok: true };
        const mimetype = (file.mimetype || '').toLowerCase();
        const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowed.includes(mimetype)) {
            return { ok: false, message: `${fieldName} must be jpg, jpeg or png only.` };
        }
        const size = file.size || (file.buffer ? file.buffer.length : 0);
        if (size > 2 * 1024 * 1024) {
            return { ok: false, message: `${fieldName} must not exceed 2MB.` };
        }
        return { ok: true };
    };

    if (req.files) {
        if (req.files.profilePicture && req.files.profilePicture[0]) {
            const r = checkImageFile(req.files.profilePicture[0], 'profilePicture');
            if (!r.ok) return res.status(400).json({ message: r.message });
        }
        if (req.files.channelBanner && req.files.channelBanner[0]) {
            const r = checkImageFile(req.files.channelBanner[0], 'channelBanner');
            if (!r.ok) return res.status(400).json({ message: r.message });
        }
    }

    try {
        // ensure user is authenticated (verifyJWT middleware should set req.user)
        if (!req?.user) return res.sendStatus(401);
        // prevent creating more than one channel per user (fast check)
        const existing = await ChannelData.findOne({ createdBy: req.user }).lean();
        if (existing) return res.status(409).json({ message: 'User already has a channel.' });
        let profilePicture = req.body.profilePicture;
        let channelBanner = req.body.channelBanner;

        if (req.files && req.files.profilePicture && req.files.profilePicture[0]) {
            profilePicture = await uploadBufferToCloudinary(req.files.profilePicture[0], 'channels/profilePictures');
        }
        if (req.files && req.files.channelBanner && req.files.channelBanner[0]) {
            channelBanner = await uploadBufferToCloudinary(req.files.channelBanner[0], 'channels/banners');
        }

        const result = await ChannelData.create({
            channelId: crypto.randomUUID(),
            channelname: req.body.channelname,
            channelType: req.body.channelType,
            Description: req.body.Description,
            contactEmail: req.body.contactEmail,
            channelBanner: channelBanner,
            profilePicture: profilePicture,
            subscribe: req.body.subscribe ?? 0,
            createdBy: req.user // set creator from verifyJWT middleware
        });

        res.status(201).json(result);// 201 is success
    } catch (err) {
        // Duplicate key (createdBy unique) -> user already has a channel
        if (err && err.code === 11000) {
            return res.status(409).json({ message: 'User already has a channel.' });
        }
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}

const updateChannelData = async (req, res) => {
    // Accept channelId from either body or query (for form-data)
    const channelId = req.body?.channelId || req.query?.channelId || req.params?.channelId;
    //req.params means /ChannelDatas/123
    //req.query means /ChannelDatas?channelId=123
    if (!channelId) {
        return res.status(400).json({ 'message': 'channelId parameter is required.' });
    }

    const channelData = await ChannelData.findOne({ channelId }).exec(); //gets ChannelData related with the above channelId from the db
    if (!channelData) {
        return res.status(204).json({ "message": `No ChannelData matches channelId ${channelId}.` });
    } //204 means server successfully processed but has no data to return
    if (req.body?.channelname) {
        if (req.body.channelname.length > 50) {
            return res.status(400).json({ message: 'Channel name must not exceed 50 characters.' });
        }
        channelData.channelname = req.body.channelname;
    }
    //replace the old with the new
    if (req.body?.channelType) {
        if (req.body.channelType.length > 50) {
            return res.status(400).json({ message: 'Channel type must not exceed 50 characters.' });
        }
        channelData.channelType = req.body.channelType;
    }
    if (req.body?.Description) {
        if (req.body.Description.length > 200) {
            return res.status(400).json({ message: 'Description must not exceed 200 characters.' });
        }
        channelData.Description = req.body.Description;
    }
    if (req.body?.contactEmail) {
        if (req.body.contactEmail.length > 70) {
            return res.status(400).json({ message: 'Contact email must not exceed 70 characters.' });
        }
        if (!/^[^\s@]+@gmail\.com$/i.test(req.body.contactEmail)) {
            return res.status(400).json({ message: 'Contact email must end with @gmail.com' });
        }
        channelData.contactEmail = req.body.contactEmail;
    }

    if (req.body?.subscribe !== undefined) {
        if (!req.user) {
            return res.status(401).json({ message: 'You must be logged in to subscribe.' });
        }
        if (!Array.isArray(channelData.subscribers)) channelData.subscribers = [];

        const existingIndex = channelData.subscribers.findIndex(s => s.username === req.user);
        if (existingIndex !== -1) {
            channelData.subscribers.splice(existingIndex, 1);
        } else {
            channelData.subscribers.push({ username: req.user, subscribedAt: new Date() });
        }
        channelData.subscribe = channelData.subscribers.length;
    }

    // Handle image and video file replacement (Cloudinary URLs)
    // Validate uploaded images for update: only jpg/jpeg/png and max 2MB
    const validateAndAssign = async (field) => {
        if (req.files && req.files[field] && req.files[field][0]) {
            const file = req.files[field][0];
            const mimetype = (file.mimetype || '').toLowerCase();
            const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowed.includes(mimetype)) {
                return { ok: false, message: `${field} must be jpg, jpeg or png only.` };
            }
            const size = file.size || (file.buffer ? file.buffer.length : 0);
            if (size > 2 * 1024 * 1024) {
                return { ok: false, message: `${field} must not exceed 2MB.` };
            }
            // upload new file to Cloudinary, then delete old one
            const newUrl = await uploadBufferToCloudinary(file, `channels/${field}`);
            if (!newUrl) return { ok: false, message: `Failed to upload ${field}.` };
            // delete previous asset if exists
            try { await safeDeleteCloudinary(channelData[field]); } catch (e) { /* ignore */ }
            channelData[field] = newUrl;
        }
        return { ok: true };
    };

    const r1 = await validateAndAssign('profilePicture');
    if (!r1.ok) return res.status(400).json({ message: r1.message });
    const r2 = await validateAndAssign('channelBanner');
    if (!r2.ok) return res.status(400).json({ message: r2.message });

    const result = await channelData.save();
    const out = result.toObject ? result.toObject() : result;
    out.subscribe = out.subscribe ?? 0;
    out.subscribed = Array.isArray(out.subscribers) && out.subscribers.some(s => s.username === req.user);
    res.json(out);
}

const deleteCloudinaryFields = async (docs, fields = []) => {
    if (!Array.isArray(docs) || !docs.length) return;
    await Promise.all(docs.map(doc => Promise.all((fields || []).map(async (field) => {
        const value = doc?.[field];
        if (typeof value !== 'string' || !value) return;
        const resourceType = /video|videoUrl/i.test(field) ? 'video' : 'image';
        await safeDeleteCloudinary(value, resourceType);
    }))));
};

const deleteChannelData = async (req, res) => {
    const channelId = req.body?.channelId || req.query?.channelId || req.params?.channelId;
    if (!channelId) return res.status(400).json({ 'message': 'channelId required.' });

    const channelData = await ChannelData.findOne({ channelId }).exec();
    if (!channelData) {
        return res.status(204).json({ "message": `No ChannelData matches channelId ${channelId}.` });
    }

    const channelQuery = { $or: [{ channelId }, { createdBy: channelData.createdBy }] };
    const [videoDocs, homeDocs, shortsDocs, contentDocs, summaryDocs, thumbnailDocs, shortsContentDocs, shortsSummaryDocs, playlistDocs] = await Promise.all([
        AggregatedVideoApi.find(channelQuery).lean(),
        YoutubeHomepageApi.find(channelQuery).lean(),
        AggregatedShortsApi.find(channelQuery).lean(),
        Videocontentapi.find(channelQuery).lean(),
        Videosummaryapi.find(channelQuery).lean(),
        Thumbnailapi.find(channelQuery).lean(),
        ShortsContentApi.find(channelQuery).lean(),
        ShortsSummaryApi.find(channelQuery).lean(),
        PlaylistHomeApi.find(channelQuery).lean()
    ]);

    await Promise.all([
        deleteCloudinaryFields(videoDocs, ['video', 'image']),
        deleteCloudinaryFields(homeDocs, ['image']),
        deleteCloudinaryFields(shortsDocs, ['thumbnail', 'videoUrl']),
        deleteCloudinaryFields(contentDocs, ['video']),
        deleteCloudinaryFields(summaryDocs, ['image']),
        deleteCloudinaryFields(thumbnailDocs, ['image']),
        deleteCloudinaryFields(shortsContentDocs, ['videoUrl']),
        deleteCloudinaryFields(shortsSummaryDocs, ['thumbnail']),
        deleteCloudinaryFields(playlistDocs, ['thumbnail']),
        safeDeleteCloudinary(channelData.profilePicture, 'image'),
        safeDeleteCloudinary(channelData.channelBanner, 'image')
    ]);

    const result = await Promise.all([
        AggregatedVideoApi.deleteMany(channelQuery),
        YoutubeHomepageApi.deleteMany(channelQuery),
        AggregatedShortsApi.deleteMany(channelQuery),
        Videocontentapi.deleteMany(channelQuery),
        Videosummaryapi.deleteMany(channelQuery),
        Thumbnailapi.deleteMany(channelQuery),
        ShortsContentApi.deleteMany(channelQuery),
        ShortsSummaryApi.deleteMany(channelQuery),
        PlaylistHomeApi.deleteMany(channelQuery),
        ChannelData.deleteOne({ channelId })
    ]);

    res.json({ acknowledged: true, deletedCount: result?.[result.length - 1]?.deletedCount ?? 1 });
}

const getChannelData = async (req, res) => {
    const channelId = req.params?.channelId || req.query?.channelId || req.body?.channelId;
    if (!channelId) return res.status(400).json({ 'message': 'channelId required.' });

    const channelData = await ChannelData.findOne({ channelId }).lean();
    if (!channelData) {
        return res.status(204).json({ "message": `No ChannelData matches channelId ${channelId}.` });
    }
    if (channelData.subscribe === undefined) {
        try { await ChannelData.updateOne({ channelId }, { $set: { subscribe: 0 } }); } catch (e) { /* ignore */ }
        channelData.subscribe = 0;
    }

    let currentUsername = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === 'string') {
        const parts = authHeader.split(' ');
        const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : authHeader;
        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            const info = decoded.UserInfo || decoded.userInfo || null;
            currentUsername = info?.username || null;
        } catch (e) { /* not logged in / expired token — treat as anonymous */ }
    }

    channelData.subscribed = currentUsername ? (channelData.subscribers || []).some(s => s.username === currentUsername) : false;
    channelData.profilePicture = makeImageUrl(channelData.profilePicture, req);
    channelData.channelBanner = makeImageUrl(channelData.channelBanner, req);
    res.json(channelData);
}



// know here that making the frontend get a real format text which is not sanitized is handled by the frontend. if the user sends <script></script> as a comment, the frontend should show it as <script></script> and not as &lt;script&gt;&lt;/script&gt; because the backend sanitizes it to prevent code injection but the frontend should show the real text which is <script></script> and not the sanitized version. so the frontend should convert &lt; to < and &gt; to > and so on when displaying comments and skills. this way we can prevent code injection while still showing the real text to users.
module.exports = {
    getAllChannelDatas,
    createNewChannelData,
    updateChannelData,
    deleteChannelData,
    getChannelData,
    // returns { exists: true, channel } or { exists: false }
    checkUserChannel: async (req, res) => {
        try {
            if (!req?.user) return res.sendStatus(401);
            const channel = await ChannelData.findOne({ createdBy: req.user }).lean();
            if (!channel) return res.json({ exists: false });
            channel.profilePicture = makeImageUrl(channel.profilePicture, req);
            channel.channelBanner = makeImageUrl(channel.channelBanner, req);
            return res.json({ exists: true, channel });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Server error' });
        }
    },
    ChannelApiSanitization,
    handleValidationErrors
}

// helper: extract cloudinary public_id from a cloudinary URL
const extractCloudinaryPublicId = (url) => {
    try {
        const u = new URL(url);
        const parts = u.pathname.split('/');
        const uploadIndex = parts.findIndex(p => p === 'upload');
        if (uploadIndex === -1) return null;
        let rest = parts.slice(uploadIndex + 1); // may start with v12345
        if (rest.length && /^v\d+$/.test(rest[0])) rest = rest.slice(1);
        if (rest.length === 0) return null;
        const last = rest.join('/');
        // strip extension
        return last.replace(/\.[a-zA-Z0-9]+$/, '');
    } catch (e) {
        return null;
    }
}

const safeDeleteCloudinary = async (url, resourceType = 'image') => {
    try {
        const pub = extractCloudinaryPublicId(url);
        if (!pub) return;
        await cloudinary.uploader.destroy(pub, { resource_type: resourceType });
    } catch (e) {
        // ignore
    }
}