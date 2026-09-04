const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    text: {
      type: String,
      default: "",
      maxlength: 200,
    },
    viewers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    // 24 ghante baad ye document khud MongoDB se delete ho jata hai (TTL index neeche)
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

storySchema.virtual("viewersCount").get(function () {
  return this.viewers ? this.viewers.length : 0; // partial populate ke liye safe fallback
});

storySchema.set("toJSON", { virtuals: true });

// TTL index - MongoDB har ~60 second me expiresAt check karta hai aur expired
// documents khud-ba-khud delete kar deta hai (expireAfterSeconds: 0 matlab
// expiresAt ki value hi deletion time hai)
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model("Story", storySchema);
