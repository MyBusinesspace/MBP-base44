import { randomBytes } from 'crypto';
import { env } from '../config/env.js';
import { createEntity, listEntities, deleteEntity } from '../entityStore.js';
import { resolveRequestUser } from '../middleware/authenticate.js';
import { sendEmail, isEmailConfigured } from '../utils/sendEmail.js';

function makeToken() {
  return randomBytes(24).toString('base64url');
}

export async function handleCreateInvitation(body, req) {
  const currentUser = await resolveRequestUser(req);
  if (!currentUser || currentUser.role !== 'admin') {
    const err = new Error('Unauthorized - Admin access required');
    err.status = 401;
    throw err;
  }

  const email = body?.email?.toLowerCase()?.trim();
  if (!email) {
    const err = new Error('Email is required');
    err.status = 400;
    throw err;
  }

  if (!isEmailConfigured()) {
    const err = new Error(
      'Email service not configured. Add RESEND_API_KEY (recommended) or SMTP settings in Vercel → Environment Variables, then Redeploy.'
    );
    err.status = 503;
    throw err;
  }

  const invitationToken = makeToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const fullName =
    body.first_name && body.last_name
      ? `${body.first_name} ${body.last_name}`.trim()
      : body.first_name || body.last_name || email;

  const role = body.role || 'user';
  const roleText = role === 'admin' ? 'Administrator' : 'User';
  const appUrl = env.webUrl || 'https://mbp-base44.vercel.app';
  const invitationLink = `${appUrl}/?invitation_token=${encodeURIComponent(invitationToken)}`;

  const invitationData = {
    email,
    first_name: body.first_name || null,
    last_name: body.last_name || null,
    job_role: body.job_role || null,
    invited_role: role,
    company_id: body.company_id || null,
    status: 'sent',
    invitation_token: invitationToken,
    invited_by: currentUser.email,
    expires_at: expiresAt.toISOString(),
  };

  let invitation;
  try {
    invitation = await createEntity('UserInvitation', invitationData);
    console.log('[createInvitation] record', invitation.id, email);
  } catch (dbError) {
    console.error('[createInvitation] DB error:', dbError.message);
    const err = new Error(`Failed to create invitation: ${dbError.message}`);
    err.status = 500;
    throw err;
  }

  const emailBody = `Dear ${fullName},

You have been invited to join MyBusinessPace as a ${roleText}.

To get started:
1. Open the link below
2. Sign in with your Google account using this email address: ${email}
3. Your account will be created automatically with the correct permissions

Join MyBusinessPace: ${invitationLink}

${body.job_role ? `Your role: ${body.job_role}\n` : ''}Account type: ${roleText}

This invitation expires in 7 days.

If you have questions, contact your administrator (${currentUser.email}).

Best regards,
MyBusinessPace Team`;

  let sendResult;
  try {
    sendResult = await sendEmail({
      to: email,
      subject: `MyBusinessPace — ${roleText} invitation`,
      body: emailBody,
      fromName: 'MyBusinessPace',
    });
  } catch (emailError) {
    console.error('[createInvitation] email failed:', emailError.message);
    try {
      await deleteEntity('UserInvitation', invitation.id);
    } catch {
      /* ignore cleanup */
    }
    const err = new Error(`Failed to send invitation email: ${emailError.message}`);
    err.status = 503;
    throw err;
  }

  return {
    success: true,
    invitation,
    invitationLink,
    emailSent: true,
    resendId: sendResult?.resendId || null,
    emailFrom: sendResult?.from || null,
    message: `Invitation sent to ${email}. Check spam if not received. Resend dashboard: resend.com/emails`,
  };
}

/** Apply pending invitation after Google/email login (invitation_token in URL). */
export async function handleProcessInvitation(body, req) {
  const currentUser = await resolveRequestUser(req);
  if (!currentUser) {
    const err = new Error('User must be authenticated');
    err.status = 401;
    throw err;
  }

  const token = body?.invitation_token;
  if (!token) {
    const err = new Error('Invitation token is required');
    err.status = 400;
    throw err;
  }

  const invitations = await listEntities('UserInvitation', {
    query: { invitation_token: token, status: 'sent' },
    limit: 5,
  });

  const invitation = invitations[0];
  if (!invitation) {
    const err = new Error('Invalid or expired invitation');
    err.status = 404;
    throw err;
  }

  if (new Date() > new Date(invitation.expires_at)) {
    const err = new Error('Invitation has expired');
    err.status = 400;
    throw err;
  }

  if (currentUser.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
    const err = new Error('This invitation is for a different email address');
    err.status = 400;
    err.data = { expected_email: invitation.email, current_email: currentUser.email };
    throw err;
  }

  const { updateEntity } = await import('../entityStore.js');
  const { saveUser } = await import('../userPersistence.js');

  await saveUser({
    id: currentUser.id,
    email: currentUser.email,
    role: invitation.invited_role || 'user',
    first_name: invitation.first_name || currentUser.first_name,
    last_name: invitation.last_name || currentUser.last_name,
    job_role: invitation.job_role || currentUser.job_role,
    company_id: invitation.company_id || currentUser.company_id,
    branch_id: invitation.company_id || currentUser.branch_id,
    status: 'Active',
  });

  await updateEntity('UserInvitation', invitation.id, { status: 'activated' });

  return {
    success: true,
    message: 'Invitation processed successfully',
    user_role: invitation.invited_role,
  };
}
