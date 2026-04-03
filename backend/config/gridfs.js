import mongoose from "mongoose";
import { GridFsStorage } from "multer-gridfs-storage";
import multer from "multer";
import path from "path";

// ✅ GridFS Storage setup
const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  file: (req, file) => {
    const filename = `${Date.now()}-${file.originalname}`;
    return {
      filename,
      bucketName: "clientDocuments", // the collection name: clientDocuments.files
      metadata: {
        uploadedBy: req.user?._id,
        description: req.body.description || "",
        teamName: req.user?.teamName,
      },
    };
  },
});

export const upload = multer({ storage });
