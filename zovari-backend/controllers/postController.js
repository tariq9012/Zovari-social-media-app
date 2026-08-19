const Post = require("../models/Post");
const { createNotification } = require("../utils/createNotification");

// @route  GET /api/posts  -> home feed (sab posts, naye pehle) ya ?sort=popular (Explore page ke liye)
const getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    let query = Post.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", "name avatar");

    if (req.query.sort === "popular") {
      // Mongoose me array length pe direct sort nahi hota, is liye aggregate use karte hain
      const posts = await Post.aggregate([
        { $addFields: { likesCount: { $size: "$likes" } } },
        { $sort: { likesCount: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]);
      const populated = await Post.populate(posts, { path: "author", select: "name avatar" });
      return res.json(populated);
    }

    const posts = await query.sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Could not load feed", error: err.message });
  }
};

// @route  POST /api/posts (protected) - composer se naya post
const createPost = async (req, res) => {
  try {
    const { text, image } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Post text is required" });
    }

    const post = await Post.create({
      author: req.user._id,
      text: text.trim(),
      image: image || "",
    });

    const populatedPost = await post.populate("author", "name avatar");
    res.status(201).json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: "Could not create post", error: err.message });
  }
};

// @route  POST /api/posts/:id/like (protected) - toggle like/unlike
const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const userId = String(req.user._id);
    const alreadyLiked = post.likes.some((id) => String(id) === userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => String(id) !== userId);
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    if (!alreadyLiked) {
      await createNotification({
        recipient: post.author,
        sender: req.user._id,
        type: "like",
        post: post._id,
      });
    }

    res.json({ liked: !alreadyLiked, likesCount: post.likes.length });
  } catch (err) {
    res.status(500).json({ message: "Could not like post", error: err.message });
  }
};

// @route  DELETE /api/posts/:id (protected) - sirf apna post delete kar sakta hai
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only delete your own posts" });
    }

    await post.deleteOne();
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
};

module.exports = { getFeed, createPost, toggleLike, deletePost };
