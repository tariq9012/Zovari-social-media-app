const Notification = require("../models/Notification");
const { emitToUser } = require("../utils/socket");

// @route  GET /api/notifications (protected)
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("sender", "name avatar isVerified")
      .populate("post", "text");

    res.json(notifications);
  } catch (err) {
    console.error("getNotifications error:", err); // Terminal me poora error dikhega debug ke liye
    res.status(500).json({ message: "Could not load notifications", error: err.message });
  }
};

// @route  PATCH /api/notifications/read-all (protected) - sab ko read mark karna
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    // Isi user ka koi aur tab/device khula ho to uska badge bhi turant clear ho jaye
    emitToUser(req.user._id, "notificationsRead", {});
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

// @route  GET /api/notifications/unread-count (protected) - sidebar badge ke liye
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Could not load unread count", error: err.message });
  }
};

module.exports = { getNotifications, markAllRead, getUnreadCount };
