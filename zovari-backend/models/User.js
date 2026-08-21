const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // login ke ilawa kabhi bhi query me wapis na aaye
    },
    bio: {
      type: String,
      default: "",
      maxlength: 200,
    },
    location: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=facearea&facepad=2&w=200&h=200&q=80",
    },
    coverImage: {
      type: String,
      default: "",
    },
    followers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    following: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
  },
  { timestamps: true }
);

// Virtuals - counts frontend ke liye (followers.length wagera bhi seedha use ho sakta hai)
// Guard lagana zaroori hai: jab User kisi doosre document (jaise Post.author) me sirf
// name/avatar select kar ke populate hota hai, tab followers/following fields hi nahi
// aati is document me - is liye pehle check karte hain warna crash ho jata hai.
userSchema.virtual("followersCount").get(function () {
  return this.followers ? this.followers.length : undefined;
});
userSchema.virtual("followingCount").get(function () {
  return this.following ? this.following.length : undefined;
});

userSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("User", userSchema);