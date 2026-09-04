const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      sparse: true, // purane test users jinke paas username nahi hai unke beech conflict na ho
      lowercase: true,
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
    isPrivate: {
      type: Boolean,
      default: false,
    },
    showActivityStatus: {
      type: Boolean,
      default: true,
    },
    notifyOnLikes: {
      type: Boolean,
      default: true,
    },
    notifyOnComments: {
      type: Boolean,
      default: true,
    },
    notifyOnFollows: {
      type: Boolean,
      default: true,
    },
    notifyOnMentions: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifyToken: {
      type: String,
      select: false,
    },
    emailVerifyExpires: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
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
    // Blocked user na tumhe message/comment/call kar sakta hai na tumhari profile/posts dekh sakta hai (dono taraf se)
    blockedUsers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    // Private account ke liye pending follow requests - jo log follow karna chahte hain
    // lekin abhi tak accept/reject nahi hue (isPrivate false ho to yeh hamesha empty rehti hai)
    followRequests: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    // Bookmark/saved posts - order push hone ke hisaab se hai (naya save hamesha end mein),
    // taake "recently saved" order UI mein easily nikal sake
    savedPosts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    ],
    // Saved reels bhi savedPosts jaisa hi pattern - naya save hamesha end mein
    savedReels: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Reel" },
    ],
    // Muted user ko pata nahi chalta, bas uski posts/reels/stories tumhari feed me nahi aatin
    mutedUsers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    // Verified badge - paid subscription se milta hai (Settings > Verification)
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedSince: {
      type: Date,
    },
    verificationPlan: {
      type: String,
      enum: ["monthly", "yearly", null],
      default: null,
    },
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