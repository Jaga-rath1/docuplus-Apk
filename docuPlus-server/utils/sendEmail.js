const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.replace(/\s+/g, ""); // Strips any unintentional spaces

  console.log("---------------- EMAIL DIAGNOSTICS ----------------");
  console.log("EMAIL_USER:", user);
  console.log("EMAIL_PASS length:", pass ? pass.length : 0);
  console.log("---------------------------------------------------");

  const transporter = nodemailer.createTransport({
    service: "gmail", // Using service: 'gmail' automatically configures optimal ports and hosts
    auth: {
      user: user,
      pass: pass,
    },
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