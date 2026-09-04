const express = require("express");
const router = express.Router();
const {
  getConversations,
  getConversationDetails,
  startConversation,
  createGroup,
  renameGroup,
  updateGroupAvatar,
  deleteGroup,
  addGroupMembers,
  removeGroupMember,
  getMessages,
  sendMessage,
  logCall,
  markConversationRead,
  toggleMuteConversation,
  getUnreadConversationsCount,
} = require("../controllers/conversationController");
const { protect } = require("../middleware/auth");

// Zaroori: literal paths (/unread-count, /group) ":id" wale routes se PEHLE
// register honi chahiyen, warna Express unhe bhi ":id" samajh lega
router.get("/", protect, getConversations);
router.post("/", protect, startConversation);
router.get("/unread-count", protect, getUnreadConversationsCount);
router.post("/group", protect, createGroup);

router.get("/:id", protect, getConversationDetails);
router.get("/:id/messages", protect, getMessages);
router.post("/:id/messages", protect, sendMessage);
router.post("/:id/call-log", protect, logCall);
router.patch("/:id/read", protect, markConversationRead);
router.patch("/:id/mute", protect, toggleMuteConversation);
router.patch("/:id/group", protect, renameGroup);
router.patch("/:id/avatar", protect, updateGroupAvatar);
router.delete("/:id/group", protect, deleteGroup);
router.post("/:id/members", protect, addGroupMembers);
router.delete("/:id/members/:userId", protect, removeGroupMember);

module.exports = router;
