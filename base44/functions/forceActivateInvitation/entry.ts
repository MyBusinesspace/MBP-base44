import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const { invitation_token } = await req.json();
    
    if (!invitation_token) {
      return Response.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Find the invitation
    const invitations = await base44.asServiceRole.entities.UserInvitation.filter({
      invitation_token: invitation_token
    });

    if (invitations.length === 0) {
      return Response.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    const invitation = invitations[0];

    // Check if already activated
    if (invitation.status === 'activated') {
      return Response.json({
        success: true,
        message: 'Invitation was already activated',
        email: invitation.email
      });
    }

    // Find user by email
    const users = await base44.asServiceRole.entities.User.list('', 1000);
    const existingUser = users.find(u => u.email && u.email.toLowerCase() === invitation.email.toLowerCase());

    if (existingUser) {
      // Update existing user
      const updateData = {
        role: invitation.invited_role,
        status: 'Active'
      };

      if (invitation.first_name) updateData.first_name = invitation.first_name;
      if (invitation.last_name) updateData.last_name = invitation.last_name;
      if (invitation.job_role) updateData.job_role = invitation.job_role;

      await base44.asServiceRole.entities.User.update(existingUser.id, updateData);
    }

    // Mark invitation as activated
    await base44.asServiceRole.entities.UserInvitation.update(invitation.id, {
      status: 'activated'
    });

    return Response.json({ 
      success: true,
      message: 'Invitation forcefully activated',
      email: invitation.email,
      role: invitation.invited_role,
      user_updated: !!existingUser
    });
    
  } catch (error) {
    console.error('Error forcing invitation activation:', error);
    return Response.json({ 
      error: error.message || 'Failed to activate invitation'
    }, { status: 500 });
  }
});