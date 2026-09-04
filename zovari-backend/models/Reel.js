const mongoose = require("mongoose");

const REACTION_TYPES = ["like", "love", "haha", "wow", "sad", "angry"];

const reelSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      default: "",
      maxlength: 300,
    },
    hashtags: {
      type: [String],
      default: [],
    },
    // Facebook jaisi multi-emoji reactions - har user ki ek hi reaction ho sakti hai
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        type: { type: String, enum: REACTION_TYPES, default: "like" },
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

reelSchema.virtual("reactionsCount").get(function () {
  return this.reactions ? this.reactions.length : 0; // partial populate ke liye safe fallback
});

reelSchema.set("toJSON", { virtuals: true });

reelSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Reel", reelSchema);
module.exports.REACTION_TYPES = REACTION_TYPES;
