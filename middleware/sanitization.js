// Centralized sanitization and validation middleware for reuse
const { body, validationResult } = require('express-validator');

function sanitizeText(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.replace(/[<>]/g, ch => ch === '<' ? '&lt;' : '&gt;');
}

// Employees sanitization
const employeeSanitization = [
    body('firstname').trim().escape(),
    body('lastname').trim().escape(),
    body('job').trim().escape(),
    body('address').trim().escape(),
    //the code we have after this cleans up only the commenets and skills fields, it checks if they are string or not, if they are string it tries to parse them as json, if it fails it treats them as string, if they are array or object it sanitizes the string values inside them, if they are something else it returns them as is.
    body('comments').optional().customSanitizer(value => {
        if (!value) return value;
        let arr = value;
        if (typeof value === 'string') {
            try { arr = JSON.parse(value); } catch (e) { arr = [value]; }
        }
        if (!Array.isArray(arr)) return arr;
        return arr.map(v => typeof v === 'string' ? v.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;', '/': '&#x2F;' }[s])) : v);
    }),
    body('skills').optional().customSanitizer(value => {
        if (!value) return value;
        let obj = value;
        if (typeof value === 'string') {
            try { obj = JSON.parse(value); } catch (e) { return value; }
        }
        if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj;
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const v = obj[key];
                sanitized[key] = typeof v === 'string' ? v.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;', '/': '&#x2F;' }[s])) : v;
            }
        }
        return sanitized;
    })
];

// Practice sanitization (for practiceController2 and practiceController)
const practiceSanitization = [
    body('name').optional().trim().escape(),
    body('email').optional().trim().escape(),
    body('job').optional().trim().escape(),
    body('practiceInfo').optional().customSanitizer(value => {
        if (!value) return value;
        let obj = value;
        if (typeof value === 'string') {
            try { obj = JSON.parse(value); } catch (e) { return value; }
        }
        if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj;
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const v = obj[key];
                sanitized[key] = typeof v === 'string' ? v.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;', '/': '&#x2F;' }[s])) : v;
            }
        }
        return sanitized;
    }),
    body('userInfo').optional().customSanitizer(value => {
        if (!value) return value;
        let obj = value;
        if (typeof value === 'string') {
            try { obj = JSON.parse(value); } catch (e) { return value; }
        }
        if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj;
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const v = obj[key];
                sanitized[key] = typeof v === 'string' ? v.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;', '/': '&#x2F;' }[s])) : v;
            }
        }
        return sanitized;
    })
];

// Centralized validation error handler
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

// Channel API sanitization (for channelapiController)
const ChannelApiSanitization = [
    body('channelname').optional().trim().escape(),
    body('channelType').optional().trim().escape(),
    body('Description').optional().trim().escape(),
    body('channelId').optional().trim().escape(),
    body('profilePicture').optional().trim(),
    body('channelBanner').optional().trim(),
    body('contactEmail').optional().isEmail().normalizeEmail(),
    body('subscribe').optional().isInt({ min: 0 }).toInt()
];

const AggregatedVideoApiSanitization = [
    body('title').optional().customSanitizer(sanitizeText),
    body('video').optional().trim(),
    body('image').optional().trim(),
    body('shortDescription').optional().customSanitizer(sanitizeText),
    body('DetailedDescription').optional().customSanitizer(sanitizeText),
    body('Views').optional().isInt({ min: 0 }).toInt(),
    body('Time').optional().isFloat({ min: 0 }).toFloat()
];
const videosummaryapiSanitization = [
    body('title').optional().customSanitizer(sanitizeText),
    body('Views').optional().isInt({ min: 0 }).toInt(),
    body('Time').optional().isFloat({ min: 0 }).toFloat()
];
const VideoContentApiSanitization = [
    body('video').optional().trim(),
    body('shortDescription').optional().customSanitizer(sanitizeText),
    body('DetailedDescription').optional().customSanitizer(sanitizeText),
];
const ThumbnailApiSanitization = [
    body('image').optional().trim().escape()
];
const NotificationApiSanitization = [
    body('videoId').exists({ checkFalsy: true }).trim().isString().withMessage('videoId must be a string'),
    body('channelId').exists({ checkFalsy: true }).trim().isString().withMessage('channelId must be a string'),
    body('isRead').exists().custom(value => {
        if (typeof value === 'boolean') return true;
        if (typeof value === 'string' && (value === 'true' || value === 'false')) return true;
        throw new Error('isRead must be a boolean or "true"/"false"');
    })
];
module.exports = {
    employeeSanitization,
    practiceSanitization,
    ChannelApiSanitization,
    handleValidationErrors,
    AggregatedVideoApiSanitization,
    videosummaryapiSanitization,
    VideoContentApiSanitization,
    ThumbnailApiSanitization,
    NotificationApiSanitization
};
