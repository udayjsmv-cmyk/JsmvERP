const mongoose = require("mongoose");

// ================= Call Log Schema =================
const CallLogSchema = new mongoose.Schema(
  {
    todayCallDate: { type: Date },
    callbackDate: { type: Date },
    callbackTime: { type: String },
    division: {
      type: String,
      enum: [
        "ColdCalling",
        "FollowUp",
        "Registered",
        "Un-paid",
        "Paid",
        "PST",
        "H4-EAD",
        "High-Income",
        "Business",
      ],
    },
    remarks: { type: String },
    comment: { type: String },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "failed"],
      default: "pending",
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true } // automatically adds createdAt & updatedAt
);

// ================= Document Schema =================
const DocumentSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId }, // GridFS ID or generic ObjectId
    fileName: { type: String, required: true },
    fileType: { type: String },
    fileUrl: { type: String },
    description: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedByRole: {
      type: String,
      enum: ["employee", "preparer", "reviewer", "manager", "admin"],
      default: "employee",
    },
    teamName: { type: String },
    uploadedAt: { type: Date, default: Date.now },

    version: {
      type: String,
      enum: ["original", "updated"],
      default: "original",
    },
    parentFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Unified document workflow
    status: {
      type: String,
      enum: [
        "uploaded",          // Employee uploaded
        "in-preparation",    // Preparer working on it
        "forwarded-review",  // Forwarded to reviewer
        "under-review",      // Reviewer currently checking
        "corrections",       // Returned to preparer for fixes
        "completed",         // Final approved
        "returned",          // Rejected or sent back
        "forwarded",         // Optional alias for legacy controller
      ],
      default: "uploaded",
    },

    // Workflow timestamps
    forwardedToPreparationDate: { type: Date },
    forwardedToReviewerDate: { type: Date },
    returnedToPreparationDate: { type: Date },
    reviewedDate: { type: Date },
  },
  { _id: true, timestamps: true } // enable unique _id for each document
);

// ================= Action History Schema =================
const ActionHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { _id: false }
);

// ================= Client Schema =================
const ClientSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    contactNo: { type: String, trim: true },

    priority: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      default: "LOW",
    },

    division: {
      type: String,
      enum: [
        "ColdCalling",
        "FollowUp",
        "Registered",
        "Un-paid",
        "Paid",
        "PST",
        "H4-EAD",
        "High-Income",
        "Business",
      ],
      default: "ColdCalling",
    },

    timeZone: {
      type: String,
      enum: ["EST", "CST", "MST", "PST"],
      default: "EST",
    },

    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "failed"],
      default: "pending",
    },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    teamName: {
      type: String,
      enum: [
        "RainBow Tax Filings",
        "On Time Tax Filings",
        "GrandTax Filings",
        "TaxFilerWay",
      ],
      default: null,
      index: true,
    },
    teamleadId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    notes: { type: String, trim: true },
    callLogs: { type: [CallLogSchema], default: [] },
    documents: { type: [DocumentSchema], default: [] },

    // Workflow flags (auto updated)
    forwardedToPreparation: { type: Boolean, default: false },
    forwardedToReviewer: { type: Boolean, default: false },
    returnedToPreparation: { type: Boolean, default: false },

    forwardedDate: { type: Date, default: null },
    forwardedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    handledByPreparer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    forwardedToReviewerDate: { type: Date },
    forwardedByPreparer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedDate: { type: Date },
    reviewStatus: {
      type: String,
      enum: ["reviewed", "corrections-needed", "pending","in-preparation","returned"],
      default: "pending",
    },
    reviewNotes: { type: String, default: "" },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedAt: { type: Date, default: Date.now },

    actionHistory: { type: [ActionHistorySchema], default: [] },
  },
  { timestamps: true }
);

// ================= Indexes =================

// Safer uniqueness check (email or contactNo)
ClientSchema.index(
  { email: 1, contactNo: 1 },
  {
    unique: true,
    partialFilterExpression: {
      $or: [
        { email: { $exists: true, $ne: null } },
        { contactNo: { $exists: true, $ne: null } },
      ],
    },
  }
);

ClientSchema.index({ teamleadId: 1, teamName: 1 });
ClientSchema.index({ assignedTo: 1 });
ClientSchema.index({ status: 1 });
ClientSchema.index({ assignedTo: 1, status: 1, division: 1 });

// ================= Hooks =================
ClientSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  if (this.documents && this.documents.length > 0) {
    const docs = this.documents;

    this.forwardedToPreparation = docs.some((d) =>
      ["in-preparation", "forwarded-review"].includes(d.status)
    );

    this.forwardedToReviewer =
      docs.length > 0 &&
      docs.every((d) =>
        ["forwarded-review", "under-review", "completed"].includes(d.status)
      );

    this.returnedToPreparation = docs.some((d) =>
      ["corrections", "returned"].includes(d.status)
    );
  } else {
    this.forwardedToPreparation = false;
    this.forwardedToReviewer = false;
    this.returnedToPreparation = false;
  }

  next();
});

module.exports = mongoose.model("Client", ClientSchema);
