const express = require("express");
const router = express.Router();

const { requireAuth, allowRoles } = require("../middleware/authMiddleware");
const { upload, uploadToGridFS } = require("../middleware/uploadMiddleware");
const client = require("../controllers/clientController");

const {
  uploadLeads,
  assignFromUnassigned,
  rebalanceToEmployee,
  getAllLeads,
  getAllEmployees,
  getEmployeeLeadCounts,
  getMyLeads,
  getByDivision,
  getByStatus,
  addCallLog,
  getCallLogs,
  updateLeadStatus
} = client;

// ================= LEADS =================

// Get all leads
router.get("/", requireAuth, allowRoles("admin", "manager", "teamlead"), getAllLeads);

// ✅ FIXED Upload route
router.post(
  "/upload-leads",
  requireAuth,
  allowRoles("manager"),
  upload.single("file"),
  uploadToGridFS, // ✅ IMPORTANT FIX
  uploadLeads
);

// Assign & rebalance
router.post("/assign-from-unassigned", requireAuth, allowRoles("teamlead"), assignFromUnassigned);
router.post("/rebalance", requireAuth, allowRoles("teamlead"), rebalanceToEmployee);

// ================= EMPLOYEES =================
router.get("/employees", requireAuth, allowRoles("admin", "manager", "teamlead"), getAllEmployees);
router.get("/employee-lead-counts", requireAuth, allowRoles("teamlead", "manager", "admin"), getEmployeeLeadCounts);

// ================= EMPLOYEE =================
router.get("/my", requireAuth, allowRoles("employee"), getMyLeads);
router.get("/clients", requireAuth, client.getClients);

// ================= CALL LOG =================
router.patch("/:id/status", requireAuth, updateLeadStatus);
router.patch("/:id/call-log", requireAuth, addCallLog);
router.get("/:id/call-log", requireAuth, getCallLogs);

// ================= FILTERS =================
router.get("/division/:division", requireAuth, getByDivision);
router.get("/status/:status", requireAuth, getByStatus);
router.get("/dashboard-stats", requireAuth, client.getDashboardStats);
router.get("/employee-performance", requireAuth, client.getEmployeePerformance);
router.get("/hourly-report", requireAuth, client.getHourlyReport);
router.get("/pipeline-stats", requireAuth, client.getPipelineStats);
router.get(
  "/documents-details", requireAuth,allowRoles("manager", "admin"),client.getDocumentsDetailed
);
router.get(
  "/preparation-details",
  requireAuth,
  allowRoles("manager", "admin"),
  client.getPreparationDetails
);

router.get(
  "/payment-details",
  requireAuth,
  allowRoles("manager", "admin"),
  client.getPaymentDetails
);
router.get("/document/:fileId",requireAuth,allowRoles("admin","manager"),client.getDocumentPreview);
router.delete(
  "/document/:id",
  requireAuth,
  allowRoles("admin", "manager"),
  client.deleteDocument
);
router.get(
  "/clients/performance",
  requireAuth,
  client.getPerformanceStats
);
router.get("/documents-grouped", requireAuth, allowRoles("manager","admin"), client.getDocumentsGrouped);
router.get("/preparation-grouped", requireAuth, allowRoles("manager","admin"), client.getPreparationGrouped);
router.get("/payments-grouped", requireAuth, allowRoles("manager","admin"), client.getPaymentsGrouped);
module.exports = router;