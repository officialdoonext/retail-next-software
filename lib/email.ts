import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "465", 10),
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "official.doonext@gmail.com",
    pass: process.env.SMTP_PASS || "kvvmyoypzrtdgwjq",
  },
});

export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<boolean> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
          .brand { color: #5e2b9d; font-size: 20px; font-weight: 700; margin-bottom: 20px; letter-spacing: -0.5px; }
          .title { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
          .desc { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
          .otp-box { background: #f4ecfc; border: 1px dashed #5e2b9d; border-radius: 6px; padding: 18px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #5e2b9d; margin: 0; font-family: monospace; }
          .note { font-size: 11px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          .footer { font-size: 10px; color: #cbd5e1; text-align: center; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand">RetailNext</div>
          <div class="title">Your One-Time Login Code</div>
          <div class="desc">You requested an administrator login verification code for RetailNext. Use the code below to complete your sign-in:</div>
          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
          </div>
          <div class="note">
            This verification code is valid for <strong>10 minutes</strong>. Do not share this OTP with anyone.<br/>
            If you did not request this login attempt, please ignore this email.
          </div>
        </div>
        <div class="footer">
          RetailNext Software &bull; Powered by Doonext &bull; Secure Authentication Service
        </div>
      </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `RetailNext <official.doonext@gmail.com>`,
      to: toEmail,
      subject: `Your RetailNext Login Code: ${otpCode}`,
      text: `Your RetailNext login code is: ${otpCode}. It is valid for 10 minutes.`,
      html: htmlContent,
    });
    return true;
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    return false;
  }
}
