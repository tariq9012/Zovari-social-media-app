const Notification = require("../models/Notification");

// @route  GET /api/notifications (protected)
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("sender", "name avatar")
      .populate("post", "text");

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Could not load notifications", error: err.message });
  }
};

// @route  PATCH /api/notifications/read-all (protected) - sab ko read mark karna
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

module.exports = { getNotifications, markAllRead };
