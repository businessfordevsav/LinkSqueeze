const URL = require("../models/url");
const { status } = require("express/lib/response");
const geoip = require("geoip-lite");
const e = require("express");

async function handleGenerateURL(req, res) {
  try {
    // Dynamically import nanoid
    const { nanoid } = await import("nanoid");
    const body = req.body;
    if (!body.redirectUrl)
      return res.status(400).json({
        status: "success",
        statusCode: 200,
        message: "Missing redirect URL",
        body: {},
      });
    const shortId = nanoid(8);
    await URL.create({
      shortId,
      redirectUrl: body.redirectUrl,
    });

    res.json({
      status: "success",
      statusCode: 200,
      body: { shortUrl: `http://localhost:3000/url/${shortId}` },
    });
  } catch (err) {
    res.status(400).json({
      status: "success",
      statusCode: 200,
      message: err.message,
      body: {},
    });
  }
}

async function handleAnalytics(req, res) {
  const shortId = req.query.shortId;

  const url = await URL.findOne({ shortId });
  if (!url) return res.status(404).json({ error: "URL not found" });

  res.json({
    status: "success",
    statusCode: status,
    body: {
      visitHistory: url.visitHistory,
      totalVisits: url.visitHistory.length,
    },
  });
}

async function handleRedirect(req, res) {
  const { shortId } = req.params;

  let platform;
  if (req.useragent.isWindows) platform = "Windows";
  else if (req.useragent.isMac) platform = "MacOS";
  else if (req.useragent.isLinux) platform = "Linux";
  else if (req.useragent.isAndroid) platform = "Android";
  else if (req.useragent.isiOS) platform = "iOS";
  else platform = req.useragent.platform;
  const url = await URL.findOneAndUpdate(
    { shortId },
    {
      $inc: { clicks: 1 },
      $push: {
        visitHistory: {
          timestamp: new Date(),
          ipAddress: req.ip,
          platform: platform,
          browser: req.useragent.browser,
          country: req.geoip?.country,
          deviceType: req.useragent.isMobile ? "Mobile" : "Desktop",
        },
      },
    },
    { new: true }
  );

  if (!url) return res.status(404).send("URL not found");
  res.redirect(url.redirectUrl);
}

module.exports = { handleGenerateURL, handleAnalytics, handleRedirect };
