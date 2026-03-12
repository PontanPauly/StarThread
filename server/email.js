import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendAccountReadyEmail(toEmail, childName, parentName, registerUrl) {
  const mailer = getTransporter();

  if (!mailer) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[EMAIL] SMTP not configured in production — account ready email not sent.');
    } else {
      console.warn('[EMAIL] SMTP not configured — logging account ready email to console (dev only).');
      console.log(`[ACCOUNT READY] Email for ${childName} (${toEmail}): ${registerUrl}`);
    }
    return false;
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  await mailer.sendMail({
    from: `"StarThread" <${fromAddress}>`,
    to: toEmail,
    subject: `${childName}, Your StarThread Account is Ready!`,
    text: `Hi ${childName}!\n\n${parentName} has set up a StarThread account for you. StarThread is where your family connects, shares moments, and keeps their stories alive.\n\nClick the link below to create your account and join your family's universe:\n${registerUrl}\n\nSee you among the stars!\n\n— The StarThread Team`,
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f59e0b;font-size:24px;margin:0;">StarThread</h1>
          <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">Every family is a galaxy of stories</p>
        </div>
        <div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:24px;">
          <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 12px;">Welcome, ${childName}!</h2>
          <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 8px;">
            ${parentName} has set up a StarThread account for you.
          </p>
          <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 20px;">
            StarThread is where your family connects, shares moments, and keeps their stories alive. Your star is already shining in your family's universe — now it's time to make it yours.
          </p>
          <div style="text-align:center;">
            <a href="${registerUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">
              Create My Account
            </a>
          </div>
        </div>
        <p style="color:#64748b;font-size:12px;text-align:center;margin:0;">
          See you among the stars!
        </p>
        <p style="color:#475569;font-size:11px;text-align:center;margin:8px 0 0;">
          — The StarThread Team
        </p>
      </div>
    `,
  });

  return true;
}

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const mailer = getTransporter();

  if (!mailer) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[EMAIL] SMTP not configured in production — password reset email not sent.');
    } else {
      console.warn('[EMAIL] SMTP not configured — logging reset link to console (dev only).');
      console.log(`[PASSWORD RESET] Reset link for ${toEmail}: ${resetUrl}`);
    }
    return false;
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  await mailer.sendMail({
    from: `"StarThread" <${fromAddress}>`,
    to: toEmail,
    subject: 'Reset Your StarThread Password',
    text: `You requested a password reset for your StarThread account.\n\nClick the link below to set a new password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f59e0b;font-size:24px;margin:0;">StarThread</h1>
          <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">Every family is a galaxy of stories</p>
        </div>
        <div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:24px;">
          <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 12px;">Password Reset</h2>
          <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 20px;">
            You requested a password reset for your account. Click the button below to choose a new password.
          </p>
          <div style="text-align:center;">
            <a href="${resetUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">
              Reset Password
            </a>
          </div>
          <p style="color:#64748b;font-size:12px;margin:16px 0 0;text-align:center;">
            This link expires in 1 hour.
          </p>
        </div>
        <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
          If you didn't request this reset, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  return true;
}
