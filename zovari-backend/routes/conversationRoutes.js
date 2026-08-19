const express = require("express");
const router = express.Router();
const {
  getConversations,
  startConversation,
  getMessages,
  sendMessage,
} = require("../controllers/conversationController");
const { protect } = require("../middleware/auth");

router.get("/", protect, getConversations);
router.post("/", protect, startConversation);
router.get("/:id/messages", protect, getMessages);
router.post("/:id/messages", protect, sendMessage);

module.exports = router;
