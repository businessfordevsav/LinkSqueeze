import express from "express";
import * as dashboardController from "../controllers/dashboard.js";
import { isAuthenticated } from "../controllers/auth.js";

const router = express.Router();

// Protect all dashboard routes
router.use(isAuthenticated);

// Main dashboard page
router.get("/", dashboardController.getDashboard);

// Link analytics page
router.get("/analytics/:shortId", dashboardController.getLinkAnalytics);

// API route to get all user links
router.get("/links", dashboardController.getUserLinks);

export default router;