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
    ? `<img src="${logoUrl}" alt="StarThread" width="52" height="52" style="display:block;margin:0 auto 14px;width:52px;height:52px;object-fit:contain;" />`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StarThread</title>
  <style>
    @keyframes twinkle1 { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
    @keyframes twinkle2 { 0%,100%{opacity:0.5} 50%{opacity:0.2} }
    @keyframes twinkle3 { 0%,100%{opacity:0.2} 50%{opacity:0.7} }
    @keyframes pulse-glow { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
    .star { position:absolute; border-radius:50%; }
    .s1 { width:2px;height:2px;background:#FBBF24;animation:twinkle1 3s ease-in-out infinite; }
    .s2 { width:1px;height:1px;background:#60A5FA;animation:twinkle2 4s ease-in-out infinite; }
    .s3 { width:2px;height:2px;background:#A78BFA;animation:twinkle3 5s ease-in-out infinite; }
    .s4 { width:1px;height:1px;background:#E2E8F0;animation:twinkle1 3.5s ease-in-out infinite; }
    .s5 { width:3px;height:3px;background:#FBBF24;animation:pulse-glow 4s ease-in-out infinite;box-shadow:0 0 6px rgba(251,191,36,0.5); }
    .nebula-top { position:absolute;top:0;left:50%;transform:translateX(-50%);width:400px;height:200px;background:radial-gradient(ellipse,rgba(124,58,237,0.06) 0%,transparent 70%);pointer-events:none; }
    .nebula-bottom { position:absolute;bottom:60px;right:0;width:300px;height:180px;background:radial-gradient(ellipse,rgba(251,191,36,0.04) 0%,transparent 70%);pointer-events:none; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#030014;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#030014 0%,#0A0520 30%,#0F0A2A 60%,#050210 100%);min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <div style="position:relative;max-width:540px;width:100%;">

          <!-- Animated star dots -->
          <div class="nebula-top"></div>
          <div class="nebula-bottom"></div>
          <div class="star s1" style="top:20px;left:30px;"></div>
          <div class="star s2" style="top:60px;right:50px;"></div>
          <div class="star s4" style="top:45px;left:140px;"></div>
          <div class="star s3" style="top:100px;right:20px;"></div>
          <div class="star s1" style="top:15px;right:120px;"></div>
          <div class="star s2" style="top:80px;left:60px;"></div>
          <div class="star s5" style="top:35px;right:90px;"></div>
          <div class="star s4" style="top:110px;left:200px;"></div>
          <div class="star s2" style="bottom:120px;left:40px;"></div>
          <div class="star s1" style="bottom:80px;right:60px;"></div>
          <div class="star s3" style="bottom:150px;right:30px;"></div>
          <div class="star s4" style="bottom:60px;left:150px;"></div>
          <div class="star s5" style="bottom:100px;left:20px;"></div>
          <div class="star s2" style="bottom:40px;right:140px;"></div>
          <div class="star s1" style="top:200px;left:10px;"></div>
          <div class="star s3" style="top:250px;right:15px;"></div>
          <div class="star s4" style="top:300px;left:25px;"></div>
          <div class="star s2" style="top:350px;right:35px;"></div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;position:relative;z-index:1;">

            <!-- Main container -->
            <tr>
              <td style="background:linear-gradient(180deg,rgba(15,23,42,0.85) 0%,rgba(10,14,26,0.9) 50%,rgba(5,2,16,0.95) 100%);border-radius:24px;border:1px solid rgba(251,191,36,0.1);overflow:hidden;box-shadow:0 0 80px rgba(124,58,237,0.08),0 0 40px rgba(251,191,36,0.04);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                  <!-- Header -->
                  <tr>
                    <td style="padding:44px 44px 28px;text-align:center;">
                      ${logoBlock}
                      <h1 style="margin:0;font-size:30px;font-weight:700;letter-spacing:0.5px;">
                        <span style="color:#FBBF24;">Star</span><span style="color:#FBBF24;">Thread</span>
                      </h1>
                      <p style="margin:8px 0 0;font-size:13px;color:#64748B;letter-spacing:3px;text-transform:uppercase;font-weight:400;">Every Family Is a Galaxy of Stars</p>
                      <div style="margin-top:28px;height:1px;background:linear-gradient(90deg,transparent,rgba(251,191,36,0.2),rgba(124,58,237,0.15),transparent);"></div>
                    </td>
                  </tr>

                  <!-- Body content -->
                  <tr>
                    <td style="padding:4px 44px 0;">
                      ${bodyContent}
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:36px 44px 44px;text-align:center;">
                      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(100,116,139,0.2),transparent);margin-bottom:28px;"></div>
                      <p style="margin:0;font-size:13px;color:#64748B;">See you among the stars</p>
                      <p style="margin:10px 0 0;font-size:11px;color:#334155;">
                        &copy; ${year} StarThread &middot; Connecting families across the universe
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

          </table>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href, label) {
  return `
    <div style="text-align:center;margin:32px 0 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="border-radius:12px;background:linear-gradient(135deg,#FBBF24 0%,#F59E0B 50%,#D97706 100%);box-shadow:0 4px 20px rgba(251,191,36,0.25),0 0 40px rgba(251,191,36,0.1);">
            <a href="${href}" style="display:inline-block;padding:15px 44px;font-size:15px;font-weight:700;color:#0F172A;text-decoration:none;letter-spacing:0.3px;">
              ${label}
            </a>
          </td>
        </tr>
      </table>
    </div>`;
}

function glassCard(content) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="background:linear-gradient(135deg,rgba(30,41,59,0.6) 0%,rgba(15,23,42,0.4) 100%);border:1px solid rgba(251,191,36,0.08);border-radius:16px;padding:32px;">
          ${content}
        </td>
      </tr>
    </table>`;
}

function infoCard(content) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      <tr>
        <td style="background:rgba(15,23,42,0.5);border:1px solid rgba(100,116,139,0.1);border-radius:12px;padding:16px 20px;text-align:center;">
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
      <h2 style="margin:0 0 6px;font-size:22px;color:#F1F5F9;font-weight:600;text-align:center;">Welcome, ${childName}</h2>
      <p style="margin:0 0 24px;font-size:13px;color:#FBBF24;text-align:center;letter-spacing:1px;">Your star is ready to shine</p>
      <p style="margin:0 0 14px;font-size:15px;color:#CBD5E1;line-height:1.75;text-align:center;">
        <span style="color:#E2E8F0;font-weight:500;">${parentName}</span> has created a place for you on StarThread.
      </p>
      <p style="margin:0;font-size:15px;color:#94A3B8;line-height:1.75;text-align:center;">
        Your family is already connected and your star is shining in the universe &mdash; now it's time to make it yours.
      </p>
    `)}
    ${ctaButton(registerUrl, 'Join Your Family')}
  `;

  await mailer.sendMail({
    from: `"StarThread" <${fromAddress}>`,
    to: toEmail,
    subject: `${childName}, your family is waiting for you on StarThread`,
    text: `Hi ${childName}!\n\n${parentName} has created a place for you on StarThread. Your family is already connected and your star is shining in the universe — now it's time to make it yours.\n\nJoin your family here:\n${registerUrl}\n\nSee you among the stars!\n\n— The StarThread Team`,
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
      <h2 style="margin:0 0 16px;font-size:22px;color:#F1F5F9;font-weight:600;text-align:center;">Reset Your Password</h2>
      <p style="margin:0;font-size:15px;color:#CBD5E1;line-height:1.75;text-align:center;">
        We received a request to reset your password. Tap the button below to choose a new one.
      </p>
    `)}
    ${ctaButton(resetUrl, 'Reset Password')}
    ${infoCard(`
      <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">This link expires in <span style="color:#FBBF24;font-weight:600;">1 hour</span></p>
      <p style="margin:0;font-size:12px;color:#475569;">If you didn't request this, you can safely ignore this email.</p>
    `)}
  `;

  await mailer.sendMail({
    from: `"StarThread" <${fromAddress}>`,
    to: toEmail,
    subject: 'Reset your StarThread password',
    text: `You requested a password reset for your StarThread account.\n\nClick the link below to set a new password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: emailWrapper(bodyContent),
  });

  return true;
}
