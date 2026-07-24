const ShortsSummaryApi = require('../model/ShortsSummaryApi');
const AggregatedShortsApi = require('../model/AggregatedShortsApi');

const isViewIncrementRequest = (body) => {
    if (!body || typeof body !== 'object') return false;
    const keys = Object.keys(body);
    return keys.length === 2
        && Boolean(body.shortId)
        && (body.Views === 1 || body.views === 1)
        && body.title === undefined
        && body.thumbnail === undefined
        && body.Time === undefined
        && body.time === undefined;
};

const getAllShortsSummaryApis = async (req, res) => {
    try {
        const items = await ShortsSummaryApi.find({}).lean();
        if (!items || items.length === 0) return res.status(204).json({ message: 'No shorts summary found.' });

        const shortIds = items.map(item => item.shortId).filter(Boolean);
        const aggregatedShorts = shortIds.length
            ? await AggregatedShortsApi.find({ shortId: { $in: shortIds } }).lean()
            : [];
        const aggregatedById = new Map(aggregatedShorts.map(item => [item.shortId, item]));

        const withBanState = items.map(item => {
            const aggregated = aggregatedById.get(item.shortId) || {};
            return {
                ...item,
                isBanned: item.isBanned === true || aggregated.isBanned === true
            };
        });

        res.json(withBanState);
    } catch (err) {
        console.error('getAllShortsSummaryApis error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch summaries. Please try again.' });
    }
};

const createNewShortsSummaryApi = async (req, res) => {
    try {
        const { shortId, channelId, title } = req.body || {};
        if (!shortId || !channelId || !title) return res.status(400).json({ message: 'shortId, channelId and title are required.' });
        const result = await ShortsSummaryApi.create({
            shortId,
            channelId,
            thumbnail: req.body.thumbnail || '',
            title,
            views: req.body.views || 0,
            createdBy: req.body.createdBy || '',
            isBanned: false
        });
        res.status(201).json(result);
    } catch (err) {
        console.error('createNewShortsSummaryApi error:', err?.message || err);
        res.status(500).json({ message: 'Create failed. Please try again.', error: err?.message });
    }
};

const updateShortsSummaryApi = async (req, res) => {
    try {
        const shortId = req.body?.shortId || req.query?.shortId || req.params?.shortId;
        if (!shortId) return res.status(400).json({ message: 'shortId required.' });
        const record = await ShortsSummaryApi.findOne({ shortId }).exec();
        if (!record) return res.status(204).json({ message: `No ShortsSummaryApi matches shortId ${shortId}.` });

        if (isViewIncrementRequest(req.body)) {
            if (!req.user) return res.sendStatus(401);
            if (!Array.isArray(record.viewedBy)) record.viewedBy = [];
            const normalizedUser = String(req.user).trim();
            if (normalizedUser && !record.viewedBy.includes(normalizedUser)) {
                record.views = (typeof record.views === 'number' ? record.views : 0) + 1;
                record.viewedBy.push(normalizedUser);
            }
            const result = await record.save();
            const out = result.toObject ? result.toObject() : { ...result };
            delete out.viewedBy;
            return res.json(out);
        }

        if (req.body?.title) {
            if (req.body.title.length > 100) return res.status(400).json({ message: 'Title must not exceed 100 characters.' });
            record.title = req.body.title;
        }

        if (req.body?.thumbnail !== undefined) {
            record.thumbnail = req.body.thumbnail;
        }

        if (typeof req.body?.isBanned !== 'undefined') {
            record.isBanned = req.body.isBanned === true || req.body.isBanned === 'true';
        }

        const result = await record.save();
        const out = result.toObject ? result.toObject() : { ...result };
        delete out.viewedBy;
        res.json(out);
    } catch (err) {
        console.error('updateShortsSummaryApi error:', err?.message || err);
        res.status(500).json({ message: 'Update failed. Please try again.' });
    }
};

const deleteShortsSummaryApi = async (req, res) => {
    try {
        const shortId = req.body?.shortId || req.query?.shortId || req.params?.shortId;
        if (!shortId) return res.status(400).json({ message: 'shortId required.' });
        const record = await ShortsSummaryApi.findOne({ shortId }).exec();
        if (!record) return res.status(204).json({ message: `No ShortsSummaryApi matches shortId ${shortId}.` });
        await record.deleteOne();
        res.json({ message: 'Short summary deleted successfully.', shortId });
    } catch (err) {
        console.error('deleteShortsSummaryApi error:', err?.message || err);
        res.status(500).json({ message: 'Delete failed. Please try again.' });
    }
};

const getShortsSummaryApi = async (req, res) => {
    try {
        const shortId = req.params?.shortId || req.query?.shortId || req.body?.shortId;
        if (!shortId) return res.status(400).json({ message: 'shortId required.' });
        const record = await ShortsSummaryApi.findOne({ shortId }).lean();
        if (!record) return res.status(204).json({ message: `No ShortsSummaryApi matches shortId ${shortId}.` });

        const aggregated = await AggregatedShortsApi.findOne({ shortId }).lean();
        res.json({
            ...record,
            isBanned: record.isBanned === true || aggregated?.isBanned === true
        });
    } catch (err) {
        console.error('getShortsSummaryApi error:', err?.message || err);
        res.status(500).json({ message: 'Failed to fetch summary. Please try again.' });
    }
};

module.exports = {
    getAllShortsSummaryApis,
    createNewShortsSummaryApi,
    updateShortsSummaryApi,
    deleteShortsSummaryApi,
    getShortsSummaryApi
};
