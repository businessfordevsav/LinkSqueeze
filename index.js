const express = require("express");
const urlRouter = require("./routes/url");
const connection = require("./connection");
const URL = require("./models/url");

const app = express();
const PORT = 3000;

connection("mongodb://localhost:27017/url-shortener");

app.use(express.json());
app.use("/url", urlRouter);

app.get("/:shortId", async (req, res) => {
  const shortId = req.params.shortId;
  console.log(shortId);
  const url = await URL.findOne({ shortId });

  if (!url) return res.status(404).json({ error: "URL not found" });

  url.visitiHistory.push({ ipAddress: req.ip });
  await url.save();


  res.redirect(url.redirectUrl);
})
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
