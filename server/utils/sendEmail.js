import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Send transactional email via Resend (fetch) or SMTP (nodemailer).
 * Configure RESEND_API_KEY + EMAIL_FROM, or SMTP_HOST + SMTP_USER + SMTP_PASS.
 */
export async function sendEmail({ to, subject, body, fromName = 'MyBusinessPace' }) {
  const recipient = String(to || '').trim();
  if (!recipient) throw new Error('Email recipient (to) is required');

  if (env.resendApiKey) {
    const from = env.emailFrom || `${fromName} <onboarding@resend.dev>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend API error: ${errText}`);
    }
    console.log('[email] sent via Resend to', recipient);
    return { provider: 'resend' };
  }

  if (env.smtpHost) {
    const transport = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth:
        env.smtpUser && env.smtpPass
          ? { user: env.smtpUser, pass: env.smtpPass }
          : undefined,
    });
    const from = env.emailFrom || env.smtpUser || 'noreply@mybusinesspace.app';
    await transport.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to: recipient,
      subject,
      text: body,
    });
    console.log('[email] sent via SMTP to', recipient);
    return { provider: 'smtp' };
  }

  throw new Error(
    'Email is not configured. Set RESEND_API_KEY + EMAIL_FROM, or SMTP_HOST + SMTP_USER + SMTP_PASS in Vercel Environment Variables.'
  );
}

export function isEmailConfigured() {
  return Boolean(env.resendApiKey || env.smtpHost);
}
