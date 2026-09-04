const User = require("../models/User");
const Post = require("../models/Post");
const { getExcludedAuthorIds } = require("../utils/blockHelpers");

// @route  GET /api/search?q=... - users aur posts dono me dhoondta hai
const search = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ users: [], posts: [] });

    // Regex special characters escape karna zaroori hai warna user ka input regex tor sakta hai
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safeQ, "i");

    const userFilter = { name: regex };
    const postFilter = { text: regex };

    // Blocked logon ko (dono taraf se) search results me kabhi nahi dikhana
    if (req.user) {
      const excludedIds = await getExcludedAuthorIds(req.user._id);
      if (excludedIds.length) {
        userFilter._id = { $nin: excludedIds };
        postFilter.author = { $nin: excludedIds };
      }
    }

    const [users, posts] = await Promise.all([
      User.find(userFilter).select("name avatar bio isVerified").limit(8),
      Post.find(postFilter).populate("author", "name avatar isVerified").sort({ createdAt: -1 }).limit(8),
    ]);

    res.json({ users, posts });
  } catch (err) {
    res.status(500).json({ message: "Search failed", error: err.message });
  }
};

module.exports = { search };
