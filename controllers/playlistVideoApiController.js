const AggregatedVideoApi = require('../model/Aggregatedvideoapi');
const PlaylistHomeApi = require('../model/PlaylistHomeApi');
const ChannelData = require('../model/ChannelApi');

const cleanImageUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    // Decode HTML entities
    let decoded = url
        .replace(/&#x2F;/gi, '/')
        .replace(/&amp;/gi, '&')
        .replace(/&#x27;/gi, "'");
    // Strip any wrongly prepended local host prefix before a real https:// URL
    const match = decoded.match(/https?:\/\/[^\/]+\/(https?:\/\/.+)/);
    if (match) return match[1];
    return decoded;
};

const getAllPlaylistVideoApis = async (req, res) => {
    try {
        if (!req?.user) return res.sendStatus(401);

        // Get the user's channel
        const channel = await ChannelData.findOne({ createdBy: req.user }).lean();
        if (!channel) return res.status(200).json([]);

        // Get all playlists for this channel
        const playlists = await PlaylistHomeApi.find({ channelId: channel.channelId }).lean();
        if (!playlists || playlists.length === 0) return res.status(200).json([]);

        // For each playlist, find its videos from AggregatedVideoApi
        const result = await Promise.all(playlists.map(async (pl) => {
            const videos = await AggregatedVideoApi.find({ playlistId: pl.playlistId }).lean();
            return {
                playlistId:    pl.playlistId,
                playlistTitle: pl.playlistTitle,
                thumbnail:     cleanImageUrl(pl.thumbnail || videos[0]?.image || ''),
                videoCount:    videos.length,
                views:         pl.views ?? 0,
                isBanned:      pl.isBanned === true,
                videos: videos.map(v => ({
                    videoId:             v.videoId,
                    image:               cleanImageUrl(v.image   || ''),
                    title:               v.title   || '',
                    shortDescription:    v.shortDescription   || '',
                    detailedDescription: v.DetailedDescription || '',
                    video:               v.video   || '',
                    timer:               v.timer   || ''
                }))
            };
        }));

        return res.json(result);
    } catch (err) {
        console.error('getAllPlaylistVideoApis error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

const getPlaylistsByChannel = async (req, res) => {
    try {
        const channelId = req.params?.channelId;
        if (!channelId) return res.status(400).json({ message: 'channelId is required.' });

        const playlists = await PlaylistHomeApi.find({ channelId }).lean();

        const result = await Promise.all((playlists || []).map(async (pl) => {
            const videos = await AggregatedVideoApi.find({ playlistId: pl.playlistId }).lean();
            return {
                playlistId:    pl.playlistId,
                playlistTitle: pl.playlistTitle,
                thumbnail:     cleanImageUrl(pl.thumbnail || videos[0]?.image || ''),
                videoCount:    videos.length,
                views:         pl.views ?? 0,
                isBanned:      pl.isBanned === true,
                videos: videos.map(v => ({
                    videoId:             v.videoId,
                    image:               cleanImageUrl(v.image   || ''),
                    title:               v.title   || '',
                    shortDescription:    v.shortDescription   || '',
                    detailedDescription: v.DetailedDescription || '',
                    video:               v.video   || '',
                    timer:               v.timer   || ''
                }))
            };
        }));

        return res.json(result);
    } catch (err) {
        console.error('getPlaylistsByChannel error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

const getPlaylistVideoApi = async (req, res) => {
    try {
        const playlistId = req.params?.playlistId || req.query?.playlistId || req.body?.playlistId;
        if (!playlistId) return res.status(400).json({ message: 'playlistId is required' });

        // Get the playlist info
        const pl = await PlaylistHomeApi.findOne({ playlistId }).lean();
        if (!pl) return res.status(404).json({ message: 'Playlist not found.' });

        // Get all videos belonging to this playlist
        const videos = await AggregatedVideoApi.find({ playlistId }).lean();

        return res.json({
            playlistId:    pl.playlistId,
            playlistTitle: pl.playlistTitle,
            thumbnail:     cleanImageUrl(pl.thumbnail || videos[0]?.image || ''),
            videoCount:    videos.length,
            views:         pl.views ?? 0,
            isBanned: pl.isBanned || false,
            videos: videos.map(v => ({
                videoId:             v.videoId,
                image:               cleanImageUrl(v.image   || ''),
                title:               v.title   || '',
                shortDescription:    v.shortDescription   || '',
                detailedDescription: v.DetailedDescription || '',
                video:               v.video   || '',
                timer:               v.timer   || ''
            }))
        });
    } catch (err) {
        console.error('getPlaylistVideoApi error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getAllPlaylistVideoApis, getPlaylistsByChannel, getPlaylistVideoApi };
