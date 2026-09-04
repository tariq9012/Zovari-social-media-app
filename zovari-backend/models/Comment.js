const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    // Comment ya to kisi Post pe hoga ya kisi Reel pe - dono me se ek hi set hota hai
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Comment text is required"],
      maxlength: 500,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null, // null = top-level comment, warna yeh kisi comment ka reply hai
    },
    likes: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
  },
  { timestamps: true }
);

commentSchema.virtual("likesCount").get(function () {
  return this.likes ? this.likes.length : 0; // partial populate ke liye safe fallback
});

commentSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Comment", commentSchema);
