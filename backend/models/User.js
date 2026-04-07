const mongoose = require("mongoose");
const {validateUserRole} = require('../utils/vaildateUserRole');

const userSchema = new mongoose.Schema(
  {
    FirstName: { type: String, required: true, trim: true },
    LastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: [
        "admin",
        "manager",
        "teamlead",
        "employee",
        "preparer",
        "reviewer",
        "filer",
        "corrections"
      ],
      required: true,
    },

    department: {
      type: String,
      enum: [
        "CallingDepartment",
        "PreparationDepartment",
        "AccountsDepartment",
        "PaymentsDepartment",
        "Administration",
      ],
      default: "CallingDepartment",
    },

    teamName: {
      type: String,
      enum: [
        "RainBow Tax Filings",
        "On Time Tax Filings",
        "GrandTax Filings",
        "TaxFilerWay",
      ],
      default: null,
    },

    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    teamleadId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    profilePic: {
      fileName: String,
      fileType: String,
      fileUrl: String,
      uploadedAt: { type: Date, default: Date.now },
    },
    documents: [
      {
        fileName: String,
        fileType: String,
        fileUrl: String,
        description: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    joiningDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
userSchema.pre("save", function (next) {
  try {
    validateUserRole(this.department, this.role);
    next();
  } catch (err) {
    next(err);
  }
});

// Validate role/department on findOneAndUpdate
userSchema.pre("findOneAndUpdate", function (next) {
  try {
    const update = this.getUpdate() || {};
    const $set = update.$set || {};
    const newDept = update.department ?? $set.department;
    const newRole = update.role ?? $set.role;
    if (newDept || newRole) validateUserRole(newDept || this.department, newRole || this.role);
    next();
  } catch (err) {
    next(err);
  }
});

// Auto-infer team from teamLead for employees
userSchema.pre("save", async function (next) {
  try {
    if (this.isNew && this.role === "employee" && this.teamleadId && !this.teamName) {
      const TeamLead = await this.model("User").findById(this.teamleadId).lean();
      if (TeamLead?.teamName) this.teamName = TeamLead.teamName;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Indexes
userSchema.index({ teamName: 1 });
userSchema.index({ role: 1 });
userSchema.index({ managerId: 1 });

module.exports = mongoose.model("User", userSchema);
