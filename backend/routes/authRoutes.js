const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { optionalAuth,requireAuth } = require("../middleware/authMiddleware");

// First admin registration (optional auth)
router.post("/register", optionalAuth, authController.register);

// Login
router.post("/login", authController.login);
router.get("/team", requireAuth, authController.getMyTeam);
router.get("/profile",requireAuth,authController.getMyprofile)


module.exports = router;
