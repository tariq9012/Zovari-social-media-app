const express = require("express");
const router = express.Router();
const { uploadImage } = require("../controllers/uploadController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.post("/", protect, upload.single("image"), uploadImage);

module.exports = router;
