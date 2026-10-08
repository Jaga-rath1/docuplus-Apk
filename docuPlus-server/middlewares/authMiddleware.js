const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Token nahi mila, kripya login karein.",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "docupulse_jwt_super_secret"
    );
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User account exist nahi karta.",
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token invalid ya expire ho chuka hai.",
    });
  }
};

module.exports = { protect };