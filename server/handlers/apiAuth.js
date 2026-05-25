import { env } from '../config/env.js';
import { getEntity, updateEntity, listAllUsers } from '../entityStore.js';
import { getUserByEmail, getUserById } from '../userPersistence.js';
import { stripSensitiveUser } from '../auth/password.js';
import { sendEmail, isEmailConfigured, resolveEmailProvider } from '../utils/sendEmail.js';

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function fail(message, status = 400) {
  return { success: false, error: message, status };
}

export async function handleApiAuth(req) {
  const method = req.method?.toUpperCase();
  const actionGet = req.query?.action;

  /* GET ?action=getCurrentUser + header x-user-id */
  if (method === 'GET' && actionGet === 'getCurrentUser') {
    const userId = req.headers['x-user-id'];
    if (!userId) return fail('x-user-id header is required', 400);

    const user = (await getUserById(userId)) || (await getEntity('User', userId).catch(() => null));
    if (!user) return fail('User not found', 404);

    return { success: true, user: stripSensitiveUser(user) };
  }

  /* GET ?action=getAllUsers */
  if (method === 'GET' && actionGet === 'getAllUsers') {
    const users = await listAllUsers({ limit: 1000, sort: '-created_date' });
    return {
      success: true,
      count: users.length,
      users: users.map(stripSensitiveUser),
    };
  }

  if (method !== 'POST') {
    return fail(
      'Use POST with { action, email?, code? } or GET ?action=getCurrentUser|getAllUsers',
      405
    );
  }

  const body = req.body || {};
  const { action, email: rawEmail, code } = body;
  const email = rawEmail?.toLowerCase?.()?.trim();

  if (!action) return fail('Action is required', 400);

  if (action === 'getUser') {
    if (!email) return fail('Email is required', 400);
    const user = await getUserByEmail(email);
    if (!user) return fail('User not found', 404);
    return { success: true, user: stripSensitiveUser(user) };
  }

  if (action === 'send') {
    if (!email) return fail('Email is required', 400);

    const user = await getUserByEmail(email);
    if (!user) return fail('User not found', 404);

    const verificationCode = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await updateEntity('User', user.id, {
      verification_code: verificationCode,
      verification_code_expires_at: expiresAt,
    });

    if (env.emailDryRun) {
      console.log('[apiAuth] DRY RUN verification code for', email, verificationCode);
      return {
        success: true,
        message: 'Verification code generated (dry run — no email sent)',
        dryRun: true,
        debug_code: verificationCode,
      };
    }

    if (!isEmailConfigured() || resolveEmailProvider() === null) {
      return fail(
        'Email not configured. Set EMAIL_PROVIDER=smtp + SMTP_* or RESEND_API_KEY on Vercel.',
        503
      );
    }

    try {
      await sendEmail({
        to: email,
        subject: 'MyBusinessPace — Your verification code',
        body: `Your verification code is: ${verificationCode}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, ignore this email.`,
        fromName: 'MyBusinessPace',
      });
    } catch (e) {
      console.error('[apiAuth] send email failed:', e.message);
      return fail(`Failed to send verification email: ${e.message}`, 503);
    }

    console.log('[apiAuth] verification code sent to', email);
    return {
      success: true,
      message: 'Verification code sent to your email',
    };
  }

  if (action === 'verify') {
    if (!email || !code) return fail('Email and code are required', 400);

    const user = await getUserByEmail(email);
    if (!user) return fail('User not found', 404);

    if (!user.verification_code || !user.verification_code_expires_at) {
      return fail('No verification code found or code expired', 400);
    }

    if (new Date() > new Date(user.verification_code_expires_at)) {
      return fail('Verification code expired', 400);
    }

    if (String(user.verification_code) !== String(code).trim()) {
      return fail('Invalid verification code', 400);
    }

    await updateEntity('User', user.id, {
      verification_code: null,
      verification_code_expires_at: null,
    });

    return {
      success: true,
      message: 'Login successful',
      user: stripSensitiveUser(user),
    };
  }

  return fail('Invalid action. Use "send", "verify", or "getUser"', 400);
}
