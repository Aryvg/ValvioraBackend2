const videosummaryapi = require('../model/Videosummaryapi');
const fs = require('fs');
const crypto = require('crypto'); // for generating videoId
const path = require('path');
const { videosummaryapiSanitization, handleValidationErrors } = require('../middleware/sanitization');

// Helper: format large numbers to abbreviated strings (95k, 1.2M, 3B, 4T)
const formatCount = (n) => {
    if (typeof n !== 'number') return n;
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${+(n / 1e12).toFixed(2).replace(/\.00$/, '')}T`;
    if (abs >= 1e9) return `${+(n / 1e9).toFixed(2).replace(/\.00$/, '')}B`;
    if (abs >= 1e6) return `${+(n / 1e6).toFixed(2).replace(/\.00$/, '')}M`;
    if (abs >= 1e3) return `${+(n / 1e3).toFixed(2).replace(/\.00$/, '')}k`;
    return n;
}

const isViewIncrementRequest = (body) => {
    if (!body || typeof body !== 'object') return false;
    const keys = Object.keys(body);
    return keys.length === 2 && body.videoId && body.Views === 1 && body.title === undefined && body.Time === undefined && body.likes === undefined && body.Likes === undefined && body.dislikes === undefined && body.Dislikes === undefined && body.views === undefined && body.time === undefined;
};

const isReactionActionRequest = (body) => {
    if (!body || typeof body !== 'object') return false;
    const keys = Object.keys(body);
    return keys.length === 2 && body.videoId && (body.action === 'like' || body.action === 'dislike');
};

const getAllvideosummaryapis = async (req, res) => {
    const videosummaryapis = await videosummaryapi.find().lean();//get all videosummaryapis from database
    if (!videosummaryapis || videosummaryapis.length === 0) return res.status(204).json({ 'message': 'No videosummaryapis found.' }); //if no videosummaryapis are found, return 204(empty).

    const mapped = videosummaryapis.map(e => {
        const { viewedBy, likedBy, dislikedBy, ...rest } = e;
        return {
            ...rest,
            Likes: formatCount(e.Likes),
            Dislikes: formatCount(e.Dislikes)
        };
    });
    res.json(mapped);
    // convert image and video paths to URLS (images from cloudinary, videos from cloudinary)
}

const createNewvideosummaryapi = async (req, res) => {
    // For multipart/form-data, fields are in req.body, files in req.files
    if (!req?.body?.title || req.body.Views === undefined || req.body.Time === undefined) {
        return res.status(400).json({ 'message': 'All fields are required' }); //400 means bad request
    }
    // Validate field lengths
    if (req.body.title.length > 100) {
        return res.status(400).json({ message: 'Title must not exceed 100 characters.' });
    }
    
    if (req.body.Views < 0) {
        return res.status(400).json({ message: 'Views must be a non-negative number.' });
    }
    if (req.body.Time < 0) {
        return res.status(400).json({ message: 'Time must be a non-negative number.' });
    }

        try {
    
            const result = await videosummaryapi.create({
                videoId: req.body.videoId || crypto.randomUUID(),
                channelId: req.body.channelId || crypto.randomUUID(),
                title: req.body.title,
                Views: req.body.Views,
                Time: req.body.Time,
                timer: req.body.timer || '0:00',
                // subscribe removed
                createdBy: req.user,
                playlistId: req.body.playlistId || null
            });
    
            const out = result.toObject ? result.toObject() : { ...result };
            out.Likes = formatCount(out.Likes);
            out.Dislikes = formatCount(out.Dislikes);
            res.status(201).json(out);// 201 is success
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }


}

const updatevideosummaryapi = async (req, res) => {
    // Accept videoId from either body or query (for form-data)
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    
    //req.params means /videosummaryapis/123
    //req.query means /videosummaryapis?videoId=123
    if (!videoId) {
        return res.status(400).json({ 'message': 'videoId parameter is required.' });
    }
  

    const Videosummaryapi = await videosummaryapi.findOne({ videoId }).exec(); //gets videosummaryapi related with the above videoId from the db
    if (!Videosummaryapi) {
        return res.status(204).json({ "message": `No videosummaryapi matches videoId ${videoId}.` });
    } //204 means server successfully processed but has no data to return

    const viewIncrementRequest = isViewIncrementRequest(req.body);
    if (viewIncrementRequest) {
        if (!req.user) return res.sendStatus(401);
        if (!Array.isArray(Videosummaryapi.viewedBy)) Videosummaryapi.viewedBy = [];
        const normalizedUser = String(req.user).trim();
        if (normalizedUser && !Videosummaryapi.viewedBy.includes(normalizedUser)) {
            Videosummaryapi.Views = (typeof Videosummaryapi.Views === 'number' ? Videosummaryapi.Views : 0) + 1;
            Videosummaryapi.viewedBy.push(normalizedUser);
        }
        const result = await Videosummaryapi.save();
        const out = result.toObject ? result.toObject() : { ...result };
        delete out.viewedBy;
        out.Likes = formatCount(out.Likes);
        out.Dislikes = formatCount(out.Dislikes);
        return res.json(out);
    }

    const reactionRequest = isReactionActionRequest(req.body);
    if (reactionRequest) {
        if (!req.user) return res.sendStatus(401);
        const normalizedUser = String(req.user).trim();
        if (!Array.isArray(Videosummaryapi.likedBy)) Videosummaryapi.likedBy = [];
        if (!Array.isArray(Videosummaryapi.dislikedBy)) Videosummaryapi.dislikedBy = [];

        const hasLiked = Videosummaryapi.likedBy.includes(normalizedUser);
        const hasDisliked = Videosummaryapi.dislikedBy.includes(normalizedUser);

        if (req.body.action === 'like') {
            if (hasLiked) {
                Videosummaryapi.likedBy = Videosummaryapi.likedBy.filter(u => u !== normalizedUser);
                Videosummaryapi.Likes = Math.max(0, (Videosummaryapi.Likes || 0) - 1);
            } else {
                Videosummaryapi.likedBy.push(normalizedUser);
                Videosummaryapi.Likes = (Videosummaryapi.Likes || 0) + 1;
                if (hasDisliked) {
                    Videosummaryapi.dislikedBy = Videosummaryapi.dislikedBy.filter(u => u !== normalizedUser);
                    Videosummaryapi.Dislikes = Math.max(0, (Videosummaryapi.Dislikes || 0) - 1);
                }
            }
        } else {
            if (hasDisliked) {
                Videosummaryapi.dislikedBy = Videosummaryapi.dislikedBy.filter(u => u !== normalizedUser);
                Videosummaryapi.Dislikes = Math.max(0, (Videosummaryapi.Dislikes || 0) - 1);
            } else {
                Videosummaryapi.dislikedBy.push(normalizedUser);
                Videosummaryapi.Dislikes = (Videosummaryapi.Dislikes || 0) + 1;
                if (hasLiked) {
                    Videosummaryapi.likedBy = Videosummaryapi.likedBy.filter(u => u !== normalizedUser);
                    Videosummaryapi.Likes = Math.max(0, (Videosummaryapi.Likes || 0) - 1);
                }
            }
        }

        const result = await Videosummaryapi.save();
        const out = result.toObject ? result.toObject() : { ...result };
        delete out.viewedBy;
        out.viewerHasLiked = out.likedBy?.includes(normalizedUser) || false;
        out.viewerHasDisliked = out.dislikedBy?.includes(normalizedUser) || false;
        delete out.likedBy;
        delete out.dislikedBy;
        out.Likes = formatCount(out.Likes);
        out.Dislikes = formatCount(out.Dislikes);
        return res.json(out);
    }

    if (req.body?.title) {
        if (req.body.title.length > 100) {
            return res.status(400).json({ message: 'Title must not exceed 100 characters.' });
        }
        Videosummaryapi.title = req.body.title;
    }
    
    if (req.body?.Views !== undefined) {
        if (req.body.Views < 0) {
            return res.status(400).json({ message: 'Views must be a non-negative number.' });
        }
        Videosummaryapi.Views = req.body.Views;
    }
    if (req.body?.Time !== undefined) {
        if (req.body.Time < 0) {
            return res.status(400).json({ message: 'Time must be a non-negative number.' });
        }   
        Videosummaryapi.Time = req.body.Time;
    }

    // Accept lowercase variants and Likes/Dislikes updates
    if (req.body?.views !== undefined) {
        if (req.body.views < 0) return res.status(400).json({ message: 'Views must be a non-negative number.' });
        Videosummaryapi.Views = req.body.views;
    }
    if (req.body?.time !== undefined) {
        if (req.body.time < 0) return res.status(400).json({ message: 'Time must be a non-negative number.' });
        Videosummaryapi.Time = req.body.time;
    }
    if (req.body?.Likes !== undefined || req.body?.likes !== undefined) {
        const likesVal = req.body.Likes !== undefined ? req.body.Likes : req.body.likes;
        if (likesVal < 0) return res.status(400).json({ message: 'Likes must be a non-negative number.' });
        Videosummaryapi.Likes = likesVal;
    }
    if (req.body?.Dislikes !== undefined || req.body?.dislikes !== undefined) {
        const dislikesVal = req.body.Dislikes !== undefined ? req.body.Dislikes : req.body.dislikes;
        if (dislikesVal < 0) return res.status(400).json({ message: 'Dislikes must be a non-negative number.' });
        Videosummaryapi.Dislikes = dislikesVal;
    }
    // subscribe field removed — do not accept subscribe updates here

    const result = await Videosummaryapi.save();
    const out = result.toObject ? result.toObject() : { ...result };
    out.Likes = formatCount(out.Likes);
    out.Dislikes = formatCount(out.Dislikes);
    res.json(out);
}

const deletevideosummaryapi = async (req, res) => {
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });
    const aggregatedRecord = await videosummaryapi.findOne({ videoId }).exec();
    if (!aggregatedRecord) {
        return res.status(204).json({ "message": `No videosummaryapi matches videoId ${videoId}.` });
    }

    const result = await aggregatedRecord.deleteOne();
    res.json(result);
}

const getvideosummaryapi = async (req, res) => {
    const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const Videosummaryapi = await videosummaryapi.findOne({ videoId }).lean();
    if (!Videosummaryapi) {
        return res.status(204).json({ "message": `No videosummaryapi matches videoId ${videoId}.` });
    }
    const { viewedBy, likedBy, dislikedBy, ...result } = Videosummaryapi;
    result.Likes = formatCount(result.Likes);
    result.Dislikes = formatCount(result.Dislikes);
    res.json(result);
}


module.exports = {
    getAllvideosummaryapis,
    createNewvideosummaryapi,
    updatevideosummaryapi,
    deletevideosummaryapi,
    getvideosummaryapi,
    videosummaryapiSanitization,
    handleValidationErrors
}
