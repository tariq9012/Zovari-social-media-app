const express = require("express");
const router = express.Router();
const {
  getReelsFeed,
  createReel,
  toggleReaction,
  registerView,
  deleteReel,
  getReelComments,
  addReelComment,
  reportReel,
  toggleSaveReel,
  getSavedReelIds,
  getSavedReels,
} = require("../controllers/reelController");
const { protect, optionalAuth } = require("../middleware/auth");

router.get("/", optionalAuth, getReelsFeed);
router.post("/", protect, createReel);
router.get("/saved/ids", protect, getSavedReelIds);
router.get("/saved/me", protect, getSavedReels);
router.post("/:id/react", protect, toggleReaction);
router.post("/:id/save", protect, toggleSaveReel);
router.post("/:id/view", registerView);
router.delete("/:id", protect, deleteReel);
router.get("/:id/comments", getReelComments);
router.post("/:id/comments", protect, addReelComment);
router.post("/:id/report", protect, reportReel);

module.exports = router;