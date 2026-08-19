const Comment = require("../models/Comment");
const Post = require("../models/Post");
const { createNotification } = require("../utils/createNotification");

// @route  GET /api/posts/:id/comments
const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .populate("author", "name avatar");

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Could not load comments", error: err.message });
  }
};

// @route  POST /api/posts/:id/comments (protected)
const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = await Comment.create({
      post: req.params.id,
      author: req.user._id,
      text: text.trim(),
    });

    const populatedComment = await comment.populate("author", "name avatar");

    await createNotification({
      recipient: post.author,
      sender: req.user._id,
      type: "comment",
      post: post._id,
    });

    res.status(201).json(populatedComment);
  } catch (err) {
    res.status(500).json({ message: "Could not add comment", error: err.message });
  }
};

module.exports = { getComments, addComment };
