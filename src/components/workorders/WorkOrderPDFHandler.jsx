import { toast } from 'sonner';

export async function handleExportPDFClick(entry, selectedProject, selectedCustomer, projectAssets, safeUsers, safeTeams, safeCategories, setShowPDFDialog, setIsGeneratingPDF, safeShiftTypes = []) {
  if (!entry?.id) return;
  
  console.log('📄 [PDF HANDLER] Starting PDF generation', {
    entryId: entry?.id?.slice(0, 8),
    entryTitle: entry?.title,
    branch_id: entry?.branch_id,
    project_id: entry?.project_id,
    projectBranch: selectedProject?.branch_id,
    tasksCount: entry?.tasks?.length,
    usersCount: safeUsers?.length,
    teamsCount: safeTeams?.length,
    categoriesCount: safeCategories?.length,
    shiftTypesCount: safeShiftTypes?.length,
  });

  try {
    setIsGeneratingPDF(true);
    
    // Prepare data for PDF - extract users/teams from tasks
    const allUserIds = new Set();
    const allTeamIds = new Set();
    (entry.tasks || []).forEach(task => {
      (task.employee_ids || []).forEach(id => allUserIds.add(id));
      (task.team_ids || []).forEach(id => allTeamIds.add(id));
    });
    
    const assignedAssets = projectAssets.filter(a => (entry.equipment_ids || []).includes(a.id));
    const assignedUsers = safeUsers.filter(u => allUserIds.has(u.id));
    const assignedTeams = safeTeams.filter(t => allTeamIds.has(t.id));
    const woCategory = safeCategories.find(c => c.id === entry.work_order_category_id);
    const shiftType = safeShiftTypes.find(s => s.id === entry.shift_type_id) || safeCategories.find(c => c.id === entry.shift_type_id);

    console.log('📄 [PDF HANDLER] Data resolved', {
      assignedUsers: assignedUsers.length,
      assignedTeams: assignedTeams.length,
      assignedAssets: assignedAssets.length,
      woCategory: woCategory?.name,
      shiftType: shiftType?.name,
      allUserIds: Array.from(allUserIds),
      allTeamIds: Array.from(allTeamIds),
    });
    
    // Get branch
    let branchData = null;
    const branchId = entry.branch_id || selectedProject?.branch_id;
    console.log('📄 [PDF HANDLER] Fetching branch, branchId:', branchId);
    if (branchId) {
      try {
        const { base44 } = await import('@/api/base44Client');
        const allBranches = await base44.entities.Branch.list('-updated_date', 100);
        branchData = Array.isArray(allBranches) ? (allBranches.find(b => b.id === branchId) || null) : null;
        console.log('📄 [PDF HANDLER] Branch loaded:', branchData?.name, '| all branches count:', allBranches?.length);
      } catch (e) {
        console.warn('📄 [PDF HANDLER] Failed to load branch:', e);
      }
    } else {
      console.warn('📄 [PDF HANDLER] No branchId found - branch will be null');
    }
    
    console.log('📄 [PDF HANDLER] Calling setShowPDFDialog with:', {
      workOrder: entry?.id?.slice(0,8),
      project: selectedProject?.name,
      customer: selectedCustomer?.name,
      branch: branchData?.name,
    });

    setShowPDFDialog({
      workOrder: entry,
      project: selectedProject,
      customer: selectedCustomer,
      branch: branchData,
      assignedUsers,
      assignedTeams,
      assignedAssets,
      woCategory,
      shiftType
    });

    console.log('📄 [PDF HANDLER] ✅ setShowPDFDialog called successfully');
  } catch (error) {
    console.error('📄 [PDF HANDLER] ❌ Error opening PDF dialog:', error);
    toast.error('Failed to open PDF view');
  } finally {
    setIsGeneratingPDF(false);
  }
}