const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const Media = require('../model/Media');
const upload = require('../config/multerCloudinary');

const detectContentType = (name) => {
  const lc = name.toLowerCase();
  if (lc.endsWith('.mp4')) return 'video/mp4';
  if (lc.endsWith('.webm')) return 'video/webm';
  if (lc.endsWith('.ogg')) return 'video/ogg';
  if (lc.endsWith('.png')) return 'image/png';
  if (lc.endsWith('.jpg') || lc.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}// this tells us what type of file it is to make the browser know

const listMedia = async (req, res) => {
  const items = await Media.find().select('filename contentType').lean();
  res.json(items.map(i => i.filename));
};// brings or lists from the db only filenames and does not include the contenttype and the files names are "video1.mp4"..

// Serve files either from DB or from disk (including backend/videos)
const getFile = async (req, res) => {//helps us to make request
  const name = req.params.name;// name here is what is located at the end of the filename url which is /media/file/video1.mp4---here name is video1.mp4-this is what is in our request
  if (!name) return res.status(400).json({ message: 'Filename required' });

  //1) Try DB first
  let media = await Media.findOne({ filename: name }).exec();// chekcs the db for the filename that is requested
  if (media && media.data) {
    res.set('Content-Type', media.contentType || detectContentType(name));
    return res.send(media.data);
  }// means if file is located in db, bring it directly and no need to go to the device

  //2) if the files are not on the db, search for them on the device
  const candidates = [
    path.join(__dirname, '..', 'videos', name),
    path.join(__dirname, '..', 'public', 'videos', name),
    path.join(__dirname, '..', 'public', 'images', name),
    path.join(__dirname, '..', 'public', 'imgf', name),
    path.join(__dirname, '..', 'public', name)
  ];

  let filePath = null;
  for (const p of candidates) {
    try {
      await fsp.access(p, fs.constants.R_OK);
      filePath = p;// here if file exists, stop
      break;
    } catch (e) {
      // not found, continue
    }
  }

  if (!filePath) return res.sendStatus(404);// here checking the device ends

  //finally here media.data is where the filename from the db is stored and filepath is where the file coming from the device is stored.

  //3) Is about playing videos smootly- not about downloading videos at once
  try {
    const stat = await fsp.stat(filePath);
    const total = stat.size;//checks size of the video like if it is 10MB OR STH
    const range = req.headers.range;//checks if user is watching in parts-here without range video loads fully but with range video loads step by step(fast like youtube)
    const contentType = detectContentType(name);

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      if (start >= total || end >= total) {
        res.status(416).set('Content-Range', `bytes */${total}`).end();
        return;
      }
      const chunkSize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': total, 'Content-Type': contentType });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err) {
    console.error('Error serving file', err);
    res.sendStatus(500);
  }
};

//4) Upload media to Cloudinary
const uploadMedia = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  // File info from multer-storage-cloudinary
  const { path: url, originalname, mimetype } = req.file;
  // if it is uploaded, the url is https://res..., originalname is cat.mp4 and mimetype is video/mp4
  res.status(201).json({
    message: 'File uploaded to Cloudinary',
    url,
    filename: originalname,
    contentType: mimetype
  });
};

module.exports = { listMedia, getFile, uploadMedia, upload };
