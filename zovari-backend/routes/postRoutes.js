const express = require("express");
const router = express.Router();
const {
  getFeed,
  createPost,
  editPost,
  toggleLike,
  deletePost,
  getPostsByIds,
  registerView,
  registerShare,
  getPostAnalytics,
  toggleSavePost,
  getSavedPostIds,
  getSavedPosts,
} = require("../controllers/postController");
const { getComments, addComment } = require("../controllers/commentController");
const { protect, optionalAuth } = require("../middleware/auth");

router.get("/", optionalAuth, getFeed);
router.post("/", protect, createPost);
router.post("/lookup", getPostsByIds);
router.get("/saved/ids", protect, getSavedPostIds);
router.get("/saved/me", protect, getSavedPosts);
router.patch("/:id", protect, editPost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, toggleLike);
router.post("/:id/save", protect, toggleSavePost);
router.post("/:id/view", optionalAuth, registerView);
router.post("/:id/share", protect, registerShare);
router.get("/:id/analytics", protect, getPostAnalytics);

router.get("/:id/comments", getComments);
router.post("/:id/comments", protect, addComment);

module.exports = router;