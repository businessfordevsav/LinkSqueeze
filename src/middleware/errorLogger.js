// src/middleware/errorLogger.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define paths for log files
const errorLogPath = path.join(logsDir, 'errors.log');

/**
 * Error logging middleware to catch and log any errors
 */
export const errorLogger = (err, req, res, next) => {
  // Get current timestamp
  const timestamp = new Date().toISOString();
  
  // Extract basic request information
  const { method, originalUrl, ip } = req;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // Get authenticated user info if available
  const userId = req.user ? req.user._id : null; // Changed to null for unauthenticated users
  const userEmail = req.user ? req.user.email : 'Unauthenticated';
  
  // Create error log entry
  const errorLog = {
    timestamp,
    level: 'ERROR',
    message: err.message,
    stack: err.stack,
    requestInfo: {
      method,
      url: originalUrl,
      ip,
      userAgent,
      userId: userId ? userId.toString() : 'Unauthenticated', // For file logs, keep as string
      userEmail,
      body: method !== 'GET' ? sanitizeRequestBody(req.body) : undefined
    }
  };
  
  // Log detailed error to file
  fs.appendFile(
    errorLogPath,
    JSON.stringify(errorLog) + '\n',
    (writeErr) => {
      if (writeErr) {
        console.error('Failed to write to error log:', writeErr);
      }
    }
  );
  
  // Console log in development for immediate visibility
  console.error(`[ERROR] ${timestamp} - ${err.message}`, {
    url: originalUrl,
    method,
    userId: userId ? userId.toString() : 'Unauthenticated',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  // Store error in database if database connection is available
  if (mongoose.connection.readyState === 1) {
    try {
      // Dynamically import to avoid circular dependencies
      import('../models/requestLog.js').then(module => {
        const RequestLog = module.default;
        RequestLog.create({
          timestamp: new Date(),
          method,
          url: originalUrl,
          statusCode: err.statusCode || 500,
          ip,
          userAgent,
          userId, // Pass userId directly (as ObjectId or null)
          duration: req._requestStartTime ? Date.now() - req._requestStartTime : null,
          isError: true,
          errorMessage: err.message,
          errorStack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }).catch(dbErr => {
          console.error('Failed to save error log to DB:', dbErr);
        });
      });
    } catch (importErr) {
      console.error('Error importing RequestLog model:', importErr);
    }
  }
  
  // Set default error status and message if not already set
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Something went wrong';
  
  // Determine response type based on request Accept header
  const isApiRequest = req.xhr || 
                      (req.headers.accept && req.headers.accept.includes('application/json')) ||
                      req.path.startsWith('/api/');
  
  if (isApiRequest) {
    // Send JSON response for API requests
    return res.status(statusCode).json({
      status: 'error',
      statusCode,
      message: errorMessage,
      // Include stack trace in development
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  } else {
    // Render error page for browser requests
    return res.status(statusCode).render('error', {
      error: {
        status: statusCode,
        message: errorMessage,
        details: process.env.NODE_ENV === 'production' 
          ? 'Our team has been notified of this issue.'
          : err.stack
      }
    });
  }
};

/**
 * Sanitize request body for logging to remove sensitive information
 */
function sanitizeRequestBody(body) {
  if (!body) return {};
  
  // Create a copy of the body
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'confirmPassword', 'token', 'currentPassword', 'newPassword'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Not Found (404) error handler
 */
export const notFoundHandler = (req, res, next) => {
  const err = new Error(`Not Found - ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

export default errorLogger;