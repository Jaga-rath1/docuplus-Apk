require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const connectDB = require("./utils/db");
const authRouter = require("./routes/authRoutes");

const app = express();
const port = process.env.PORT || 3000;

// Trust reverse proxies (Render, Railway, Heroku, Vercel, Nginx)
app.set("trust proxy", 1);

// Production Security & Performance Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serverless DB connection middleware (ensures DB is connected on Vercel/AWS Lambda)
app.use(async (req, res, next) => {
  try {
    if (process.env.MONGO_URI) {
      await connectDB();
    }
    next();
  } catch (err) {
    console.error("DB Connection Middleware Error:", err);
    res.status(503).json({
      success: false,
      message: "Database connection failed. Service temporarily unavailable.",
    });
  }
});

// Root & Health Check Endpoints
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    name: "DocuPulse Backend API",
    status: "online",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  const mongoose = require("mongoose");
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

  res.status(200).json({
    status: "ok",
    database: dbStatus,
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRouter);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Application Error:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// Start Standalone Server (Render, Railway, Local, Docker)
let server;
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  connectDB()
    .then(() => {
      server = app.listen(port, () => {
        console.log(`🚀 DocuPulse Server running on port ${port} in ${process.env.NODE_ENV || "development"} mode`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server due to DB connection error:", err.message);
      process.exit(1);
    });
}

// Graceful Shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Initiating graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log("HTTP server closed.");
      try {
        const mongoose = require("mongoose");
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
      } catch (err) {
        console.error("Error during MongoDB disconnection:", err);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = app;