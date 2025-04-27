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
      default: function() {
        // Set default expiration to 30 days from now, at the end of that day
        const date = new Date();
        date.setDate(date.getDate() + 30);
        date.setHours(23, 59, 59, 999);
        return date;
      },
    },
    qrCodeUrl: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Add adModeEnabled field to track QR codes with app icon
    adModeEnabled: {
      type: Boolean,
      default: false,
    },
    customOverlay: {
      enabled: {
        type: Boolean,
        default: false,
      },
      text: String,
      buttonText: String,
      buttonUrl: String,
      backgroundColor: {
        type: String,
        default: "rgba(0, 0, 0, 0.7)",
      },
      textColor: {
        type: String,
        default: "#ffffff",
      },
      buttonColor: {
        type: String,
        default: "#3498db",
      },
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
