const express = require("express");
const { handleGenerateURL, handleAnalytics } = require("../controllers/url");

const router = express.Router();

router.post("/", handleGenerateURL);
router.get("/analytics", handleAnalytics);

module.exports = router;
