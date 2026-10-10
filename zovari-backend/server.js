require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const connectDB = require("./config/db");
const { initSocket } = require("./utils/socket");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const commentRoutes = require("./routes/commentRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const searchRoutes = require("./routes/searchRoutes");
const storyRoutes = require("./routes/storyRoutes");
const reelRoutes = require("./routes/reelRoutes");

const app = express();

// Express app ko ek plain http server me wrap karna zaroori hai taake
// Socket.io usi port pe (same server) real-time connections handle kar sake
const server = http.createServer(app);
initSocket(server);

// Allow the configured frontend origin(s). Set CLIENT_URL to one or more
// comma-separated exact origins in Vercel Project Settings.
const allowedOrigins = (process.env.CLIENT_URL || "http://127.0.0.1:5500,http://localhost:5500")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());

// Health check (does not require a database round-trip).
app.get("/", (req, res) => {
  res.json({ message: "Zovari backend is running 🚀" });
});

// Ensure a MongoDB connection is ready before database-backed API routes run.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("MongoDB connection unavailable:", err.message);
    res.status(503).json({ message: "Database unavailable. Check backend configuration." });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/reels", reelRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Multer (file upload) errors ko clean JSON response me convert karna
app.use((err, req, res, next) => {
  if (err && err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Image must be under 5MB" });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message || "Something went wrong" });
  }
  next();
});

// Vercel uses the exported HTTP server as a Function entry point. For local
// development, continue running `npm start` as a regular long-lived server.
if (require.main === module) {
  connectDB().then(() => {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Zovari backend listening on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error("Unable to start Zovari backend:", err.message);
    process.exitCode = 1;
  });
}

module.exports = server;
