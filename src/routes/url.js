import express from "express";
import {
  handleGenerateURL,
  handleAnalytics,
  handleRedirect,
  handleEditURL,
  handleToggleURLStatus,
  handleRegenerateQRCode,
  handleDeleteURL,
  handleGetURL,
} from "../controllers/url.js";
import { isAuthenticated } from "../controllers/auth.js";
import { urlValidation, urlIdValidation, urlUpdateValidation } from "../middleware/validators.js";

const router = express.Router();

// All routes except the redirect should be protected
router.post("/", isAuthenticated, urlValidation, handleGenerateURL);
router.get("/analytics", isAuthenticated, handleAnalytics);

// URL API endpoint to get URL details by shortId - public access, no authentication required
router.get("/api/:shortId", urlIdValidation, handleGetURL);

// Public redirect route - must be after more specific routes
router.get("/:shortId", handleRedirect); // Keep this public so anyone can use shortened URLs

// URL management endpoints - all protected
router.patch("/:shortId", isAuthenticated, urlUpdateValidation, handleEditURL); // Use the less strict validation
router.patch("/:shortId/status", isAuthenticated, urlIdValidation, handleToggleURLStatus);
router.post("/:shortId/qrcode", isAuthenticated, urlIdValidation, handleRegenerateQRCode);
router.delete("/:shortId", isAuthenticated, urlIdValidation, handleDeleteURL);

export default router;
