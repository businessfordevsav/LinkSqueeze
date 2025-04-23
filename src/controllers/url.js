import URL from "../models/url.js";
// Fix the import error by importing the module as a default export
import responseModule from "express/lib/response.js";
import geoip from "geoip-lite";
import {
  generateQRCode,
  deleteQRCode,
  generateAdModeQRCode,
} from "../services/qrCodeService.js";

// Updated handleGenerateURL function with better error logging
const handleGenerateURL = async (req, res) => {
  try {
    // Dynamically import nanoid
    const { nanoid } = await import("nanoid");
    const {
      redirectUrl,
      name,
      expiresAt,
      customOverlay,
      overlayText,
      buttonText,
      buttonUrl,
      customOverlayEnabled,
      adModeEnabled,
      iconSizePercent,
      useLargeIcon,
    } = req.body;

    console.log("Received request to generate short URL:", {
      redirectUrl,
      name: name || "[not provided]",
      expiresAt: expiresAt || "[not provided]",
      customOverlayEnabled: customOverlayEnabled || false,
      overlayText: overlayText || "[not provided]",
      adModeEnabled: adModeEnabled || false,
    });

    if (!redirectUrl)
      return res.status(400).json({
        status: "error",
        statusCode: 400,
        message: "Missing redirect URL",
        body: {},
      });

    const shortId = nanoid(8);
    console.log(`Generated shortId: ${shortId}`);
    const fullUrl = `${req.protocol}://${req.get("host")}/url/${shortId}`;
    console.log(`Full URL for QR code: ${fullUrl}`);

    // Generate QR code (with or without ad mode)
    console.log("Attempting to generate QR code...");
    let qrCodeUrl;
    try {
      // Check if ad mode is enabled
      if (adModeEnabled === "on" || adModeEnabled === true) {
        console.log("Using ad mode with app icon for QR code");
        const adModeOptions = {
          iconSizePercent: iconSizePercent ? parseInt(iconSizePercent) : 20,
          useLargeIcon: useLargeIcon === "on" || useLargeIcon === true,
          darkColor: "#000000",
          lightColor: "#ffffff",
        };
        qrCodeUrl = await generateAdModeQRCode(shortId, fullUrl, adModeOptions);
      } else {
        qrCodeUrl = await generateQRCode(shortId, fullUrl);
      }
      console.log(`QR code generated successfully: ${qrCodeUrl}`);
    } catch (qrError) {
      console.error("QR code generation failed:", qrError);
      // Continue with URL creation even if QR fails
      qrCodeUrl = null;
    }

    // Process custom overlay data from form if enabled
    let parsedCustomOverlay = null;
    if (customOverlay) {
      // If already a JSON object, use it directly
      parsedCustomOverlay =
        typeof customOverlay === "string"
          ? JSON.parse(customOverlay)
          : customOverlay;
    } else if (customOverlayEnabled === "on" || customOverlayEnabled === true) {
      // Build custom overlay from form fields
      parsedCustomOverlay = {
        enabled: true,
        text: overlayText || null,
        buttonText: buttonText || null,
        buttonUrl: buttonUrl || null,
        backgroundColor: "rgba(0, 0, 0, 0.85)", // Default dark background
        textColor: "#ffffff", // Default white text
        buttonColor: "#3b82f6", // Default blue button
      };
    }

    // Parse expiration date if provided as YYYY-MM-DD format
    let parsedExpiresAt = null;
    if (expiresAt) {
      if (expiresAt.includes("T")) {
        // Already in ISO format
        parsedExpiresAt = new Date(expiresAt);
      } else {
        // Convert from YYYY-MM-DD to date object
        parsedExpiresAt = new Date(expiresAt);
        // Set time to end of day
        parsedExpiresAt.setHours(23, 59, 59, 999);
      }
    }

    // Create the URL document
    console.log("Creating URL document in database...");
    const urlDoc = await URL.create({
      shortId,
      redirectUrl,
      name: name || `Shortened-${shortId}`,
      qrCodeUrl,
      // Set expiration date if provided
      ...(parsedExpiresAt && { expiresAt: parsedExpiresAt }),
      // Add custom overlay if provided
      ...(parsedCustomOverlay && { customOverlay: parsedCustomOverlay }),
      // Add user reference if authenticated
      ...(req.user && { createdBy: req.user._id }),
      // Store if ad mode was used
      adModeEnabled: adModeEnabled === "on" || adModeEnabled === true,
    });

    console.log(`URL document created with ID: ${urlDoc._id}`);

    // Construct the full QR code URL if available
    const fullQrCodeUrl = qrCodeUrl
      ? `${req.protocol}://${req.get("host")}${qrCodeUrl}`
      : null;

    res.json({
      status: "success",
      statusCode: 200,
      body: {
        shortUrl: fullUrl,
        qrCodeUrl: fullQrCodeUrl,
        details: urlDoc,
      },
    });
  } catch (err) {
    console.error("Error in handleGenerateURL:", err);
    res.status(400).json({
      status: "error",
      statusCode: 400,
      message: err.message,
      body: {},
    });
  }
};

// Add function to regenerate QR code if needed, now with ad mode support
const handleRegenerateQRCode = async (req, res) => {
  try {
    const { shortId } = req.params;
    const { adModeEnabled, iconSizePercent, useLargeIcon } = req.body;

    const url = await URL.findOne({ shortId });
    if (!url) {
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        message: "URL not found",
      });
    }

    // Generate the full URL for the QR code
    const fullUrl = `${req.protocol}://${req.get("host")}/url/${shortId}`;

    // Delete existing QR code if there is one
    if (url.qrCodeUrl) {
      const deleted = await deleteQRCode(url.qrCodeUrl);
      if (!deleted) {
        console.warn(`Failed to delete existing QR code: ${url.qrCodeUrl}`);
      }
    }

    // Generate a new QR code
    let qrCodeUrl;
    try {
      if (adModeEnabled === "on" || adModeEnabled === true) {
        const adModeOptions = {
          iconSizePercent: iconSizePercent ? parseInt(iconSizePercent, 10) : 20,
          useLargeIcon: useLargeIcon === "on" || useLargeIcon === true,
          darkColor: "#000000",
          lightColor: "#ffffff",
        };
        qrCodeUrl = await generateAdModeQRCode(shortId, fullUrl, adModeOptions);
        url.adModeEnabled = true; // Update the ad mode flag
      } else {
        qrCodeUrl = await generateQRCode(shortId, fullUrl);
        url.adModeEnabled = false; // Update the ad mode flag
      }
    } catch (qrError) {
      console.error("Failed to generate QR code:", qrError);
      return res.status(500).json({
        status: "error",
        statusCode: 500,
        message: "Failed to generate QR code: " + qrError.message,
      });
    }

    // Update the URL with the new QR code URL
    url.qrCodeUrl = qrCodeUrl;
    await url.save();

    // Return success response
    res.json({
      status: "success",
      statusCode: 200,
      body: {
        message: "QR code regenerated successfully",
        qrCodeUrl: `${req.protocol}://${req.get("host")}${qrCodeUrl}`,
        url,
      },
    });
  } catch (err) {
    console.error("Error regenerating QR code:", err);
    res.status(500).json({
      status: "error",
      statusCode: 500,
      message: err.message,
    });
  }
};

const handleAnalytics = async (req, res) => {
  try {
    const { shortId } = req.query;
    console.log(`Fetching analytics for URL ID: ${shortId}`);

    // Fetch the complete URL document
    const url = await URL.findOne({ shortId });

    if (!url) {
      console.log(`URL not found: ${shortId}`);
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        message: "URL not found",
      });
    }

    console.log(`Successfully found URL: ${url.shortId}, name: ${url.name}`);

    // Process analytics data with visualizations
    const countryCounts = {};
    const deviceCounts = {};
    const browserCounts = {};
    const platformCounts = {};
    const timeData = {};

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

      // Process time data (by hour)
      if (visit.timestamp) {
        const date = new Date(visit.timestamp);
        const hour = date.getHours();
        timeData[hour] = (timeData[hour] || 0) + 1;
      }
    });

    // Return the complete URL document along with the analytics data
    res.json({
      status: "success",
      statusCode: 200,
      body: {
        visitHistory: url.visitHistory,
        totalVisits: url.visitHistory.length,
        analytics: {
          countries: countryCounts,
          devices: deviceCounts,
          browsers: browserCounts,
          platforms: platformCounts,
          timeDistribution: timeData,
        },
        url: url.toObject(), // Convert to plain object to ensure all fields are included
      },
    });
  } catch (err) {
    console.error("Error in handleAnalytics:", err);
    res.status(500).json({
      status: "error",
      statusCode: 500,
      message: err.message,
    });
  }
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

  try {
    const url = await URL.findOne({ shortId });

    if (!url) return res.status(404).send("URL not found");

    // Check if URL is active and not expired
    if (!url.isActive) {
      return res.status(403).render("error", {
        error: {
          status: 403,
          message: "This link has been disabled by the owner",
          details:
            "The owner of this link has temporarily disabled it. Please contact them for more information.",
        },
      });
    }

    if (url.expiresAt && new Date() > url.expiresAt) {
      return res.status(403).render("error", {
        error: {
          status: 403,
          message: "This link has expired",
          details:
            "The link you're trying to access has expired. Please contact the link creator for an updated link.",
        },
      });
    }

    // Create visit data
    const visitData = {
      timestamp: new Date(),
      ipAddress: req.ip,
      platform,
      browser: req.useragent.browser,
      country: req.geoip?.country || "Unknown",
      deviceType: req.useragent.isMobile ? "Mobile" : "Desktop",
      referrer: req.get("Referrer") || "Direct",
    };

    // If URL has custom overlay and is enabled, render the overlay page
    if (url.customOverlay && url.customOverlay.enabled) {
      // Update visit history and increment clicks
      await URL.findOneAndUpdate(
        { shortId },
        {
          $inc: { clicks: 1 },
          $push: { visitHistory: visitData },
        }
      );

      // Emit link click event for real-time notifications
      if (req.app.get("linkActivityEmitter")) {
        req.app.get("linkActivityEmitter").emit("linkClick", {
          shortId,
          urlName: url.name,
          visit: {
            ...visitData,
            timestamp: visitData.timestamp.toISOString(),
            platformIcon: URL.getPlatformIcon(platform),
            browserIcon: URL.getBrowserIcon(req.useragent.browser),
          },
        });
      }

      return res.render("overlay", {
        url,
        redirectUrl: url.redirectUrl,
        overlay: url.customOverlay,
      });
    }

    // Update visit history and increment clicks
    await URL.findOneAndUpdate(
      { shortId },
      {
        $inc: { clicks: 1 },
        $push: { visitHistory: visitData },
      }
    );

    // Emit link click event for real-time notifications
    if (req.app.get("linkActivityEmitter")) {
      req.app.get("linkActivityEmitter").emit("linkClick", {
        shortId,
        urlName: url.name,
        visit: {
          ...visitData,
          timestamp: visitData.timestamp.toISOString(),
          platformIcon: URL.getPlatformIcon(platform),
          browserIcon: URL.getBrowserIcon(req.useragent.browser),
        },
      });
    }

    res.redirect(url.redirectUrl);
  } catch (error) {
    console.error("Error in handleRedirect:", error);
    res.status(500).render("error", {
      error: {
        status: 500,
        message: "Server Error",
        details: "An unexpected error occurred while processing your request.",
      },
    });
  }
};

// Fixed handleEditURL function to properly handle the customOverlay nested object
const handleEditURL = async (req, res) => {
  try {
    const { shortId } = req.params;
    const { redirectUrl, name, expiresAt, customOverlay, isActive } = req.body;

    console.log("Received edit request for URL:", shortId, {
      redirectUrl,
      name,
      expiresAt,
      customOverlay,
      isActive,
    });

    // Find the URL
    const url = await URL.findOne({ shortId });
    if (!url) {
      console.log(`URL not found: ${shortId}`);
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        message: "URL not found",
      });
    }

    // Update fields if provided
    if (redirectUrl) url.redirectUrl = redirectUrl;
    if (name) url.name = name;
    if (isActive !== undefined) url.isActive = isActive;

    // Handle expiration date
    if (expiresAt) {
      try {
        url.expiresAt = new Date(expiresAt);
      } catch (error) {
        console.error("Invalid date format for expiresAt:", error);
        return res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Invalid date format for expiration date",
        });
      }
    }

    // Properly update the custom overlay
    if (customOverlay) {
      // Initialize customOverlay object if it doesn't exist
      if (!url.customOverlay) {
        url.customOverlay = {
          enabled: false,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          textColor: "#ffffff",
          buttonColor: "#3498db",
        };
      }

      // Update each field individually to prevent overwriting existing values
      url.customOverlay.enabled =
        customOverlay.enabled !== undefined
          ? customOverlay.enabled
          : url.customOverlay.enabled;

      if (customOverlay.text !== undefined) {
        url.customOverlay.text = customOverlay.text;
      }

      if (customOverlay.buttonText !== undefined) {
        url.customOverlay.buttonText = customOverlay.buttonText;
      }

      if (customOverlay.buttonUrl !== undefined) {
        url.customOverlay.buttonUrl = customOverlay.buttonUrl;
      }

      // Preserve default colors if not specified
      if (customOverlay.backgroundColor !== undefined) {
        url.customOverlay.backgroundColor = customOverlay.backgroundColor;
      }

      if (customOverlay.textColor !== undefined) {
        url.customOverlay.textColor = customOverlay.textColor;
      }

      if (customOverlay.buttonColor !== undefined) {
        url.customOverlay.buttonColor = customOverlay.buttonColor;
      }
    }

    console.log("Saving updated URL:", {
      shortId: url.shortId,
      redirectUrl: url.redirectUrl,
      customOverlay: url.customOverlay,
    });

    await url.save();

    res.json({
      status: "success",
      statusCode: 200,
      body: {
        message: "URL updated successfully",
        url,
      },
    });
  } catch (err) {
    console.error("Error in handleEditURL:", err);
    res.status(400).json({
      status: "error",
      statusCode: 400,
      message: err.message,
    });
  }
};

// New handler for disabling/enabling URL
const handleToggleURLStatus = async (req, res) => {
  try {
    const { shortId } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({ error: "isActive field is required" });
    }

    // Find and update URL
    const url = await URL.findOneAndUpdate(
      { shortId },
      { isActive },
      { new: true }
    );

    if (!url) return res.status(404).json({ error: "URL not found" });

    res.json({
      status: "success",
      statusCode: 200,
      body: {
        message: isActive ? "URL enabled" : "URL disabled",
        url,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: err.message,
    });
  }
};

// Add new handler for completely deleting a URL
const handleDeleteURL = async (req, res) => {
  try {
    const { shortId } = req.params;
    console.log(`Request to delete URL with shortId: ${shortId}`);

    // First, find the URL to get QR code path if it exists
    const url = await URL.findOne({ shortId });

    if (!url) {
      console.log(`URL not found for deletion: ${shortId}`);
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        message: "URL not found",
      });
    }

    // Delete QR code image if it exists
    if (url.qrCodeUrl) {
      const deleted = await deleteQRCode(url.qrCodeUrl);
      if (deleted) {
        console.log(`QR code deleted for URL: ${shortId}`);
      } else {
        console.warn(`Failed to delete QR code for URL: ${shortId}`);
      }
    }

    // Delete the URL document from the database
    const result = await URL.deleteOne({ shortId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        message: "URL not found or already deleted",
      });
    }

    console.log(`URL deleted successfully: ${shortId}`);
    res.json({
      status: "success",
      statusCode: 200,
      message: "URL deleted successfully",
    });
  } catch (err) {
    console.error("Error in handleDeleteURL:", err);
    res.status(500).json({
      status: "error",
      statusCode: 500,
      message: err.message,
    });
  }
};

export {
  handleGenerateURL,
  handleAnalytics,
  handleRedirect,
  handleEditURL,
  handleToggleURLStatus,
  handleRegenerateQRCode,
  handleDeleteURL, // Add this export
};
