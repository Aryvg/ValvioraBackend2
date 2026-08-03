const videosummaryapi = require('../model/Videosummaryapi');
const VideoContentApi = require('../model/Videocontentapi');
const ChannelData = require('../model/ChannelApi');
const AggregatedVideoApi = require('../model/Aggregatedvideoapi');
const PlaylistHomeApi = require('../model/PlaylistHomeApi');
const path = require('path');
const formatCount = require('../utils/formatCount');

const makeMediaUrl = (mediaPath, req) => {
    if (!mediaPath) return '';
    if (typeof mediaPath !== 'string') return '';
    const trimmed = mediaPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) return trimmed;
    const base = path.basename(trimmed);
    return `${req.protocol}://${req.get('host')}/media/file/${encodeURIComponent(base)}`;
};
const makeImageUrl = (imgPath, req) => {
    if (!imgPath) return '';
    if (typeof imgPath !== 'string') return '';
    const trimmed = imgPath.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || /^\/\/./.test(trimmed)) return trimmed;
    const clean = trimmed.replace(/^\/+/, '');
    return `${req.protocol}://${req.get('host')}/${clean}`;
};

const formatRelativeTime = (value) => {
    if (value == null || value === '') return '';

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d+$/.test(trimmed)) value = Number(trimmed);
        else {
            const match = trimmed.match(/^(\d+)\s*(hour|hours|day|days|month|months|year|years)\b/i);
            if (match) {
                const [, amount, unit] = match;
                const count = Number(amount);
                const baseUnit = unit.toLowerCase().replace(/s$/, '');
                const label = count === 1 ? baseUnit : `${baseUnit}s`;
                const prefix = count === 1 && baseUnit === 'year' ? 'a' : count;
                return `${prefix} ${label} ago`;
            }
            return trimmed;
        }
    }

    if (typeof value === 'number') {
        const normalized = value > 1000000000000 ? value : value > 1000000000 ? value * 1000 : value;
        const diffMs = Date.now() - normalized;
        const diffSec = Math.max(0, Math.floor(diffMs / 1000));

        if (diffSec < 60) return 'just now';

        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

        const diffMonths = Math.floor(diffDays / 30);
        if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;

        const diffYears = Math.floor(diffMonths / 12);
        return diffYears === 1 ? 'a year ago' : `${diffYears} years ago`;
    }

    return value;
};

// subscribe removed from summary data flow; second-page responses won't include it

const getAllYoutubeSecondpageapis = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });

        const summaries = await videosummaryapi.find({}).lean();
        if (!summaries || summaries.length === 0) return res.status(204).json({ message: 'No videos found.' });

        const videoIds = Array.from(new Set(summaries.map(s => s.videoId).filter(Boolean)));
        const contents = await VideoContentApi.find({ videoId: { $in: videoIds } }).lean();
        const contentMap = new Map((contents || []).map(c => [c.videoId, c]));

        // Fetch all channels referenced by these summaries in a single query
        const channelIds = Array.from(new Set(summaries.map(s => s.channelId).filter(Boolean)));
        const channels = await ChannelData.find({ channelId: { $in: channelIds } }).lean();
        const channelMap = new Map(channels.map(ch => [ch.channelId, ch]));

        const merged = summaries.map(s => {
            const c = contentMap.get(s.videoId);
            if (!c) return null;
            const ch = channelMap.get(s.channelId) || null;
            return ({
                videoId:             s.videoId,
                channelId:           s.channelId,
                title:               s.title,
                views:               s.Views,
                time:                formatRelativeTime(s.Time),
                videoFile:           makeMediaUrl(c.video, req),
                videoDescription:    c.shortDescription,
                detailedDescription: c.DetailedDescription,
                channelInfo: {
                    channelProfile: ch ? makeImageUrl(ch.profilePicture, req) : '',
                    channelName:    ch ? (ch.channelname || '') : ''
                },
                subscribe: ch?.subscribe ?? 0,
                Likes:    formatCount(s.Likes ?? 0),
                Dislikes: formatCount(s.Dislikes ?? 0)
            });
        }).filter(Boolean);

        res.json(merged);
    } catch (err) {
        console.error('getAllYoutubeSecondpageapis error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch videos. Please try again.' });
    }
};

const getYoutubeSecondpageapi = async (req, res) => {
    try {
        const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
        if (!videoId) return res.status(400).json({ message: 'videoId required.' });

        const [summary, content] = await Promise.all([
            videosummaryapi.findOne({ videoId }).lean(),
            VideoContentApi.findOne({ videoId }).lean()
        ]);

        if (!summary) return res.status(204).json({ message: `No video found for videoId ${videoId}.` });
        if (!content) return res.status(204).json({ message: `No content found for videoId ${videoId}.` });

        const aggregated = await AggregatedVideoApi.findOne({ videoId }).lean();
        if (aggregated?.isBanned === true) {
            return res.status(204).json({ message: `No video found for videoId ${videoId}.` });
        }

        const playlistId = aggregated?.playlistId || null;
        if (playlistId) {
            const playlist = await PlaylistHomeApi.findOne({ playlistId }).lean();
            if (playlist?.isBanned === true) {
                return res.status(204).json({ message: `No video found for playlistId ${playlistId}.` });
            }
        }

        // Fetch the channel that owns this video
        const channel = await ChannelData.findOne({ channelId: summary.channelId }).lean();

        const normalizedUser = req.user ? String(req.user).trim() : '';
        const viewerHasLiked = normalizedUser && Array.isArray(summary.likedBy) && summary.likedBy.includes(normalizedUser);
        const viewerHasDisliked = normalizedUser && Array.isArray(summary.dislikedBy) && summary.dislikedBy.includes(normalizedUser);

        const merged = {
            videoId:             summary.videoId,
            channelId:           summary.channelId,
            title:               summary.title,
            views:               formatCount(summary.Views ?? 0),
            time:                formatRelativeTime(summary.Time),
            videoFile:           makeMediaUrl(content.video, req),
            videoDescription:    content.shortDescription,
            detailedDescription: content.DetailedDescription,
            channelInfo: {
                channelProfile: channel ? makeImageUrl(channel.profilePicture, req) : '',
                channelName:    channel ? (channel.channelname || '') : ''
            },
            subscribe: channel?.subscribe ?? 0,
            Likes:    formatCount(summary.Likes ?? 0),
            Dislikes: formatCount(summary.Dislikes ?? 0),
            viewerHasLiked: !!viewerHasLiked,
            viewerHasDisliked: !!viewerHasDisliked
        };

        res.json(merged);
    } catch (err) {
        console.error('getYoutubeSecondpageapi error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch videos. Please try again.' });
    }
};

module.exports = {
    getAllYoutubeSecondpageapis,
    getYoutubeSecondpageapi
};
