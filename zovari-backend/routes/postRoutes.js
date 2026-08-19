const express = require("express");
const router = express.Router();
const { getFeed, createPost, toggleLike, deletePost } = require("../controllers/postController");
const { getComments, addComment } = require("../controllers/commentController");
const { protect } = require("../middleware/auth");

router.get("/", getFeed);
router.post("/", protect, createPost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, toggleLike);

router.get("/:id/comments", getComments);
router.post("/:id/comments", protect, addComment);

module.exports = router;
