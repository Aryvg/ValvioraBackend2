const ThumbnailApi = require('../model/Thumbnailapi');
const fs = require('fs');
const crypto = require('crypto'); // for generating videoId
const path = require('path');
const { ThumbnailApiSanitization, handleValidationErrors } = require('../middleware/sanitization');

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

const getAllThumbnailApis = async (req, res) => {
    const ThumbnailApis = await ThumbnailApi.find().lean();//get all ThumbnailApis from database
    if (!ThumbnailApis || ThumbnailApis.length === 0) return res.status(204).json({ 'message': 'No ThumbnailApis found.' }); //if no ThumbnailApis are found, return 204(empty).

    const mapped = ThumbnailApis.map(e => ({
        ...e,
        image: makeImageUrl(e.image, req)
    }));
    res.json(mapped);
    // convert image and video paths to URLS (images from cloudinary, videos from cloudinary)
}

const createNewThumbnailApi = async (req, res) => {
    // For multipart/form-data, fields are in req.body, files in req.files
    if (!req?.body?.image) {
        return res.status(400).json({ 'message': 'thumbnail image is required' }); //400 means bad request
    }
   

     try {
            let imagePath = req.body.image;
            if (req.files && req.files.image && req.files.image[0]) {
                imagePath = req.files.image[0].path; // Cloudinary URL
            }
           
    
            const result = await ThumbnailApi.create({
                // videoId: crypto.randomUUID(),
                // channelId: crypto.randomUUID(),
                videoId: req.body.videoId || crypto.randomUUID(),
                channelId: req.body.channelId || crypto.randomUUID(),
                image: imagePath,
                createdBy: req.user,
                playlistId: req.body.playlistId || null
            });
    
            res.status(201).json(result);// 201 is success
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }


}

const updateThumbnailApi = async (req, res) => {
    // Accept videoId from either body or query (for form-data)
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    
    //req.params means /ThumbnailApis/123
    //req.query means /ThumbnailApis?videoId=123
    if (!videoId) {
        return res.status(400).json({ 'message': 'videoId parameter is required.' });
    }
  

    const thumbnailApi = await ThumbnailApi.findOne({ videoId }).exec(); //gets ThumbnailApi related with the above videoId from the db
    if (!thumbnailApi) {
        return res.status(204).json({ "message": `No ThumbnailApi matches videoId ${videoId}.` });
    } //204 means server successfully processed but has no data to return
    // Handle image replacement from either uploaded file or JSON body
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
        thumbnailApi.image = req.files.image[0].path; // Cloudinary URL
    } else if (req.body?.image) {
        thumbnailApi.image = req.body.image;
    }
    const result = await thumbnailApi.save();
    res.json(result);
}

const deleteThumbnailApi = async (req, res) => {
    const videoId = req.body?.videoId || req.query?.videoId || req.params?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });
    const aggregatedRecord = await ThumbnailApi.findOne({ videoId }).exec();
    if (!aggregatedRecord) {
        return res.status(204).json({ "message": `No ThumbnailApi matches videoId ${videoId}.` });
    }

    const result = await aggregatedRecord.deleteOne();
    res.json(result);
}

const getThumbnailApi = async (req, res) => {
    const videoId = req.params?.videoId || req.query?.videoId || req.body?.videoId;
    if (!videoId) return res.status(400).json({ 'message': 'videoId required.' });

    const thumbnailApi = await ThumbnailApi.findOne({ videoId }).lean();
    if (!thumbnailApi) {
        return res.status(204).json({ "message": `No ThumbnailApi matches videoId ${videoId}.` });
    }
    thumbnailApi.image = makeImageUrl(thumbnailApi.image, req);
    res.json(thumbnailApi);
}


module.exports = {
    getAllThumbnailApis,
    createNewThumbnailApi,
    updateThumbnailApi,
    deleteThumbnailApi,
    getThumbnailApi,
    ThumbnailApiSanitization,
    handleValidationErrors
}
