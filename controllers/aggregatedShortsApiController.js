const AggregatedShortsApi = require('../model/AggregatedShortsApi');
const crypto = require('crypto');
const path = require('path');
const axios = require('axios');
const ChannelData = require('../model/ChannelApi');
const ShortsSummaryApi = require('../model/ShortsSummaryApi');

const makeImageUrl = (imgPath, req) => {
    if (!imgPath) return '';
    if (typeof imgPath !== 'string') return '';
    const trimmed = imgPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    const clean = trimmed.replace(/^\/+/, '');
    return `${req.protocol}://${req.get('host')}/${clean}`;
}

const makeMediaUrl = (mediaPath, req) => {
    if (!mediaPath) return '';
    if (typeof mediaPath !== 'string') return '';
    const trimmed = mediaPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    const base = path.basename(trimmed);
    return `${req.protocol}://${req.get('host')}/media/file/${encodeURIComponent(base)}`;
}

const getAllAggregatedShortsApis = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });

        const filter = {};
        if (req.query.mine === '1' || req.query.mine === 'true') {
            const channel = await ChannelData.findOne({ createdBy: req.user }).lean();
            if (!channel || !channel.channelId) {
                return res.status(204).json({ message: 'No shorts found.' });
            }
            filter.channelId = channel.channelId;
        }

        const shorts = await AggregatedShortsApi.find(filter).lean();
        if (!shorts || shorts.length === 0) return res.status(204).json({ message: 'No shorts found.' });

        const shortIds = shorts.map(s => s.shortId).filter(Boolean);
        const summaryDocs = await ShortsSummaryApi.find({ shortId: { $in: shortIds } }).lean();
        const summaryById = new Map(summaryDocs.map(s => [s.shortId, s]));

        const mapped = shorts.map(e => {
            const summary = summaryById.get(e.shortId);
            return {
                ...e,
                thumbnail: makeImageUrl(e.thumbnail, req),
                videoUrl: makeMediaUrl(e.videoUrl, req),
                views: typeof summary?.views === 'number' ? summary.views : 0,
                userReaction: (Array.isArray(e.likedBy) && e.likedBy.includes(req.user)) ? 'like'
                    : (Array.isArray(e.dislikedBy) && e.dislikedBy.includes(req.user)) ? 'dislike'
                    : null
            };
        });

        res.json(mapped);
    } catch (err) {
        console.error('getAllAggregatedShortsApis error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch shorts. Please try again.' });
    }
};

const createNewAggregatedShortsApi = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });

        if (!req.body?.title || !req.body.title.toString().trim()) {
            return res.status(400).json({ message: 'title is required' });
        }

        // Enforce file size limits
        const MAX_VIDEO = 95 * 1024 * 1024;
        if (req.files?.video?.[0]?.size > MAX_VIDEO) {
            return res.status(413).json({ message: 'Video file exceeds the 95 MB limit.' });
        }
        if (req.files?.image?.[0]?.size > 5 * 1024 * 1024) {
            return res.status(413).json({ message: 'Thumbnail image exceeds 5 MB. Please use a smaller image.' });
        }

        // Find user's channel
        const channel = await ChannelData.findOne({ createdBy: req.user }).lean();
        if (!channel || !channel.channelId) {
            return res.status(400).json({ message: 'You must have a channel before uploading shorts.' });
        }

        const channelId = channel.channelId;
        const channelName = channel.channelname;
        const ProfilePicture = channel.profilePicture;

        let thumbnail = req.body.thumbnail;
        let videoUrl = req.body.videoUrl;
        if (req.files?.image?.[0]) thumbnail = req.files.image[0].path;
        if (req.files?.video?.[0]) videoUrl = req.files.video[0].path;

        if (!thumbnail) return res.status(400).json({ message: 'thumbnail image is required' });
        if (!videoUrl) return res.status(400).json({ message: 'videoUrl is required' });

        const result = await AggregatedShortsApi.create({
            shortId: crypto.randomUUID(),
            channelId,
            title: req.body.title,
            views: 0,
            thumbnail,
            videoUrl,
            createdAt: new Date().toISOString(),
            Likes: req.body?.Likes || 0,
            Dislikes: req.body?.Dislikes || 0,
            channelName,
            ProfilePicture,
            createdBy: req.user
        });

        // Fan-out to child APIs, forward Authorization header
        const forwardedAuth = req.headers.authorization || req.headers.Authorization || '';
        const axiosConfig = { headers: { Authorization: forwardedAuth } };

        await Promise.all([
            axios.post('https://valviorabackend2.onrender.com/shortsSummaryApi', {
                shortId: result.shortId,
                channelId: result.channelId,
                thumbnail: result.thumbnail,
                title: result.title,
                views: result.views
            }, axiosConfig),
            axios.post('https://valviorabackend2.onrender.com/shortsContentApi', {
                shortId: result.shortId,
                channelId: result.channelId,
                videoUrl: result.videoUrl,
                Likes: result.Likes,
                Dislikes: result.Dislikes,
                channelName: result.channelName,
                ProfilePicture: result.ProfilePicture
            }, axiosConfig)
        ]);

        res.status(201).json({ message: 'Short published successfully.', shortId: result.shortId, channelId: result.channelId });

    } catch (err) {
        console.error('createNewAggregatedShortsApi error:', err?.message || err);
        res.status(500).json({ message: 'Upload failed. Please try again.', error: err?.message });
    }
};

const updateAggregatedShortsApi = async (req, res) => {
    try {
        const shortId = req.body?.shortId || req.query?.shortId || req.params?.shortId;
        if (!shortId) return res.status(400).json({ message: 'shortId parameter is required.' });

        const record = await AggregatedShortsApi.findOne({ shortId }).exec();
        if (!record) return res.status(204).json({ message: `No AggregatedShortsApi matches shortId ${shortId}.` });

        if (req.body?.title) {
            if (req.body.title.length > 100) return res.status(400).json({ message: 'Title must not exceed 100 characters.' });
            record.title = req.body.title;
        }
        if (req.body?.views !== undefined) {
            if (req.body.views < 0) return res.status(400).json({ message: 'Views must be a non-negative number.' });
            record.views = req.body.views;
        }
        if (req.body?.Likes !== undefined) {
            if (req.body.Likes < 0) return res.status(400).json({ message: 'Likes must be a non-negative number.' });
            record.Likes = req.body.Likes;
        }
        if (req.body?.Dislikes !== undefined) {
            if (req.body.Dislikes < 0) return res.status(400).json({ message: 'Dislikes must be a non-negative number.' });
            record.Dislikes = req.body.Dislikes;
        }

        if (req.body?.isBanned !== undefined) {
            record.isBanned = (req.body.isBanned === true || req.body.isBanned === 'true');
        }

        // Handle thumbnail replacement
        if (req.files && req.files.image && req.files.image[0]) {
            const oldThumbnailUrl = req.body?.oldThumbnailUrl || '';
            if (oldThumbnailUrl && oldThumbnailUrl.startsWith('http')) {
                try {
                    const cloudinary = require('../config/cloudinary');
                    const urlObj = new URL(oldThumbnailUrl);
                    const parts = urlObj.pathname.split('/');
                    const uploadIndex = parts.findIndex(p => p === 'upload');
                    if (uploadIndex !== -1) {
                        let rest = parts.slice(uploadIndex + 1);
                        if (rest.length && /^v\d+$/.test(rest[0])) rest = rest.slice(1);
                        const publicId = rest.join('/').replace(/\.[a-zA-Z0-9]+$/, '');
                        if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                    }
                } catch (e) {
                    console.warn('Old thumbnail Cloudinary delete failed during update:', e?.message || e);
                }
            }
            record.thumbnail = req.files.image[0].path;
        }

        if (req.files && req.files.video && req.files.video[0]) {
            record.videoUrl = req.files.video[0].path;
        }

        const result = await record.save();

        // Fan-out updates to child APIs so they stay in sync with aggregated data
        const forwardedAuth = req.headers?.authorization || req.headers?.Authorization || '';
        const axiosConfig = { headers: { Authorization: forwardedAuth } };

        // Full mirror sync — always send ALL current values from the saved record
        // so ShortsSummaryApi and ShortsContentApi are always an exact copy
        await Promise.allSettled([
            axios.put('https://valviorabackend2.onrender.com/shortsSummaryApi', {
                shortId: result.shortId,
                title: result.title,
                views: result.views,
                thumbnail: result.thumbnail,
                isBanned: result.isBanned
            }, axiosConfig),

            axios.put('https://valviorabackend2.onrender.com/shortsContentApi', {
                shortId: result.shortId,
                Likes: result.Likes,
                Dislikes: result.Dislikes,
                videoUrl: result.videoUrl
            }, axiosConfig)
        ]).then(fanOutResults => {
            fanOutResults.forEach((r, i) => {
                const names = ['shortsSummaryApi', 'shortsContentApi'];
                if (r.status === 'rejected') {
                    console.warn(`Update fan-out to ${names[i]} failed:`, r.reason?.message || r.reason);
                }
            });
        });

        res.json(result);
    } catch (err) {
        console.error('updateAggregatedShortsApi error:', err?.message || err);
        res.status(500).json({ message: 'Update failed. Please try again.', error: err?.message });
    }
};

const updateShortReaction = async (req, res, reaction) => {
    const { shortId } = req.params;
    if (!shortId) return res.status(400).json({ message: 'shortId is required.' });
    if (!req.user) return res.status(401).json({ message: 'You must be logged in.' });

    try {
        const record = await AggregatedShortsApi.findOne({ shortId }).exec();
        if (!record) return res.status(404).json({ message: 'Short not found.' });

        if (!Array.isArray(record.likedBy)) record.likedBy = [];
        if (!Array.isArray(record.dislikedBy)) record.dislikedBy = [];

        const hasLiked = record.likedBy.includes(req.user);
        const hasDisliked = record.dislikedBy.includes(req.user);

        if (reaction === 'like') {
            if (hasLiked) {
                record.likedBy = record.likedBy.filter(u => u !== req.user);
            } else {
                record.likedBy.push(req.user);
                if (hasDisliked) record.dislikedBy = record.dislikedBy.filter(u => u !== req.user);
            }
        } else {
            if (hasDisliked) {
                record.dislikedBy = record.dislikedBy.filter(u => u !== req.user);
            } else {
                record.dislikedBy.push(req.user);
                if (hasLiked) record.likedBy = record.likedBy.filter(u => u !== req.user);
            }
        }

        record.Likes = record.likedBy.length;
        record.Dislikes = record.dislikedBy.length;

        const updated = await record.save();

        try {
            const forwardedAuth = req.headers.authorization || req.headers.Authorization || '';
            await axios.put('https://valviorabackend2.onrender.com/shortsContentApi', {
                shortId: updated.shortId,
                Likes: updated.Likes,
                Dislikes: updated.Dislikes
            }, { headers: { Authorization: forwardedAuth } });
        } catch (fanOutErr) {
            console.warn('shortsContentApi like/dislike fan-out failed:', fanOutErr?.message || fanOutErr);
        }

        res.json({
            message: reaction === 'like' ? 'Like updated.' : 'Dislike updated.',
            Likes: updated.Likes,
            Dislikes: updated.Dislikes,
            userReaction: updated.likedBy.includes(req.user)
                ? 'like'
                : (updated.dislikedBy.includes(req.user) ? 'dislike' : null)
        });
    } catch (err) {
        console.error(`updateShortReaction (${reaction}) error:`, err);
        res.status(500).json({ message: 'Failed to update reaction.' });
    }
};

const likeAggregatedShort = (req, res) => updateShortReaction(req, res, 'like');
const dislikeAggregatedShort = (req, res) => updateShortReaction(req, res, 'dislike');

const deleteAggregatedShortsApi = async (req, res) => {
    const shortId = req.body?.shortId || req.query?.shortId || req.params?.shortId;
    if (!shortId) return res.status(400).json({ message: 'shortId required.' });

    try {
        const record = await AggregatedShortsApi.findOne({ shortId }).exec();
        if (!record) return res.status(204).json({ message: `No AggregatedShortsApi matches shortId ${shortId}.` });

        const thumbnailUrl = record.thumbnail || '';
        const videoUrl = record.videoUrl || '';

        await record.deleteOne();

        const deleteFromCloudinary = async (url, resourceType) => {
            if (!url || !url.startsWith('http')) return;
            try {
                const urlObj = new URL(url);
                const parts = urlObj.pathname.split('/');
                const uploadIndex = parts.findIndex(p => p === 'upload');
                if (uploadIndex === -1) return;
                let rest = parts.slice(uploadIndex + 1);
                if (rest.length && /^v\d+$/.test(rest[0])) rest = rest.slice(1);
                const publicId = rest.join('/').replace(/\.[a-zA-Z0-9]+$/, '');
                if (!publicId) return;
                const cloudinary = require('../config/cloudinary');
                await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
                console.log(`Deleted from Cloudinary: ${publicId} (${resourceType})`);
            } catch (e) {
                console.warn(`Cloudinary delete failed for ${url}:`, e?.message || e);
            }
        };

        await Promise.all([
            deleteFromCloudinary(thumbnailUrl, 'image'),
            deleteFromCloudinary(videoUrl, 'video')
        ]);

        const forwardedAuth = req.headers.authorization || req.headers.Authorization || '';
        const axiosConfig = {
            headers: { 'Authorization': forwardedAuth, 'Content-Type': 'application/json' },
            data: { shortId }
        };

        const fanOutResults = await Promise.allSettled([
            axios.delete('https://valviorabackend2.onrender.com/shortsSummaryApi', axiosConfig),
            axios.delete('https://valviorabackend2.onrender.com/shortsContentApi', axiosConfig)
        ]);

        fanOutResults.forEach((result, i) => {
            const names = ['shortsSummaryApi', 'shortsContentApi'];
            if (result.status === 'rejected') {
                console.warn(`Delete fan-out to ${names[i]} failed:`, result.reason?.message || result.reason);
            }
        });

        res.json({ message: 'Short deleted successfully.', shortId });

    } catch (err) {
        console.error('deleteAggregatedShortsApi error:', err?.message || err);
        res.status(500).json({ message: 'Delete failed. Please try again.', error: err?.message });
    }
};

const getAggregatedShortsApi = async (req, res) => {
    try {
        const shortId = req.params?.shortId || req.query?.shortId || req.body?.shortId;
        if (!shortId) return res.status(400).json({ message: 'shortId required.' });

        const record = await AggregatedShortsApi.findOne({ shortId }).lean();
        if (!record) return res.status(204).json({ message: `No AggregatedShortsApi matches shortId ${shortId}.` });

        const summary = await ShortsSummaryApi.findOne({ shortId }).lean();
        record.thumbnail = makeImageUrl(record.thumbnail, req);
        record.videoUrl = makeMediaUrl(record.videoUrl, req);
        record.views = typeof summary?.views === 'number' ? summary.views : 0;
        res.json(record);
    } catch (err) {
        console.error('getAggregatedShortsApi error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch short. Please try again.' });
    }
};

module.exports = {
    getAllAggregatedShortsApis,
    createNewAggregatedShortsApi,
    updateAggregatedShortsApi,
    deleteAggregatedShortsApi,
    getAggregatedShortsApi,
    likeAggregatedShort,
    dislikeAggregatedShort
};
