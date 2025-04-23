import express from "express";
import {
  handleGenerateURL,
  handleAnalytics,
  handleRedirect,
  handleEditURL,
  handleToggleURLStatus,
  handleRegenerateQRCode,
  handleDeleteURL, // Added this import
} from "../controllers/url.js";

const router = express.Router();

router.post("/", handleGenerateURL);
router.get("/analytics", handleAnalytics);
router.get("/:shortId", handleRedirect);

// URL management endpoints
router.patch("/:shortId", handleEditURL);
router.patch("/:shortId/status", handleToggleURLStatus);

// QR code regeneration endpoint - update to match the route we used in frontend
router.post("/:shortId/qrcode", handleRegenerateQRCode);

// Add the DELETE route for URLs - corrected to match the actual route structure
router.delete("/:shortId", handleDeleteURL);

export default router;
