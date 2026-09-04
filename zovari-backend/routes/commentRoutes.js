const express = require("express");
const router = express.Router();
const { toggleCommentLike } = require("../controllers/commentController");
const { protect } = require("../middleware/auth");

router.post("/:id/like", protect, toggleCommentLike);

module.exports = router;
