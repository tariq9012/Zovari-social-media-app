const Comment = require("../models/Comment");
const Post = require("../models/Post");
const { createNotification } = require("../utils/createNotification");
const { notifyMentions } = require("../utils/notifyMentions");
const { isBlockedEitherWay } = require("../utils/blockHelpers");

// @route  GET /api/posts/:id/comments
const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .populate("author", "name avatar isVerified");

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Could not load comments", error: err.message });
  }
};

// @route  POST /api/posts/:id/comments (protected) - parentComment bhejo to yeh reply ban jata hai
const addComment = async (req, res) => {
  try {
    const { text, parentComment } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (await isBlockedEitherWay(req.user._id, post.author)) {
      return res.status(403).json({ message: "You can't comment on this post" });
    }

    let parent = null;
    if (parentComment) {
      parent = await Comment.findById(parentComment);
      if (!parent) return res.status(404).json({ message: "Comment being replied to was not found" });
    }

    const comment = await Comment.create({
      post: req.params.id,
      author: req.user._id,
      text: text.trim(),
      parentComment: parent ? parent._id : null,
    });

    const populatedComment = await comment.populate("author", "name avatar isVerified");

    // Reply ho to us comment ke original author ko notification jaye, warna post ke author ko
    await createNotification({
      recipient: parent ? parent.author : post.author,
      sender: req.user._id,
      type: "comment",
      post: post._id,
    });

    res.status(201).json(populatedComment);

    await notifyMentions(text.trim(), req.user._id, post._id);
  } catch (err) {
    res.status(500).json({ message: "Could not add comment", error: err.message });
  }
};

// @route  POST /api/comments/:id/like (protected) - toggle like/unlike ek comment pe
const toggleCommentLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const userId = String(req.user._id);
    const alreadyLiked = comment.likes.some((id) => String(id) === userId);

    if (alreadyLiked) {
      comment.likes = comment.likes.filter((id) => String(id) !== userId);
    } else {
      comment.likes.push(req.user._id);
    }

    await comment.save();
    res.json({ liked: !alreadyLiked, likesCount: comment.likes.length });
  } catch (err) {
    res.status(500).json({ message: "Could not like comment", error: err.message });
  }
};

module.exports = { getComments, addComment, toggleCommentLike };
