const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    // Jin participants ne is conversation ka naya message abhi tak nahi dekha (badge count ke liye)
    unreadBy: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    // Jinhone is conversation ki notifications mute kar rakhi hain
    mutedBy: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    // ---- Group chat fields (1-to-1 conversations ke liye ye sab empty/false rehte hain) ----
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      default: "",
      maxlength: 60,
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
