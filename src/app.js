import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import crypto from "crypto";
import favicon from "serve-favicon";
import useragent from "express-useragent";
import swaggerUi from "swagger-ui-express";

import urlRouter from "./routes/url.js";
import connection from "../connection.js";
import URL from "./models/url.js";
import swaggerDocument from "../swagger.json" with { type: "json" };

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname,"./views"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/url", urlRouter);

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

app.post("/linksqueeze", async (req, res) => {
  try {
    const { originalUrl, customName } = req.body;
    if (!originalUrl) throw new Error("Original URL is required");

    const shortId = generateShortId();

    const url = await URL.create({
      shortId,
      redirectUrl: originalUrl,
      name: customName || `Shortened-${shortId}`,
      visitHistory: [],
    });

    const urls = await URL.find().sort({ createdAt: -1 }).limit(10);

    res.redirect("/linksqueeze");
  } catch (error) {
    const urls = await URL.find().sort({ createdAt: -1 }).limit(10);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.status(400).render("index", { error: error.message, urls, baseUrl });
  }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
