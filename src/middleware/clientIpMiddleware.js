/**
 * Middleware to extract and normalize the client IP address from various headers
 * Works with different proxy setups including Nginx, Cloudflare, AWS, etc.
 */

const clientIpMiddleware = (req, res, next) => {
  // List of headers to check in priority order
  const ipHeaders = [
    'cf-connecting-ip',      // Cloudflare
    'x-real-ip',             // Nginx
    'x-forwarded-for',       // Standard proxy header
    'x-client-ip',           // Client IP header
    'x-forwarded',           // Standard proxy header
    'forwarded-for',         // Less common proxy header
    'forwarded',             // Less common proxy header
    'true-client-ip',        // Akamai and Cloudflare
    'fastly-client-ip',      // Fastly CDN
    'x-cluster-client-ip'    // GCP
  ];

  // Extract client IP from the first valid header we find
  let clientIp = null;
  for (const header of ipHeaders) {
    const headerValue = req.headers[header];
    if (headerValue) {
      // If the header value contains comma (like x-forwarded-for can), 
      // take the first IP which is typically the client IP
      const ips = headerValue.split(',');
      clientIp = ips[0].trim();
      // Store which header provided the IP for debugging
      req.ipSource = header;
      break;
    }
  }

  // If no IP found in headers, fall back to Express's built-in properties
  if (!clientIp) {
    clientIp = req.connection?.remoteAddress || 
               req.socket?.remoteAddress || 
               req.ip;
    req.ipSource = 'connection';
  }

  // Clean the IP (remove IPv6 prefix if present)
  req.clientIp = clientIp ? clientIp.replace(/^.*:/, '').trim() : null;
  
  // Log IP detection for debugging
  console.log(`Client IP detected: ${req.clientIp} (Source: ${req.ipSource})`);
  
  next();
};

export default clientIpMiddleware;