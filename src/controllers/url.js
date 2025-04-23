import URL from "../models/url.js";
// Fix the import error by importing the module as a default export
import responseModule from "express/lib/response.js";
import geoip from "geoip-lite";

const handleGenerateURL = async (req, res) => {
  try {
    // Dynamically import nanoid
    const { nanoid } = await import("nanoid");
    const { redirectUrl } = req.body;

    if (!redirectUrl)
      return res.status(400).json({
        status: "success",
        statusCode: 200,
        message: "Missing redirect URL",
        body: {},
      });

    const shortId = nanoid(8);
    await URL.create({
      shortId,
      redirectUrl,
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
};

const handleAnalytics = async (req, res) => {
  const { shortId } = req.query;

  const url = await URL.findOne({ shortId });
  if (!url) return res.status(404).json({ error: "URL not found" });

  res.json({
    status: "success",
    statusCode: 200, // Fixed: Using explicit status code instead of imported status
    body: {
      visitHistory: url.visitHistory,
      totalVisits: url.visitHistory.length,
    },
  });
};

const handleRedirect = async (req, res) => {
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
          platform,
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
};

export { handleGenerateURL, handleAnalytics, handleRedirect };
