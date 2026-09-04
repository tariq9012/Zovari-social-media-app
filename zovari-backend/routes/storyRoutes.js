const express = require("express");
const router = express.Router();
const {
  createStory,
  getStoriesFeed,
  getUserStories,
  viewStory,
  getStoryViewers,
  deleteStory,
} = require("../controllers/storyController");
const { protect } = require("../middleware/auth");

router.get("/", protect, getStoriesFeed);
router.post("/", protect, createStory);
router.get("/user/:userId", protect, getUserStories);
router.post("/:id/view", protect, viewStory);
router.get("/:id/viewers", protect, getStoryViewers);
router.delete("/:id", protect, deleteStory);

module.exports = router;
