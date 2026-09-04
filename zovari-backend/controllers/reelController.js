const Reel = require("../models/Reel");
const Comment = require("../models/Comment");
const Report = require("../models/Report");
const User = require("../models/User");
const { createNotification } = require("../utils/createNotification");
const { extractHashtags } = require("../utils/parseText");
const { getExcludedAuthorIds, isBlockedEitherWay } = require("../utils/blockHelpers");

const REACTION_TYPES = Reel.REACTION_TYPES;

// @route  GET /api/reels?page=1&limit=10 - vertical feed, naye pehle
const getReelsFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const filter = {};
    if (req.user) {
      const excludedIds = await getExcludedAuthorIds(req.user._id);
      if (excludedIds.length) filter.author = { $nin: excludedIds };
    }

    const reels = await Reel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", "name avatar isVerified");

    // Har reel ke comments ka count bhi saath bhej dete hain (chhoti list hai, alag query sasti hai)
    const reelsWithCounts = await Promise.all(
      reels.map(async (reel) => {
        const commentsCount = await Comment.countDocuments({ reel: reel._id });
        return { ...reel.toJSON(), commentsCount };
      })
    );

    res.json(reelsWithCounts);
  } catch (err) {
    res.status(500).json({ message: "Could not load reels", error: err.message });
  }
};

// @route  POST /api/reels (protected) - body: { videoUrl, caption }
const createReel = async (req, res) => {
  try {
    const { videoUrl, caption } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ message: "A video is required for a reel" });
    }

    const trimmedCaption = (caption || "").trim();

    const reel = await Reel.create({
      author: req.user._id,
      videoUrl,
      caption: trimmedCaption,
      hashtags: extractHashtags(trimmedCaption),
    });

    const populated = await reel.populate("author", "name avatar isVerified");
    res.status(201).json(populated);
  } catch (err) {
    console.error("createReel error:", err);
    res.status(500).json({ message: "Could not create reel", error: err.message });
  }
};

// @route  POST /api/reels/:id/react (protected) - body: { type } - like/love/haha/wow/sad/angry
// Same type dobara bhejo to reaction hat jati hai (un-react), alag type bhejo to badal jati hai
const toggleReaction = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    if (await isBlockedEitherWay(req.user._id, reel.author)) {
      return res.status(403).json({ message: "You can't interact with this reel" });
    }

    const type = REACTION_TYPES.includes(req.body.type) ? req.body.type : "like";
    const userId = String(req.user._id);
    const existing = reel.reactions.find((r) => String(r.user) === userId);

    let myReaction = null;
    if (existing && existing.type === type) {
      // Wahi emoji dobara dabaya - reaction hata do
      reel.reactions = reel.reactions.filter((r) => String(r.user) !== userId);
    } else if (existing) {
      // Alag emoji select kiya - type badal do
      existing.type = type;
      myReaction = type;
    } else {
      reel.reactions.push({ user: req.user._id, type });
      myReaction = type;
    }

    await reel.save();

    if (myReaction && !existing) {
      await createNotification({ recipient: reel.author, sender: req.user._id, type: "like" });
    }

    res.json({ myReaction, reactionsCount: reel.reactions.length });
  } catch (err) {
    res.status(500).json({ message: "Could not react to reel", error: err.message });
  }
};

// @route  POST /api/reels/:id/view - view count barhana (login zaroori nahi)
const registerView = async (req, res) => {
  try {
    const reel = await Reel.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
    if (!reel) return res.status(404).json({ message: "Reel not found" });
    res.json({ views: reel.views });
  } catch (err) {
    res.status(500).json({ message: "Could not register view", error: err.message });
  }
};

// @route  DELETE /api/reels/:id (protected) - sirf apna reel delete kar sakta hai
const deleteReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    if (String(reel.author) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only delete your own reel" });
    }

    await reel.deleteOne();
    await Comment.deleteMany({ reel: reel._id }); // uske comments bhi saath delete
    res.json({ message: "Reel deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
};

// @route  GET /api/reels/:id/comments
const getReelComments = async (req, res) => {
  try {
    const comments = await Comment.find({ reel: req.params.id })
      .sort({ createdAt: 1 })
      .populate("author", "name avatar isVerified");
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Could not load comments", error: err.message });
  }
};

// @route  POST /api/reels/:id/comments (protected) - body: { text }
const addReelComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    if (await isBlockedEitherWay(req.user._id, reel.author)) {
      return res.status(403).json({ message: "You can't comment on this reel" });
    }

    const comment = await Comment.create({
      reel: req.params.id,
      author: req.user._id,
      text: text.trim(),
    });

    const populated = await comment.populate("author", "name avatar isVerified");

    await createNotification({ recipient: reel.author, sender: req.user._id, type: "comment" });

    const commentsCount = await Comment.countDocuments({ reel: reel._id });
    res.status(201).json({ ...populated.toJSON(), commentsCount });
  } catch (err) {
    res.status(500).json({ message: "Could not add comment", error: err.message });
  }
};

// @route  POST /api/reels/:id/report (protected) - body: { reason } (optional)
const reportReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    await Report.create({
      reporter: req.user._id,
      reel: reel._id,
      reason: (req.body.reason || "").trim().slice(0, 300),
    });

    res.status(201).json({ message: "Reel reported. Thanks for letting us know." });
  } catch (err) {
    res.status(500).json({ message: "Could not report reel", error: err.message });
  }
};

// @route  POST /api/reels/:id/save (protected) - bookmark toggle karna (save/unsave)
const toggleSaveReel = async (req, res) => {
  try {
    const reelId = req.params.id;
    const reel = await Reel.findById(reelId);
    if (!reel) return res.status(404).json({ message: "Reel not found" });

    const user = req.user;
    const alreadySaved = user.savedReels.some((id) => String(id) === reelId);

    if (alreadySaved) {
      user.savedReels = user.savedReels.filter((id) => String(id) !== reelId);
    } else {
      user.savedReels.push(reelId);
    }
    await user.save();

    res.json({ saved: !alreadySaved });
  } catch (err) {
    res.status(500).json({ message: "Could not update saved reel", error: err.message });
  }
};

// @route  GET /api/reels/saved/ids (protected) - sirf IDs, lightweight - har page pe
// bookmark icon ka sahi (saved/not-saved) state dikhane ke liye use hota hai
const getSavedReelIds = async (req, res) => {
  try {
    res.json(req.user.savedReels.map(String));
  } catch (err) {
    res.status(500).json({ message: "Could not load saved reel ids", error: err.message });
  }
};

// @route  GET /api/reels/saved/me (protected) - saved reels page ke liye poore reels, sabse
// recently-saved sab se upar (server pe save hoti hain - doosre device pe bhi dikhengi)
const getSavedReels = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("savedReels");
    const savedIds = user.savedReels.map(String).reverse(); // naya saved hua reel sab se upar

    const reels = await Reel.find({ _id: { $in: savedIds } }).populate(
      "author",
      "name avatar isVerified"
    );
    const reelsById = new Map(reels.map((r) => [String(r._id), r]));
    const ordered = savedIds.map((id) => reelsById.get(id)).filter(Boolean);

    res.json(ordered);
  } catch (err) {
    res.status(500).json({ message: "Could not load saved reels", error: err.message });
  }
};

module.exports = {
  getReelsFeed,
  createReel,
  toggleReaction,
  registerView,
  deleteReel,
  getReelComments,
  addReelComment,
  reportReel,
  toggleSaveReel,
  getSavedReelIds,
  getSavedReels,
};