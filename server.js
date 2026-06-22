const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory OTP store: email -> { otp, expiresAt, attempts }
const otpStore = new Map();

// Mailtrap SMTP transporter
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "3cd451b1bab3d4",
    pass: "6528de2babe567"
  }
});

// Verify transporter connection on startup
transporter.verify((err) => {
  if (err) {
    console.error('❌ Mailtrap connection failed:', err.message);
  } else {
    console.log('✅ Mailtrap SMTP connected');
  }
});

// ─── POST /api/send-otp ───────────────────────────────────────────────────────
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }

  // Rate limit: block if a valid OTP was sent in the last 60 seconds
  const existing = otpStore.get(email);
  if (existing && existing.expiresAt - Date.now() > 4 * 60 * 1000) {
    return res.status(429).json({ error: 'Please wait before requesting a new code.' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  otpStore.set(email, { otp, expiresAt, attempts: 0 });

  // Auto-cleanup after expiry
  setTimeout(() => {
    const entry = otpStore.get(email);
    if (entry && entry.otp === otp) otpStore.delete(email);
  }, 5 * 60 * 1000);

  try {
    await transporter.sendMail({
      from: '"MyApp Security" <no-reply@myapp.com>',
      to: email,
      subject: `${otp} is your verification code`,
      text: `Your OTP is: ${otp}\n\nThis code expires in 5 minutes.\nIf you did not request this, ignore this email.`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#111;">Verification code</h2>
          <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Enter this code to verify your email address.</p>
          <div style="background:#f9fafb;border-radius:8px;padding:20px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:700;color:#111;">${otp}</div>
          <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">Expires in 5 minutes. Do not share this code.</p>
        </div>
      `
    });

    console.log(`📧 OTP sent to ${email}`);
    res.json({ success: true, message: 'OTP sent successfully.' });

  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    otpStore.delete(email);
    res.status(500).json({ error: 'Failed to send OTP. Try again.' });
  }
});

// ─── POST /api/verify-otp ─────────────────────────────────────────────────────
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  const record = otpStore.get(email);

  if (!record) {
    return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  // Max 5 attempts
  if (record.attempts >= 5) {
    otpStore.delete(email);
    return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
  }

  if (record.otp !== otp.toString().trim()) {
    record.attempts++;
    const left = 5 - record.attempts;
    return res.status(400).json({
      error: `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} remaining.`
    });
  }

  // ✅ Valid
  otpStore.delete(email);
  console.log(`✅ OTP verified for ${email}`);
  res.json({ success: true, message: 'Email verified successfully.' });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 OTP server running at http://localhost:${PORT}`);
});
