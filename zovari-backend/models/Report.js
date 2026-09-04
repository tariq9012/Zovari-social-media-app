const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Sirf ek hi set hota hai - jis cheez ki report ho rahi hai
    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
    reason: {
      type: String,
      default: "",
      maxlength: 300,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
