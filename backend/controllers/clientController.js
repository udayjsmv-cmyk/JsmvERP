// controllers/clientController.js
const Client = require("../models/Client");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { parseLeadsFromBuffer } = require("../services/parseService");
const { roundRobinAssign } = require("../services/assignmentService");
const mongoose = require("mongoose");

const respondError = (res, status = 500, message = "Server error", err = null) => {
  if (err) console.error(message + ":", err);
  return res.status(status).json({ message, error: err ? err.message : undefined });
};

const isPrivileged = (user) =>
  ["admin", "manager", "teamlead", "preparer", "reviewer"].includes(user?.role || "");

function normalizeStatus(s = "") {
  return String(s || "").trim().toLowerCase();
}
function updateClientOverallForwardStatus(client) {
  const docs = client.documents || [];
  if (!docs.length) {
    client.forwardedToPreparation = false;
    client.forwardedToReviewer = false;
    client.returnedToPreparation = false;
    client.reviewStatus = client.reviewStatus || "pending";
    return;
  }

  // Normalize statuses to avoid tiny string mismatches
  const normalized = docs.map((d) => normalizeStatus(d.status));

  const inPrep =
    normalized.some((s) => s === "in-preparation" || s === "inpreparation" || s === "forwarded-review" || s === "forwardedreview");
  const inReview = normalized.every((s) =>
    ["forwarded-review", "forwardedreview", "under-review", "underreview", "approved", "completed"].includes(s)
  );
  const inCorrection = normalized.some((s) => ["corrections", "returned"].includes(s));

  client.forwardedToPreparation = inPrep;
  client.forwardedToReviewer = inReview;
  client.returnedToPreparation = inCorrection;

  if (inReview) client.reviewStatus = "under-review";
  else if (inPrep) client.reviewStatus = "in-preparation";
  else if (inCorrection) client.reviewStatus = "returned";
  else client.reviewStatus = "pending";
}

// ---------- Constants ----------
const allowedPriorities = ["HIGH", "MEDIUM", "LOW"];
const allowedTimeZones = ["EST", "CST", "MST", "PST"];
const allowedDivisions = [
  "ColdCalling",
  "FollowUp",
  "Registered",
  "Un-paid",
  "Paid",
  "PST",
  "H4-EAD",
  "High-Income",
  "Business",
];
const allowedStatuses = ["pending", "in-progress", "completed", "failed"];

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function buildScopeFilter(user) {
  if (!user) return {};
  if (["admin", "superadmin"].includes(user.role)) return {};
  if (user.role === "manager") return { managerId: user._id };
  if (user.role === "teamlead") return { teamleadId: user._id };
  return { assignedTo: user._id };
}

// ---------- Controller methods (refactored / optimized) ----------

// Upload leads (Manager)
exports.uploadLeads = async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Only Manager can upload leads" });
    }

    const { division } = req.body;
    if (!division || !allowedDivisions.includes(division)) {
      return res.status(400).json({ message: "Invalid or missing division" });
    }

    // ===== Parse Leads =====
    let leads = [];
    if (req.file?.buffer) {
      leads = await parseLeadsFromBuffer(req.file.buffer);
    }

    if (!leads.length) {
      return res.status(400).json({ message: "No valid leads found in file" });
    }

    // ===== Remove duplicates =====
    const emails = leads.map(l => l.email).filter(Boolean);
    const phones = leads.map(l => l.contactNo).filter(Boolean);

    const existing = await Client.find({
      $or: [
        { email: { $in: emails } },
        { contactNo: { $in: phones } }
      ]
    }).select("email contactNo");

    const existingEmails = new Set(existing.map(e => e.email));
    const existingPhones = new Set(existing.map(e => e.contactNo));

    const freshLeads = leads.filter(
      l =>
        !(l.email && existingEmails.has(l.email)) &&
        !(l.contactNo && existingPhones.has(l.contactNo))
    );

    if (!freshLeads.length) {
      return res.status(409).json({ message: "All leads already exist" });
    }

    
    // ===== Get employees under this manager =====
    const employees = await User.find({
      role: "employee",
    }).select("_id name teamName teamleadId managerId");

    if (!employees.length) {
      return res.status(400).json({ message: "No employees found under you" });
    }

    // ===== Assign leads =====
    const docsToInsert = roundRobinAssign(
      freshLeads,
      employees,
      req.user._id,
      division
    );
    docsToInsert.forEach(doc => {
    doc.uploadedBy = req.user._id;   // ✅ THIS FIXES EVERYTHING
  });

    // ===== SAFE INSERT =====
    let inserted = [];
    let insertErrors = [];

    try {
      inserted = await Client.insertMany(docsToInsert, { ordered: false });
    } catch (err) {
      inserted = err.insertedDocs || [];
      insertErrors = err.writeErrors || [];
      console.warn("Partial insert:", insertErrors.length);
    }

    // ===== Distribution summary =====
    const distribution = {};
    docsToInsert.forEach(doc => {
      const id = doc.assignedTo?.toString();
      if (!id) return;
      distribution[id] = (distribution[id] || 0) + 1;
    });

    const summary = employees.map(e => ({
      employeeId: e._id,
      name: e.name,
      team: e.teamName || "N/A",
      assigned: distribution[e._id.toString()] || 0,
    }));

    // ===== Activity Log =====
    await ActivityLog.create({
      userId: req.user._id,
      action: "upload_leads",
      targetCollection: "Client",
      details: {
        total: leads.length,
        inserted: inserted.length,
        failed: insertErrors.length,
        division,
      },
    });

    return res.status(200).json({
      message: "Upload processed successfully",
      totalProvided: leads.length,
      inserted: inserted.length,
      failed: insertErrors.length,
      skipped: leads.length - inserted.length,
      division,
      summary,
    });
  } catch (err) {
    return respondError(res, 500, "Upload failed", err);
  }
};

// Assign from unassigned (TeamLead)
exports.assignFromUnassigned = async (req, res) => {
  try {
    if (req.user.role !== "teamlead") return res.status(403).json({ message: "Only TeamLead can assign" });

    const { employeeId, count } = req.body;
    const N = Math.max(1, Number(count) || 1);

    const employee = await User.findOne({
      _id: employeeId,
      department: "CallingDepartment",
      role: "employee",
      teamleadId: req.user._id,
    });

    if (!employee) return res.status(400).json({ message: "Employee not in your team or invalid" });

    const leads = await Client.find({ assignedTo: null, status: "pending", teamName: req.user.teamName })
      .sort({ createdAt: 1 })
      .limit(N)
      .lean();

    if (!leads.length) return res.json({ message: "No unassigned pending leads" });

    const ids = leads.map((l) => l._id);
    const result = await Client.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          assignedTo: employee._id,
          assignedAt: new Date(),
          teamleadId: req.user._id,
          managerId: req.user.managerId || null,
          updatedBy: req.user._id,
          updatedAt: new Date(),
        },
      }
    );

    await ActivityLog.create({
      userId: req.user._id,
      action: "assign_from_unassigned",
      targetCollection: "Client",
      details: { employeeId: employee._id, requested: N, assigned: result.modifiedCount },
    });

    return res.json({ message: "Assigned", requested: N, assigned: result.modifiedCount });
  } catch (err) {
    return respondError(res, 500, "Error assigning leads", err);
  }
};

// Rebalance leads among employees of the teamlead
exports.rebalanceToEmployee = async (req, res) => {
  try {
    if (req.user.role !== "teamlead") return res.status(403).json({ message: "Only TeamLead can rebalance" });

    const employees = await User.find({ department: "CallingDepartment", role: "employee", teamleadId: req.user._id })
      .select("_id")
      .lean();

    if (!employees.length) return res.status(400).json({ message: "No employees in your team" });

    const employeeIds = employees.map((e) => e._id);

    const leads = await Client.find({
      teamleadId: req.user._id,
      teamName: req.user.teamName,
      status: { $in: ["pending", "in-progress"] },
    })
      .sort({ createdAt: 1 })
      .lean();

    if (!leads.length) return res.json({ message: "No leads to rebalance" });

    const bulkOps = leads.map((lead, i) => ({
      updateOne: {
        filter: { _id: lead._id },
        update: {
          $set: {
            assignedTo: employeeIds[i % employeeIds.length],
            assignedAt: new Date(),
            updatedBy: req.user._id,
            updatedAt: new Date(),
          },
        },
      },
    }));

    const bulkResult = await Client.bulkWrite(bulkOps, { ordered: false });

    await ActivityLog.create({
      userId: req.user._id,
      action: "rebalance_team",
      targetCollection: "Client",
      details: { teamName: req.user.teamName, totalLeads: leads.length },
    });

    return res.json({ message: "Leads rebalanced", rebalanced: leads.length, result: bulkResult.modifiedCount });
  } catch (err) {
    return respondError(res, 500, "Error rebalancing leads", err);
  }
};

// Get my leads (employee)
exports.getMyLeads = async (req, res) => {
  try {
    const employeeId = req.user._id;
    if (!employeeId) return res.status(400).json({ message: "Invalid user identity" });

    const filter = { assignedTo: employeeId };
    const leads = await Client.find(filter)
      .populate("assignedTo", "FirstName LastName email")
      .populate("teamleadId", "FirstName LastName email teamName")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(leads);
  } catch (err) {
    return respondError(res, 500, "Error fetching leads", err);
  }
};

// Upload client document
exports.uploadClientDocument = async (req, res) => {
  try {
    const { id: clientId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });
    if (!file.id) return res.status(500).json({ message: "File not persisted to GridFS" });
    if (!ALLOWED_TYPES.includes(file.mimetype)) return res.status(400).json({ message: "Invalid file type" });
    if (file.size && file.size > MAX_FILE_SIZE) return res.status(400).json({ message: "File too large (max 20MB)" });

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const privileged = isPrivileged(req.user);
    const isAssignee = client.assignedTo?.toString() === req.user._id.toString();
    if (!privileged && !isAssignee) return res.status(403).json({ message: "Not authorized to upload documents" });

    const newDocument = {
      fileId: file.id,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileUrl: `/api/files/download/${file.id}`,
      description: req.body.description || "",
      uploadedBy: req.user._id,
      teamName: req.user.teamName || null,
      uploadedAt: new Date(),
      uploadedByRole: req.user.role,
      version: req.body.version || "original",
      status: "uploaded",
    };

    client.documents.push(newDocument);
    client.actionHistory.push({
      action: "Document Uploaded",
      performedBy: req.user._id,
      notes: `Uploaded ${newDocument.fileName}`,
      date: new Date(),
    });

    client.updatedBy = req.user._id;
    client.updatedAt = new Date();

    // markModified to ensure nested array change persisted
    client.markModified("documents");

    await client.save();

    await ActivityLog.create({
      userId: req.user._id,
      action: "upload_document",
      targetCollection: "Client",
      targetId: client._id,
      details: { fileName: newDocument.fileName },
    });

    return res.status(201).json({ message: "Document uploaded", document: newDocument });
  } catch (err) {
    return respondError(res, 500, "Error uploading document", err);
  }
};

// Update single document status (clientId & fileId path params)
exports.updateDocumentStatus = async (req, res) => {
  try {
    const { clientId, fileId } = req.params;
    const { status } = req.body;

    const allowedDocStatuses = [
      "uploaded",
      "in-preparation",
      "forwarded-review",
      "under-review",
      "approved",
      "corrections",
      "returned",
      "rejected",
    ];

    if (!allowedDocStatuses.includes(status)) return res.status(400).json({ message: "Invalid document status" });

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const doc = client.documents.find((d) => d.fileId?.toString() === fileId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    doc.status = status;
    doc.updatedAt = new Date();

    if (status === "in-preparation") doc.forwardedToPreparationDate = new Date();
    if (status === "forwarded-review") doc.forwardedToReviewerDate = new Date();
    if (["returned", "corrections"].includes(status)) doc.returnedToPreparationDate = new Date();

    client.markModified("documents");

    // Update overall flags (controller-level)
    updateClientOverallForwardStatus(client);

    client.actionHistory.push({
      action: `Document ${status}`,
      performedBy: req.user._id,
      notes: `${doc.fileName} marked as ${status}`,
      date: new Date(),
    });

    client.updatedBy = req.user._id;
    client.updatedAt = new Date();

    await client.save();

    await ActivityLog.create({
      userId: req.user._id,
      action: `document_${status}`,
      targetCollection: "Client",
      targetId: client._id,
      details: { fileName: doc.fileName, newStatus: status },
    });

    return res.json({ message: `Document marked as ${status}`, document: doc });
  } catch (err) {
    return respondError(res, 500, "Error updating document status", err);
  }
};
// controllers/clientController.js

exports.getClients = async (req, res) => {
  try {
    let filter = {};

    // 👑 ADMIN → all data
    if (req.user.role === "admin") {
      filter = {};
    }

    // 🧑‍💼 MANAGER → multiple teams
    else if (req.user.role === "manager") {
      filter = { teamName: { $in: req.user.teams || [] } };
    }

    // 👨‍💼 TEAMLEAD → only his team
    else if (req.user.role === "teamlead") {
      filter = { teamName: req.user.teamName };
    }

    // 👤 EMPLOYEE → only assigned leads
    else {
      filter = { assignedTo: req.user.id };
    }

    const clients = await Client.find(filter)
      .populate("assignedTo", "FirstName LastName")
      .sort({ createdAt: -1 });

    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch clients" });
  }
};

// Get client documents
exports.getClientDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id).populate("documents.uploadedBy", "FirstName LastName email role teamName");
    if (!client) return res.status(404).json({ message: "Client not found" });

    const privileged = isPrivileged(req.user);
    const isAssignee = client.assignedTo?.toString() === req.user._id.toString();
    if (!privileged && !isAssignee) return res.status(403).json({ message: "Not authorized" });

    return res.json({
      documents: client.documents || [],
      clientName: client.clientName,
      clientEmail: client.email,
      forwardedToPreparation: client.forwardedToPreparation || false,
    });
  } catch (err) {
    return respondError(res, 500, "Error fetching documents", err);
  }
};

// Add call log
exports.addCallLog = async (req, res) => {
  try {
    const {
      todayCallDate,
      callbackDate,
      callbackTime,
      division,
      priority,
      timeZone,
      remarks,
      comment,
      status,
    } = req.body;

    const lead = await Client.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const privileged = isPrivileged(req.user);
    const isAssignee = lead.assignedTo?.toString() === req.user._id.toString();
    if (!privileged && !isAssignee) return res.status(403).json({ message: "Not authorized" });

    if (division && !allowedDivisions.includes(division)) return res.status(400).json({ message: "Invalid division" });
    if (priority && !allowedPriorities.includes(priority)) return res.status(400).json({ message: "Invalid priority" });
    if (timeZone && !allowedTimeZones.includes(timeZone)) return res.status(400).json({ message: "Invalid timeZone" });
    if (status && !allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const newLog = {
      todayCallDate: todayCallDate || undefined,
      callbackDate: callbackDate || undefined,
      callbackTime,
      division,
      priority,
      timeZone,
      remarks,
      comment,
      status,
      updatedBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    lead.callLogs.push(newLog);

    if (status) lead.status = status;
    if (priority && allowedPriorities.includes(priority)) lead.priority = priority;
    if (timeZone && allowedTimeZones.includes(timeZone)) lead.timeZone = timeZone;

    const remarksLower = (remarks || "").toLowerCase();
    if (remarksLower === "followup" || remarksLower === "follow-up") {
      lead.division = "FollowUp";
    }

    lead.updatedBy = req.user._id;
    lead.updatedAt = new Date();

    await lead.save();

    await ActivityLog.create({
      userId: req.user._id,
      action: "add_call_log",
      targetCollection: "Client",
      targetId: lead._id,
      details: { remarks, callbackDate, callbackTime },
    });

    return res.json({ message: "Call log added successfully", lead });
  } catch (err) {
    return respondError(res, 500, "Error adding call log", err);
  }
};

// Get call logs
exports.getCallLogs = async (req, res) => {
  try {
    const lead = await Client.findById(req.params.id).populate("callLogs.updatedBy", "FirstName LastName email");
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const privileged = isPrivileged(req.user);
    const isAssignee = lead.assignedTo?.toString() === req.user._id.toString();
    if (!privileged && !isAssignee) return res.status(403).json({ message: "Not allowed" });

    return res.json({
      clientName: lead.clientName,
      email: lead.email,
      contactNo: lead.contactNo,
      status: lead.status,
      division: lead.division,
      priority: lead.priority,
      timeZone: lead.timeZone,
      callLogs: lead.callLogs,
    });
  } catch (err) {
    return respondError(res, 500, "Error fetching call logs", err);
  }
};

// Admin / Manager / Teamlead views
exports.getAllLeads = async (req, res) => {
  try {
    const {
      team,
      employee,
      status,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    let query = {};

    // ===== ROLE BASE FILTER =====
    if (req.user.role === "admin") {
      query = {};
    } 
    else if (req.user.role === "manager") {
      query.uploadedBy = req.user._id;
    } 
    else if (req.user.role === "teamlead") {
      query.teamleadId = req.user._id;
    } 
    else if (req.user.role === "employee") {
      query.assignedTo = req.user._id;
    }

    // ===== APPLY FILTERS =====
    if (team) {
      query.teamName = team;
    }

    if (employee) {
      query.assignedTo = employee;
    }
    const { division } = req.query;

    if (division) {
      query.division = division;
    }

    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { clientName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    // ===== FETCH DATA =====
    const [leads, total] = await Promise.all([
      Client.find(query)
        .populate("assignedTo", "FirstName LastName")
        .populate("teamleadId", "FirstName LastName teamName")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      Client.countDocuments(query),
    ]);

    return res.json({
      data: leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    return respondError(res, 500, "Error fetching leads", err);
  }
};

exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({
      role: { $in: ["employee", "teamlead", "preparer", "filer", "reviewer", "corrections"] },
    }).sort({ updatedAt: -1 });
    return res.json(employees);
  } catch (err) {
    return respondError(res, 500, "Error fetching employees data", err);
  }
};

exports.getByDivision = async (req, res) => {
  try {
    const { division } = req.params;
    if (!allowedDivisions.includes(division)) return res.status(400).json({ message: "Invalid division" });

    const scope = buildScopeFilter(req.user);
    const filter = { ...scope, division };
    const leads = await Client.find(filter).sort({ updatedAt: -1 });
    return res.json(leads);
  } catch (err) {
    return respondError(res, 500, "Error fetching leads", err);
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const lead = await Client.findById(id);
    if (!lead) return res.status(404).json({ message: "Client not found" });

    const privileged = ["admin", "manager", "teamlead"].includes(req.user.role);
    const isAssignee = lead.assignedTo?.toString() === req.user._id.toString();
    if (!privileged && !isAssignee) return res.status(403).json({ message: "Not authorized to update this lead" });

    lead.status = status;
    lead.updatedBy = req.user._id;
    lead.updatedAt = new Date();

    await lead.save();
    return res.json({ message: "Status updated successfully", lead });
  } catch (err) {
    return respondError(res, 500, "Error updating status", err);
  }
};

exports.getByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const scope = buildScopeFilter(req.user);
    const filter = { ...scope, status };
    const leads = await Client.find(filter).sort({ updatedAt: -1 });
    return res.json(leads);
  } catch (err) {
    return respondError(res, 500, "Error fetching leads", err);
  }
};
exports.getEmployeeLeadCounts = async (req, res) => {
  try {
    let match = {};

    if (req.user.role === "teamlead") {
      match.teamName = req.user.teamName;
    }

    if (req.user.role === "manager") {
      match.teamName = { $in: req.user.teams || [] };
    }

    const stats = await Client.aggregate([
      { $match: match },

      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "employee",
        },
      },

      { $unwind: "$employee" },

      {
        $group: {
          _id: "$assignedTo",
          name: {
            $first: {
              $concat: ["$employee.FirstName", " ", "$employee.LastName"],
            },
          },
          teamName: { $first: "$teamName" },
          leadCount: { $sum: 1 },
        },
      },

      { $sort: { leadCount: -1 } },
    ]);

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch employee stats" });
  }
};
exports.forwardToPreparation = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentsToForward = [] } = req.body;

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const privileged = isPrivileged(req.user);
    const isAssignee = client.assignedTo?.toString() === req.user._id.toString();
    if (!privileged && !isAssignee) return res.status(403).json({ message: "Not authorized" });
    const forwardAll = !Array.isArray(documentsToForward) || documentsToForward.length === 0;

    let updatedCount = 0;
    client.documents.forEach((doc) => {
      const fileIdStr = doc.fileId?.toString();
      if (forwardAll || documentsToForward.includes(fileIdStr)) {
        if (normalizeStatus(doc.status) !== "in-preparation") {
          doc.status = "in-preparation";
          doc.forwardedToPreparationDate = new Date();
          updatedCount++;
        }
      }
    });
    client.markModified("documents");
    updateClientOverallForwardStatus(client);
    client.forwardedDate = new Date();
    client.forwardedBy = req.user._id;
    client.handledByPreparer = null;

    client.actionHistory.push({
      action: "Forwarded to Preparation",
      performedBy: req.user._id,
      notes: `Documents forwarded: ${updatedCount} ${forwardAll ? "(all)" : ""}`,
      date: new Date(),
    });

    client.updatedBy = req.user._id;
    client.updatedAt = new Date();

    await client.save();

    await ActivityLog.create({
      userId: req.user._id,
      action: "forward_to_preparation",
      targetCollection: "Client",
      targetId: client._id,
      details: { forwardedDocs: forwardAll ? "all" : documentsToForward, forwardedCount: updatedCount },
    });

    return res.json({ message: "Documents forwarded successfully", forwardedCount: updatedCount, client });
  } catch (err) {
    return respondError(res, 500, "Error forwarding client", err);
  }
};
exports.getDashboardStats = async (req, res) => {
  try {
    let match = {};
    const stats = await Client.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const formatted = {
      total: 0,
      pending: 0,
      "in-progress": 0,
      completed: 0,
      failed: 0,
    };

    stats.forEach(s => {
      formatted[s._id] = s.count;
      formatted.total += s.count;
    });

    res.json(formatted);

  } catch (err) {
    return respondError(res, 500, "Stats error", err);
  }
};
exports.getEmployeePerformance = async (req, res) => {
  try {
    let match = {};

    const data = await Client.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$assignedTo",
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      {
        $project: {
          name: {
            $concat: ["$employee.FirstName", " ", "$employee.LastName"],
          },
          team: "$employee.teamName",
          total: 1,
          completed: 1,
          pending: 1,
        },
      },
    ]);

    res.json(data);

  } catch (err) {
    return respondError(res, 500, "Performance error", err);
  }
};
exports.getHourlyReport = async (req, res) => {
  try {
    let match = {};
    const data = await Client.aggregate([
      { $match: match },
      {
        $project: {
          hour: { $hour: "$updatedAt" },
        },
      },
      {
        $group: {
          _id: "$hour",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);

  } catch (err) {
    return respondError(res, 500, "Hourly report error", err);
  }
};
exports.getPipelineStats = async (req, res) => {
  try {
    let match = {};

    // ===== DOCUMENT LEVEL AGGREGATION =====
    const docStats = await Client.aggregate([
      { $match: match },

      { $unwind: "$documents" },

      {
        $group: {
          _id: "$documents.status",
          count: { $sum: 1 },
        },
      },
    ]);

    let documents = 0;
    let preparation = 0;

    docStats.forEach((d) => {
      const status = (d._id || "").toLowerCase();

      if (status === "uploaded") {
        documents += d.count;
      }

      if (status === "in-preparation") {
        preparation += d.count;
      }
    });

    // ===== PAYMENTS (CLIENT LEVEL) =====
    const payments = await Client.countDocuments({
      ...match,
      status: "completed",
    });

    const stages = {
      documents,
      preparation,
      payments,
    };

    // ===== CATEGORY =====
    const categoryList = [
      "ColdCalling",
      "FollowUp",
      "Registered",
      "Un-paid",
      "Paid",
      "PST",
      "H4-EAD",
      "High-Income",
      "Business",
    ];

    const categoryAgg = await Client.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $toLower: "$division" },
          count: { $sum: 1 },
        },
      },
    ]);

    const categories = {};
    categoryList.forEach((cat) => (categories[cat] = 0));

    categoryAgg.forEach((c) => {
      const matchKey = categoryList.find(
        (cat) => cat.toLowerCase() === c._id
      );
      if (matchKey) categories[matchKey] = c.count;
    });

    res.json({ stages, categories });

  } catch (err) {
    return respondError(res, 500, "Pipeline stats error", err);
  }
};
exports.getDocumentsDetailed = async (req, res) => {
  try {
    let match = {};

    const data = await Client.aggregate([
      { $match: match },
      { $unwind: "$documents" },

      {
        $match: {
          "documents.status": "uploaded",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "employee",
        },
      },

      { $unwind: "$employee" },

      {
        $project: {
          clientName: 1,
          teamName: 1,
          documentName: "$documents.fileName",
          uploadedAt: "$documents.uploadedAt",
          employeeName: {
            $ifNull: [
              { $concat: ["$employee.FirstName", " ", "$employee.LastName"] },
              "$employee.email"
            ]
          }
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    return respondError(res, 500, "Error fetching documents details", err);
  }
};
exports.getPreparationDetails = async (req, res) => {
  try {
    let match = {};

    const data = await Client.aggregate([
      { $match: match },

      { $unwind: "$documents" },

      {
        $match: {
          "documents.status": "in-preparation",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "employee",
        },
      },

      { $unwind: "$employee" },

      {
        $project: {
          clientName: 1,
          teamName: 1,
          documentName: "$documents.fileName",
          forwardedAt: "$documents.forwardedToPreparationDate",
          employeeName: {
            $concat: ["$employee.FirstName", " ", "$employee.LastName"],
          },
        },
      },
    ]);

    res.json(data);
  } catch (err) {
      return respondError(res, 500, "Error fetching preparation details", err);
  }
};
exports.getPaymentDetails = async (req, res) => {
  try {
    let match = {
      status: "completed",
    };
    const data = await Client.aggregate([
      { $match: match },

      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "employee",
        },
      },

      { $unwind: "$employee" },

      {
        $project: {
          clientName: 1,
          teamName: 1,
          completedAt: "$updatedAt",
          employeeName: {
            $concat: ["$employee.FirstName", " ", "$employee.LastName"],
          },
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    return respondError(res, 500, "Error fetching payment details", err);
  }
};
exports.getDocumentsGrouped = async (req, res) => {
  try {
    let match = {};

    const data = await Client.aggregate([
      { $match: match },
      { $unwind: "$documents" },

      {
        $match: {
          "documents.status": "uploaded",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },

      // ===== GROUP BY TEAM + EMPLOYEE =====
      {
        $group: {
          _id: {
            team: "$teamName",
            employeeId: "$employee._id",
            employeeName: {
              $concat: ["$employee.FirstName", " ", "$employee.LastName"],
            },
          },
          docs: {
            $push: {
              _id: "$documents._id",
              clientName: "$clientName",
              email:"$email",
              division:"$division",
              documentName: "$documents.fileName",
              teamName:"$teamName",
              uploadedAt: "$documents.uploadedAt",
              fileUrl: "$documents.fileUrl",
              status: "$documents.status",
              uploadedAt: "$documents.uploadedAt",
            },
          },
        },
      },

      // ===== GROUP BY TEAM =====
      {
        $group: {
          _id: "$_id.team",
          employees: {
            $push: {
              employeeId: "$_id.employeeId",
              employeeName: "$_id.employeeName",
              docs: "$docs",
            },
          },
        },
      },

      {
        $project: {
          teamName: "$_id",
          employees: 1,
          _id: 0,
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    return respondError(res, 500, "Grouped documents error", err);
  }
};
exports.getPaymentsGrouped = async (req, res) => {
  try {
    let match = { status: "completed" };

    const data = await Client.aggregate([
      { $match: match },

      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },

      {
        $group: {
          _id: {
            team: "$teamName",
            employeeId: "$employee._id",
            employeeName: {
              $concat: ["$employee.FirstName", " ", "$employee.LastName"],
            },
          },
          payments: {
            $push: {
              clientName: "$clientName",
              email: "$email",
              contactNo: "$contactNo",
              division: "$division",
              teamName: "$teamName",
              status: "$status",
              completedAt: "$updatedAt",
            },
          },
        },
      },

      {
        $group: {
          _id: "$_id.team",
          employees: {
            $push: {
              employeeName: "$_id.employeeName",
              payments: "$payments",
            },
          },
        },
      },

      {
        $project: {
          teamName: "$_id",
          employees: 1,
          _id: 0,
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    return respondError(res, 500, "Grouped payments error", err);
  }
};
exports.getPreparationGrouped = async (req, res) => {
  try {
    let match = {};

    const data = await Client.aggregate([
      { $match: match },

      { $unwind: "$documents" },

      {
        $match: {
          "documents.status": "in-preparation",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },

      // ===== GROUP BY EMPLOYEE =====
      {
        $group: {
          _id: {
            team: "$teamName",
            employeeId: "$employee._id",
            employeeName: {
              $concat: ["$employee.FirstName", " ", "$employee.LastName"],
            },
          },
          preparations: {
            $push: {
              _id: "$documents._id",
              clientName: "$clientName",
              documentName: "$documents.fileName",
              email:"$email",
               contactNo: "$contactNo",
              division: "$division",
              teamName: "$teamName",
              status: {
              $ifNull: ["$documents.status", "uploaded"]
            },
              fileUrl: "$documents.fileUrl",
              forwardedAt: {
                $ifNull: [
                  "$documents.forwardedToPreparationDate",
                  "$documents.updatedAt",
                ],
              },
            },
          },
        },
      },

      // ===== GROUP BY TEAM =====
      {
        $group: {
          _id: "$_id.team",
          employees: {
            $push: {
              employeeId: "$_id.employeeId",
              employeeName: "$_id.employeeName",
              preparations: "$preparations",
            },
          },
        },
      },

      {
        $project: {
          teamName: "$_id",
          employees: 1,
          _id: 0,
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    return respondError(res, 500, "Grouped preparation error", err);
  }
};
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findOne({
      "documents._id": id,
    });

    if (!client) return res.status(404).json({ message: "Document not found" });

    client.documents = client.documents.filter(
      (doc) => doc._id.toString() !== id
    );

    client.markModified("documents");
    await client.save();

    res.json({ message: "Document deleted" });
  } catch (err) {
    return respondError(res, 500, "Delete error", err);
  }
};

exports.getDocumentPreview = async (req, res) => {
  try {
    const fileId = req.params.fileId;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ message: "Invalid file ID" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "fs", // default
    });

    const files = await mongoose.connection.db
      .collection("fs.files")
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const file = files[0];

    // ✅ Set correct content type
    res.set({"Content-Type":"application/pdf","Content-Disposition":"inline"});

    // ✅ STREAM FILE
    const downloadStream = bucket.openDownloadStream(
      new mongoose.Types.ObjectId(fileId)
    );

    downloadStream.pipe(res);

  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ message: "Error streaming file" });
  }
};
exports.getPerformanceStats = async (req, res) => {
  try {
    let match = {};

    // 🔐 ROLE BASED FILTER
    if (req.user.role === "teamlead") {
      match.teamName = req.user.teamName;
    }

    if (req.user.role === "manager") {
      match.teamName = { $in: req.user.teams || [] };
    }

    if (req.user.role === "employee") {
      match.assignedTo = req.user.id;
    }

    // 👑 Admin → no filter

    const stats = await Client.aggregate([
      { $match: match },

      // 👤 Join employee
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "employee",
        },
      },

      { $unwind: "$employee" },

      // 📊 Group per employee
      {
        $group: {
          _id: "$assignedTo",

          name: {
            $first: {
              $concat: ["$employee.FirstName", " ", "$employee.LastName"],
            },
          },

          teamName: { $first: "$teamName" },

          total: { $sum: 1 },

          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },

          pending: {
            $sum: {
              $cond: [{ $ne: ["$status", "completed"] }, 1, 0],
            },
          },
        },
      },

      // 📈 Add conversion %
      {
        $addFields: {
          conversion: {
            $cond: [
              { $eq: ["$total", 0] },
              0,
              {
                $multiply: [
                  { $divide: ["$completed", "$total"] },
                  100,
                ],
              },
            ],
          },
        },
      },

      // 🏆 Sort (Ranking)
      { $sort: { conversion: -1 } },
    ]);

    res.json(stats);
  } catch (err) {
    console.error("Performance API Error:", err);
    res.status(500).json({ message: "Failed to fetch performance stats" });
  }
};
