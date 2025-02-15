const { nanoid } = require('nanoid');
const URL = require('../models/url');

async function handleGenerateURL(req, res) {
    const body = req.body;
    if (!body.redirectUrl) return res.status(400).json({ error: 'Missing redirect URL' });
    const shortId = nanoid(8)
    await URL.create({ shortId, redirectUrl: body.redirectUrl })

    res.json({ shortUrl: `http://localhost:3000/${shortId}` });
}

module.exports = handleGenerateURL;