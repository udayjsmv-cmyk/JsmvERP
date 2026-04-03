require("dotenv").config();
require("express-async-errors");

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");
const clientRoutes = require("./routes/clientRoutes");
const fileRoutes = require("./routes/files");
const authRoutes = require("./routes/authRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

// ✅ CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173", // your frontend URL
    credentials: true,
  })
);

// ✅ Logger and body parsers
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Static folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Basic health check route
app.get("/", (req, res) => res.send("CRM Backend up 🚀"));

// ✅ API routes
app.use("/api/clients", clientRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/review", reviewRoutes);

// ✅ Optional DB test route (to check connection speed)
app.get("/api/db-test", async (req, res) => {
  try {
    console.time("DB test");
    const User = require("./models/User");
    const user = await User.findOne({});
    console.timeEnd("DB test");
    res.json({ success: true, user });
  } catch (err) {
    console.error("DB test error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Error handling middleware
app.use(notFound);
app.use(errorHandler);

// ✅ Start server after DB connection
const PORT = process.env.PORT || 8080;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection error", err);
    process.exit(1);
  });
