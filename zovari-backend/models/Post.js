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
      default: "",
      maxlength: 2000,
    },
    image: {
      type: String,
      default: "", // purane posts ke liye rakha hai (backward compatibility), naye posts "images" use karte hain
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 4,
        message: "Maximum 4 images per post",
      },
    },
    video: {
      type: String,
      default: "",
    },
    hashtags: {
      type: [String],
      default: [],
    },
    likes: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    // Analytics ke liye - kis kis ne dekha (reach = unique count) aur kitni baar dekha gaya (impressions)
    viewedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    impressions: {
      type: Number,
      default: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

postSchema.virtual("likesCount").get(function () {
  // Jab post sirf kuch fields ke sath populate ki jati hai (jaise notifications me
  // sirf "text"), tab "likes" field select hi nahi hoti aur undefined hoti hai -
  // is liye yahan safe fallback zaroori hai warna JSON serialize karte waqt crash ho jata hai
  return this.likes ? this.likes.length : 0;
});

postSchema.virtual("reachCount").get(function () {
  return this.viewedBy ? this.viewedBy.length : 0;
});

postSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    // viewedBy sirf analytics endpoint ke through hi dikhni chahiye, feed me har post
    // ke sath bhejna fizool aur privacy ke lihaz se ghalat hai (kisne dekha ye info)
    delete ret.viewedBy;
    return ret;
  },
});

module.exports = mongoose.model("Post", postSchema);