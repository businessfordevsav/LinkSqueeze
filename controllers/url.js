const { nanoid } = require("nanoid");
const URL = require("../models/url");
const { status } = require("express/lib/response");
const geoip = require("geoip-lite");

async function handleGenerateURL(req, res) {
  const body = req.body;
  if (!body.redirectUrl)
    return res.status(400).json({ error: "Missing redirect URL" });
  const shortId = nanoid(8);
  await URL.create({
    shortId,
    redirectUrl: body.redirectUrl.replace("https://", ""),
  });

  res.json({
    status: "success",
    statusCode: 200,
    body: { shortUrl: `http://localhost:3000/${shortId}` },
  });
}

async function handleAnalytics(req, res) {
  const shortId = req.query.shortId;

  const url = await URL.findOne({ shortId });
  if (!url) return res.status(404).json({ error: "URL not found" });

  res.json({
    status: "success",
    statusCode: status,
    body: {
      visitiHistory: url.visitiHistory,
      totalVisits: url.visitiHistory.length,
    },
  });
}

async function handleRedirect(req, res) {
  const shortId = req.params.shortId;
  const url = await URL.findOne({ shortId });

  if (!url) return res.status(404).json({ error: "URL not found" });

  var geo = geoip.lookup(req.ip);

  const browser = req.useragent.browser;
  console.log(JSON.stringify(req.useragent, null, 4));
  const platform = req.useragent.platform;

  url.visitiHistory.push({
    ipAddress: req.ip,
    platform: platform,
    browser: browser,
    country: geo ? geo.country : "Unknown",
  });
  await url.save();

  res.redirect(`https://${url.redirectUrl}`);
}

module.exports = { handleGenerateURL, handleAnalytics, handleRedirect };
