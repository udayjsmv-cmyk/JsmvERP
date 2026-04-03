const multer = require("multer");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");
const { Readable } = require("stream");

// Allowed file types
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
];

// Max file size (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// Multer memory storage
const storage = multer.memoryStorage();

// Multer config
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Invalid file type"), false);
    }
    cb(null, true);
  },
});

// Upload to GridFS middleware
const uploadToGridFS = async (req, res, next) => {
  if (!req.file) return next();

  try {
    // Ensure MongoDB connection is ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve, reject) => {
        mongoose.connection.once("open", resolve);
        mongoose.connection.once("error", reject);
      });
    }

    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, {
      bucketName: "clientDocuments",
    });

    const filename = `${Date.now()}-${req.file.originalname}`;
    const readableStream = Readable.from(req.file.buffer);

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        uploadedBy: req.user ? req.user._id : null,
        originalname: req.file.originalname,
      },
    });

    // Pipe buffer → GridFS
    await new Promise((resolve, reject) => {
      readableStream
        .pipe(uploadStream)
        .on("error", (err) => {
          console.error("GridFS upload error:", err);
          reject(err);
        })
        .on("finish", () => resolve());
    });

    // Attach file info for controller
    req.file.id = uploadStream.id;
    req.file.filename = filename;
    req.file.url = `/api/files/download/${uploadStream.id}`;

    next();
  } catch (err) {
    console.error("GridFS middleware error:", err);
    return res.status(500).json({
      message: "Error uploading file",
      error: err.message,
    });
  }
};

module.exports = {
  upload,
  uploadToGridFS,
};