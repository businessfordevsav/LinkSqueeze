import mongoose from "mongoose";
import validator from "validator";

const urlSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    redirectUrl: {
      type: String,
      required: [true, "Please provide a valid URL"],
      validate: {
        validator: (value) =>
          validator.isURL(value, {
            protocols: ["http", "https"],
            require_protocol: true,
          }),
        message: "Invalid URL format",
      },
    },
    name: {
      type: String,
      maxlength: [50, "Name cannot be longer than 50 characters"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    clicks: {
      type: Number,
      default: 0,
    },
    visitHistory: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        ipAddress: String,
        platform: String,
        browser: String,
        country: String,
        referrer: String,
        deviceType: String,
      },
    ],
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for formatted history
urlSchema.virtual("formattedHistory").get(function () {
  return this.visitHistory.map((visit) => ({
    ...visit.toObject(),
    formattedDate: visit.timestamp.toLocaleString(),
    platformIcon: this.constructor.getPlatformIcon(visit.platform),
    browserIcon: this.constructor.getBrowserIcon(visit.browser),
  }));
});

// Static methods for icons
urlSchema.statics.getPlatformIcon = function (platform) {
  const platforms = {
    Windows: "💻",
    MacOS: "🍎",
    Linux: "🐧",
    iOS: "📱",
    Android: "🤖",
  };
  return platforms[platform] || "❓";
};

urlSchema.statics.getBrowserIcon = function (browser) {
  const browsers = {
    Chrome: "🌐",
    Firefox: "🦊",
    Safari: "🌍",
    Edge: "🌊",
    Opera: "🔴",
  };
  return browsers[browser] || "❓";
};

const URL = mongoose.model("SHORT-URL", urlSchema);

export default URL;
