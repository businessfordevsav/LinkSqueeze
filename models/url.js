const { count } = require("console");
const mongoose = require("mongoose");
const { platform } = require("os");

const urlScheme = mongoose.Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,
    },
    redirectUrl: {
      type: String,
      required: true,
    },
    visitiHistory: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        ipAddress: {
          type: String,
        },
        platform: {
          type: String,
        },
        browser: {
          type: String,
        },
        country: {
          type: String,
        },
      },
    ],
  },
  { timestamp: true }
);

const URL = mongoose.model("UrlShortener", urlScheme);

module.exports = URL;
