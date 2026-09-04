const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { generateUniqueUsername } = require("../utils/generateUsername");
const { generateToken: generateSecureToken, hashToken } = require("../utils/tokenUtils");
const sendEmail = require("../utils/sendEmail");

// JWT token generate karne ka helper (login session ke liye - naam token generate karne wale
// upar wale secure token se mix na ho isliye alag naam diya hai)
const generateJwt = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// CLIENT_URL agar set nahi hai to localhost Live Server default maan lete hain
const CLIENT_URL = process.env.CLIENT_URL || "http://127.0.0.1:5500";

// @route  POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are all required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "This email is already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const username = await generateUniqueUsername(name);

    const { rawToken, hashedToken } = generateSecureToken();

    const user = await User.create({
      name,
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      emailVerifyToken: hashedToken,
      emailVerifyExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 ghante
    });

    res.status(201).json({
      token: generateJwt(user._id),
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        isEmailVerified: user.isEmailVerified,
      },
    });

    // Response bhej dene ke baad email bhejte hain - agar email fail bhi ho jaye to
    // signup process pe koi asar nahi parta (bas user unverified reh jata hai)
    try {
      const verifyLink = `${CLIENT_URL}/verify-email.html?token=${rawToken}`;
      await sendEmail({
        to: user.email,
        subject: "Verify your Zovari account",
        html: `<p>Hi ${name},</p><p>Welcome to Zovari! Please verify your email by clicking the link below:</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>This link expires in 24 hours.</p>`,
      });
    } catch (emailErr) {
      console.warn("Verification email bhej nahi saka:", emailErr.message);
    }
  } catch (err) {
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
};

// @route  POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are both required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      token: generateJwt(user._id),
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

// @route  GET /api/auth/me (protected)
const getMe = async (req, res) => {
  res.json(req.user);
};

// @route  GET /api/auth/verify-email/:token
const verifyEmail = async (req, res) => {
  try {
    const hashedToken = hashToken(req.params.token);

    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpires: { $gt: Date.now() },
    }).select("+emailVerifyToken +emailVerifyExpires");

    if (!user) {
      return res.status(400).json({ message: "Verification link is invalid or has expired" });
    }

    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    res.status(500).json({ message: "Verification failed", error: err.message });
  }
};

// @route  POST /api/auth/resend-verification (protected)
const resendVerification = async (req, res) => {
  try {
    if (req.user.isEmailVerified) {
      return res.status(400).json({ message: "Your email is already verified" });
    }

    const { rawToken, hashedToken } = generateSecureToken();
    req.user.emailVerifyToken = hashedToken;
    req.user.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;
    await req.user.save();

    const verifyLink = `${CLIENT_URL}/verify-email.html?token=${rawToken}`;
    await sendEmail({
      to: req.user.email,
      subject: "Verify your Zovari account",
      html: `<p>Hi ${req.user.name},</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>This link expires in 24 hours.</p>`,
    });

    res.json({ message: "Verification email sent" });
  } catch (err) {
    res.status(500).json({ message: "Could not send verification email", error: err.message });
  }
};

// @route  POST /api/auth/forgot-password - body: { email }
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });

    // Security: chahe email exist kare ya na kare, hamesha yehi generic message dete hain
    // (warna koi bhi try kar ke pata laga sakta hai kaunsi emails registered hain)
    const genericResponse = { message: "If that email is registered, a reset link has been sent." };

    if (!user) return res.json(genericResponse);

    const { rawToken, hashedToken } = generateSecureToken();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 ghanta
    await user.save();

    try {
      const resetLink = `${CLIENT_URL}/reset-password.html?token=${rawToken}`;
      await sendEmail({
        to: user.email,
        subject: "Reset your Zovari password",
        html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      });
    } catch (emailErr) {
      console.warn("Reset email bhej nahi saka:", emailErr.message);
    }

    res.json(genericResponse);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// @route  POST /api/auth/reset-password - body: { token, password }
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: "Could not reset password", error: err.message });
  }
};

module.exports = { signup, login, getMe, verifyEmail, resendVerification, forgotPassword, resetPassword };
