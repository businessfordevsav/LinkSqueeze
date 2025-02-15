const express = require("express");
const handleGenerateURL = require("../controllers/url");


const router = express.Router();

router.post("/", handleGenerateURL);

module.exports = router;