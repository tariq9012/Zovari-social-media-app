const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // "text" = normal message, "call" = voice/video call ka log entry (WhatsApp jaisa)
    type: {
      type: String,
      enum: ["text", "call"],
      default: "text",
    },
    text: {
      type: String,
      maxlength: 1000,
      required: function () {
        return this.type === "text"; // call log messages ke liye text zaroori nahi
      },
    },
    callInfo: {
      callType: { type: String, enum: ["audio", "video"] },
      status: { type: String, enum: ["completed", "missed", "rejected", "cancelled"] },
      duration: { type: Number, default: 0 }, // seconds, sirf "completed" ke liye
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
