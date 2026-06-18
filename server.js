require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// ── OTP Store ────────────────────────────────────────────────────────────────
const otpStore = new Map();

// ── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ status: "OTP Server Running" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Generate 6 digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    // Save OTP
    otpStore.set(email, { otp, expiresAt });

    // Send Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      html: `
        <h2>Your OTP Code</h2>
        <h1 style="color:#4f46e5;letter-spacing:8px;">${otp}</h1>
        <p>Expires in 10 minutes. Do not share this code.</p>
      `,
    });

    return res.json({ success: true, message: "OTP sent to " + email });

  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP required" });
  }

  const record = otpStore.get(email);

  if (!record) {
    return res.status(400).json({ success: false, message: "No OTP found for this email" });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ success: false, message: "OTP expired" });
  }

  if (record.otp !== String(otp)) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  otpStore.delete(email);
  return res.json({ success: true, message: "OTP verified successfully" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
