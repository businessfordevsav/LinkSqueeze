// src/middleware/requestLogger.js
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
const requestLogPath = path.join(logsDir, 'requests.log');

/**
 * Request tracking middleware logs information about each incoming request
 */
export const requestLogger = (req, res, next) => {
  // Get current timestamp
  const timestamp = new Date().toISOString();
  
  // Get basic request information
  const { method, originalUrl, ip } = req;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const referrer = req.headers['referer'] || 'Direct';
  
  // Store start time to calculate duration
  req._requestStartTime = Date.now();
  
  // Capture the end of the request
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    // Calculate request duration
    const duration = Date.now() - req._requestStartTime;
    
    // Get authenticated user info at the END of the request
    // This ensures we get the final auth state after all middleware has run
    const userId = req.user ? req.user._id : null;
    const userEmail = req.user ? req.user.email : 'Unauthenticated';
    
    // Create complete log entry with final user state
    const logEntry = {
      timestamp,
      method,
      url: originalUrl,
      ip,
      userAgent,
      referrer,
      statusCode: res.statusCode,
      duration: duration,
      userId: userId ? userId.toString() : 'Unauthenticated',
      userEmail,
      requestBody: method !== 'GET' ? sanitizeRequestBody(req.body) : undefined
    };
    
    // Log to file
    fs.appendFile(
      requestLogPath,
      JSON.stringify(logEntry) + '\n',
      (err) => {
        if (err) {
          console.error('Failed to write to request log:', err);
        }
      }
    );
    
    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${method} ${originalUrl} - ${res.statusCode} - ${duration}ms - User: ${userId ? userEmail : 'Unauthenticated'}`);
    }
    
    // For DB logging if needed
    if (mongoose.connection.readyState === 1) {
      try {
        // Dynamically import to avoid circular dependencies
        import('../models/requestLog.js').then(module => {
          const RequestLog = module.default;
          
          // Create DB log with final state
          RequestLog.create({
            timestamp: new Date(),
            method,
            url: originalUrl,
            statusCode: res.statusCode,
            ip,
            userAgent,
            userId, // Store as ObjectId or null
            duration: duration,
            isError: false
          }).catch(err => {
            console.error('Failed to save request log to DB:', err);
          });
        });
      } catch (err) {
        console.error('Error importing RequestLog model:', err);
      }
    }
    
    // Call the original end method
    originalEnd.apply(res, arguments);
  };
  
  next();
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

export default requestLogger;