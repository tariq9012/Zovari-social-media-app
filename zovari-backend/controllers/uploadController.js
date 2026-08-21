const cloudinary = require("../config/cloudinary");

// @route  POST /api/upload (protected) - form-data field name: "image"
// Frontend pehle isay call karta hai, jo URL wapis milta hai wahi post/avatar me use hota hai
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file was sent" });
    }

    // Buffer ko ek upload_stream ke zariye Cloudinary bhejte hain (disk pe save kiye bagair)
    const streamUpload = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "zovari", resource_type: "image" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        stream.end(req.file.buffer);
      });

    const result = await streamUpload();
    res.status(201).json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ message: "Image upload failed", error: err.message });
  }
};

module.exports = { uploadImage };
