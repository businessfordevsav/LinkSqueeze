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

import urlRouter from "./routes/url.js";
import connection from "../connection.js";
import URL from "./models/url.js";
import swaggerDocument from "../swagger.json" with { type: "json" };
import { handleGenerateURL } from "./controllers/url.js";

// Create global event emitter for real-time notifications
const linkActivityEmitter = new EventEmitter();

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
// Create HTTP server
const server = createServer(app);

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
app.set("view engine", "ejs");
app.set("views", path.join(__dirname,"./views"));

// Expose the link activity emitter to use in URL controller
app.set('linkActivityEmitter', linkActivityEmitter);

// Make the qrcodes directory accessible publicly
app.use('/qrcodes', express.static(path.join(__dirname, '../public/qrcodes')));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/url", urlRouter);

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

const generateShortId = () => crypto.randomBytes(4).toString("hex");

app.get("/linksqueeze", async (req, res) => {
  try {
    const urls = await URL.find().sort({ createdAt: -1 }).limit(10);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.render("index", { urls, baseUrl });
  } catch (error) {
    res.status(500).send("Error fetching URLs");
  }
});

// Changed to use the same handler as /url
app.post("/linksqueeze", async (req, res, next) => {
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
        return res.redirect("/linksqueeze");
      }
      // If there was an error, render the index page with the error
      return res.status(400).render("index", { 
        error: data.message || "Error creating shortened URL", 
        urls: [], 
        baseUrl: `${req.protocol}://${req.get("host")}` 
      });
    };
    
    // Call the handleGenerateURL function
    handleGenerateURL(req, res);
  } catch (error) {
    console.error("Error in /linksqueeze route:", error);
    const urls = await URL.find().sort({ createdAt: -1 }).limit(10);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.status(400).render("index", { error: error.message, urls, baseUrl });
  }
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
