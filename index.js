require("dotenv").config(); // Load environment variables from .env file
const express = require("express");
const urlRouter = require("./routes/url");
const connection = require("./connection");
const URL = require("./models/url");
const useragent = require("express-useragent");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");
const path = require("path");
const mongoose = require("mongoose");
const crypto = require("crypto");

var favicon = require("serve-favicon");

const app = express();
// Use environment variable for PORT, fallback to 3000
const PORT = process.env.PORT || 3000;

// Database Connection
async function connectDB() {
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
}
connectDB();

app.use(express.json());
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));
app.use(express.urlencoded({ extended: true })); // Ensure form data is parsed
app.use(useragent.express());
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/url", urlRouter);

function generateShortId() {
  return crypto.randomBytes(4).toString("hex");
}

app.get("/linksqueeze", async (req, res) => {
  try {
    const urls = await URL.find().sort({ createdAt: -1 }).limit(10);
    const baseUrl = `${req.protocol}://${req.get("host")}`; // Define baseUrl
    res.render("index", { urls, baseUrl }); // Pass baseUrl to the template
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
    const baseUrl = `${req.protocol}://${req.get("host")}`; // Define baseUrl
    res.status(400).render("index", { error: error.message, urls, baseUrl }); // Pass baseUrl to the template
  }
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
