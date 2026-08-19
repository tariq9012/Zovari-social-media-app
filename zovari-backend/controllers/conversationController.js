const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// @route  GET /api/conversations (protected) -> current user ki sari conversations, latest pehle
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name avatar");

    // Response me "otherUser" nikal kar bhej dete hain taake frontend ko khud filter na karna paray
    const formatted = conversations.map((conv) => {
      const otherUser = conv.participants.find(
        (p) => String(p._id) !== String(req.user._id)
      );
      return {
        _id: conv._id,
        otherUser,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Could not load conversations", error: err.message });
  }
};

// @route  POST /api/conversations (protected) -> { userId } ke sath conversation start/find karna
const startConversation = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });
    if (userId === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot message yourself" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, userId], $size: 2 },
    }).populate("participants", "name avatar");

    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.user._id, userId] });
      conversation = await conversation.populate("participants", "name avatar");
    }

    const otherUser = conversation.participants.find(
      (p) => String(p._id) !== String(req.user._id)
    );

    res.status(201).json({
      _id: conversation._id,
      otherUser,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not start conversation", error: err.message });
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
      .populate("sender", "name avatar");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Could not load messages", error: err.message });
  }
};

// @route  POST /api/conversations/:id/messages (protected)
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

    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user._id,
      text: text.trim(),
    });

    conversation.lastMessage = text.trim();
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populatedMessage = await message.populate("sender", "name avatar");
    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(500).json({ message: "Could not send message", error: err.message });
  }
};

module.exports = { getConversations, startConversation, getMessages, sendMessage };
