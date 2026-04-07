const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { optionalAuth,requireAuth } = require("../middleware/authMiddleware");
const { profileUpload } = require("../middleware/uploadMiddleware");

// First admin registration (optional auth)
router.post("/register", optionalAuth, authController.register);

// Login
router.post("/login", authController.login);
router.get("/team", requireAuth, authController.getMyTeam);
router.get("/profile",requireAuth,authController.getMyprofile);
router.put("/profile", requireAuth, authController.updateProfile);
router.put(
  "/profile-pic",
  requireAuth,
  profileUpload.single("profilePic"),
  authController.uploadProfilePic
);


module.exports = router;
