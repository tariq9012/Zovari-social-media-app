const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: [true, "Post text is required"],
      maxlength: 2000,
    },
    image: {
      type: String,
      default: "",
    },
    likes: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
  },
  { timestamps: true }
);

postSchema.virtual("likesCount").get(function () {
  return this.likes.length;
});

postSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Post", postSchema);
