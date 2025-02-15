const express = require("express");
const urlRouter = require("./routes/url");
const connection = require("./connection");
const URL = require("./models/url");
const useragent = require("express-useragent");

const { handleRedirect } = require("./controllers/url");

const app = express();
const PORT = 3000;

connection("mongodb://localhost:27017/url-shortener");

app.use(express.json());
app.use(useragent.express());

app.use("/url", urlRouter);

app.get("/:shortId", handleRedirect);

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
