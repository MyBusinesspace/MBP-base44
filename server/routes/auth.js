import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { signToken } from '../auth/token.js';
import { resolveRequestUser } from '../middleware/authenticate.js';
import { findUserByEmail, updateEntity } from '../entityStore.js';
import { normalizeUserForApi } from '../userNormalize.js';
import { getUserByEmail, saveUser, saveGoogleUser } from '../userPersistence.js';
import { isSupabasePoolerError, isInvalidDatabaseUrlError } from '../db.js';

function dbErrorResponse(res, e) {
  if (isInvalidDatabaseUrlError(e) || e.message?.includes('ENOTFOUND base')) {
    return res.status(503).json({
      success: false,
      error:
        'رابط DATABASE_URL في Vercel غير مكتمل أو خاطئ (يظهر host=base). الصق الرابط الكامل من Supabase بدون اقتطاع، بدون علامات اقتباس، في سطر واحد.',
      code: 'DATABASE_URL_INVALID',
    });
  }
  if (isSupabasePoolerError(e)) {
    return res.status(503).json({
      success: false,
      error:
        'خطأ اتصال Supabase على Vercel: استخدم pooler (IPv4) وليس db.xxx. مثال: postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres — من Supabase → Database → Transaction pooler.',
      code: 'SUPABASE_CONNECTION',
    });
  }
  return res.status(500).json({ success: false, error: e.message });
}
import { getDefaultBranchId } from '../auth/branch.js';
import { hashPassword, verifyPassword, stripSensitiveUser } from '../auth/password.js';
import { buildAuthRedirect } from '../utils/authRedirect.js';

const router = Router();

function getOAuthClient() {
  if (!env.googleOAuthClientId || !env.googleOAuthClientSecret) {
    return null;
  }
  return new OAuth2Client(
    env.googleOAuthClientId,
    env.googleOAuthClientSecret,
    env.googleOAuthCallbackUrl
  );
}

function issueAuthResponse(user) {
  const token = signToken({ sub: user.id, email: user.email }, env.jwtSecret);
  return {
    success: true,
    token,
    user: stripSensitiveUser(user),
  };
}

async function upsertGoogleUser(profile) {
  const branchId = await getDefaultBranchId();
  return saveGoogleUser(profile, branchId);
}

router.get('/status', (_req, res) => {
  res.json({
    auth_required: env.authRequired,
    google_login_enabled: Boolean(env.googleOAuthClientId),
    email_login_enabled: true,
  });
});

router.get('/me', async (req, res) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      if (!env.googleOAuthClientId) {
        const { getDevUser } = await import('../entityStore.js');
        return res.json(getDevUser());
      }
      return res.status(401).json({ message: 'Unauthorized' });
    }
    res.json(stripSensitiveUser(normalizeUserForApi(user)));
  } catch (e) {
    console.error('[auth/me]', e.message);
    return dbErrorResponse(res, e);
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = req.body?.email;
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required', success: false });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password', success: false });
    }

    if (user.archived) {
      return res.status(403).json({ error: 'User account is archived', success: false });
    }

    if (!user.password || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password', success: false });
    }

    const updated = await updateEntity('User', user.id, {
      last_login: new Date().toISOString(),
    });

    return res.json(issueAuthResponse(updated));
  } catch (e) {
    console.error('[auth/login]', e.message);
    return dbErrorResponse(res, e);
  }
});

router.post('/register', async (req, res) => {
  try {
    const email = req.body?.email?.toLowerCase()?.trim();
    const password = req.body?.password;
    const fullName = req.body?.full_name?.trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required', success: false });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters', success: false });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists', success: false });
    }

    const branchId = await getDefaultBranchId();
    const user = await saveUser({
      email,
      full_name: fullName || email.split('@')[0],
      role: 'user',
      branch_id: branchId,
      company_id: branchId,
      sort_order: 999,
      archived: false,
      password: hashPassword(password),
      status: 'Active',
      last_login: new Date().toISOString(),
    });

    return res.status(201).json(issueAuthResponse(user));
  } catch (e) {
    console.error('[auth/register]', e.message);
    return dbErrorResponse(res, e);
  }
});

router.get('/google', (_req, res) => {
  const client = getOAuthClient();
  if (!client) {
    return res.status(503).json({
      error: 'Google login is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env',
    });
  }

  const url = client.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const client = getOAuthClient();
  if (!client) {
    return res.redirect(buildAuthRedirect('auth_error=google_not_configured'));
  }

  const code = req.query.code;
  if (!code) {
    return res.redirect(buildAuthRedirect('auth_error=missing_code'));
  }

  try {
    const { tokens } = await client.getToken(String(code));
    client.setCredentials(tokens);

    let profile;
    if (tokens.id_token) {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.googleOAuthClientId,
      });
      profile = ticket.getPayload();
    } else {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!res.ok) throw new Error('Google userinfo failed');
      const info = await res.json();
      profile = {
        sub: info.sub,
        email: info.email,
        name: info.name,
        picture: info.picture,
      };
    }

    if (!profile?.email) {
      throw new Error('Google account has no email');
    }

    const user = await upsertGoogleUser(profile);
    const token = signToken({ sub: user.id, email: user.email }, env.jwtSecret);
    console.log('[auth/google] saved user', user.email, user.id, user.full_name);

    res.redirect(
      buildAuthRedirect(
        `auth_token=${encodeURIComponent(token)}&auth_email=${encodeURIComponent(user.email)}`
      )
    );
  } catch (e) {
    console.error('[auth/google/callback]', e.message);
    res.redirect(buildAuthRedirect(`auth_error=${encodeURIComponent(e.message)}`));
  }
});

router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

export default router;
