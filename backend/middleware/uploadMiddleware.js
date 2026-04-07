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
const uploadToGridFS = async (file, user) => {
  if (!file) return null;

  // Ensure DB connection
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

  const filename = `${Date.now()}-${file.originalname}`;
  const readableStream = Readable.from(file.buffer);

  const uploadStream = bucket.openUploadStream(filename, {
    contentType: file.mimetype,
    metadata: {
      uploadedBy: user?._id || null,
      originalname: file.originalname,
    },
  });

  await new Promise((resolve, reject) => {
    readableStream
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", resolve);
  });

  return {
    fileId: uploadStream.id,
    fileName: filename,
    fileType: file.mimetype,
    fileUrl: `/api/files/download/${uploadStream.id}`,
  };
};
const profileUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 2MB limit
});
module.exports = {
  upload,
  uploadToGridFS,
  profileUpload
};