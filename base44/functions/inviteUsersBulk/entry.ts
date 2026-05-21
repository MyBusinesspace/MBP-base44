import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser || currentUser.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { users } = await req.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return Response.json(
        { error: 'Please provide an array of users with email and role' },
        { status: 400 }
      );
    }

    const results = [];
    
    for (const user of users) {
      try {
        if (!user.email) {
          results.push({
            email: user.email || 'unknown',
            success: false,
            error: 'Email is required'
          });
          continue;
        }

        const role = user.role || 'user';
        
        await base44.users.inviteUser(user.email, role);
        
        results.push({
          email: user.email,
          role: role,
          success: true
        });
        
      } catch (error) {
        results.push({
          email: user.email,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return Response.json({
      success: true,
      total: users.length,
      invited: successCount,
      failed: errorCount,
      results: results
    });

  } catch (error) {
    console.error('Error inviting users:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});