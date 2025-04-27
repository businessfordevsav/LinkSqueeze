// src/middleware/securityHeaders.js
/**
 * Middleware to set secure HTTP headers and caching policies
 */
export const securityHeaders = (req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevents MIME type sniffing
  res.setHeader('X-Frame-Options', 'DENY'); // Prevents clickjacking
  res.setHeader('X-XSS-Protection', '1; mode=block'); // Enables XSS filtering in browsers
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // Limits referrer information
  
  // For non-static assets, set no-cache for authenticated routes (to prevent caching of sensitive data)
  if (req.session && req.session.user && !req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  } else if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    // For static assets, set caching policy
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  }
  
  next();
};

export default securityHeaders;