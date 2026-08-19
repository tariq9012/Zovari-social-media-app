const User = require("../models/User");
const Post = require("../models/Post");
const { createNotification } = require("../utils/createNotification");

// @route  GET /api/users?limit=4  -> "Who to follow" / "Top Creators" suggestions
const getUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const filter = {};

    // Logged in ho to khud ko aur jinhe already follow kar rakha hai unhe exclude kar dete hain
    if (req.user) {
      filter._id = { $nin: [req.user._id, ...req.user.following] };
    }

    const users = await User.find(filter).select("name avatar bio followers").limit(limit);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Could not load users", error: err.message });
  }
};

// @route  GET /api/users/:id
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const posts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .populate("author", "name avatar");

    res.json({ user, posts });
  } catch (err) {
    res.status(500).json({ message: "Could not load profile", error: err.message });
  }
};

// @route  PATCH /api/users/me (protected) - settings page save button
const updateMe = async (req, res) => {
  try {
    const allowedFields = ["name", "bio", "avatar", "coverImage", "location"];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

// @route  POST /api/users/:id/follow (protected) - toggle follow/unfollow
const toggleFollow = async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const currentUser = req.user;
    const alreadyFollowing = currentUser.following.includes(targetId);

    if (alreadyFollowing) {
      currentUser.following = currentUser.following.filter((id) => String(id) !== targetId);
      targetUser.followers = targetUser.followers.filter(
        (id) => String(id) !== String(currentUser._id)
      );
    } else {
      currentUser.following.push(targetId);
      targetUser.followers.push(currentUser._id);
    }

    await currentUser.save();
    await targetUser.save();

    if (!alreadyFollowing) {
      await createNotification({
        recipient: targetUser._id,
        sender: currentUser._id,
        type: "follow",
      });
    }

    res.json({
      following: !alreadyFollowing,
      followersCount: targetUser.followers.length,
    });
  } catch (err) {
    res.status(500).json({ message: "Follow/unfollow failed", error: err.message });
  }
};

module.exports = { getUsers, getUserProfile, updateMe, toggleFollow };
