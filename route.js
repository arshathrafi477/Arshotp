const express = require("express");
const router = express.Router();

// Test route (check working)
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Route is working ✅"
  });
});

// Generate code (OTP-like)
router.get("/generate-code", (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000); // 6-digit code

  res.json({
    success: true,
    code: code,
    message: "Code generated successfully"
  });
});

module.exports = router;
