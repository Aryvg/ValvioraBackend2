require('dotenv').config();
const mongoose = require('mongoose');
const AggregatedShortsApi = require('../model/AggregatedShortsApi');
const ShortsSummaryApi = require('../model/ShortsSummaryApi');
const ShortsContentApi = require('../model/ShortsContentApi');

const run = async () => {
  if (!process.env.DATABASE_URI) {
    console.error('DATABASE_URI is not configured.');
    process.exit(1);
  }

  const targetShortId = process.argv[2];
  const shouldRepair = process.argv.includes('--repair');

  await mongoose.connect(process.env.DATABASE_URI);
  console.log('Connected to MongoDB');

  try {
    if (targetShortId) {
      const summary = await ShortsSummaryApi.findOne({ shortId: targetShortId }).lean();
      const aggregate = await AggregatedShortsApi.findOne({ shortId: targetShortId }).lean();
      const content = await ShortsContentApi.findOne({ shortId: targetShortId }).lean();

      console.log('--- Summary ---');
      console.log(JSON.stringify(summary, null, 2));
      console.log('--- Aggregate ---');
      console.log(JSON.stringify(aggregate, null, 2));
      console.log('--- Content ---');
      console.log(JSON.stringify(content, null, 2));

      if (shouldRepair && !aggregate && summary && content) {
        const repaired = await AggregatedShortsApi.create({
          shortId: summary.shortId,
          channelId: summary.channelId || content.channelId || '',
          title: summary.title || '',
          views: summary.views || 0,
          thumbnail: summary.thumbnail || '',
          videoUrl: content.videoUrl || '',
          createdAt: summary.createdAt || new Date().toISOString(),
          Likes: content.Likes || 0,
          Dislikes: content.Dislikes || 0,
          channelName: content.channelName || '',
          ProfilePicture: content.ProfilePicture || '',
          createdBy: content.createdBy || summary.createdBy || ''
        });
        console.log('Repaired aggregate:', repaired.shortId);
      }
      return;
    }

    const summaries = await ShortsSummaryApi.find({}).lean();
    console.log(`Found ${summaries.length} summary records`);

    for (const summary of summaries) {
      const existing = await AggregatedShortsApi.findOne({ shortId: summary.shortId }).lean();
      if (existing) {
        continue;
      }

      const content = await ShortsContentApi.findOne({ shortId: summary.shortId }).lean();
      if (!content) {
        console.warn(`Orphaned summary without matching content/aggregate: ${summary.shortId}`);
        continue;
      }

      if (!summary.thumbnail || !content.videoUrl) {
        console.warn(`Incomplete data for ${summary.shortId}; skipping repair.`);
        continue;
      }

      const aggregate = await AggregatedShortsApi.create({
        shortId: summary.shortId,
        channelId: summary.channelId || content.channelId || '',
        title: summary.title || '',
        views: summary.views || 0,
        thumbnail: summary.thumbnail || '',
        videoUrl: content.videoUrl || '',
        createdAt: summary.createdAt || new Date().toISOString(),
        Likes: content.Likes || 0,
        Dislikes: content.Dislikes || 0,
        channelName: content.channelName || '',
        ProfilePicture: content.ProfilePicture || '',
        createdBy: content.createdBy || summary.createdBy || ''
      });

      console.log(`Repaired aggregate for shortId: ${aggregate.shortId}`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
