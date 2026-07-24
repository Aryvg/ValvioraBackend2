const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let ensureIndexPromise = null;

async function ensureUserScopedIndex() {
    if (ensureIndexPromise) return ensureIndexPromise;

    ensureIndexPromise = (async () => {
        try {
            const db = mongoose.connection.db;
            if (!db) return;

            const candidateNames = [mongoose.models.NotInterested?.collection?.name, 'notinteresteds', 'notinterests'];
            const collectionName = candidateNames.find(Boolean) || 'notinteresteds';
            const collection = db.collection(collectionName);
            const indexes = await collection.indexes();

            for (const index of indexes) {
                const keys = Object.keys(index.key || {});
                const isLegacyContentIndex = index.unique && keys.length === 1 && keys[0] === 'contentId';
                const isLegacyUserIdCompound = index.unique && keys.includes('userId') && keys.includes('contentId');
                const isLegacyUsernameCompound = index.unique && keys.includes('username') && keys.includes('contentId') && index.name !== 'username_contentId_unique';

                if (isLegacyContentIndex || isLegacyUserIdCompound || isLegacyUsernameCompound) {
                    await collection.dropIndex(index.name).catch(() => {});
                }
            }

            await collection.createIndex({ username: 1, contentId: 1 }, { unique: true, name: 'username_contentId_unique' }).catch(() => {});
        } catch (err) {
            console.warn('ensureUserScopedIndex warning:', err?.message || err);
        }
    })();

    return ensureIndexPromise;
}

const notInterestedSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    contentId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['video', 'short', 'playlist']
    }
}, { timestamps: true });

notInterestedSchema.index({ username: 1, contentId: 1 }, { unique: true, name: 'username_contentId_unique' });

const NotInterestedModel = mongoose.model('NotInterested', notInterestedSchema);

module.exports = Object.assign(NotInterestedModel, { ensureUserScopedIndex });
