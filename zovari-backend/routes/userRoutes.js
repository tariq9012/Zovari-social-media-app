const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/userController");
const { protect, optionalAuth } = require("../middleware/auth");

router.get("/", optionalAuth, getUsers);
router.patch("/me", protect, updateMe);
router.get("/me/blocked", protect, getBlockedUsers);
router.get("/me/subscription", protect, getMySubscription);
router.get("/me/follow-requests", protect, getFollowRequests);
router.post("/me/verify", protect, subscribeVerification);
router.delete("/me/verify", protect, cancelVerification);
router.get("/:id/liked", optionalAuth, getLikedPosts);
router.get("/:id", optionalAuth, getUserProfile);
router.post("/:id/follow", protect, toggleFollow);
router.post("/:id/follow-request/accept", protect, acceptFollowRequest);
router.post("/:id/follow-request/reject", protect, rejectFollowRequest);
router.post("/:id/block", protect, toggleBlock);
router.post("/:id/mute", protect, toggleMute);

module.exports = router;