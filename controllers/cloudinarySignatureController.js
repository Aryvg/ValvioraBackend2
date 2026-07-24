const crypto = require('crypto');

exports.getCloudinarySignature = (req, res) => {
  const { folder, public_id, timestamp } = req.body;
  if (!folder || !public_id || !timestamp) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // 1. Sort params alphabetically by key (already in order)
  const paramsToSign = `folder=${folder}&public_id=${public_id}&timestamp=${timestamp}`;
  // 2. Use your API_SECRET from env
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  // 3. Generate signature
  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + apiSecret)
    .digest('hex');

  // Logging for debugging
  console.log('String to sign:', paramsToSign);
  console.log('Generated signature:', signature);
  console.log('Timestamp:', timestamp);
  console.log('Request body:', req.body);

  res.json({ signature, stringToSign: paramsToSign, timestamp });
};
