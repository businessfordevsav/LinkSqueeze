import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import crypto from "crypto";
import favicon from "serve-favicon";
import useragent from "express-useragent";
import swaggerUi from "swagger-ui-express";
import { createServer } from "http";
import { EventEmitter } from "events";
import cookieParser from "cookie-parser";
import session from "express-session";
import MongoStore from "connect-mongo";
import fs from "fs";
import helmet from "helmet"; // Import Helmet.js
import rateLimit from 'express-rate-limit'; // Import rate limiter
// Removed CSRF import
import xssProtection from './middleware/xssProtection.js'; // Import XSS protection middleware
import securityHeaders from './middleware/securityHeaders.js'; // Import security headers middleware
import dbSanitize from './middleware/dbSanitize.js'; // Import database sanitization middleware
import requestLogger from './middleware/requestLogger.js'; // Import request logger middleware
import { errorLogger, notFoundHandler } from './middleware/errorLogger.js'; // Import error logger middleware
import { WebSocketServer } from 'ws'; // Import WebSocket server

import urlRouter from "./routes/url.js";
import authRouter from "./routes/auth.js";
import dashboardRouter from "./routes/dashboard.js";
import s3proxyRouter from "./routes/s3proxy.js"; // Import our new S3 proxy router
import connection from "../connection.js";
import URL from "./models/url.js";
import swaggerDocument from "../swagger.json" with { type: "json" };
import { handleGenerateURL } from "./controllers/url.js";
import { isAuthenticated } from "./controllers/auth.js";

// Create global event emitter for real-time notifications
const linkActivityEmitter = new EventEmitter();

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Ensure necessary directories exist
const QR_CODES_DIR = path.join(__dirname, "../public/qrcodes");
const PROFILE_IMAGES_DIR = path.join(__dirname, "../public/uploads/profile");
const TEMP_DIR = path.join(__dirname, "../temp");

// Create directories if they don't exist
[QR_CODES_DIR, PROFILE_IMAGES_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    } catch (err) {
      console.error(`Failed to create directory ${dir}:`, err);
    }
  }
});

const app = express();
// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Store connected clients
const clients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
  // Add client to the set
  clients.add(ws);
  
  // Send a welcome message
  ws.send(JSON.stringify({
    event: 'connected',
    message: 'Connected to shrtn.live real-time updates'
  }));
  
  // Handle client disconnection
  ws.on('close', () => {
    clients.delete(ws);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    clients.delete(ws);
  });
});

// Listen to link activity events and broadcast to all connected clients
linkActivityEmitter.on('linkClick', (data) => {
  const message = JSON.stringify({
    event: 'link_click',
    ...data
  });
  
  // Broadcast to all connected clients
  clients.forEach(client => {
    try {
      if (client.readyState === 1) {
        client.send(message);
      }
    } catch (error) {
      clients.delete(client);
    }
  });
});

// Use environment variable for PORT, fallback to 3000
const PORT = process.env.PORT || 3000;

// Database Connection
const connectDB = async () => {
  // Use environment variable for MongoDB URI, fallback to local for development
  const mongoURI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/url-shortener";
  try {
    await connection(mongoURI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    // Consider exiting the process if the database connection fails on startup
    // process.exit(1);
  }
};
connectDB();

app.use(express.json());
app.use(favicon(path.join(__dirname, "..", "public", "favicon.ico")));
app.use(express.urlencoded({ extended: true })); // Ensure form data is parsed
app.use(useragent.express());
app.use(express.static('public'));
app.use(cookieParser());

// Set up session management with MongoDB
app.use(
  session({
    secret: process.env.SESSION_SECRET || "shrtn-live-session-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/url-shortener",
      touchAfter: 24 * 60 * 60, // 1 day period in seconds
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      secure: process.env.NODE_ENV === "production",
      httpOnly: true, // Prevents client-side JS from reading the cookie
      sameSite: 'strict' // Prevents the cookie from being sent in cross-site requests
    },
  })
);

// Apply security middleware in the correct order
app.use(requestLogger); // Request tracking middleware (add as early as possible)
app.use(xssProtection); // XSS protection first
app.use(dbSanitize); // Then database sanitization
app.use(securityHeaders); // Then security headers
app.use(helmet()); // Use Helmet.js for security

// Configure Helmet with custom CSP settings
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections
      },
    },
    crossOriginEmbedderPolicy: false, // Required for certain resources like fonts
  })
);

// CSRF protection removed

app.set("view engine", "ejs");
app.set("views", path.join(__dirname,"./views"));

// Expose the link activity emitter to use in URL controller
app.set('linkActivityEmitter', linkActivityEmitter);

// Make the qrcodes directory accessible publicly with proper CORS headers
app.use('/qrcodes', (req, res, next) => {
  // Set CORS headers to prevent CORB issues with QR code images
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', 'image/png');
  next();
}, express.static(path.join(__dirname, '../public/qrcodes')));

// Configure rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for auth routes
  message: 'Too many authentication attempts, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 API requests per minute
  message: 'Too many requests, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to authentication routes
app.use('/login', authLimiter);
app.use('/register', authLimiter);
app.use('/forgot-password', authLimiter);
app.use('/reset-password', authLimiter);
app.use('/api', apiLimiter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Set up user data for views
app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.user;
  next();
});

// Use the new routers
app.use("/url", urlRouter);
app.use("/", authRouter);
app.use("/dashboard", dashboardRouter);
app.use("/", s3proxyRouter); // Add the S3 proxy router

// Root route - Serve the starter page
app.get("/", (req, res) => {
  res.render("starter", {
    user: req.user || null,
    isAuthenticated: !!req.user
  });
});

// Privacy Policy route
app.get("/privacy-policy", (req, res) => {
  res.render("privacy-policy", {
    user: req.user || null,
    isAuthenticated: !!req.user
  });
});

// Terms of Service route
app.get("/terms-of-service", (req, res) => {
  res.render("terms-of-service", {
    user: req.user || null,
    isAuthenticated: !!req.user
  });
});

// SSE endpoint for real-time notifications
app.get('/events', (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send a heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write('event: heartbeat\ndata: {}\n\n');
  }, 30000);

  // Event listener for link clicks
  const linkClickListener = (data) => {
    res.write(`event: linkClick\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Subscribe to link click events
  linkActivityEmitter.on('linkClick', linkClickListener);

  // Clean up when connection is closed
  req.on('close', () => {
    clearInterval(heartbeat);
    linkActivityEmitter.removeListener('linkClick', linkClickListener);
  });
});

// WebSocket server setup
app.get('/ws', (req, res) => {
  res.set({
    'Connection': 'Upgrade',
    'Upgrade': 'websocket'
  });
  res.status(426).send('Upgrade Required');
});

const generateShortId = () => crypto.randomBytes(4).toString("hex");

// Update linksqueeze route to handle authentication
app.get("/shrtn", isAuthenticated, async (req, res) => {
  try {
    // User is authenticated, show only their links
    let queryObj = { createdBy: req.user._id };
    
    const urls = await URL.find(queryObj).sort({ createdAt: -1 }).limit(10);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    
    res.render("link_shorter", { 
      urls, 
      baseUrl,
      user: req.user,
      isAuthenticated: true
    });
  } catch (error) {
    res.status(500).send("Error fetching URLs");
  }
});

// Changed to use the same handler as /url
app.post("/shrtn", isAuthenticated, async (req, res, next) => {
  try {
    // Map form field names to the expected format in handleGenerateURL
    if (req.body.originalUrl) {
      req.body.redirectUrl = req.body.originalUrl;
    }
    if (req.body.customName) {
      req.body.name = req.body.customName;
    }
    
    // Store the original Accept header
    const originalAccept = req.headers.accept;
    
    // Override response sending for JSON responses
    const originalJson = res.json;
    res.json = function(data) {
      if (data.status === 'success') {
        return res.redirect("/dashboard");
      }
      // If there was an error, render the index page with the error
      return res.status(400).render("link_shorter", { 
        error: data.message || "Error creating shortened URL", 
        urls: [], 
        baseUrl: `${req.protocol}://${req.get("host")}`,
        user: req.user,
        isAuthenticated: true
      });
    };
    
    // Call the handleGenerateURL function
    handleGenerateURL(req, res);
  } catch (error) {
    console.error("Error in /shrtn.live route:", error);
    const urls = await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 }).limit(10);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.status(400).render("link_shorter", { 
      error: error.message, 
      urls, 
      baseUrl,
      user: req.user,
      isAuthenticated: true
    });
  }
});

// 404 handler - for any routes that aren't matched
app.use(notFoundHandler);

// Global error handling middleware - should be the last middleware
app.use(errorLogger);

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
