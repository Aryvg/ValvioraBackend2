const VideoContentApi = require('../model/Videocontentapi');
const fs = require('fs');
const crypto = require('crypto'); // for generating videoId
const path = require('path');
const { VideoContentApiSanitization, handleValidationErrors } = require('../middleware/sanitization');



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

const getAllVideoContentApis = async (req, res) => {
    const VideoContentApis = await VideoContentApi.find().lean();//get all VideoContentApis from database
    if (!VideoContentApis || VideoContentApis.length === 0) return res.status(204).json({ 'message': 'No VideoContentApis found.' }); //if no VideoContentApis are found, return 204(empty).

    const mapped = VideoContentApis.map(e => ({
        ...e,
        video: makeMediaUrl(e.video, req)
    }));
    res.json(mapped);
    // convert image and video paths to URLS (images from cloudinary, videos from cloudinary)
}

const createNewVideoContentApi = async (req, res) => {
    // For multipart/form-data, fields are in req.body, files in req.files
    if ( !req?.body?.video || !req?.body?.shortDescription || !req?.body?.DetailedDescription) {
        return res.status(400).json({ 'message': 'All fields are required' }); //400 means bad request
    }
    if (req.body.shortDescription.length > 200) {
        return res.status(400).json({ message: 'Short description must not exceed 200 characters.' });
    }
    if (req.body.DetailedDescription.length > 1000) {
        return res.status(400).json({ message: 'Detailed description must not exceed 1000 characters.' });
    }
    

     try {
            let videoPath = req.body.video;
            if (req.files && req.files.video && req.files.video[0]) {
                videoPath = req.files.video[0].path; // Cloudinary URL
            }
    
            const result = await VideoContentApi.create({
                videoId: req.body.videoId || crypto.randomUUID(),
                channelId: req.body.channelId || crypto.randomUUID(),
                video: videoPath,
                shortDescription: req.body.shortDescription,
                DetailedDescription: req.body.DetailedDescription,
                createdBy: req.user,
                playlistId: req.body.playlistId || null
            });
    
            res.status(201).json(result);// 201 is success
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }


}

const updateVideoContentApi = async (req, res) => {
    // Accept videoId from either body or query (for form-data)
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    
    //req.params means /VideoContentApis/123
    //req.query means /VideoContentApis?videoId=123
    if (!videoId) {
        return res.status(400).json({ 'message': 'videoId parameter is required.' });
    }
  

    const videoContentApi = await VideoContentApi.findOne({ videoId }).exec(); //gets VideoContentApi related with the above videoId from the db
    if (!videoContentApi) {
        return res.status(204).json({ "message": `No VideoContentApi matches videoId ${videoId}.` });
    } //204 means server successfully processed but has no data to return
    
    //replace the old with the new
    if (req.body?.shortDescription) {
        if (req.body.shortDescription.length > 200) {
            return res.status(400).json({ message: 'Short description must not exceed 200 characters.' });
        }
        videoContentApi.shortDescription = req.body.shortDescription;
    }
    if (req.body?.DetailedDescription) {
        if (req.body.DetailedDescription.length > 1000) {
            return res.status(400).json({ message: 'Detailed description must not exceed 1000 characters.' });
        }
        videoContentApi.DetailedDescription = req.body.DetailedDescription;
    }
   
    if (req.files && req.files.video && req.files.video[0]) {
        videoContentApi.video = req.files.video[0].path; // Cloudinary URL
    }

    const result = await videoContentApi.save();
    res.json(result);
}

const deleteVideoContentApi = async (req, res) => {
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });
    const aggregatedRecord = await VideoContentApi.findOne({ videoId }).exec();
    if (!aggregatedRecord) {
        return res.status(204).json({ "message": `No VideoContentApi matches videoId ${videoId}.` });
    }

    const result = await aggregatedRecord.deleteOne();
    res.json(result);
}

const getVideoContentApi = async (req, res) => {
    const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const videoContentApi = await VideoContentApi.findOne({ videoId }).lean();
    if (!videoContentApi) {
        return res.status(204).json({ "message": `No VideoContentApi matches videoId ${videoId}.` });
    }
    videoContentApi.video = makeMediaUrl(videoContentApi.video, req);
    res.json(videoContentApi);
}


module.exports = {
    getAllVideoContentApis,
    createNewVideoContentApi,
    updateVideoContentApi,
    deleteVideoContentApi,
    getVideoContentApi,
    VideoContentApiSanitization,
    handleValidationErrors
}