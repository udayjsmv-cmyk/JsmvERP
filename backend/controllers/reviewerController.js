// controllers/reviewerController.js
const Client = require("../models/Client");
const ActivityLog = require("../models/ActivityLog");
exports.getForwardedToReviewer = async (req, res) => {
  try {
    if (req.user.role !== "reviewer") {
      return res.status(403).json({ message: "Only Reviewers can access this data" });
    }

    const filter = {
      forwardedToReviewer: true,
      reviewedBy: null, // not yet reviewed
    };

    const clients = await Client.find(filter)
      .populate("forwardedByPreparer", "FirstName LastName email")
      .populate("assignedTo", "FirstName LastName email teamName")
      .populate("teamleadId", "FirstName LastName email teamName")
      .populate("documents.uploadedBy", "FirstName LastName email role teamName")
      .sort({ forwardedToReviewerDate: -1 })
      .lean();

    const docs = clients.flatMap((client) =>
      (client.documents || [])
      .filter(doc => doc.status === "forwarded-review")
      .map((doc) => ({
        clientId: client._id,
        clientName: client.clientName,
        clientEmail: client.email,
        fileId: doc.fileId,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        uploadedAt: doc.uploadedAt,
        uploadedBy: doc.uploadedBy
          ? {
              name: `${doc.uploadedBy.FirstName || ""} ${doc.uploadedBy.LastName || ""}`.trim(),
              email: doc.uploadedBy.email,
              role: doc.uploadedBy.role,
              teamName: doc.uploadedBy.teamName,
            }
          : null,
        uploadedByRole: doc.uploadedByRole || "unknown",
        version: doc.version || "original",
      }))
    );

    return res.status(200).json({
      message: "Clients forwarded to reviewer",
      totalClients: clients.length,
      totalDocuments: docs.length,
      clients,
      documents: docs,
    });
  } catch (err) {
    console.error("❌ getForwardedToReviewer error:", err);
    return res.status(500).json({ message: "Error fetching reviewer clients", error: err.message });
  }
};
exports.markAsReviewed = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, status } = req.body;

    if (req.user.role !== "reviewer") {
      return res.status(403).json({ message: "Only Reviewer can mark as reviewed" });
    }

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    if (!client.forwardedToReviewer) {
      return res.status(400).json({ message: "Client not forwarded to reviewer yet" });
    }

    if (client.reviewedBy) {
      return res.status(400).json({ message: "Client already reviewed" });
    }

    // Update client review state
    client.reviewedBy = req.user._id;
    client.reviewedDate = new Date();
    client.reviewStatus = status || "reviewed"; // e.g., reviewed, corrections-needed
    client.reviewNotes = notes || "";

    client.actionHistory.push({
      action: "Reviewed by Reviewer",
      performedBy: req.user._id,
      notes: notes || "Reviewed successfully",
      date: new Date(),
    });

    client.updatedBy = req.user._id;
    client.updatedAt = new Date();

    await client.save();

    // Log activity
    await ActivityLog.create({
      userId: req.user._id,
      action: "mark_as_reviewed",
      targetCollection: "Client",
      targetId: client._id,
      details: {
        reviewedDate: client.reviewedDate,
        reviewStatus: client.reviewStatus,
      },
    });

    return res.status(200).json({ message: "Client marked as reviewed", client });
  } catch (err) {
    console.error("❌ markAsReviewed error:", err);
    return res.status(500).json({ message: "Error marking as reviewed", error: err.message });
  }
};
exports.getReviewed = async (req, res) => {
  try {
    const { role, _id } = req.user;

    if (!["reviewer", "admin", "manager"].includes(role)) {
      return res.status(403).json({ message: "Not authorized to access reviewed clients" });
    }

    const filter = { reviewedBy: { $exists: true, $ne: null } };
    if (role === "reviewer") filter.reviewedBy = _id;

    const clients = await Client.find(filter)
      .populate("forwardedByPreparer", "FirstName LastName email")
      .populate("assignedTo", "FirstName LastName email teamName")
      .populate("teamleadId", "FirstName LastName email teamName")
      .populate("reviewedBy", "FirstName LastName email")
      .sort({ reviewedDate: -1 })
      .lean();

    return res.status(200).json({
      message: "Reviewed clients fetched successfully",
      total: clients.length,
      clients,
    });
  } catch (err) {
    console.error("❌ getReviewed error:", err);
    return res.status(500).json({ message: "Error fetching reviewed clients", error: err.message });
  }
};
exports.returnToPreparer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (req.user.role !== "reviewer") {
      return res.status(403).json({ message: "Only Reviewer can return to Preparer" });
    }

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    client.forwardedToReviewer = false;
    client.returnedToPreparation = true;
    client.reviewedBy = req.user._id;
    client.reviewedDate = new Date();
    client.reviewStatus = "returned";
    client.reviewNotes = reason || "Returned for correction";

    client.actionHistory.push({
      action: "Returned to Preparer",
      performedBy: req.user._id,
      notes: reason || "Corrections required",
      date: new Date(),
    });

    client.updatedBy = req.user._id;
    client.updatedAt = new Date();

    await client.save();

    await ActivityLog.create({
      userId: req.user._id,
      action: "return_to_preparer",
      targetCollection: "Client",
      targetId: client._id,
      details: { reason },
    });

    return res.status(200).json({ message: "Client returned to preparer", client });
  } catch (err) {
    console.error("❌ returnToPreparer error:", err);
    return res.status(500).json({ message: "Error returning client to preparer", error: err.message });
  }
};
