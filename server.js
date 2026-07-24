require('dotenv').config();
const express= require('express');
const app= express();
const fs= require('fs');
const fsPromises= require('fs').promises;
const path= require('path');
const cors= require('cors');
const PORT= process.env.PORT || 3500;
const {logger}= require('./middleware/logEvents');
const errorHandler=require('./middleware/errorHandler');
const verifyJWT= require('./middleware/verifyJWT');
const cookieParser= require('cookie-parser');
const requireAuthForPages = require('./middleware/requireAuthForPages');
const corsOptions=require('./config/corsOptions');
const credentials=require('./middleware/credentials');
const mongoose= require('mongoose');
const connectDB= require('./config/dbConn');
connectDB();



app.use(logger);
app.use(credentials); // credentials must be used before CORS
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Protect certain frontend pages before static serving
app.use(requireAuthForPages);

app.use(express.static(path.join(__dirname, '/public')));//This hepls us connect images and css files to the pages in views folder like documentation.html

app.use('/subdir', require('./routes/subdir'));
app.use('/', require('./routes/root'));//This run the files in views.
//app.use(express.json());
//app.use(cookieParser());
app.use('/register', require('./routes/register'));
app.use('/auth', require('./routes/auth'));
app.use('/registered', require('./routes/api/registered'));
app.use('/refresh', require('./routes/refresh'));// and here
app.use('/logout', require('./routes/logout'));// and here
// public user helpers (username availability)
app.use('/users', require('./routes/users'));

// if we say http://localhost:3500/users by a get request, it gives us usernames in the db of all people
// public media route (serve images/videos from DB or disk)
app.use('/media', require('./routes/media'));
app.use('/api', require('./routes/cloudinary'));
app.use('/commentApi', require('./routes/api/commentapis'));
app.use(verifyJWT);// whatever is below this will be handled by accessToken

app.use('/notInterestedApi', require('./routes/api/notInterested'));
app.use('/channelApi', require('./routes/api/channelapis'));
app.use('/subscribedChannelsApi', require('./routes/api/subscribedChannelsApi'));
app.use('/aggregatedApi', require('./routes/api/aggregatedvideoapis'));
app.use('/videoSummaryApi', require('./routes/api/videosummaryapis'));
app.use('/videoContentApi', require('./routes/api/videocontentapis'));
app.use('/thumbnailApi', require('./routes/api/thumbnailapis'));
app.use('/notificationApi', require('./routes/api/notificationapis'));

app.use('/youtubeHomepageApi', require('./routes/api/youtubehomepageapis'));
app.use('/youtubeSecondpageapi', require('./routes/api/youtubeSecondpageapis'));
// Alias (accept plural path used by some clients)
app.use('/youtubeSecondpageapis', require('./routes/api/youtubeSecondpageapis'));
app.use('/aggregatedShortsApi', require('./apis/routes/aggregatedShortsApi'));
app.use('/shortsSummaryApi',    require('./apis/routes/shortsSummaryApi'));
app.use('/shortsContentApi',    require('./apis/routes/shortsContentApi'));
app.use('/playlistHomeApi', require('./apis/routes/playlistHomeApi'));
app.use('/playlistVideoApi', require('./apis/routes/playlistVideoApi'));
//app.use(logger);

//const allowedOrigns=['https://www.google.com', 'http://127.0.0.1:5500', 'http://localhost:3500'];
/*const corsOptions={
    origin:(origin, callback)=>{
        if (!origin || allowedOrigns.indexOf(origin)!==-1){
            callback(null, true);
        }else{
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus:200
}*/
//app.use(credentials);//credentials must be used above cors
//app.use(cors(corsOptions));
app.use((req, res)=>{
    res.status(404);
    if (req.accepts('html')){
        res.sendFile(path.join(__dirname, 'views', '404.html'));
    }else if (req.accepts('json')){
        res.json({error: '404 Not Found'})
    }else{
        res.type('text').send('404 not found');
    }
})
app.use(errorHandler)
mongoose.connection.once('open', async ()=>{
    console.log('Connected to MongoDB');
    try {
        const usersColl = mongoose.connection.db.collection('users');
        const indexes = await usersColl.indexes();
        const hasVideoId = indexes.some(idx => idx.name === 'videoId_1');
        if (hasVideoId) {
            await usersColl.dropIndex('videoId_1');
            console.log('Dropped conflicting index videoId_1 from users collection');
        }
    } catch (err) {
        console.error('Error checking/dropping users.videoId_1 index:', err.message || err);
    }
    try {
        const collections = [
            'aggregatedvideoapis',
            'thumbnailapis',
            'videosummaryapis',
            'videocontentapis'
        ];
        for (const col of collections) {
            try {
                await mongoose.connection.db.collection(col).dropIndex('channelId_1');
                console.log(`Dropped stale channelId_1 index from ${col}`);
            } catch (e) {
                if (!(e && e.codeName === 'IndexNotFound')) {
                    console.warn(`Could not drop channelId_1 from ${col}:`, e.message || e);
                }
            }
        }
    } catch (e) {
        console.warn('Error while attempting to drop channelId_1 indexes:', e.message || e);
    }
    try {
        const channelsColl = mongoose.connection.db.collection('channelapis');
        const legacyChannels = await channelsColl.find({ 'subscribers.0': { $type: 'string' } }).toArray();
        for (const doc of legacyChannels) {
            const migratedSubscribers = (doc.subscribers || []).map(s =>
                typeof s === 'string' ? { username: s, subscribedAt: new Date() } : s
            );
            await channelsColl.updateOne({ _id: doc._id }, { $set: { subscribers: migratedSubscribers } });
        }
        if (legacyChannels.length) {
            console.log(`Migrated subscribers array for ${legacyChannels.length} channel(s).`);
        }
    } catch (err) {
        console.error('Error migrating channel subscribers:', err.message || err);
    }
    const server = app.listen(PORT, ()=>console.log(`Server is running on ${PORT}`));
    // Increase server timeouts to allow large uploads to complete
    server.timeout = 60 * 60 * 1000; // 5 minutes
    server.keepAliveTimeout = 60 * 60 * 1000;
    server.headersTimeout = 60 * 60 * 1000;
});

