const AggregatedVideoApi = require('../model/Aggregatedvideoapi');
const NotificationApi = require('../model/NotificationApi');
const fs = require('fs');
const crypto = require('crypto'); // for generating videoId
const path = require('path');
const { AggregatedVideoApiSanitization, handleValidationErrors } = require('../middleware/sanitization');
const axios = require('axios');
const dayjs = require('dayjs');
const ChannelData = require('../model/ChannelApi');
const VideoSummaryApi = require('../model/Videosummaryapi');
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

const getAllAggregatedVideoApis = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized. Please log in.' });

        // Find this user's channel to get their channelId
        const channel = await ChannelData.findOne({ createdBy: req.user }).lean();
        if (!channel || !channel.channelId) {
            return res.status(204).json({ message: 'No channel found for this user.' });
        }

        // Return only videos that belong to this channel
        const videos = await AggregatedVideoApi.find({ channelId: channel.channelId }).lean();
        if (!videos || videos.length === 0) {
            return res.status(204).json({ message: 'No videos found for this channel.' });
        }

        const videoIds = videos.map(v => v.videoId).filter(Boolean);
        const summaries = await VideoSummaryApi.find({ videoId: { $in: videoIds } }).lean();
        const summaryById = new Map(summaries.map(s => [s.videoId, s]));

        const mapped = videos.map(e => {
            const summary = summaryById.get(e.videoId);
            return {
                ...e,
                image: makeImageUrl(e.image, req),
                video: makeMediaUrl(e.video, req),
                Views: typeof summary?.Views === 'number' ? summary.Views : 0
            };
        });

        res.json(mapped);

    } catch (err) {
        console.error('getAllAggregatedVideoApis error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch videos. Please try again.' });
    }
};

const getVideosByChannel = async (req, res) => {
    try {
        const channelId = req.params?.channelId;
        if (!channelId) return res.status(400).json({ message: 'channelId is required.' });

        const videos = await AggregatedVideoApi.find({ channelId }).lean();
        const videoIds = videos.map(v => v.videoId).filter(Boolean);
        const summaries = await VideoSummaryApi.find({ videoId: { $in: videoIds } }).lean();
        const summaryById = new Map(summaries.map(s => [s.videoId, s]));

        const mapped = (videos || []).map(e => {
            const summary = summaryById.get(e.videoId);
            return {
                ...e,
                image: makeImageUrl(e.image, req),
                video: makeMediaUrl(e.video, req),
                Views: typeof summary?.Views === 'number' ? summary.Views : 0
            };
        });

        res.json(mapped);
    } catch (err) {
        console.error('getVideosByChannel error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch videos for this channel.' });
    }
};

const createNewAggregatedVideoApi = async (req, res) => {

    const hasTitle = req?.body?.title?.toString().trim();
    const hasVideo = req?.files?.video?.[0] || req?.body?.video;
    const hasImage = req?.files?.image?.[0] || req?.body?.image;

    // For playlist videos, shortDescription and DetailedDescription are optional
    // because the playlist modal treats them as optional fields
    const isPlaylistVideo = !!(req?.body?.playlistId);
    const hasShortDesc = isPlaylistVideo || req?.body?.shortDescription?.toString().trim();
    const hasDetailedDesc = isPlaylistVideo || req?.body?.DetailedDescription?.toString().trim();

    if (!hasTitle || !hasShortDesc || !hasDetailedDesc || !hasVideo || !hasImage) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        let imagePath = req.body.image;
        let videoPath = req.body.video;
        if (req.files?.image?.[0]) imagePath = req.files.image[0].path;
        if (req.files?.video?.[0]) videoPath = req.files.video[0].path;

        // Quick verification: ensure the assigned paths look like final URLs
        const looksLikeUrl = p => typeof p === 'string' && /^https?:\/\//i.test(p);
        console.info('AggregatedVideoApi upload paths verification:', {
            imagePath,
            imageIsUrl: looksLikeUrl(imagePath),
            videoPath,
            videoIsUrl: looksLikeUrl(videoPath)
        });

        // Enforce size limits before attempting to save / upload to Cloudinary
        const MAX_BYTES = 95 * 1024 * 1024; // 95 MB (buffer under Cloudinary 100 MB limit)
        if (req.files?.video?.[0]?.size > MAX_BYTES) {
            return res.status(413).json({ message: 'Video file exceeds the 100 MB Cloudinary limit.' });
        }
        if (req.files?.image?.[0]?.size > 5 * 1024 * 1024) {
            return res.status(413).json({ message: 'Thumbnail image exceeds 5 MB. Please use a smaller image.' });
        }

        // Ensure image was actually received (not stripped or blocked)
        if (!req.files?.image?.[0]) {
            return res.status(400).json({ message: 'Thumbnail image is missing or was not received by the server.' });
        }

        // --- STEP 1: Save to your aggregated DB (your existing code) ---
            // prefer the uploader's existing channelId if available; otherwise generate a new one
            let channelIdToUse = crypto.randomUUID();
            try {
                if (req?.user) {
                    const channel = await ChannelData.findOne({ createdBy: req.user }).lean();
                    if (channel && channel.channelId) channelIdToUse = channel.channelId;
                }
            } catch (e) {
                console.warn('Channel lookup failed, using random channelId', e?.message || e);
            }

            const result = await AggregatedVideoApi.create({
                videoId: crypto.randomUUID(),
                channelId: channelIdToUse,
                title: req.body.title,
                video: videoPath,
                shortDescription: req.body.shortDescription,
                DetailedDescription: req.body.DetailedDescription,
                Views: 0,
                Time: dayjs().valueOf(),
                timer: req.body.timer || '0:00',
                playlistId: req.body.playlistId || null,
                image: imagePath,
                createdBy: req.user
            });

        // --- STEP 2: FAN-OUT — fire all 3 API calls at the same time ---
        // Forward Authorization header (if present) so downstream routes that
        // are protected by `verifyJWT` accept these internal fan-out requests.
        const forwardedAuth = req.headers.authorization || req.headers.Authorization || '';
        const axiosConfig = { headers: { Authorization: forwardedAuth } };
        // for this one you have install axios by saying npm install axios
        await Promise.all([

            // Branch 1: Send title, Views, Time → videoSummaryApi
            axios.post('http://localhost:3500/videoSummaryApi', {
                videoId: result.videoId,
                channelId: result.channelId,
                title: result.title,
                Views: result.Views,
                Time: result.Time,
                timer: result.timer || '0:00',
                playlistId: req.body.playlistId || null
            }, axiosConfig),

            // Branch 2: Send video, descriptions → videoContentApi
            axios.post('http://localhost:3500/videoContentApi', {
                videoId: result.videoId,
                channelId: result.channelId,
                video: result.video,
                shortDescription: result.shortDescription,
                DetailedDescription: result.DetailedDescription,
                playlistId: req.body.playlistId || null
            }, axiosConfig),

            // Branch 3: Send image → thumbnailApi
            axios.post('http://localhost:3500/thumbnailApi', {
                videoId: result.videoId,
                channelId: result.channelId,
                image: result.image,
                playlistId: req.body.playlistId || null
            }, axiosConfig)

        ]);
        // Promise.all waits for ALL three to finish before moving on.
        // If even ONE fails, it jumps to the catch block below.

        // --- STEP 3: Create notifications for subscribers who were already subscribed before upload ---
        try {
            const channelDoc = await ChannelData.findOne({ channelId: result.channelId }).lean();
            if (channelDoc && Array.isArray(channelDoc.subscribers) && channelDoc.subscribers.length > 0) {
                const uploadTime = new Date(result.Time);
                const channelProfilePicture = makeImageUrl(channelDoc.profilePicture, req);
                const thumbnailUrl = makeImageUrl(result.image, req);

                const notificationsToInsert = channelDoc.subscribers
                    .filter(sub => sub && sub.username && sub.subscribedAt && new Date(sub.subscribedAt).getTime() < uploadTime.getTime())
                    .map(sub => ({
                        user: sub.username,
                        videoId: result.videoId,
                        channelId: result.channelId,
                        title: result.title,
                        image: thumbnailUrl,
                        profilePicture: channelProfilePicture,
                        timer: result.timer || '0:00',
                        isRead: true,
                        createdAt: uploadTime
                    }));

                if (notificationsToInsert.length > 0) {
                    await NotificationApi.insertMany(notificationsToInsert, { ordered: false }).catch(err => {
                        if (!err || err.code !== 11000) {
                            console.error('Notification insertMany error:', err?.message || err);
                        }
                    });
                }
            }
        } catch (notifyErr) {
            console.error('Failed to create subscriber notifications:', notifyErr?.message || notifyErr);
        }

        // --- STEP 4: Delete from aggregatedApi after successful fan-out ---
        // await AggregatedVideoApi.deleteOne({ videoId: result.videoId });

        // --- STEP 5: Return success ---
        res.status(201).json({
            message: 'Fan-out successful. Data distributed and cleaned up.',
            videoId: result.videoId,
            channelId: result.channelId
        });

    } catch (err) {
        console.error('Upload/fan-out error:', err?.message || err, err?.stack);
        const cloudinaryMsg = err?.message && err.message.includes('Invalid image')
            ? 'Cloudinary rejected the image. Please use a JPG or PNG file under 5 MB.'
            : 'Upload failed. Please try again.';
        return res.status(500).json({ message: cloudinaryMsg, error: err?.message });
    }
};

const updateAggregatedVideoApi = async (req, res) => {
    // Accept videoId from either body or query (for form-data)
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    
    //req.params means /AggregatedVideoApis/123
    //req.query means /AggregatedVideoApis?videoId=123
    if (!videoId) {
        return res.status(400).json({ 'message': 'videoId parameter is required.' });
    }
  

    const aggregatedVideoApi = await AggregatedVideoApi.findOne({ videoId }).exec(); //gets AggregatedVideoApi related with the above videoId from the db
    if (!aggregatedVideoApi) {
        return res.status(204).json({ "message": `No AggregatedVideoApi matches videoId ${videoId}.` });
    } //204 means server successfully processed but has no data to return
    if (req.body?.title) {
        if (req.body.title.length > 100) {
            return res.status(400).json({ message: 'Title must not exceed 100 characters.' });
        }
        aggregatedVideoApi.title = req.body.title;
    }
    //replace the old with the new
    if (req.body?.shortDescription) {
        if (req.body.shortDescription.length > 200) {
            return res.status(400).json({ message: 'Short description must not exceed 200 characters.' });
        }
        aggregatedVideoApi.shortDescription = req.body.shortDescription;
    }
    if (req.body?.DetailedDescription) {
        if (req.body.DetailedDescription.length > 1000) {
            return res.status(400).json({ message: 'Detailed description must not exceed 1000 characters.' });
        }
        aggregatedVideoApi.DetailedDescription = req.body.DetailedDescription;
    }
    if (req.body?.Views) {
        if (req.body.Views < 0) {
            return res.status(400).json({ message: 'Views must be a non-negative number.' });
        }
        aggregatedVideoApi.Views = req.body.Views;
    }
    if (req.body?.Time) {
        if (req.body.Time < 0) {
            return res.status(400).json({ message: 'Time must be a non-negative number.' });
        }   
        aggregatedVideoApi.Time = req.body.Time;
    }

    if (typeof req.body?.isBanned !== 'undefined') {
        aggregatedVideoApi.isBanned = (req.body.isBanned === true || req.body.isBanned === 'true');
    }

    // Handle image and video file replacement (Cloudinary URLs)
    if (req.files && req.files.image && req.files.image[0]) {
        // Delete old image from Cloudinary if oldImageUrl was provided
        const oldImageUrl = req.body?.oldImageUrl || '';
        if (oldImageUrl && oldImageUrl.startsWith('http')) {
            try {
                const cloudinary = require('../config/cloudinary');
                const urlObj = new URL(oldImageUrl);
                const parts = urlObj.pathname.split('/');
                const uploadIndex = parts.findIndex(p => p === 'upload');
                if (uploadIndex !== -1) {
                    let rest = parts.slice(uploadIndex + 1);
                    if (rest.length && /^v\d+$/.test(rest[0])) rest = rest.slice(1);
                    const publicId = rest.join('/').replace(/\.[a-zA-Z0-9]+$/, '');
                    if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
                }
            } catch (e) {
                console.warn('Old image Cloudinary delete failed during update:', e?.message || e);
            }
        }
        aggregatedVideoApi.image = req.files.image[0].path;
    }
    if (req.files && req.files.video && req.files.video[0]) {
        aggregatedVideoApi.video = req.files.video[0].path; // Cloudinary URL
    }

    const result = await aggregatedVideoApi.save();
    res.json(result);
}

const deleteAggregatedVideoApi = async (req, res) => {
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) return res.status(400).json({ message: 'videoId required.' });

    try {
        const aggregatedRecord = await AggregatedVideoApi.findOne({ videoId }).exec();
        if (!aggregatedRecord) {
            return res.status(204).json({ message: `No AggregatedVideoApi matches videoId ${videoId}.` });
        }

        // Save image and video URLs before deleting the record
        const imageUrl = aggregatedRecord.image || '';
        const videoUrl = aggregatedRecord.video || '';

        // Step 1: Delete from aggregatedvideoapis
        await aggregatedRecord.deleteOne();

        // Step 2: Delete from Cloudinary (image and video)
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
            deleteFromCloudinary(imageUrl, 'image'),
            deleteFromCloudinary(videoUrl, 'video')
        ]);

        // Step 3: Fan-out DELETE to the three split collections
        const forwardedAuth = req.headers.authorization || req.headers.Authorization || '';
        const axiosConfig = {
            headers: {
                'Authorization': forwardedAuth,
                'Content-Type': 'application/json'
            },
            data: { videoId }
        };

        const fanOutResults = await Promise.allSettled([
            axios.delete('http://localhost:3500/thumbnailApi', axiosConfig),
            axios.delete('http://localhost:3500/videoContentApi', axiosConfig),
            axios.delete('http://localhost:3500/videoSummaryApi', axiosConfig)
        ]);

        fanOutResults.forEach((result, i) => {
            const names = ['thumbnailApi', 'videoContentApi', 'videoSummaryApi'];
            if (result.status === 'rejected') {
                console.warn(`Delete fan-out to ${names[i]} failed:`, result.reason?.message || result.reason);
            }
        });

        res.json({ message: 'Video and all related data deleted successfully.', videoId });

    } catch (err) {
        console.error('deleteAggregatedVideoApi error:', err?.message || err, err?.stack);
        res.status(500).json({ message: 'Delete failed. Please try again.', error: err?.message });
    }
}

const getAggregatedVideoApi = async (req, res) => {
    const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const aggregatedVideoApi = await AggregatedVideoApi.findOne({ videoId }).lean();
    if (!aggregatedVideoApi) {
        return res.status(204).json({ "message": `No AggregatedVideoApi matches videoId ${videoId}.` });
    }
    const summary = await VideoSummaryApi.findOne({ videoId }).lean();
    aggregatedVideoApi.image = makeImageUrl(aggregatedVideoApi.image, req); // change the url to http...
    aggregatedVideoApi.video = makeMediaUrl(aggregatedVideoApi.video, req);
    aggregatedVideoApi.Views = typeof summary?.Views === 'number' ? summary.Views : 0;
    res.json(aggregatedVideoApi);
}


module.exports = {
    getAllAggregatedVideoApis,
    getVideosByChannel,
    createNewAggregatedVideoApi,
    updateAggregatedVideoApi,
    deleteAggregatedVideoApi,
    getAggregatedVideoApi,
    AggregatedVideoApiSanitization,
    handleValidationErrors
}