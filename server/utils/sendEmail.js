import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { normalizeEnvString } from './normalizeEnv.js';

const RESEND_TEST_FROM = 'MyBusinessPace <onboarding@resend.dev>';

/** Which backend to use: dry_run | resend | smtp (EMAIL_PROVIDER overrides auto-detect). */
export function resolveEmailProvider() {
  if (env.emailDryRun) return 'dry_run';

  const forced = normalizeEnvString(env.emailProvider).toLowerCase();
  if (forced === 'smtp' || forced === 'resend' || forced === 'dry_run') {
    return forced;
  }

  // Auto: prefer explicit SMTP when only SMTP is configured
  if (env.smtpHost && !env.resendApiKey) return 'smtp';
  if (env.resendApiKey && !env.smtpHost) return 'resend';
  // Both set — default was resend; use EMAIL_PROVIDER=smtp to switch
  if (env.resendApiKey) return 'resend';
  if (env.smtpHost) return 'smtp';
  return null;
}

export function resolveResendFromAddress(fromName = 'MyBusinessPace') {
  let from = normalizeEnvString(env.emailFrom);
  if (!from) return RESEND_TEST_FROM;
  if (from.includes('@') && !from.includes('<')) {
    from = `${fromName} <${from}>`;
  }
  return from;
}

export function getEmailDiagnostics() {
  const provider = resolveEmailProvider();
  if (provider === 'dry_run') {
    return {
      email_provider: 'dry_run',
      email_from: null,
      email_hint:
        'EMAIL_DRY_RUN=true — no real email sent. Copy invitationLink from the invite dialog.',
      email_dry_run: true,
    };
  }
  if (provider === 'smtp') {
    const from = normalizeEnvString(env.emailFrom) || env.smtpUser || null;
    return {
      email_provider: 'smtp',
      email_from: from,
      email_hint: env.resendApiKey
        ? 'EMAIL_PROVIDER=smtp — using Gmail/SMTP (Resend key is ignored). Set EMAIL_FROM to your Gmail address.'
        : 'Using SMTP (Gmail). Check spam folder if mail does not arrive.',
    };
  }
  if (provider === 'resend') {
    const from = resolveResendFromAddress();
    let hint = null;
    if (!normalizeEnvString(env.emailFrom)) {
      hint =
        'EMAIL_FROM not set — using onboarding@resend.dev (test). Verify domain in Resend for production.';
    } else if (!/resend\.dev$/i.test(from)) {
      hint =
        'Using Resend — domain must be Verified in Resend → Domains. Or set EMAIL_PROVIDER=smtp for Gmail.';
    } else {
      hint = 'Resend test sender — verify a domain for production mail.';
    }
    if (env.smtpHost) {
      hint = `${hint || ''} (SMTP is configured but ignored until you set EMAIL_PROVIDER=smtp or remove RESEND_API_KEY.)`.trim();
    }
    return { email_provider: 'resend', email_from: from, email_hint: hint };
  }
  return {
    email_provider: null,
    email_from: null,
    email_hint: 'Set EMAIL_PROVIDER=smtp + SMTP_* or RESEND_API_KEY, or EMAIL_DRY_RUN=true',
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
    return `${message} — Verify domain at https://resend.com/domains or use EMAIL_PROVIDER=smtp with Gmail.`;
  }
  if (/invalid.*from|from.*invalid/i.test(message)) {
    return `${message} — Fix EMAIL_FROM (use a verified domain or EMAIL_PROVIDER=smtp + Gmail).`;
  }
  return `Resend API (${status}): ${message}`;
}

async function sendViaResend({ to, subject, body, htmlBody, fromName }) {
  const from = resolveResendFromAddress(fromName);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
      html: htmlBody,
    }),
  });
  const errText = await res.text();
  if (!res.ok) throw new Error(parseResendError(res.status, errText));
  let resendId = null;
  try {
    const data = JSON.parse(errText);
    resendId = data.id || null;
  } catch {
    /* ignore */
  }
  console.log('[email] Resend ok', { to, from, resendId });
  return { provider: 'resend', resendId, from };
}

async function sendViaSmtp({ to, subject, body, htmlBody, fromName }) {
  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth:
      env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });
  const from = normalizeEnvString(env.emailFrom) || env.smtpUser || 'noreply@mybusinesspace.app';
  await transport.sendMail({
    from: fromName ? `"${fromName}" <${from}>` : from,
    to,
    subject,
    text: body,
    html: htmlBody,
  });
  console.log('[email] SMTP ok', to, 'from', from);
  return { provider: 'smtp', from };
}

/**
 * Send transactional email via Resend or SMTP (see EMAIL_PROVIDER).
 */
export async function sendEmail({ to, subject, body, fromName = 'MyBusinessPace' }) {
  const recipient = String(to || '').trim();
  if (!recipient) throw new Error('Email recipient (to) is required');

  const htmlBody = `<div style="font-family:sans-serif;line-height:1.5;white-space:pre-wrap">${String(body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</div>`;

  const provider = resolveEmailProvider();
  if (provider === 'resend') {
    if (!env.resendApiKey) throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    return sendViaResend({ to: recipient, subject, body, htmlBody, fromName });
  }
  if (provider === 'smtp') {
    if (!env.smtpHost) throw new Error('SMTP_HOST is required when EMAIL_PROVIDER=smtp');
    return sendViaSmtp({ to: recipient, subject, body, htmlBody, fromName });
  }

  throw new Error(
    'Email is not configured. Set EMAIL_PROVIDER=smtp + SMTP_*, or RESEND_API_KEY, or EMAIL_DRY_RUN=true.'
  );
}

export function isEmailConfigured() {
  const p = resolveEmailProvider();
  return p === 'dry_run' || p === 'resend' || p === 'smtp';
}
