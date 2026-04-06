// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {validateUserRole} = require("../utils/vaildateUserRole");

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, teamName: user.teamName },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function normalizeRole(role) {
  const mapping = {
    admin: "admin",
    manager: "manager",
    teamlead: "teamlead",
    employee: "employee",
    preparer: "preparer",
    reviewer: "reviewer",
    filer: "filer",
    corrections: "corrections",
  };
  return mapping[role.toString().toLowerCase()] || role;
}

exports.register = async (req, res) => {
  try {
    const {
      FirstName,
      LastName,
      email,
      password,
      department,
      role,
      teamName,
      teamleadId,
      managerId,
      joiningDate,
    } = req.body;

    if (!FirstName || !LastName || !email || !password || !department || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newRole = normalizeRole(role);
    const emailNorm = email.toString().toLowerCase().trim();

    // Validate department & role combination
    try {
      validateUserRole(department, newRole);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const exists = await User.findOne({ email: emailNorm });
    if (exists) return res.status(400).json({ message: "Email already registered" });

    const totalUsers = await User.countDocuments();
    const creator = req.user || null;

    if (!creator && totalUsers > 0) {
      return res.status(403).json({
        message: "User creation must be performed by an authenticated Admin/Manager/TeamLead",
      });
    }

    if (!creator && totalUsers === 0 && newRole !== "admin") {
      return res.status(400).json({ message: "First user must be an admin" });
    }

    let assignedManagerId = managerId || null;
    let assignedTeamleadId = teamleadId || null;
    let assignedTeamName = teamName || null;

    if (creator) {
      const creatorRole = creator.role;

      if (creatorRole === "admin") {
        // Admin can create manager, teamlead, employee
      } else if (creatorRole === "manager") {
        if (!["teamlead", "employee","preparer","reviewer","filer","corrections"].includes(newRole)) {
          return res.status(403).json({ message: "Manager can only create teamlead or employee" });
        }
        assignedManagerId = creator._id;
      } else if (creatorRole === "teamlead") {
        if (newRole !== "employee") {
          return res.status(403).json({ message: "TeamLead can only create employees" });
        }
        assignedTeamleadId = creator._id;
        assignedTeamName = creator.teamName;
        assignedManagerId = creator.managerId || assignedManagerId;
      } else {
        return res.status(403).json({ message: "Not authorized to create users" });
      }
    }

    if (newRole === "teamlead" && !assignedTeamName) {
      return res.status(400).json({ message: "TeamLead must belong to a team (teamName)" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const userPayload = {
      FirstName,
      LastName,
      email: emailNorm,
      password: hashed,
      department,
      role: newRole,
      teamName: assignedTeamName,
      teamleadId: assignedTeamleadId,
      managerId: assignedManagerId,
      createdBy: creator ? creator._id : null,
      joiningDate,
    };

    const user = await User.create(userPayload);
    const token = signToken(user);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        FirstName: user.FirstName,
        LastName: user.LastName,
        email: user.email,
        department: user.department,
        role: user.role,
        teamName: user.teamName,
        teamleadId: user.teamleadId,
        managerId: user.managerId,
      },
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Missing credentials" });

    const emailNorm = email.toString().toLowerCase().trim();
    console.time("DB find user");
    const user = await User.findOne({ email: emailNorm });
    console.timeEnd("DB find user");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);

    res.json({
      message: "Logged in successfully",
      user: {
        id: user._id,
        FirstName: user.FirstName,
        LastName: user.LastName,
        email: user.email,
        department: user.department,
        role: user.role,
        teamName: user.teamName,
        teamleadId: user.teamleadId,
        managerId: user.managerId,
      },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};
// ================= Get Team Members (TeamLead Dashboard) =================
exports.getMyTeam = async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== "teamlead") {
      return res.status(403).json({ message: "Only TeamLead can view their team" });
    }

    // Find all employees in the same teamName
    const teamMembers = await User.find({ teamName: user.teamName, role: "employee" })
      .select("FirstName LastName email role joiningDate isActive")
      .sort({ FirstName: 1 });

    res.json({
      teamLead: {
        id: user._id,
        FirstName: user.FirstName,
        LastName: user.LastName,
        email: user.email,
        teamName: user.teamName,
      },
      teamMembers,
    });
  } catch (err) {
    console.error("getMyTeam error:", err);
    res.status(500).json({ message: "Error fetching team members", error: err.message });
  }
};
exports.getMyprofile= async(req,res)=>{
  try{
    const user= req.user;
    const profile= await User.find({email:user.email});
    res.json({
      message: "profile fetched successfully",
      user: {
        id: user._id,
        FirstName: user.FirstName,
        LastName: user.LastName,
        email: user.email,
        department: user.department,
        role: user.role,
        teamName: user.teamName,
      },
      profile,
    });
  }
  catch (err) {
    console.error("getMyProfile error:", err);
    res.status(500).json({ message: "Error fetching profile", error: err.message });
  }
};
