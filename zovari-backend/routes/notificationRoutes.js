const express = require("express");
const router = express.Router();
const { getNotifications, markAllRead } = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");

router.get("/", protect, getNotifications);
router.patch("/read-all", protect, markAllRead);

module.exports = router;
