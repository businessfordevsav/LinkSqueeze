// src/middleware/dbSanitize.js
import sanitize from 'mongo-sanitize';

/**
 * Middleware to sanitize user inputs before they reach MongoDB queries
 * This prevents NoSQL injection attacks
 */
export const dbSanitize = (req, res, next) => {
  // Sanitize request body, query, and params to prevent NoSQL injection
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  if (req.params) {
    req.params = sanitize(req.params);
  }
  
  next();
};

export default dbSanitize;