require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./utils/db");
const authRouter = require("./routes/authRoutes");

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);

// Health check
app.get("/", (req, res) => {
  res.send("DocuPulse Backend API Engine is Live!");
});

// Start Database and Server
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Port Is Listening on ${port}`);
  });
});