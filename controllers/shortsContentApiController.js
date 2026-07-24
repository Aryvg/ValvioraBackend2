const ShortsContentApi = require('../model/ShortsContentApi');
const path = require('path');
const axios = require('axios');

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

const getAllShortsContentApis = async (req, res) => {
    try {
        const items = await ShortsContentApi.find({}).lean();
        if (!items || items.length === 0) return res.status(204).json({ message: 'No shorts content found.' });
        const mapped = items.map(e => ({
            ...e,
            videoUrl: makeMediaUrl(e.videoUrl, req),
            ProfilePicture: makeImageUrl(e.ProfilePicture, req)
        }));
        res.json(mapped);
    } catch (err) {
        console.error('getAllShortsContentApis error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch content. Please try again.' });
    }
};

const createNewShortsContentApi = async (req, res) => {
    try {
        const { shortId, channelId, videoUrl } = req.body || {};
        if (!shortId || !channelId || !videoUrl) return res.status(400).json({ message: 'shortId, channelId and videoUrl are required.' });
        const result = await ShortsContentApi.create({
            shortId,
            channelId,
            videoUrl,
            Likes: req.body.Likes || 0,
            Dislikes: req.body.Dislikes || 0,
            channelName: req.body.channelName || '',
            ProfilePicture: req.body.ProfilePicture || '',
            createdBy: req.body.createdBy || ''
        });
        res.status(201).json(result);
    } catch (err) {
        console.error('createNewShortsContentApi error:', err?.message || err);
        res.status(500).json({ message: 'Create failed. Please try again.' });
    }
};

const updateShortsContentApi = async (req, res) => {
    try {
        const shortId = req.body?.shortId || req.query?.shortId || req.params?.shortId;
        if (!shortId) return res.status(400).json({ message: 'shortId required.' });
        const record = await ShortsContentApi.findOne({ shortId }).exec();
        if (!record) return res.status(204).json({ message: `No ShortsContentApi matches shortId ${shortId}.` });

        if (req.body?.Likes !== undefined) {
            if (req.body.Likes < 0) return res.status(400).json({ message: 'Likes must be a non-negative number.' });
            record.Likes = req.body.Likes;
        }
        if (req.body?.Dislikes !== undefined) {
            if (req.body.Dislikes < 0) return res.status(400).json({ message: 'Dislikes must be a non-negative number.' });
            record.Dislikes = req.body.Dislikes;
        }

        if (req.body?.videoUrl !== undefined) {
            record.videoUrl = req.body.videoUrl;
        }

        const result = await record.save();
        res.json(result);
    } catch (err) {
        console.error('updateShortsContentApi error:', err?.message || err);
        res.status(500).json({ message: 'Update failed. Please try again.' });
    }
};

const deleteShortsContentApi = async (req, res) => {
    try {
        const shortId = req.body?.shortId || req.query?.shortId || req.params?.shortId;
        if (!shortId) return res.status(400).json({ message: 'shortId required.' });
        const record = await ShortsContentApi.findOne({ shortId }).exec();
        if (!record) return res.status(204).json({ message: `No ShortsContentApi matches shortId ${shortId}.` });
        await record.deleteOne();
        res.json({ message: 'Short content deleted successfully.', shortId });
    } catch (err) {
        console.error('deleteShortsContentApi error:', err?.message || err);
        res.status(500).json({ message: 'Delete failed. Please try again.' });
    }
};

const getShortsContentApi = async (req, res) => {
    try {
        const shortId = req.params?.shortId || req.query?.shortId || req.body?.shortId;
        if (!shortId) return res.status(400).json({ message: 'shortId required.' });

        const record = await ShortsContentApi.findOne({ shortId }).lean();
        if (!record) return res.status(204).json({ message: `No ShortsContentApi matches shortId ${shortId}.` });
        record.videoUrl = makeMediaUrl(record.videoUrl, req);
        record.ProfilePicture = makeImageUrl(record.ProfilePicture, req);
        res.json(record);
    } catch (err) {
        console.error('getShortsContentApi error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch content. Please try again.' });
    }
};

module.exports = {
    getAllShortsContentApis,
    createNewShortsContentApi,
    updateShortsContentApi,
    deleteShortsContentApi,
    getShortsContentApi
};
