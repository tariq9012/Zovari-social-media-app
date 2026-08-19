const express = require("express");
const router = express.Router();
const { getUsers, getUserProfile, updateMe, toggleFollow } = require("../controllers/userController");
const { protect, optionalAuth } = require("../middleware/auth");

router.get("/", optionalAuth, getUsers);
router.patch("/me", protect, updateMe);
router.get("/:id", getUserProfile);
router.post("/:id/follow", protect, toggleFollow);

module.exports = router;
