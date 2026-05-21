import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin authentication
    const currentUser = await base44.auth.me();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return Response.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email - get all users and search manually
    const allUsers = await base44.asServiceRole.entities.User.list('', 1000);
    const user = allUsers.find(u => u.email && u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate code and expiry
    const verificationCode = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store code in user entity
    await base44.asServiceRole.entities.User.update(user.id, {
      verification_code: verificationCode,
      verification_code_expires_at: expiresAt
    });

    // Send email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'Your Verification Code (Admin)',
      body: `Your verification code is: ${verificationCode}\n\nThis code will expire in 5 minutes.\n\nSent by admin: ${currentUser.email}`
    });

    return Response.json({
      success: true,
      message: `Verification code sent to ${email}`,
      code: verificationCode // Include in response for admin convenience
    });

  } catch (error) {
    console.error('Error sending verification code:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});