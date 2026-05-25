import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { normalizeEnvString } from './normalizeEnv.js';

const RESEND_TEST_FROM = 'MyBusinessPace <onboarding@resend.dev>';

export function resolveResendFromAddress(fromName = 'MyBusinessPace') {
  let from = normalizeEnvString(env.emailFrom);
  if (!from) return RESEND_TEST_FROM;
  if (from.includes('@') && !from.includes('<')) {
    from = `${fromName} <${from}>`;
  }
  return from;
}

export function getEmailDiagnostics() {
  const provider = env.resendApiKey ? 'resend' : env.smtpHost ? 'smtp' : null;
  const from = env.resendApiKey ? resolveResendFromAddress() : normalizeEnvString(env.emailFrom) || env.smtpUser;
  let hint = null;
  if (env.resendApiKey) {
    if (!normalizeEnvString(env.emailFrom)) {
      hint =
        'EMAIL_FROM not set — using onboarding@resend.dev (test). Verify your domain in Resend and set EMAIL_FROM=MyBusinessPace <invites@yourdomain.com>';
    } else if (!/resend\.dev$/i.test(from)) {
      hint =
        'Using custom EMAIL_FROM — the domain must show Verified in Resend → Domains (DNS SPF/DKIM).';
    } else {
      hint =
        'Test mode: onboarding@resend.dev may only deliver reliably after domain verification in Resend.';
    }
  }
  return {
    email_provider: provider,
    email_from: from,
    email_hint: hint,
  };
}

function parseResendError(status, errText) {
  let message = errText;
  try {
    const j = JSON.parse(errText);
    message = j.message || j.error || errText;
  } catch {
    /* plain text */
  }
  if (/domain.*not verified|verify your domain/i.test(message)) {
    return `${message} — Add and verify your domain at https://resend.com/domains then set EMAIL_FROM=MyBusinessPace <you@yourdomain.com> in Vercel.`;
  }
  if (/invalid.*from|from.*invalid/i.test(message)) {
    return `${message} — Fix EMAIL_FROM in Vercel (example: MyBusinessPace <invites@verified-domain.com>).`;
  }
  if (/only send.*your own|testing/i.test(message)) {
    return `${message} — In Resend test mode, send to your Resend account email or verify a domain first.`;
  }
  return `Resend API (${status}): ${message}`;
}

/**
 * Send transactional email via Resend (fetch) or SMTP (nodemailer).
 */
export async function sendEmail({ to, subject, body, fromName = 'MyBusinessPace' }) {
  const recipient = String(to || '').trim();
  if (!recipient) throw new Error('Email recipient (to) is required');

  const htmlBody = `<div style="font-family:sans-serif;line-height:1.5;white-space:pre-wrap">${String(body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</div>`;

  if (env.resendApiKey) {
    const from = resolveResendFromAddress(fromName);
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
        html: htmlBody,
      }),
    });
    const errText = await res.text();
    if (!res.ok) {
      throw new Error(parseResendError(res.status, errText));
    }
    let resendId = null;
    try {
      const data = JSON.parse(errText);
      resendId = data.id || null;
    } catch {
      /* ignore */
    }
    console.log('[email] Resend ok', { to: recipient, from, resendId });
    return { provider: 'resend', resendId, from };
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
    const from = normalizeEnvString(env.emailFrom) || env.smtpUser || 'noreply@mybusinesspace.app';
    await transport.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to: recipient,
      subject,
      text: body,
      html: htmlBody,
    });
    console.log('[email] SMTP ok', recipient);
    return { provider: 'smtp', from };
  }

  throw new Error(
    'Email is not configured. Set RESEND_API_KEY + EMAIL_FROM, or SMTP_HOST + SMTP_USER + SMTP_PASS in Vercel.'
  );
}

export function isEmailConfigured() {
  return Boolean(env.resendApiKey || env.smtpHost);
}
