const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  // 1. If RESEND_API_KEY is configured, use HTTP API (Works 100% on Render Free Tier!)
  if (process.env.RESEND_API_KEY) {
    try {
      console.log("Attempting email dispatch via Resend HTTPS API (Port 443)...");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "DocuPulse <onboarding@resend.dev>",
          to: [to],
          subject: subject,
          html: html,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log("✅ Email sent successfully via Resend API:", data);
        return data;
      }
      const errData = await res.text();
      console.warn("Resend API responded with error:", errData);
    } catch (resendErr) {
      console.error("Resend API call error:", resendErr.message);
    }
  }

  // 2. Nodemailer SMTP (Gmail) with strict 5-second timeout
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("EMAIL_USER or EMAIL_PASS environment variables are missing.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: user,
      pass: pass,
    },
    // Strict 5-second connection timeout prevents Render from hanging
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  const mailOptions = {
    from: `"DocuPulse Vault" <${user}>`,
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

module.exports = sendEmail;