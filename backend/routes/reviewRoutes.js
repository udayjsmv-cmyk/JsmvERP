const express = require("express");
const router = express.Router();
const {forwardToReviewer} = require("../controllers/preparerController");
const {getForwardedToReviewer,markAsReviewed, getReviewed, returnToPreparer} = require( '../controllers/reviewerController');
const { requireAuth } = require( "../middleware/authMiddleware");

router.post("/:id/forward-to-reviewer", requireAuth, forwardToReviewer);   // Preparer → Reviewer
router.get("/forwarded-to-reviewer", requireAuth, getForwardedToReviewer); // Reviewer’s inbox
router.post("/:id/mark-reviewed", requireAuth, markAsReviewed);            // Reviewer marks as reviewed
router.get("/Marked",requireAuth,getReviewed);
router.post("/:id/return-to-preparer",requireAuth,returnToPreparer);


module.exports = router;