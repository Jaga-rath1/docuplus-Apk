const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
  googleAuth,
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

// Public endpoints
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/google", googleAuth);
// Protected endpoint
router.get("/me", protect, getMe);

module.exports = router;