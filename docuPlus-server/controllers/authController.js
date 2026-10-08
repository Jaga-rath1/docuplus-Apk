const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Nodemailer Transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// JWT token generator helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "docupulse_jwt_super_secret", {
    expiresIn: "30d",
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists. Please log in.",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Registration successful!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during registration.",
    });
  }
};

// @desc    Login user & get token
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both email and password.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during login.",
    });
  }
};

// @desc    Get current user profile (Token validation)
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user profile.",
    });
  }
};

// @desc    Send 6-digit OTP to user email
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found registered with this email address.",
      });
    }

    // 6-digit OTP generation
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // SHA-256 hash for secure storage
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    user.resetPasswordToken = hashedOtp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    await user.save({ validateBeforeSave: false });

    // HTML Email template
    const html = `
      <div style="background:#070b13; color:#cfd7e6; padding:30px; font-family:sans-serif; border-radius:12px; max-width:480px; margin:auto; border:1px solid #1e293b;">
        <h2 style="color:#38bdf8; margin-top:0;">DocuPulse Vault Recovery</h2>
        <p style="font-size:13px; color:#94a3b8;">You requested a one-time verification code to reset your password. Use the verification code below:</p>
        <div style="text-align:center; margin:24px 0;">
          <span style="font-size:32px; font-weight:bold; letter-spacing:8px; color:#ffffff; background:#0f172a; padding:12px 24px; border-radius:8px; border:1px solid #0284c7; display:inline-block;">${otp}</span>
        </div>
        <p style="font-size:12px; color:#64748b;">This code is valid for <strong>10 minutes</strong>. If you did not initiate this request, you can safely ignore this email.</p>
      </div>
    `;

    // Dev Fallback check if EMAIL_PASS is missing
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`\n[DEV MODE] Password Reset Code for ${cleanEmail}: ${otp}\n`);
      return res.status(200).json({
        success: true,
        message: `Verification code generated (DEV Code: ${otp})`,
      });
    }

    // Send Real Email via Nodemailer
    await sendEmail({
      to: user.email,
      subject: "Your Verification Code - DocuPulse Password Reset",
      html,
    });

    return res.status(200).json({
      success: true,
      message: "A verification code has been sent to your email address.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send verification code.",
    });
  }
};

// @desc    Verify OTP and Set New Password
// @route   POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, verification code, and new password are all required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const hashedOtp = crypto.createHash("sha256").update(otp.trim()).digest("hex");

    const user = await User.findOne({
      email: cleanEmail,
      resetPasswordToken: hashedOtp,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code.",
      });
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate fresh token for automatic authentication
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reset password.",
    });
  }
};

// @desc    Google Sign-In / Sign-Up
// @route   POST /api/auth/google
const googleAuth = async (req, res) => {
  try {
    const { name, email, googleId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required for Google Sign-In.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    // Create a new user if one does not already exist
    if (!user) {
      const generatedPassword = crypto.randomBytes(16).toString("hex");
      user = await User.create({
        name: name || "Google User",
        email: cleanEmail,
        password: generatedPassword,
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Google authentication successful!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process Google authentication.",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
  googleAuth,
};