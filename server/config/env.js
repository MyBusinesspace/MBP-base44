import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') });

/**
 * Secrets & API keys (were Base44 function environment variables).
 * Add values to .env in the project root — no frontend code changes needed.
 */
export const env = {
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
  dailyApiKey: process.env.DAILY_API_KEY || '',
  customersApiKey: process.env.CUSTOMERS_API_KEY || '',
  zapierWebhookUrl: process.env.ZAPIER_WEBHOOK_URL || '',
  base44ServiceRoleKey: process.env.BASE44_SERVICE_ROLE_KEY || '',
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  googleOAuthCallbackUrl:
    process.env.GOOGLE_OAUTH_CALLBACK_URL ||
    `http://localhost:${process.env.API_PORT || 3001}/api/auth/google/callback`,
  jwtSecret: process.env.JWT_SECRET || 'mpb-local-dev-secret-change-me',
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
  authRequired: process.env.AUTH_REQUIRED !== 'false',
  localAdminPassword: process.env.LOCAL_ADMIN_PASSWORD || 'admin123',
};

export function requireEnv(name, value) {
  if (!value) {
    const err = new Error(`${name} is not set in .env`);
    err.status = 500;
    throw err;
  }
  return value;
}
