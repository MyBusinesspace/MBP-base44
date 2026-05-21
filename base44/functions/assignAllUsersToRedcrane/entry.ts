import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin user
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    // Get all branches
    const branches = await base44.asServiceRole.entities.Branch.list();
    
    // Find Redcrane branch (case-insensitive)
    const redcraneBranch = branches.find(b => 
      (b.name || '').toLowerCase().includes('redcrane') || 
      (b.short_name || '').toLowerCase().includes('redcrane')
    );
    
    if (!redcraneBranch) {
      return Response.json({ 
        error: 'Redcrane branch not found',
        branches: branches.map(b => ({ id: b.id, name: b.name, short_name: b.short_name }))
      }, { status: 404 });
    }

    // Get ALL users
    const allUsers = await base44.asServiceRole.entities.User.list('', 1000);
    
    // Filter users without branch_id or with different branch_id
    const usersToUpdate = allUsers.filter(u => !u.branch_id || u.branch_id !== redcraneBranch.id);
    
    console.log(`Found ${usersToUpdate.length} users to assign to Redcrane (${redcraneBranch.name})`);
    
    // Update users in batches
    let updated = 0;
    for (const userToUpdate of usersToUpdate) {
      try {
        await base44.asServiceRole.entities.User.update(userToUpdate.id, {
          branch_id: redcraneBranch.id
        });
        updated++;
      } catch (error) {
        console.error(`Failed to update user ${userToUpdate.email}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      message: `Assigned ${updated} users to ${redcraneBranch.name}`,
      branch: { id: redcraneBranch.id, name: redcraneBranch.name },
      updated,
      total: usersToUpdate.length
    });
    
  } catch (error) {
    console.error('Error assigning users:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});