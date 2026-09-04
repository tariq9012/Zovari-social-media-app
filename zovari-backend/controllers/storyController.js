const Story = require("../models/Story");
const User = require("../models/User");

// @route  POST /api/stories (protected) - body: { mediaUrl, mediaType, text }
const createStory = async (req, res) => {
  try {
    const { mediaUrl, mediaType, text } = req.body;

    if (!mediaUrl || !mediaType) {
      return res.status(400).json({ message: "Media is required for a story" });
    }
    if (!["image", "video"].includes(mediaType)) {
      return res.status(400).json({ message: "mediaType must be image or video" });
    }

    const story = await Story.create({
      author: req.user._id,
      mediaUrl,
      mediaType,
      text: (text || "").trim().slice(0, 200),
    });

    const populated = await story.populate("author", "name avatar isVerified");
    res.status(201).json(populated);
  } catch (err) {
    console.error("createStory error:", err);
    res.status(500).json({ message: "Could not create story", error: err.message });
  }
};

// @route  GET /api/stories (protected)
// Apni khud ki + jinko follow karte ho unki active stories, author ke hisab se grouped
const getStoriesFeed = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("following mutedUsers");
    const mutedIds = (me?.mutedUsers || []).map((id) => String(id));
    const authorIds = [req.user._id, ...(me?.following || [])].filter(
      (id) => !mutedIds.includes(String(id))
    );

    const stories = await Story.find({
      author: { $in: authorIds },
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: 1 }) // ek user ke stories andar purani se nayi order me hon
      .populate("author", "name avatar isVerified");

    // Author ke hisab se group karte hain taake frontend ek-ek avatar dikha sake
    const grouped = new Map();
    for (const story of stories) {
      const authorId = String(story.author._id);
      if (!grouped.has(authorId)) {
        grouped.set(authorId, {
          author: story.author,
          stories: [],
          hasUnseen: false,
        });
      }
      const seenByMe = story.viewers.some((v) => String(v.user) === String(req.user._id));
      grouped.get(authorId).stories.push(story);
      if (!seenByMe && String(authorId) !== String(req.user._id)) {
        grouped.get(authorId).hasUnseen = true;
      }
    }

    // Apni story sab se pehle, phir jinke unseen stories hain, phir baqi
    const result = [...grouped.values()].sort((a, b) => {
      const aMine = String(a.author._id) === String(req.user._id);
      const bMine = String(b.author._id) === String(req.user._id);
      if (aMine !== bMine) return aMine ? -1 : 1;
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return 0;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Could not load stories", error: err.message });
  }
};

// @route  GET /api/stories/user/:userId (protected) - ek user ki sab active stories (viewer ke marker ke bagair)
const getUserStories = async (req, res) => {
  try {
    const stories = await Story.find({
      author: req.params.userId,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: 1 })
      .populate("author", "name avatar isVerified");

    res.json(stories);
  } catch (err) {
    res.status(500).json({ message: "Could not load stories", error: err.message });
  }
};

// @route  POST /api/stories/:id/view (protected) - story dekhi to viewer list me add ho jata hai
const viewStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: "Story not found" });

    const alreadyViewed = story.viewers.some((v) => String(v.user) === String(req.user._id));
    // Apni khud ki story dekhne pe viewer list me apna naam nahi jodna
    if (!alreadyViewed && String(story.author) !== String(req.user._id)) {
      story.viewers.push({ user: req.user._id });
      await story.save();
    }

    res.json({ viewersCount: story.viewers.length });
  } catch (err) {
    res.status(500).json({ message: "Could not mark story as viewed", error: err.message });
  }
};

// @route  GET /api/stories/:id/viewers (protected) - sirf apni story ke viewers dekh sakte ho
const getStoryViewers = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id).populate("viewers.user", "name avatar isVerified");
    if (!story) return res.status(404).json({ message: "Story not found" });

    if (String(story.author) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only see viewers of your own story" });
    }

    const viewers = story.viewers
      .filter((v) => v.user) // agar koi user delete ho chuka ho to skip
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
      .map((v) => ({ user: v.user, viewedAt: v.viewedAt }));

    res.json(viewers);
  } catch (err) {
    res.status(500).json({ message: "Could not load viewers", error: err.message });
  }
};

// @route  DELETE /api/stories/:id (protected) - sirf apni story delete kar sakta hai
const deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: "Story not found" });

    if (String(story.author) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only delete your own story" });
    }

    await story.deleteOne();
    res.json({ message: "Story deleted" });
  } catch (err) {
    res.status(500).json({ message: "Could not delete story", error: err.message });
  }
};

module.exports = {
  createStory,
  getStoriesFeed,
  getUserStories,
  viewStory,
  getStoryViewers,
  deleteStory,
};
