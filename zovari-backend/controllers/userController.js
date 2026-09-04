const User = require("../models/User");
const Post = require("../models/Post");
const Subscription = require("../models/Subscription");
const { createNotification } = require("../utils/createNotification");
const { getExcludedAuthorIds } = require("../utils/blockHelpers");

// Profile links kabhi real ObjectId se banti hain (feed posts se), kabhi @username se
// (mentions se) - yeh helper dono ko sambhal leta hai
async function findUserByIdOrUsername(idOrUsername) {
  if (/^[0-9a-fA-F]{24}$/.test(idOrUsername)) {
    const user = await User.findById(idOrUsername);
    if (user) return user;
  }
  return User.findOne({ username: idOrUsername.toLowerCase() });
}

// @route  GET /api/users?limit=4  -> "Who to follow" / "Top Creators" suggestions
const getUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const filter = {};

    if (req.user) {
      // Khud ko, jinhe already follow karta hoon, aur block/mute wale rishtay - sab exclude
      const excludedIds = await getExcludedAuthorIds(req.user._id);
      filter._id = { $nin: [req.user._id, ...req.user.following, ...excludedIds] };
    }

    const users = await User.find(filter).select("name avatar bio followers isVerified").limit(limit);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Could not load users", error: err.message });
  }
};

// @route  GET /api/users/:id
const getUserProfile = async (req, res) => {
  try {
    const user = await findUserByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const viewerId = req.user ? String(req.user._id) : null;
    const isOwner = viewerId && viewerId === String(user._id);

    // Block state check karna - dono taraf se, aur khud ka bhi (jab tak owner na ho)
    let iBlockedThem = false;
    let theyBlockedMe = false;
    let iMutedThem = false;
    if (viewerId && !isOwner) {
      iBlockedThem = req.user.blockedUsers.some((id) => String(id) === String(user._id));
      theyBlockedMe = user.blockedUsers.some((id) => String(id) === viewerId);
      iMutedThem = req.user.mutedUsers.some((id) => String(id) === String(user._id));
    }

    // Viewer ne is (private) account ko follow request bheji hui hai ya nahi - button
    // "Requested" state me dikhane ke liye, safeUser se delete karne se pehle nikal lete hain
    const hasRequestedFollow =
      viewerId && !isOwner && user.followRequests.some((id) => String(id) === viewerId);

    // User document ko safe object me convert karte hain - blockedUsers/mutedUsers/followRequests
    // kisi doosre ko kabhi nahi dikhni chahiyen (privacy) - followRequests sirf owner ke apne
    // /users/me/follow-requests endpoint se milti hai
    const safeUser = user.toJSON();
    delete safeUser.blockedUsers;
    delete safeUser.mutedUsers;
    delete safeUser.followRequests;

    if (iBlockedThem || theyBlockedMe) {
      return res.json({
        user: safeUser,
        posts: [],
        isPrivateLocked: false,
        isBlocked: true,
        iBlockedThem,
        theyBlockedMe,
      });
    }

    const isFollower = viewerId && user.followers.some((id) => String(id) === viewerId);

    // Private account: sirf owner ya jo already follow karta hai woh posts dekh sakta hai
    if (user.isPrivate && !isOwner && !isFollower) {
      return res.json({
        user: safeUser,
        posts: [],
        isPrivateLocked: true,
        iMutedThem,
        hasRequestedFollow,
      });
    }

    const posts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .populate("author", "name avatar isVerified");

    res.json({ user: safeUser, posts, isPrivateLocked: false, iMutedThem, hasRequestedFollow });
  } catch (err) {
    res.status(500).json({ message: "Could not load profile", error: err.message });
  }
};

// @route  GET /api/users/:id/liked -> is user ne jo posts like ki hain (Profile ke "Likes" tab ke liye)
const getLikedPosts = async (req, res) => {
  try {
    const user = await findUserByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const viewerId = req.user ? String(req.user._id) : null;
    const isOwner = viewerId && viewerId === String(user._id);

    if (viewerId && !isOwner) {
      const blocked =
        req.user.blockedUsers.some((id) => String(id) === String(user._id)) ||
        user.blockedUsers.some((id) => String(id) === viewerId);
      if (blocked) return res.json([]);
    }

    const isFollower = viewerId && user.followers.some((id) => String(id) === viewerId);

    if (user.isPrivate && !isOwner && !isFollower) {
      return res.json([]);
    }

    const posts = await Post.find({ likes: user._id })
      .sort({ createdAt: -1 })
      .populate("author", "name avatar isVerified");

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Could not load liked posts", error: err.message });
  }
};

// @route  PATCH /api/users/me (protected) - settings page save button
const updateMe = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "bio",
      "avatar",
      "coverImage",
      "location",
      "isPrivate",
      "showActivityStatus",
      "notifyOnLikes",
      "notifyOnComments",
      "notifyOnFollows",
      "notifyOnMentions",
    ];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const wasPrivate = req.user.isPrivate;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    // Private se public account banaya to jitni pending follow requests thi sab
    // auto-accept ho jati hain - jaise Instagram me hota hai
    if (wasPrivate && user.isPrivate === false && user.followRequests.length > 0) {
      const pendingIds = user.followRequests.map((id) => String(id));
      user.followers.push(...user.followRequests);
      user.followRequests = [];
      await user.save();
      await User.updateMany(
        { _id: { $in: pendingIds } },
        { $addToSet: { following: user._id } }
      );
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

// @route  POST /api/users/:id/follow (protected) - toggle follow/unfollow/request
// Public account: seedha follow/unfollow, jaisa pehle tha.
// Private account: pehli baar click pe "follow request" jati hai (jab tak owner accept
// na kare tab tak follower nahi bante), dobara click karne se pending request cancel ho jati hai.
const toggleFollow = async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    // Block ho to follow/unfollow bhi nahi kar sakte
    const blocked =
      req.user.blockedUsers.some((id) => String(id) === targetId) ||
      targetUser.blockedUsers.some((id) => String(id) === String(req.user._id));
    if (blocked) {
      return res.status(403).json({ message: "You can't follow this user" });
    }

    const currentUser = req.user;
    const alreadyFollowing = currentUser.following.includes(targetId);

    // Already following ho to seedha unfollow - chahe account ab private ho ya na ho
    if (alreadyFollowing) {
      currentUser.following = currentUser.following.filter((id) => String(id) !== targetId);
      targetUser.followers = targetUser.followers.filter(
        (id) => String(id) !== String(currentUser._id)
      );
      await currentUser.save();
      await targetUser.save();

      return res.json({
        following: false,
        requested: false,
        followersCount: targetUser.followers.length,
      });
    }

    const alreadyRequested = targetUser.followRequests.some(
      (id) => String(id) === String(currentUser._id)
    );

    // Pehle se pending request thi - dobara click ka matlab hai request cancel karo
    if (alreadyRequested) {
      targetUser.followRequests = targetUser.followRequests.filter(
        (id) => String(id) !== String(currentUser._id)
      );
      await targetUser.save();

      return res.json({
        following: false,
        requested: false,
        followersCount: targetUser.followers.length,
      });
    }

    // Private account - direct follow nahi, request bhejni hai
    if (targetUser.isPrivate) {
      targetUser.followRequests.push(currentUser._id);
      await targetUser.save();

      await createNotification({
        recipient: targetUser._id,
        sender: currentUser._id,
        type: "follow_request",
      });

      return res.json({
        following: false,
        requested: true,
        followersCount: targetUser.followers.length,
      });
    }

    // Public account - seedha follow
    currentUser.following.push(targetId);
    targetUser.followers.push(currentUser._id);
    await currentUser.save();
    await targetUser.save();

    await createNotification({
      recipient: targetUser._id,
      sender: currentUser._id,
      type: "follow",
    });

    res.json({
      following: true,
      requested: false,
      followersCount: targetUser.followers.length,
    });
  } catch (err) {
    res.status(500).json({ message: "Follow/unfollow failed", error: err.message });
  }
};

// @route  GET /api/users/me/follow-requests (protected) - pending requests jo mujhe follow
// karna chahte hain (sirf tab meaningful hai jab mera account private ho)
const getFollowRequests = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).populate(
      "followRequests",
      "name avatar isVerified bio"
    );
    res.json(me.followRequests);
  } catch (err) {
    res.status(500).json({ message: "Could not load follow requests", error: err.message });
  }
};

// @route  POST /api/users/:id/follow-request/accept (protected) - :id = requester ka id
const acceptFollowRequest = async (req, res) => {
  try {
    const requesterId = req.params.id;
    const currentUser = req.user;

    const wasRequested = currentUser.followRequests.some(
      (id) => String(id) === requesterId
    );
    if (!wasRequested) {
      return res.status(404).json({ message: "No pending request from this user" });
    }

    const requester = await User.findById(requesterId);
    if (!requester) return res.status(404).json({ message: "User not found" });

    currentUser.followRequests = currentUser.followRequests.filter(
      (id) => String(id) !== requesterId
    );
    currentUser.followers.push(requester._id);
    requester.following.push(currentUser._id);

    await currentUser.save();
    await requester.save();

    await createNotification({
      recipient: requester._id,
      sender: currentUser._id,
      type: "follow_accept",
    });

    res.json({ accepted: true, followersCount: currentUser.followers.length });
  } catch (err) {
    res.status(500).json({ message: "Could not accept follow request", error: err.message });
  }
};

// @route  POST /api/users/:id/follow-request/reject (protected) - :id = requester ka id
const rejectFollowRequest = async (req, res) => {
  try {
    const requesterId = req.params.id;
    const currentUser = req.user;

    currentUser.followRequests = currentUser.followRequests.filter(
      (id) => String(id) !== requesterId
    );
    await currentUser.save();

    res.json({ rejected: true });
  } catch (err) {
    res.status(500).json({ message: "Could not reject follow request", error: err.message });
  }
};

// @route  POST /api/users/:id/block (protected) - toggle block/unblock
const toggleBlock = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const currentUser = req.user;
    const alreadyBlocked = currentUser.blockedUsers.some((id) => String(id) === targetId);

    if (alreadyBlocked) {
      currentUser.blockedUsers = currentUser.blockedUsers.filter((id) => String(id) !== targetId);
    } else {
      currentUser.blockedUsers.push(targetId);
      // Block karte hi follow relationship (aur pending follow requests) dono taraf se
      // khatam - jaise real apps me hota hai
      currentUser.following = currentUser.following.filter((id) => String(id) !== targetId);
      currentUser.followers = currentUser.followers.filter((id) => String(id) !== targetId);
      currentUser.followRequests = currentUser.followRequests.filter(
        (id) => String(id) !== targetId
      );
      targetUser.following = targetUser.following.filter(
        (id) => String(id) !== String(currentUser._id)
      );
      targetUser.followers = targetUser.followers.filter(
        (id) => String(id) !== String(currentUser._id)
      );
      targetUser.followRequests = targetUser.followRequests.filter(
        (id) => String(id) !== String(currentUser._id)
      );
      await targetUser.save();
    }

    await currentUser.save();
    res.json({ blocked: !alreadyBlocked });
  } catch (err) {
    res.status(500).json({ message: "Block/unblock failed", error: err.message });
  }
};

// @route  POST /api/users/:id/mute (protected) - toggle mute/unmute (sirf feed posts hide hoti hain)
const toggleMute = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot mute yourself" });
    }

    const currentUser = req.user;
    const alreadyMuted = currentUser.mutedUsers.some((id) => String(id) === targetId);

    if (alreadyMuted) {
      currentUser.mutedUsers = currentUser.mutedUsers.filter((id) => String(id) !== targetId);
    } else {
      currentUser.mutedUsers.push(targetId);
    }

    await currentUser.save();
    res.json({ muted: !alreadyMuted });
  } catch (err) {
    res.status(500).json({ message: "Mute/unmute failed", error: err.message });
  }
};

// @route  GET /api/users/me/blocked (protected) - Settings page ki "Blocked accounts" list
const getBlockedUsers = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).populate("blockedUsers", "name avatar isVerified");
    res.json(me.blockedUsers);
  } catch (err) {
    res.status(500).json({ message: "Could not load blocked accounts", error: err.message });
  }
};

const VERIFICATION_PRICES = { monthly: 11.99, yearly: 99.99 };

// @route  POST /api/users/me/verify (protected) - body: { plan, cardNumber, cardName, expiry, cvv }
// NOTE: Ye ek simulated checkout hai (college project scope) - koi real payment gateway
// nahi lagta, lekin poora flow (card validate karna, sirf last-4 store karna, subscription
// record banana) waisa hi hai jaisa real apps me hota hai
const subscribeVerification = async (req, res) => {
  try {
    const { plan, cardNumber, cardName, expiry, cvv } = req.body;

    if (!["monthly", "yearly"].includes(plan)) {
      return res.status(400).json({ message: "Plan must be monthly or yearly" });
    }

    const cleanCardNumber = (cardNumber || "").replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(cleanCardNumber)) {
      return res.status(400).json({ message: "Enter a valid card number" });
    }
    if (!cardName || !cardName.trim()) {
      return res.status(400).json({ message: "Name on card is required" });
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry || "")) {
      return res.status(400).json({ message: "Expiry must be in MM/YY format" });
    }
    if (!/^\d{3,4}$/.test(cvv || "")) {
      return res.status(400).json({ message: "Enter a valid CVV" });
    }

    const subscription = await Subscription.create({
      user: req.user._id,
      plan,
      amount: VERIFICATION_PRICES[plan],
      cardLast4: cleanCardNumber.slice(-4),
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isVerified: true, verifiedSince: new Date(), verificationPlan: plan },
      { new: true }
    );

    res.status(201).json({ user, subscription });
  } catch (err) {
    res.status(500).json({ message: "Could not process subscription", error: err.message });
  }
};

// @route  DELETE /api/users/me/verify (protected) - subscription cancel karna, badge hat jata hai
const cancelVerification = async (req, res) => {
  try {
    await Subscription.updateMany(
      { user: req.user._id, status: "active" },
      { status: "cancelled", cancelledAt: new Date() }
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isVerified: false, verificationPlan: null },
      { new: true }
    );

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Could not cancel subscription", error: err.message });
  }
};

// @route  GET /api/users/me/subscription (protected) - Settings page ke "Verification" section ke liye
const getMySubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ user: req.user._id, status: "active" }).sort({
      createdAt: -1,
    });
    res.json({ subscription: subscription || null });
  } catch (err) {
    res.status(500).json({ message: "Could not load subscription", error: err.message });
  }
};

module.exports = {
  getUsers,
  getUserProfile,
  getLikedPosts,
  updateMe,
  toggleFollow,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  toggleBlock,
  toggleMute,
  getBlockedUsers,
  subscribeVerification,
  cancelVerification,
  getMySubscription,
};