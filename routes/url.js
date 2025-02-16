const express = require("express");
const {
  handleGenerateURL,
  handleAnalytics,
  handleRedirect,
} = require("../controllers/url");

const router = express.Router();

router.post("/", handleGenerateURL);
router.get("/:shortId", handleRedirect);
router.get("/analytics", handleAnalytics);

module.exports = router;
