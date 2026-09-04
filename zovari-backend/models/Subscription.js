const mongoose = require("mongoose");

// Ye ek simulated/mock payment record hai - college project ke scope me real payment
// gateway (Stripe wagera) integrate nahi kiya, lekin poora flow (checkout form, plan,
// card ka sirf last-4, subscription history) waisa hi hai jaisa real apps me hota hai.
const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    // Kabhi bhi poora card number store nahi karte - sirf last 4 digits, display ke liye
    cardLast4: {
      type: String,
      required: true,
      maxlength: 4,
    },
    cardBrand: {
      type: String,
      default: "Card",
    },
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
    },
    cancelledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
