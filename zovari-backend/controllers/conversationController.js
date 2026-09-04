const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { emitToUser } = require("../utils/socket");
const { isBlockedEitherWay } = require("../utils/blockHelpers");

const DEFAULT_GROUP_AVATAR =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=facearea&facepad=2&w=200&h=200&q=80";

// Ek conversation ko frontend ke liye ek hi consistent shape me format karta hai,
// chahe wo 1-to-1 ho ya group
function formatConversation(conv, currentUserId) {
  const base = {
    _id: conv._id,
    isGroup: conv.isGroup,
    lastMessage: conv.lastMessage,
    lastMessageAt: conv.lastMessageAt,
    hasUnread: conv.unreadBy.some((id) => String(id) === String(currentUserId)),
    isMuted: (conv.mutedBy || []).some((id) => String(id) === String(currentUserId)),
  };

  if (conv.isGroup) {
    return {
      ...base,
      groupName: conv.groupName,
      groupAvatar: conv.groupAvatar || DEFAULT_GROUP_AVATAR,
      groupAdmin: conv.groupAdmin,
      memberCount: conv.participants.length,
      participants: conv.participants,
    };
  }

  const otherUser = conv.participants.find((p) => String(p._id) !== String(currentUserId));
  return { ...base, otherUser };
}

// @route  GET /api/conversations (protected) -> current user ki sari conversations, latest pehle
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name avatar isVerified");

    res.json(conversations.map((conv) => formatConversation(conv, req.user._id)));
  } catch (err) {
    res.status(500).json({ message: "Could not load conversations", error: err.message });
  }
};

// @route  GET /api/conversations/:id (protected) -> ek conversation ki poori detail (group info panel ke liye)
const getConversationDetails = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).populate(
      "participants",
      "name avatar isVerified"
    );
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => String(p._id) === String(req.user._id))) {
      return res.status(403).json({ message: "This conversation does not belong to you" });
    }

    res.json(formatConversation(conversation, req.user._id));
  } catch (err) {
    res.status(500).json({ message: "Could not load conversation", error: err.message });
  }
};

// @route  POST /api/conversations (protected) -> { userId } ke sath 1-to-1 conversation start/find karna
const startConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });
    if (userId === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot message yourself" });
    }

    if (await isBlockedEitherWay(req.user._id, userId)) {
      return res.status(403).json({ message: "You can't message this user" });
    }

    // isGroup:false zaroori hai warna agar in dono logon ka koi 2-member group ho
    // (theoretically) to wo galti se yahan match ho sakta hai
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, userId], $size: 2 },
      isGroup: { $ne: true },
    }).populate("participants", "name avatar isVerified");

    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.user._id, userId] });
      conversation = await conversation.populate("participants", "name avatar isVerified");
    }

    res.status(201).json(formatConversation(conversation, req.user._id));
  } catch (err) {
    res.status(500).json({ message: "Could not start conversation", error: err.message });
  }
};

// @route  POST /api/conversations/group (protected) - body: { name, userIds: [...] }
const createGroup = async (req, res) => {
  try {
    const { name, userIds } = req.body;
    const trimmedName = (name || "").trim();

    if (!trimmedName) return res.status(400).json({ message: "Group name is required" });
    if (!Array.isArray(userIds) || userIds.length < 2) {
      return res.status(400).json({ message: "Select at least 2 other people for a group" });
    }

    // Duplicate ids hatana aur khud ko dobara add hone se rokna
    const uniqueMemberIds = [...new Set(userIds.filter((id) => id !== String(req.user._id)))];

    let conversation = await Conversation.create({
      participants: [req.user._id, ...uniqueMemberIds],
      isGroup: true,
      groupName: trimmedName,
      groupAdmin: req.user._id,
    });
    conversation = await conversation.populate("participants", "name avatar isVerified");

    const formatted = formatConversation(conversation, req.user._id);

    // Sab members ko real-time batana ke naya group ban gaya - unki sidebar list refresh ho jaye
    uniqueMemberIds.forEach((memberId) => emitToUser(memberId, "groupUpdated", { conversationId: conversation._id }));

    res.status(201).json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Could not create group", error: err.message });
  }
};

// @route  PATCH /api/conversations/:id/group (protected) - body: { groupName } - sirf admin rename kar sakta hai
const renameGroup = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.isGroup) return res.status(400).json({ message: "This is not a group" });
    if (String(conversation.groupAdmin) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the group admin can rename the group" });
    }

    const trimmedName = (req.body.groupName || "").trim();
    if (!trimmedName) return res.status(400).json({ message: "Group name is required" });

    conversation.groupName = trimmedName;
    await conversation.save();

    conversation.participants.forEach((participantId) => {
      emitToUser(participantId, "groupUpdated", { conversationId: conversation._id });
    });

    res.json({ groupName: conversation.groupName });
  } catch (err) {
    res.status(500).json({ message: "Could not rename group", error: err.message });
  }
};

// @route  PATCH /api/conversations/:id/avatar (protected) - body: { groupAvatar } - koi bhi member badal sakta hai
const updateGroupAvatar = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.isGroup) return res.status(400).json({ message: "This is not a group" });
    if (!conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: "This conversation does not belong to you" });
    }

    const { groupAvatar } = req.body;
    if (!groupAvatar) return res.status(400).json({ message: "groupAvatar is required" });

    conversation.groupAvatar = groupAvatar;
    await conversation.save();

    conversation.participants.forEach((participantId) => {
      emitToUser(participantId, "groupUpdated", { conversationId: conversation._id });
    });

    res.json({ groupAvatar: conversation.groupAvatar });
  } catch (err) {
    res.status(500).json({ message: "Could not update group photo", error: err.message });
  }
};

// @route  DELETE /api/conversations/:id/group (protected) - sirf admin - poora group aur uske messages delete
const deleteGroup = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.isGroup) return res.status(400).json({ message: "This is not a group" });
    if (String(conversation.groupAdmin) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the group admin can delete this group" });
    }

    const memberIds = conversation.participants.map((p) => String(p));

    await Message.deleteMany({ conversation: conversation._id });
    await conversation.deleteOne();

    memberIds.forEach((memberId) => emitToUser(memberId, "groupUpdated", { conversationId: conversation._id, deleted: true }));

    res.json({ message: "Group deleted" });
  } catch (err) {
    res.status(500).json({ message: "Could not delete group", error: err.message });
  }
};

// @route  POST /api/conversations/:id/members (protected) - body: { userIds: [...] } - koi bhi member add kar sakta hai
const addGroupMembers = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.isGroup) return res.status(400).json({ message: "This is not a group" });
    if (!conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: "This conversation does not belong to you" });
    }

    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "Select at least one person to add" });
    }

    const existingIds = conversation.participants.map((p) => String(p));
    const newIds = userIds.filter((id) => !existingIds.includes(String(id)));

    if (newIds.length === 0) {
      return res.status(400).json({ message: "Selected people are already in the group" });
    }

    conversation.participants.push(...newIds);
    await conversation.save();
    await conversation.populate("participants", "name avatar isVerified");

    conversation.participants.forEach((p) => {
      emitToUser(p._id, "groupUpdated", { conversationId: conversation._id });
    });

    res.json(formatConversation(conversation, req.user._id));
  } catch (err) {
    res.status(500).json({ message: "Could not add members", error: err.message });
  }
};

// @route  DELETE /api/conversations/:id/members/:userId (protected)
// User apna aap ko hata sakta hai ("leave group"), ya admin kisi aur ko remove kar sakta hai
const removeGroupMember = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.isGroup) return res.status(400).json({ message: "This is not a group" });

    const targetId = req.params.userId;
    const isSelfLeaving = targetId === String(req.user._id);
    const isAdmin = String(conversation.groupAdmin) === String(req.user._id);

    if (!isSelfLeaving && !isAdmin) {
      return res.status(403).json({ message: "Only the group admin can remove other members" });
    }

    conversation.participants = conversation.participants.filter(
      (p) => String(p) !== String(targetId)
    );

    // Admin khud chala jaye to group me se koi bhi baqi banda naya admin ban jata hai
    if (String(conversation.groupAdmin) === String(targetId) && conversation.participants.length > 0) {
      conversation.groupAdmin = conversation.participants[0];
    }

    if (conversation.participants.length === 0) {
      await conversation.deleteOne(); // sab chale gaye - khali group delete kar dena
      return res.json({ message: "Group deleted (no members left)" });
    }

    await conversation.save();

    const remainingIds = [...conversation.participants, targetId]; // jaane wale ko bhi batana hai
    remainingIds.forEach((p) => emitToUser(p, "groupUpdated", { conversationId: conversation._id }));

    res.json({ message: isSelfLeaving ? "You left the group" : "Member removed" });
  } catch (err) {
    res.status(500).json({ message: "Could not remove member", error: err.message });
  }
};

// @route  GET /api/conversations/:id/messages (protected)
const getMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: "This conversation does not belong to you" });
    }

    const messages = await Message.find({ conversation: req.params.id })
      .sort({ createdAt: 1 })
      .populate("sender", "name avatar isVerified");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Could not load messages", error: err.message });
  }
};

// @route  POST /api/conversations/:id/messages (protected) - 1-to-1 aur group dono ke liye same
const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: "This conversation does not belong to you" });
    }

    // 1-to-1 chat me agar dono me se kisi ne block kar rakha ho to message nahi ja sakta
    // (groups me blocking messaging nahi rokti - jaise WhatsApp/Instagram me hota hai)
    if (!conversation.isGroup) {
      const otherId = conversation.participants.find((p) => String(p) !== String(req.user._id));
      if (otherId && (await isBlockedEitherWay(req.user._id, otherId))) {
        return res.status(403).json({ message: "You can't message this user" });
      }
    }

    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user._id,
      text: text.trim(),
    });

    conversation.lastMessage = text.trim();
    conversation.lastMessageAt = new Date();

    // Doosre participant(s) ke liye ye conversation "unread" mark ho jati hai
    conversation.participants.forEach((participantId) => {
      if (String(participantId) === String(req.user._id)) return;
      const alreadyUnread = conversation.unreadBy.some((id) => String(id) === String(participantId));
      if (!alreadyUnread) conversation.unreadBy.push(participantId);
    });

    await conversation.save();

    const populatedMessage = await message.populate("sender", "name avatar isVerified");

    // Real-time: baqi sab participants ko turant naya message mil jata hai (group ho ya 1-to-1,
    // dono ke liye ye loop kaam karta hai kyunki participants array me jitne bhi log hon sabko bhej deta hai)
    conversation.participants.forEach((participantId) => {
      if (String(participantId) === String(req.user._id)) return; // khud ko wapis nahi bhejna
      emitToUser(participantId, "newMessage", {
        ...populatedMessage.toObject(),
        conversation: conversation._id,
        isGroup: conversation.isGroup,
      });
      emitToUser(participantId, "conversationUpdated", {
        conversationId: conversation._id,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
      });
    });

    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(500).json({ message: "Could not send message", error: err.message });
  }
};

// @route  POST /api/conversations/:id/call-log (protected) - body: { callType, status, duration }
// Call khatam hone ke baad chat me ek record chor deta hai (jaise WhatsApp me "Missed call" dikhta hai)
const logCall = async (req, res) => {
  try {
    const { callType, status, duration } = req.body;
    if (!["audio", "video"].includes(callType)) {
      return res.status(400).json({ message: "callType must be audio or video" });
    }
    if (!["completed", "missed", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid call status" });
    }

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: "This conversation does not belong to you" });
    }

    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user._id,
      type: "call",
      callInfo: { callType, status, duration: duration || 0 },
    });

    const previewText = callType === "video" ? "Video call" : "Voice call";
    conversation.lastMessage = previewText;
    conversation.lastMessageAt = new Date();

    conversation.participants.forEach((participantId) => {
      if (String(participantId) === String(req.user._id)) return;
      const alreadyUnread = conversation.unreadBy.some((id) => String(id) === String(participantId));
      if (!alreadyUnread) conversation.unreadBy.push(participantId);
    });

    await conversation.save();

    const populatedMessage = await message.populate("sender", "name avatar isVerified");

    conversation.participants.forEach((participantId) => {
      if (String(participantId) === String(req.user._id)) return;
      emitToUser(participantId, "newMessage", {
        ...populatedMessage.toObject(),
        conversation: conversation._id,
        isGroup: conversation.isGroup,
      });
      emitToUser(participantId, "conversationUpdated", {
        conversationId: conversation._id,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
      });
    });

    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(500).json({ message: "Could not log call", error: err.message });
  }
};

// @route  PATCH /api/conversations/:id/read (protected) - is conversation ko "read" mark karna
const markConversationRead = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: "This conversation does not belong to you" });
    }

    conversation.unreadBy = conversation.unreadBy.filter((id) => String(id) !== String(req.user._id));
    await conversation.save();

    res.json({ message: "Conversation marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Could not mark conversation as read", error: err.message });
  }
};

// @route  PATCH /api/conversations/:id/mute (protected) - is conversation ki notifications mute/unmute karna
const toggleMuteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: "This conversation does not belong to you" });
    }

    const alreadyMuted = conversation.mutedBy.some((id) => String(id) === String(req.user._id));
    if (alreadyMuted) {
      conversation.mutedBy = conversation.mutedBy.filter((id) => String(id) !== String(req.user._id));
    } else {
      conversation.mutedBy.push(req.user._id);
    }

    await conversation.save();
    res.json({ muted: !alreadyMuted });
  } catch (err) {
    res.status(500).json({ message: "Could not update mute setting", error: err.message });
  }
};

// @route  GET /api/conversations/unread-count (protected) - sidebar badge ke liye
const getUnreadConversationsCount = async (req, res) => {
  try {
    const count = await Conversation.countDocuments({
      participants: req.user._id,
      unreadBy: req.user._id,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Could not load unread count", error: err.message });
  }
};

module.exports = {
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
};
