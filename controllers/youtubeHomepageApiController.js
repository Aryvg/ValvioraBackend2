const YoutubeHomepageApi = require('../model/YoutubeHomepageApi');
const AggregatedVideoApi = require('../model/Aggregatedvideoapi');
const ThumbnailApi = require('../model/ThumbnailApi');
const VideoSummaryApi = require('../model/Videosummaryapi');
const mongoose = require('mongoose');
const VideoContentApi = mongoose.models.VideoContentApi || require('../model/Videocontentapi');
const ChannelApi = require('../model/ChannelApi');
const crypto = require('crypto');

const makeImageUrl = (imgPath, req) => {
    if (!imgPath) return '';
    if (typeof imgPath !== 'string') return '';
    const trimmed = imgPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    const clean = trimmed.replace(/^\/+/, '');
    return `${req.protocol}://${req.get('host')}/${clean}`;
};

// makeMediaUrl removed — not needed in this controller anymore

const getAllYoutubeHomepageApis = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        // Fetch ALL summaries and ALL thumbnails from ALL channels
        const [summaries, thumbnails] = await Promise.all([
            VideoSummaryApi.find({}).lean(),
            ThumbnailApi.find({}).lean()
        ]);

        if ((!summaries || summaries.length === 0) && (!thumbnails || thumbnails.length === 0)) {
            return res.status(204).json({ message: 'No videos found.' });
        }

        // Collect all unique videoIds across both collections
        const allVideoIds = new Set([
            ...(summaries || []).map(s => s.videoId),
            ...(thumbnails || []).map(t => t.videoId)
        ]);

        // Build lookup maps by videoId
        const summaryMap = new Map((summaries || []).map(s => [s.videoId, s]));
        const thumbnailMap = new Map((thumbnails || []).map(t => [t.videoId, t]));
        const aggregatedVideos = await AggregatedVideoApi.find({ videoId: { $in: [...allVideoIds] } }).lean();
        const aggregatedMap = new Map((aggregatedVideos || []).map(v => [v.videoId, v]));

        // Collect all unique channelIds so we can batch-fetch all channels at once
        const allChannelIds = new Set([
            ...(summaries || []).map(s => s.channelId).filter(Boolean),
            ...(thumbnails || []).map(t => t.channelId).filter(Boolean)
        ]);

        // Fetch all needed channels in ONE query using $in
        const channels = await ChannelApi.find({ 
            channelId: { $in: [...allChannelIds] } 
        }).lean();

        // Build a channel lookup map by channelId for fast access
        const channelMap = new Map((channels || []).map(c => [c.channelId, c]));

        // Build the merged result for every videoId
        const results = [...allVideoIds].map(videoId => {
            const summary = summaryMap.get(videoId) || {};
            const thumbnail = thumbnailMap.get(videoId) || {};

            // Each video knows its own channelId — use that to get the right channel
            const videoChannelId = summary.channelId || thumbnail.channelId || '';
            const channel = channelMap.get(videoChannelId) || {};

            return {
                videoId,
                channelId: videoChannelId,
                title: summary.title || '',
                Views: summary.Views ?? 0,
                Time: summary.Time ?? 0,
                timer: summary.timer || '',
                isBanned: aggregatedMap.get(videoId)?.isBanned === true,
                image: (() => {
                    let raw = thumbnail.image || '';
                    // Decode HTML entities (e.g. &#x2F; → /)
                    raw = raw.replace(/&#x2F;/gi, '/').replace(/&amp;/gi, '&').replace(/&#x27;/gi, "'");
                    // Strip any wrongly prepended local host prefix before a valid https:// URL
                    const match = raw.match(/https?:\/\/[^/]+\/(https?:\/\/.+)/);
                    if (match) raw = match[1];
                    return raw;
                })(),
                channelName: channel.channelname || '',
                profilePicture: makeImageUrl(channel.profilePicture || '', req)
            };
        }).filter(Boolean);

        if (!results || results.length === 0) {
            return res.status(204).json({ message: 'No videos found.' });
        }

        res.json(results);

    } catch (err) {
        console.error('getAllYoutubeHomepageApis error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch homepage videos. Please try again.' });
    }
};

const createNewYoutubeHomepageApi = async (req, res) => {
    try {
        const videoId = req.body?.videoId;
        const channelId = req.body?.channelId;

        if (!videoId || !channelId) return res.status(400).json({ message: 'videoId and channelId are required.' });

        const thumb = await ThumbnailApi.findOne({ videoId }).lean();
        if (!thumb) return res.status(404).json({ message: 'Thumbnail not found for this videoId' });

        const summary = await VideoSummaryApi.findOne({ videoId }).lean();
        if (!summary) return res.status(404).json({ message: 'VideoSummary not found for this videoId' });

        const channel = await ChannelApi.findOne({ channelId }).lean();
        if (!channel) return res.status(404).json({ message: 'Channel not found for this channelId' });

        const exists = await YoutubeHomepageApi.findOne({ videoId }).lean();
        if (exists) return res.status(409).json({ message: 'Homepage entry already exists for this videoId' });

        const created = await YoutubeHomepageApi.create({
            videoId,
            channelId,
            title: summary.title,
            Views: summary.Views,
            Time: summary.Time,
            timer: summary.timer || '0:00',
            image: thumb.image,
            channelName: channel.channelname,
            profilePicture: channel.profilePicture,
            createdBy: req.user
        });

        const result = created.toObject ? created.toObject() : created;
        result.image = makeImageUrl(result.image, req);
        result.profilePicture = makeImageUrl(result.profilePicture, req);

        res.status(201).json(result);
    } catch (err) {
        console.error('createNewYoutubeHomepageApi error:', err?.message || err);
        res.status(500).json({ message: 'Failed to create homepage entry. Please try again.' });
    }
};

const updateYoutubeHomepageApi = async (req, res) => {
    try {
        const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
        if (!videoId) return res.status(400).json({ message: 'videoId parameter is required.' });

        const record = await YoutubeHomepageApi.findOne({ videoId }).exec();
        if (!record) return res.status(204).json({ message: `No YoutubeHomepageApi matches videoId ${videoId}.` });

        if (req.body?.title) {
            if (req.body.title.length > 100) return res.status(400).json({ message: 'Title must not exceed 100 characters.' });
            record.title = req.body.title;
        }
        if (typeof req.body?.Views !== 'undefined') {
            if (Number(req.body.Views) < 0) return res.status(400).json({ message: 'Views must be a non-negative number.' });
            record.Views = Number(req.body.Views);
        }
        if (typeof req.body?.Time !== 'undefined') {
            if (Number(req.body.Time) < 0) return res.status(400).json({ message: 'Time must be a non-negative number.' });
            record.Time = Number(req.body.Time);
        }
        if (typeof req.body?.image !== 'undefined') record.image = req.body.image;
        if (typeof req.body?.channelName !== 'undefined') record.channelName = req.body.channelName;
        if (typeof req.body?.profilePicture !== 'undefined') record.profilePicture = req.body.profilePicture;
        if (typeof req.body?.timer !== 'undefined') record.timer = req.body.timer;

        const saved = await record.save();
        const out = saved.toObject ? saved.toObject() : saved;
        out.image = makeImageUrl(out.image, req);
        out.profilePicture = makeImageUrl(out.profilePicture, req);
        res.json(out);
    } catch (err) {
        console.error('updateYoutubeHomepageApi error:', err?.message || err);
        res.status(500).json({ message: 'Failed to update homepage entry. Please try again.' });
    }
};

const deleteYoutubeHomepageApi = async (req, res) => {
    try {
        const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
        if (!videoId) return res.status(400).json({ message: 'videoId required.' });

        const record = await YoutubeHomepageApi.findOne({ videoId }).exec();
        if (!record) return res.status(204).json({ message: `No YoutubeHomepageApi matches videoId ${videoId}.` });

        await record.deleteOne();
        res.json({ message: 'Homepage entry deleted successfully.', videoId });
    } catch (err) {
        console.error('deleteYoutubeHomepageApi error:', err?.message || err);
        res.status(500).json({ message: 'Delete failed. Please try again.' });
    }
};

const getYoutubeHomepageApi = async (req, res) => {
    try {
        const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
        if (!videoId) return res.status(400).json({ message: 'videoId required.' });

        const record = await YoutubeHomepageApi.findOne({ videoId }).lean();
        if (!record) return res.status(204).json({ message: `No YoutubeHomepageApi matches videoId ${videoId}.` });

        record.image = (() => {
            let raw = record.image || '';
            // Decode HTML entities (e.g. &#x2F; → /)
            raw = raw.replace(/&#x2F;/gi, '/').replace(/&amp;/gi, '&').replace(/&#x27;/gi, "'");
            // Strip any wrongly prepended local host prefix before a valid https:// URL
            const match = raw.match(/https?:\/\/[^/]+\/(https?:\/\/.+)/);
            if (match) raw = match[1];
            return raw;
        })();
        record.profilePicture = makeImageUrl(record.profilePicture, req);
        res.json(record);
    } catch (err) {
        console.error('getYoutubeHomepageApi error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch homepage entry. Please try again.' });
    }
};

module.exports = {
    getAllYoutubeHomepageApis,
    createNewYoutubeHomepageApi,
    updateYoutubeHomepageApi,
    deleteYoutubeHomepageApi,
    getYoutubeHomepageApi
};
