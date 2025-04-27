// src/middleware/xssProtection.js
import sanitizeHtml from 'sanitize-html';

/**
 * Middleware to sanitize request body and parameters to prevent XSS attacks
 */
export const xssProtection = (req, res, next) => {
  // Function to sanitize a value
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return sanitizeHtml(value, {
        allowedTags: [], // No HTML tags allowed
        allowedAttributes: {}, // No attributes allowed
        disallowedTagsMode: 'recursiveEscape' // Convert HTML to entities
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize objects
      if (Array.isArray(value)) {
        return value.map(item => sanitizeValue(item));
      } else {
        const sanitizedObj = {};
        for (const key in value) {
          sanitizedObj[key] = sanitizeValue(value[key]);
        }
        return sanitizedObj;
      }
    }
    return value;
  };

  // Check if the request is a JSON content type
  const contentType = req.headers['content-type'] || '';
  const isJsonRequest = contentType.includes('application/json');

  // For JSON data in PATCH or PUT requests, we need special handling
  if (isJsonRequest && (req.method === 'PATCH' || req.method === 'PUT')) {
    // For these requests, we want to preserve the JSON structure
    try {
      // If req.body is already parsed as JSON by express.json() middleware
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
      }
    } catch (err) {
      console.error('Error sanitizing JSON data:', err);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid JSON data in request'
      });
    }
  } else if (req.body) {
    // For other requests, sanitize as before
    req.body = sanitizeValue(req.body);
  }
  
  // Sanitize query and params
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};

export default xssProtection;