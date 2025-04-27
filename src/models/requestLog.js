// src/models/requestLog.js
import mongoose from "mongoose";

const requestLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    referrer: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    duration: {
      type: Number, // in milliseconds
    },
    requestBody: {
      type: Object,
    },
    responseStatus: {
      type: String,
    },
    isError: {
      type: Boolean,
      default: false,
    },
    errorMessage: {
      type: String,
    },
    errorStack: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically expire old logs after 30 days (adjust as needed)
requestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Create index on timestamp for efficient querying
requestLogSchema.index({ timestamp: -1 });
requestLogSchema.index({ userId: 1, timestamp: -1 });
requestLogSchema.index({ url: 1, timestamp: -1 });
requestLogSchema.index({ isError: 1, timestamp: -1 });

const RequestLog = mongoose.model("RequestLog", requestLogSchema);

export default RequestLog;