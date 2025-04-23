import express from "express";
import {
  handleGenerateURL,
  handleAnalytics,
  handleRedirect,
} from "../controllers/url.js";

const router = express.Router();

router.post("/", handleGenerateURL);
router.get("/:shortId", handleRedirect);
router.get("/analytics", handleAnalytics);

export default router;
