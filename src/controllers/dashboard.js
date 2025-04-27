import URL from "../models/url.js";
import { getProxiedUrl } from "../services/qrCodeService.js";

// Get dashboard with user's URLs
export const getDashboard = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // 10 links per page
    const skip = (page - 1) * limit;

    // Get total count of user's URLs for pagination
    const totalUrls = await URL.countDocuments({ createdBy: req.user._id });
    const totalPages = Math.ceil(totalUrls / limit);

    // Get user's URLs with pagination
    const urls = await URL.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    
    res.render("dashboard/index", {
      user: req.user,
      urls,
      baseUrl,
      error: req.query.error || null,
      success: req.query.success || null,
      currentPage: page,
      totalPages,
      totalUrls
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.render("dashboard/index", {
      user: req.user,
      urls: [],
      baseUrl: `${req.protocol}://${req.get("host")}`,
      error: "Error loading dashboard",
      success: null,
      currentPage: 1,
      totalPages: 0,
      totalUrls: 0
    });
  }
};

// Get detailed analytics for a specific link
export const getLinkAnalytics = async (req, res) => {
  try {
    const { shortId } = req.params;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    
    // Find the URL and ensure it belongs to the current user
    const url = await URL.findOne({ 
      shortId, 
      createdBy: req.user._id 
    });
    
    if (!url) {
      return res.status(404).render("dashboard/analytics", {
        error: "Link not found or you don't have permission to view it",
        url: null,
        analytics: null,
        baseUrl,
        req
      });
    }
    
    // Process analytics data
    const countryCounts = {};
    const deviceCounts = {};
    const browserCounts = {};
    const platformCounts = {};
    const timeData = {};
    const referrerData = {};
    
    url.visitHistory.forEach((visit) => {
      // Count by country
      const country = visit.country || "Unknown";
      countryCounts[country] = (countryCounts[country] || 0) + 1;
      
      // Count by device type
      const device = visit.deviceType || "Unknown";
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;
      
      // Count by browser
      const browser = visit.browser || "Unknown";
      browserCounts[browser] = (browserCounts[browser] || 0) + 1;
      
      // Count by platform
      const platform = visit.platform || "Unknown";
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      
      // Count by referrer
      const referrer = visit.referrer || "Direct";
      referrerData[referrer] = (referrerData[referrer] || 0) + 1;
      
      // Process time data (by hour)
      if (visit.timestamp) {
        const date = new Date(visit.timestamp);
        const hour = date.getHours();
        timeData[hour] = (timeData[hour] || 0) + 1;
      }
    });
    
    const analytics = {
      totalClicks: url.clicks,
      countries: countryCounts,
      devices: deviceCounts,
      browsers: browserCounts,
      platforms: platformCounts,
      timeDistribution: timeData,
      referrers: referrerData
    };
    
    // Make ensureProxiedUrl function available to the template
    const ensureProxiedUrl = (url) => {
      return getProxiedUrl(url);
    };
    
    res.render("dashboard/analytics", {
      url,
      analytics,
      baseUrl,
      error: null,
      ensureProxiedUrl, // Pass the function to the view
      req // Pass the request object to the view so pagination works
    });
  } catch (error) {
    console.error("Link analytics error:", error);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.status(500).render("dashboard/analytics", {
      error: "An error occurred while fetching link analytics",
      url: null,
      analytics: null,
      baseUrl,
      req
    });
  }
};

// Get all links for the current user
export const getUserLinks = async (req, res) => {
  try {
    const urls = await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    
    res.json({
      status: "success",
      count: urls.length,
      data: urls.map(url => ({
        ...url.toObject(),
        fullUrl: `${baseUrl}/url/${url.shortId}`
      }))
    });
  } catch (error) {
    console.error("Get user links error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch your links"
    });
  }
};