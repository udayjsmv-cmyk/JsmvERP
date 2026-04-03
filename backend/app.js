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

// ✅ CORS for dev + deployed frontend
const allowedOrigins = [
  "https://jsmv-crm.vercel.app", // production frontend
  "http://localhost:3000"        // local dev frontend
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// ✅ Logger and body parser
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Static uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Root & API info routes
app.get("/", (req, res) => res.send("CRM Backend up 🚀"));
app.get("/api", (req, res) => res.send("CRM API running. Use /api/auth/login"));

// ✅ API routes
app.use("/api/clients", clientRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/review", reviewRoutes);

// ✅ Optional DB test
app.get("/api/db-test", async (req, res) => {
  try {
    console.time("DB test");
    const User = require("./models/User");
    const user = await User.findOne({});
    console.timeEnd("DB test");
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Error handling
app.use(notFound);
app.use(errorHandler);

// ✅ Start server
const PORT = process.env.PORT || 8080;
connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });
