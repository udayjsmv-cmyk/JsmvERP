const express = require("express");
const router = express.Router();
const { requireAuth, allowRoles } = require("../middleware/authMiddleware");
const { upload, uploadToGridFS } = require("../middleware/uploadMiddleware");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

const clientController = require("../controllers/clientController");
const preparerController = require("../controllers/preparerController");

// ✅ Get all clients/documents forwarded to Preparer
router.get(
  "/forwarded",
  requireAuth,
  allowRoles("preparer", "admin", "manager"),
  preparerController.getAllForwardedDocuments
);

// ✅ Preparer uploads updated documents (after editing employee files)
router.post(
  "/preparer/upload/:clientId",
  requireAuth,
  allowRoles("preparer"),
  upload.single("file"),
  uploadToGridFS,
  preparerController.uploadUpdatedDocument
);

// Employee uploads client document
router.post(
  "/:id/upload",
  requireAuth,
  upload.single("file"),
  uploadToGridFS,
  clientController.uploadClientDocument
);

// Employee forwards client to preparation (for Preparer)
router.post(
  "/:id/forward",
  requireAuth,
  allowRoles("employee"),
  clientController.forwardToPreparation
);

// Get documents for a client
router.get("/:id", requireAuth, clientController.getClientDocuments);

router.get("/download/:id", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: "clientDocuments" });
    const fileId = new mongoose.Types.ObjectId(req.params.id);

    const files = await db
      .collection("clientDocuments.files")
      .find({ _id: fileId })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const file = files[0];
    res.set("Content-Type", file.contentType || "application/octet-stream");

    if (req.query.preview === "true") {
      res.set("Content-Disposition", `inline; filename="${file.filename}"`);
    } else {
      res.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    }

    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(res);
  } catch (err) {
    console.error("Error fetching file:", err);
    res.status(500).json({ message: "Error fetching file" });
  }
});

module.exports = router;
