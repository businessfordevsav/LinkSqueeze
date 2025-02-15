
const mongoose = require("mongoose");

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
        userAgent: {
          type: String,
        },
      },
    ],
  },
  { timestamp: true }
);

const URL = mongoose.model("UrlShortener", urlScheme);

module.exports = URL;
