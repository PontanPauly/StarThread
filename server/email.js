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

function emailWrapper(bodyContent) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StarThread</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Nebula glow effect (top) -->
          <tr>
            <td align="center" style="padding-bottom:0;line-height:0;">
              <div style="width:280px;height:4px;border-radius:4px;background:linear-gradient(90deg,transparent,#7C3AED,#FBBF24,#7C3AED,transparent);"></div>
            </td>
          </tr>

          <!-- Main container -->
          <tr>
            <td style="background:linear-gradient(180deg,#0F172A 0%,#0A0E1A 60%,#050208 100%);border-radius:20px;border:1px solid rgba(251,191,36,0.15);overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Header with star decoration -->
                <tr>
                  <td style="padding:40px 40px 24px;text-align:center;background:linear-gradient(180deg,rgba(124,58,237,0.08) 0%,transparent 100%);">
                    <!-- Star cluster decoration -->
                    <div style="margin-bottom:16px;font-size:20px;letter-spacing:12px;opacity:0.6;">&#10022; &#10023; &#10022;</div>
                    <!-- Logo -->
                    <h1 style="margin:0;font-size:32px;font-weight:700;letter-spacing:1px;">
                      <span style="color:#FBBF24;">Star</span><span style="color:#60A5FA;">Thread</span>
                    </h1>
                    <p style="margin:6px 0 0;font-size:13px;color:#94A3B8;letter-spacing:2px;text-transform:uppercase;">Every family is a galaxy of stories</p>
                    <!-- Divider line -->
                    <div style="margin-top:24px;height:1px;background:linear-gradient(90deg,transparent,rgba(251,191,36,0.3),transparent);"></div>
                  </td>
                </tr>

                <!-- Body content -->
                <tr>
                  <td style="padding:0 40px;">
                    ${bodyContent}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:32px 40px 40px;text-align:center;">
                    <!-- Divider -->
                    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(100,116,139,0.3),transparent);margin-bottom:24px;"></div>
                    <!-- Star decoration -->
                    <div style="font-size:14px;letter-spacing:8px;opacity:0.4;margin-bottom:12px;">&#10023; &#10022; &#10023;</div>
                    <p style="margin:0;font-size:12px;color:#64748B;">See you among the stars!</p>
                    <p style="margin:8px 0 0;font-size:11px;color:#475569;">
                      &copy; ${new Date().getFullYear()} StarThread &middot; Connecting families across the universe
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Nebula glow effect (bottom) -->
          <tr>
            <td align="center" style="padding-top:0;line-height:0;">
              <div style="width:200px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,#60A5FA,transparent);"></div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href, label) {
  return `
    <div style="text-align:center;margin:28px 0 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="border-radius:10px;background:linear-gradient(135deg,#FBBF24 0%,#F59E0B 50%,#D97706 100%);box-shadow:0 4px 24px rgba(251,191,36,0.3);">
            <a href="${href}" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#0F172A;text-decoration:none;letter-spacing:0.5px;">
              ${label}
            </a>
          </td>
        </tr>
      </table>
    </div>`;
}

function glassCard(content) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:linear-gradient(135deg,rgba(30,41,59,0.9) 0%,rgba(15,23,42,0.7) 100%);border:1px solid rgba(251,191,36,0.12);border-radius:14px;padding:28px;">
          ${content}
        </td>
      </tr>
    </table>`;
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

  const bodyContent = `
    ${glassCard(`
      <h2 style="margin:0 0 4px;font-size:22px;color:#F1F5F9;font-weight:600;">Welcome, ${childName}!</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#FBBF24;">Your star is ready to shine</p>
      <p style="margin:0 0 12px;font-size:15px;color:#CBD5E1;line-height:1.7;">
        <span style="color:#E2E8F0;font-weight:500;">${parentName}</span> has set up a StarThread account for you.
      </p>
      <p style="margin:0;font-size:15px;color:#CBD5E1;line-height:1.7;">
        StarThread is where your family connects, shares moments, and keeps their stories alive. Your star is already shining in your family's universe &mdash; now it's time to make it yours.
      </p>
    `)}
    ${ctaButton(registerUrl, '&#10022;&nbsp;&nbsp;Create My Account&nbsp;&nbsp;&#10022;')}
  `;

  await mailer.sendMail({
    from: `"StarThread" <${fromAddress}>`,
    to: toEmail,
    subject: `${childName}, Your StarThread Account is Ready! ✨`,
    text: `Hi ${childName}!\n\n${parentName} has set up a StarThread account for you. StarThread is where your family connects, shares moments, and keeps their stories alive.\n\nClick the link below to create your account and join your family's universe:\n${registerUrl}\n\nSee you among the stars!\n\n— The StarThread Team`,
    html: emailWrapper(bodyContent),
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

  const bodyContent = `
    ${glassCard(`
      <div style="text-align:center;margin-bottom:16px;">
        <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,rgba(251,191,36,0.15) 0%,rgba(124,58,237,0.1) 100%);border:1px solid rgba(251,191,36,0.2);line-height:56px;font-size:24px;">&#128274;</div>
      </div>
      <h2 style="margin:0 0 16px;font-size:22px;color:#F1F5F9;font-weight:600;text-align:center;">Password Reset</h2>
      <p style="margin:0 0 8px;font-size:15px;color:#CBD5E1;line-height:1.7;text-align:center;">
        You requested a password reset for your StarThread account. Click the button below to choose a new password.
      </p>
    `)}
    ${ctaButton(resetUrl, 'Reset My Password')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="background:rgba(30,41,59,0.5);border:1px solid rgba(100,116,139,0.15);border-radius:10px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">&#9202; This link expires in <strong style="color:#FBBF24;">1 hour</strong></p>
          <p style="margin:0;font-size:12px;color:#64748B;">If you didn't request this reset, you can safely ignore this email.</p>
        </td>
      </tr>
    </table>
  `;

  await mailer.sendMail({
    from: `"StarThread" <${fromAddress}>`,
    to: toEmail,
    subject: 'Reset Your StarThread Password',
    text: `You requested a password reset for your StarThread account.\n\nClick the link below to set a new password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: emailWrapper(bodyContent),
  });

  return true;
}
