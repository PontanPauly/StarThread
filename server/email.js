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

function getLogoUrl() {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || '';
  if (domain) return `https://${domain.split(',')[0]}/logo.png`;
  return '';
}

function emailWrapper(bodyContent) {
  const logoUrl = getLogoUrl();
  const year = new Date().getFullYear();

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="StarThread" width="48" height="48" style="display:inline-block;width:48px;height:48px;vertical-align:middle;margin-right:12px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0F172A;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

      <!-- Header -->
      <tr><td align="center" style="padding:32px 32px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="vertical-align:middle;">
              ${logoBlock}<span style="font-size:28px;font-weight:700;color:#FBBF24;vertical-align:middle;letter-spacing:0.3px;">StarThread</span>
            </td>
          </tr>
        </table>
        <p style="margin:10px 0 0;font-size:12px;color:#64748B;letter-spacing:2.5px;text-transform:uppercase;">Every Family Is a Galaxy of Stars</p>
      </td></tr>

      <!-- Gold accent line -->
      <tr><td style="padding:0 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#FBBF24,transparent);font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:28px 40px 0;">
        ${bodyContent}
      </td></tr>

      <!-- Footer divider -->
      <tr><td style="padding:32px 48px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#334155,transparent);font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:24px 32px 36px;">
        <p style="margin:0;font-size:13px;color:#64748B;">See you among the stars</p>
        <p style="margin:8px 0 0;font-size:11px;color:#334155;">&copy; ${year} StarThread</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function ctaButton(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 8px;">
  <tr>
    <td align="center" style="border-radius:10px;background-color:#FBBF24;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#0F172A;text-decoration:none;border-radius:10px;">${label}</a>
    </td>
  </tr>
</table>`;
}

export async function sendAccountReadyEmail(toEmail, childName, parentName, registerUrl) {
  const mailer = getTransporter();

  if (!mailer) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[EMAIL] SMTP not configured in production - account ready email not sent.');
    } else {
      console.warn('[EMAIL] SMTP not configured - logging account ready email to console (dev only).');
      console.log(`[ACCOUNT READY] Email for ${childName} (${toEmail}): ${registerUrl}`);
    }
    return false;
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  const bodyContent = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1E293B;border-radius:12px;">
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 6px;font-size:21px;color:#F1F5F9;font-weight:600;text-align:center;">Welcome, ${childName}</h2>
    <p style="margin:0 0 24px;font-size:13px;color:#FBBF24;text-align:center;letter-spacing:1px;">Your star is ready to shine</p>
    <p style="margin:0 0 12px;font-size:15px;color:#CBD5E1;line-height:1.7;text-align:center;">
      <strong style="color:#E2E8F0;">${parentName}</strong> has created a place for you on StarThread.
    </p>
    <p style="margin:0;font-size:15px;color:#94A3B8;line-height:1.7;text-align:center;">
      Your family is already connected and your star is shining in the universe. Now it's time to make it yours.
    </p>
    ${ctaButton(registerUrl, 'Join Your Family')}
  </td></tr>
</table>`;

  await mailer.sendMail({
    from: `"StarThread" <${fromAddress}>`,
    to: toEmail,
    subject: `${childName}, your family is waiting for you on StarThread`,
    text: `Hi ${childName}!\n\n${parentName} has created a place for you on StarThread. Your family is already connected and your star is shining in the universe. Now it's time to make it yours.\n\nJoin your family here:\n${registerUrl}\n\nSee you among the stars!\n- StarThread`,
    html: emailWrapper(bodyContent),
  });

  return true;
}

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const mailer = getTransporter();

  if (!mailer) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[EMAIL] SMTP not configured in production - password reset email not sent.');
    } else {
      console.warn('[EMAIL] SMTP not configured - logging reset link to console (dev only).');
      console.log(`[PASSWORD RESET] Reset link for ${toEmail}: ${resetUrl}`);
    }
    return false;
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  const bodyContent = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1E293B;border-radius:12px;">
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;font-size:21px;color:#F1F5F9;font-weight:600;text-align:center;">Reset Your Password</h2>
    <p style="margin:0;font-size:15px;color:#CBD5E1;line-height:1.7;text-align:center;">
      We received a request to reset your password. Tap the button below to choose a new one.
    </p>
    ${ctaButton(resetUrl, 'Reset Password')}
  </td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
  <tr><td style="padding:14px 20px;text-align:center;background-color:#1E293B;border-radius:10px;">
    <p style="margin:0 0 2px;font-size:12px;color:#94A3B8;">This link expires in <strong style="color:#FBBF24;">1 hour</strong></p>
    <p style="margin:0;font-size:12px;color:#475569;">If you didn't request this, you can safely ignore this email.</p>
  </td></tr>
</table>`;

  await mailer.sendMail({
    from: `"StarThread" <${fromAddress}>`,
    to: toEmail,
    subject: 'Reset your StarThread password',
    text: `You requested a password reset for your StarThread account.\n\nClick the link below to set a new password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n- StarThread`,
    html: emailWrapper(bodyContent),
  });

  return true;
}
