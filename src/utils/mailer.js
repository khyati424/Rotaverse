const nodemailer = require('nodemailer');

/**
 * Sends OTP emails over SMTP. Configure with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * and optionally SMTP_FROM / SMTP_SECURE. Without SMTP settings, codes are only logged
 * to the console (fine for development, not for real users).
 */

let transporter = null;

const isMailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
};

const sendOtpEmail = async (email, otp, minutes) => {
  const appName = process.env.APP_NAME || 'Rotaract Clubs';
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `"${appName}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `${otp} is your ${appName} login code`,
    text: `Your ${appName} login code is ${otp}. It expires in ${minutes} minutes. If you didn't request it, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">${appName}</h2>
        <p style="margin:0 0 16px">Use this code to sign in:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:0 0 16px">${otp}</p>
        <p style="margin:0;color:#64748b;font-size:13px">It expires in ${minutes} minutes. If you didn't request it, you can ignore this email.</p>
      </div>`
  });
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tells a newly added user they can sign in to the app with this email. */
const sendInviteEmail = async (email, name) => {
  const appName = process.env.APP_NAME || 'Rotaract Clubs';
  const hello = name ? `Hi ${name},` : 'Hello,';
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `"${appName}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `You're invited to ${appName}`,
    text: `${hello}

You have been added to ${appName}. Open the app and sign in with this email address (${email}). We will send a one-time code to this inbox each time you log in.

If you weren't expecting this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Welcome to ${escapeHtml(appName)}</h2>
        <p style="margin:0 0 12px">${escapeHtml(hello)}</p>
        <p style="margin:0 0 12px">You have been added to <b>${escapeHtml(appName)}</b>. Open the app and sign in with this email address:</p>
        <p style="font-size:18px;font-weight:bold;margin:0 0 12px">${escapeHtml(email)}</p>
        <p style="margin:0 0 12px">We'll send a one-time login code to this inbox each time you sign in.</p>
        <p style="margin:0;color:#64748b;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
      </div>`
  });
};

/** Invites a new admin: their role and the email + password to sign in to the admin panel with. */
const sendAdminInviteEmail = async ({ email, name, roleLabel, password, invitedBy }) => {
  const appName = process.env.APP_NAME || 'Rotaract Clubs';
  const panelUrl = process.env.ADMIN_PANEL_URL || '';
  const hello = name ? `Hi ${name},` : 'Hello,';
  const by = invitedBy ? ` by ${invitedBy}` : '';
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `"${appName}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `You're invited as ${roleLabel} on ${appName}`,
    text: [
      hello,
      '',
      `You have been invited${by} to join ${appName} as ${roleLabel}.`,
      '',
      `Email: ${email}`,
      `Password: ${password}`,
      panelUrl ? `Sign in: ${panelUrl}` : '',
      '',
      'Please change your password after your first login.',
      "If you weren't expecting this, you can ignore this email."
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Welcome to ${escapeHtml(appName)}</h2>
        <p style="margin:0 0 12px">${escapeHtml(hello)}</p>
        <p style="margin:0 0 12px">You have been invited${escapeHtml(by)} to join <b>${escapeHtml(appName)}</b> as <b>${escapeHtml(roleLabel)}</b>.</p>
        <p style="margin:0 0 4px">Your sign-in details:</p>
        <table style="margin:0 0 16px;font-size:15px">
          <tr><td style="color:#64748b;padding:2px 12px 2px 0">Email</td><td><b>${escapeHtml(email)}</b></td></tr>
          <tr><td style="color:#64748b;padding:2px 12px 2px 0">Password</td><td><b>${escapeHtml(password)}</b></td></tr>
        </table>
        ${panelUrl ? `<p style="margin:0 0 16px"><a href="${escapeHtml(panelUrl)}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Sign in</a></p>` : ''}
        <p style="margin:0 0 8px;color:#64748b;font-size:13px">Please change your password after your first login.</p>
        <p style="margin:0;color:#64748b;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
      </div>`
  });
};

module.exports = {
  isMailConfigured,
  sendOtpEmail,
  sendInviteEmail,
  sendAdminInviteEmail
};
