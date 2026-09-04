const multer = require("multer");

// Memory me file rakhte hain (disk pe save nahi karte) - seedha Cloudinary ko stream kar dete hain
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image or video files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB max (videos zyada bhaari hote hain images se)
});

module.exports = upload;
