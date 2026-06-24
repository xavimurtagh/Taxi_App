import nodemailer from 'nodemailer';
import env from '../config/env.js';

/**
 * Email service.
 *
 * Mirrors the gated-fallback pattern used by the SMS service: when SMTP is
 * configured (SMTP_HOST + SMTP_USER + SMTP_PASSWORD) email is sent for real via
 * nodemailer; otherwise the message is logged to the console so local and CI
 * environments work without an email provider.
 */

let transporter = null;

/**
 * Lazily build (and cache) the nodemailer transport. Returns null when SMTP is
 * not configured.
 */
function getTransporter() {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // implicit TLS on 465, STARTTLS otherwise
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return transporter;
}

/**
 * Send an email.
 *
 * @param {Object} params
 * @param {string} params.to      - Recipient email address
 * @param {string} params.subject - Subject line
 * @param {string} params.text    - Plain-text body
 * @param {string} [params.html]  - Optional HTML body
 * @returns {Promise<{delivered: boolean}>}
 */
export async function sendEmail({ to, subject, text, html }) {
  const tx = getTransporter();

  if (!tx) {
    // Development / unconfigured: log instead of sending.
    console.log(
      `[email] (dev, not sent) to=${to} subject="${subject}"\n${text}`
    );
    return { delivered: false };
  }

  await tx.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });
  return { delivered: true };
}

/**
 * Send a password-reset email containing a tokenized link and the raw code.
 *
 * @param {string} to    - Recipient email address
 * @param {string} token - One-time reset token
 * @returns {Promise<{delivered: boolean}>}
 */
export async function sendPasswordResetEmail(to, token) {
  const link = `${env.WEB_APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Reset your OpenRide password';
  const text =
    `We received a request to reset your OpenRide password.\n\n` +
    `Reset it here (valid for 30 minutes):\n${link}\n\n` +
    `If you didn't request this, you can safely ignore this email.`;
  const html =
    `<p>We received a request to reset your OpenRide password.</p>` +
    `<p><a href="${link}">Reset your password</a> (valid for 30 minutes).</p>` +
    `<p>If you didn't request this, you can safely ignore this email.</p>`;

  return sendEmail({ to, subject, text, html });
}
