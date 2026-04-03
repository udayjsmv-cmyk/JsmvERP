require("dotenv").config();
require("express-async-errors");

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");

const connectDB = require("./config/db");
const clientRoutes = require("./routes/clientRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const path = require("path"); 
const fileRoutes = require("./routes/files");


const app = express();

// ✅ CORS FIRST — and configured properly
app.use(
  cors({
    origin: "http://localhost:5173", // your Vite frontend URL
    credentials: true, // allow cookies or auth headers
  })
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => res.send("CRM Backend up 🚀"));
app.use("/api/clients", clientRoutes);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/files", fileRoutes); 
app.use("/api/review", require('./routes/reviewRoutes'));

// ✅ Handle errors LAST
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ DB connection error", err);
    process.exit(1);
  });
