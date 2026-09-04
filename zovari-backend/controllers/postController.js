const Post = require("../models/Post");
const User = require("../models/User");
const { createNotification } = require("../utils/createNotification");
const { notifyMentions } = require("../utils/notifyMentions");
const { extractHashtags } = require("../utils/parseText");
const { getExcludedAuthorIds, isBlockedEitherWay } = require("../utils/blockHelpers");

// @route  GET /api/posts  -> home feed (naye pehle), ?sort=popular, ya ?hashtag=coding
const getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const filter = {};
    if (req.query.hashtag) {
      filter.hashtags = req.query.hashtag.toLowerCase();
    }

    // Login ho to blocked/muted logon ki posts feed se hata dete hain
    if (req.user) {
      const excludedIds = await getExcludedAuthorIds(req.user._id);
      if (excludedIds.length) filter.author = { $nin: excludedIds };
    }

    if (req.query.sort === "popular") {
      // Mongoose me array length pe direct sort nahi hota, is liye aggregate use karte hain
      const posts = await Post.aggregate([
        { $match: filter },
        { $addFields: { likesCount: { $size: "$likes" } } },
        { $sort: { likesCount: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]);
      const populated = await Post.populate(posts, { path: "author", select: "name avatar isVerified" });
      return res.json(populated);
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", "name avatar isVerified");

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Could not load feed", error: err.message });
  }
};

// @route  POST /api/posts (protected) - composer se naya post (text/images/video me se koi bhi combination)
const createPost = async (req, res) => {
  try {
    const { text, images, video } = req.body;
    const trimmedText = (text || "").trim();
    const imageList = Array.isArray(images) ? images.slice(0, 4) : [];

    if (!trimmedText && imageList.length === 0 && !video) {
      return res.status(400).json({ message: "Post needs some text, image, or video" });
    }

    const post = await Post.create({
      author: req.user._id,
      text: trimmedText,
      images: imageList,
      video: video || "",
      hashtags: extractHashtags(trimmedText),
    });

    const populatedPost = await post.populate("author", "name avatar isVerified");
    res.status(201).json(populatedPost);

    await notifyMentions(trimmedText, req.user._id, post._id);
  } catch (err) {
    console.error("createPost error:", err); // Terminal me poora error dikhega debug ke liye
    res.status(500).json({ message: "Could not create post", error: err.message });
  }
};

// @route  POST /api/posts/:id/like (protected) - toggle like/unlike
const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (await isBlockedEitherWay(req.user._id, post.author)) {
      return res.status(403).json({ message: "You can't interact with this post" });
    }

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

// @route  PATCH /api/posts/:id (protected) - sirf apna post edit kar sakta hai
const editPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only edit your own posts" });
    }

    const { text, images, video } = req.body;
    const trimmedText = text !== undefined ? text.trim() : post.text;
    const newImages = images !== undefined ? images.slice(0, 4) : post.images;
    const newVideo = video !== undefined ? video : post.video;

    if (!trimmedText && newImages.length === 0 && !newVideo) {
      return res.status(400).json({ message: "Post needs some text, image, or video" });
    }

    post.text = trimmedText;
    post.images = newImages;
    post.video = newVideo;
    post.hashtags = extractHashtags(trimmedText);
    await post.save();

    const populatedPost = await post.populate("author", "name avatar isVerified");
    res.json(populatedPost);

    await notifyMentions(trimmedText, req.user._id, post._id);
  } catch (err) {
    console.error("editPost error:", err);
    res.status(500).json({ message: "Could not edit post", error: err.message });
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

// @route  POST /api/posts/lookup - body: { ids: [...] } - Saved posts page ke liye
const getPostsByIds = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json([]);

    const posts = await Post.find({ _id: { $in: ids } }).populate("author", "name avatar isVerified");

    const postsById = new Map(posts.map((p) => [String(p._id), p]));
    const ordered = ids.map((id) => postsById.get(String(id))).filter(Boolean);

    res.json(ordered);
  } catch (err) {
    res.status(500).json({ message: "Could not load saved posts", error: err.message });
  }
};

// @route  POST /api/posts/:id/view - post ki reach/impressions track karna (login zaroori nahi)
const registerView = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select("author viewedBy impressions");
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.impressions += 1; // har view count hoti hai, chahe wahi banda dobara dekhe

    // Reach ke liye sirf unique logged-in viewers count karte hain, aur apni khud ki
    // post dekhne se apni hi reach nahi barhti (jaise real apps me hota hai)
    if (req.user && String(req.user._id) !== String(post.author)) {
      const alreadyViewed = post.viewedBy.some((v) => String(v.user) === String(req.user._id));
      if (!alreadyViewed) post.viewedBy.push({ user: req.user._id });
    }

    await post.save();
    res.json({ impressions: post.impressions, reach: post.viewedBy.length });
  } catch (err) {
    res.status(500).json({ message: "Could not register view", error: err.message });
  }
};

// @route  POST /api/posts/:id/share (protected) - share button use hote hi count barhana
const registerShare = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { sharesCount: 1 } },
      { new: true, select: "sharesCount" }
    );
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json({ sharesCount: post.sharesCount });
  } catch (err) {
    res.status(500).json({ message: "Could not register share", error: err.message });
  }
};

// @route  GET /api/posts/:id/analytics (protected) - sirf post ka author dekh sakta hai
// (Facebook Insights jaisa: reach, impressions, likes/comments/shares, engagement rate,
// aur pichle 7 din ka views-over-time breakdown)
const getPostAnalytics = async (req, res) => {
  try {
    const Comment = require("../models/Comment");
    const post = await Post.findById(req.params.id).populate("likes", "name avatar isVerified");
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (String(post.author) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only view insights for your own posts" });
    }

    const commentsCount = await Comment.countDocuments({ post: post._id });
    const reach = post.viewedBy.length;
    const engagementActions = post.likes.length + commentsCount + post.sharesCount;
    const engagementRate = reach > 0 ? Math.round((engagementActions / reach) * 1000) / 10 : 0;

    // Pichle 7 din, har din kitne views huay - chart banane ke liye
    const dayBuckets = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = post.viewedBy.filter((v) => v.viewedAt >= dayStart && v.viewedAt < dayEnd).length;
      dayBuckets.push({
        label: dayStart.toLocaleDateString(undefined, { weekday: "short" }),
        count,
      });
    }

    res.json({
      postId: post._id,
      createdAt: post.createdAt,
      reach,
      impressions: post.impressions,
      likesCount: post.likes.length,
      commentsCount,
      sharesCount: post.sharesCount,
      engagementRate,
      viewsOverTime: dayBuckets,
      likedBy: post.likes.slice(-12).reverse(), // sab se recent 12 likers
    });
  } catch (err) {
    res.status(500).json({ message: "Could not load post insights", error: err.message });
  }
};

// @route  POST /api/posts/:id/save (protected) - bookmark toggle karna (save/unsave)
const toggleSavePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const user = req.user;
    const alreadySaved = user.savedPosts.some((id) => String(id) === postId);

    if (alreadySaved) {
      user.savedPosts = user.savedPosts.filter((id) => String(id) !== postId);
    } else {
      user.savedPosts.push(postId);
    }
    await user.save();

    res.json({ saved: !alreadySaved });
  } catch (err) {
    res.status(500).json({ message: "Could not update saved post", error: err.message });
  }
};

// @route  GET /api/posts/saved/ids (protected) - sirf IDs, lightweight - har page pe
// bookmark icon ka sahi (saved/not-saved) state dikhane ke liye use hota hai
const getSavedPostIds = async (req, res) => {
  try {
    res.json(req.user.savedPosts.map(String));
  } catch (err) {
    res.status(500).json({ message: "Could not load saved post ids", error: err.message });
  }
};

// @route  GET /api/posts/saved/me (protected) - saved.html ke liye poori posts, sabse
// recently-saved sab se upar (server pe save hoti hain - ab doosre device pe bhi dikhengi)
const getSavedPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("savedPosts");
    const savedIds = user.savedPosts.map(String).reverse(); // naya saved hua post sab se upar

    const posts = await Post.find({ _id: { $in: savedIds } }).populate(
      "author",
      "name avatar isVerified"
    );
    const postsById = new Map(posts.map((p) => [String(p._id), p]));
    const ordered = savedIds.map((id) => postsById.get(id)).filter(Boolean);

    res.json(ordered);
  } catch (err) {
    res.status(500).json({ message: "Could not load saved posts", error: err.message });
  }
};

module.exports = {
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
};