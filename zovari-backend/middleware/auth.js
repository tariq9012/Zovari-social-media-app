const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Yeh middleware protected routes ke liye hai - token check karta hai
// aur req.user me logged-in user daal deta hai
const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, login required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

// Yeh un routes ke liye hai jo bagair login ke bhi chal saktay hain,
// lekin agar token mojood ho to req.user set kar deta hai (extra personalization ke liye)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    } catch (err) {
      // invalid/expired token - bas ignore karke aage barh jao, error mat do
    }
  }
  next();
};

module.exports = { protect, optionalAuth };
