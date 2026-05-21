import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API Helper - Authentication via user_id header + request token
 * * Endpoints:
 * - GET /apiHelper?action=getSidebarItems
 * - GET /apiHelper?action=getStats&date=YYYY-MM-DD
 * - GET /apiHelper?action=appInit&date=YYYY-MM-DD
 * - GET /apiHelper?action=getCurrentCompany
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);


// ======================================================================
    // 🛡️ التحقق من إصدار التطبيق (App Version Check) - نسخة مصححة
    // ======================================================================
    
    const clientVersion = req.headers.get('x-app-version'); 

  
    const settings = await base44.asServiceRole.entities.AppSettings.filter({
      setting_key: { $in: ['mobile_app_version', 'mobile_app_link'] }  
        });

    const versionSetting = settings.find(s => s.setting_key === 'mobile_app_version');
    const linkSetting = settings.find(s => s.setting_key === 'mobile_app_link');    
    const appLink = linkSetting?.setting_value || linkSetting?.value;
    const requiredVersion = versionSetting?.setting_value || versionSetting?.value;

    console.log(`Client Version: ${clientVersion}, Required: ${requiredVersion}`);

    if (requiredVersion && clientVersion !== String(requiredVersion)) {
      return Response.json({
        success: false,
        update_required: true,
        message: "A new update is available for the app, please update to continue.",
        current_version: clientVersion,
        required_version: requiredVersion,
        update_link: appLink
      }, { status: 426 }); 
    }


    // ======================================================================


  try {
    const url = new URL(req.url);
    const method = req.method;
    const action = url.searchParams.get('action');

    const userId = req.headers.get('X-User-ID') || req.headers.get('x-user-id') || req.headers.get('user_id');

    if (!userId) {
      return Response.json({ 
        error: 'Unauthorized - User ID header missing',
        details: 'Please provide X-User-ID header'
      }, { status: 401 });
    }
 
    let currentUser;
    try {
      const users = await base44.asServiceRole.entities.User.filter({ id: userId });
      if (!users || users.length === 0) {
        return Response.json({ 
          error: 'Unauthorized - User not found',
          details: `No user found with ID: ${userId}`
        }, { status: 401 });
      }
      currentUser = users[0];
    } catch (error) {
      console.error('Failed to verify user:', error);
      return Response.json({ 
        error: 'Unauthorized - Failed to verify user',
        details: error.message
      }, { status: 401 });
    }

    const isAdmin = currentUser.role === 'admin';

    // Helper: Check calendar event access
    const hasAccessToEvent = (event) => {
      if (!event) return false;
      if (isAdmin) return true;
      if (event.participant_user_ids?.includes(currentUser.id)) return true;
      if (currentUser.team_id && event.participant_team_ids?.includes(currentUser.team_id)) return true;
      if (event.created_by === currentUser.email) return true;
      return false;
    };

    // ACTION: Get Current Company Info
    if (method === 'GET' && action === 'getCurrentCompany') {
        if (!currentUser.company_id) {
            return Response.json({ success: false, error: 'User is not assigned to any company' }, { status: 400 });
        }
        try {
            const companies = await base44.asServiceRole.entities.Branch.filter({ id: currentUser.company_id });
            if (!companies || companies.length === 0) {
                return Response.json({ success: false, error: 'Company not found' }, { status: 404 });
            }
            const company = companies[0];
            return Response.json({ success: true, data: company });
        } catch (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }
    }

    // ACTION: App Init
    // if (method === 'GET' && action === 'appInit') {
    //   const date = url.searchParams.get('date');
    //   const today = date || new Date().toISOString().split('T')[0];

    //   try {
    //     const [timesheets, workOrders, calendarEvents, pettyCashEntries, leaveRequests] = await Promise.all([
    //       base44.asServiceRole.entities.TimesheetEntry.filter({ clock_in_time: { $startsWith: today } }, '-clock_in_time', 50).catch(() => []),
    //       base44.asServiceRole.entities.TimeEntry.filter({ planned_start_time: { $startsWith: today } }, '-planned_start_time', 50).catch(() => []),
    //       base44.asServiceRole.entities.CalendarEvent.filter({ start_time: { $startsWith: today } }, '-start_time', 50).catch(() => []),
    //       isAdmin 
    //         ? base44.asServiceRole.entities.PettyCashEntry.filter({}, '-created_date', 20).catch(() => []) 
    //         : base44.asServiceRole.entities.PettyCashEntry.filter({ employee_id: currentUser.id }, '-created_date', 20).catch(() => []),
    //       isAdmin 
    //         ? base44.asServiceRole.entities.LeaveRequest.filter({}, '-created_date', 20).catch(() => []) 
    //         : base44.asServiceRole.entities.LeaveRequest.filter({ employee_id: currentUser.id }, '-created_date', 20).catch(() => []),
    //     ]);

    //     const todayTimesheets = timesheets || [];
    //     const totalMinutes = todayTimesheets.reduce((sum, ts) => sum + (ts.total_duration_minutes || 0), 0);
    //     const todayWorkOrders = workOrders || [];
    //     const projectIds = [...new Set(todayWorkOrders.map(w => w.project_id).filter(Boolean))];
    //     const projects = (projectIds.length > 0 && projectIds.length < 50) 
    //       ? await base44.asServiceRole.entities.Project.filter({ id: { $in: projectIds } }).catch(() => [])
    //       : [];

    //     const filteredCalendar = (calendarEvents || []).filter(hasAccessToEvent);
    //     const pc = pettyCashEntries || [];
    //     const totalExpenses = pc.filter(e => e.type === 'expense').reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
    //     const totalInputs = pc.filter(e => e.type === 'input').reduce((sum, e) => sum + (e.amount || 0), 0);
    //     const pettySummary = { total_expenses: totalExpenses, total_inputs: totalInputs, balance: totalInputs - totalExpenses };

    //     const sortedLeaves = [...(leaveRequests || [])].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    //     return Response.json({
    //       success: true,
    //       data: {
    //         date: today,
    //         stats: {
    //           timesheets: { count: todayTimesheets.length, total_minutes: totalMinutes, total_hours: (totalMinutes / 60).toFixed(2), active: todayTimesheets.filter(t => t.is_active).length },
    //           work_orders: { 
    //             count: todayWorkOrders.length, 
    //             by_status: { open: todayWorkOrders.filter(w => w.status === 'open').length, closed: todayWorkOrders.filter(w => w.status === 'closed').length },
    //             items: todayWorkOrders.map(wo => ({ id: wo.id, work_order_number: wo.work_order_number, title: wo.title, status: wo.status, project_id: wo.project_id, planned_start_time: wo.planned_start_time }))
    //           }
    //         },
    //         calendar: filteredCalendar,
    //         projects,
    //         petty_cash: { summary: pettySummary, transactions: pc.slice(0, 10) },
    //         leaves: { count: sortedLeaves.length, pending: sortedLeaves.filter(l => l.status === 'Pending').length, approved: sortedLeaves.filter(l => l.status === 'Approved').length, items: sortedLeaves.slice(0, 10) },
    //       },
    //       authenticated_as: { user_id: currentUser.id, role: currentUser.role }
    //     });
    //   } catch (error) {
    //     return Response.json({ success: false, error: 'Data processing error', details: error.message }, { status: 500 });
    //   }
    // }

// ACTION: App Init
    if (method === 'GET' && action === 'appInit') {
      const date = url.searchParams.get('date');
      const today = date || new Date().toISOString().split('T')[0];

      try {
        const [timesheets, workOrders, calendarEvents, pettyCashEntries, leaveRequests, allUsers, allCategories] = await Promise.all([
          base44.asServiceRole.entities.TimesheetEntry.filter({ clock_in_time: { $startsWith: today } }, '-clock_in_time', 50).catch(() => []),
          base44.asServiceRole.entities.TimeEntry.filter({ planned_start_time: { $startsWith: today } }, '-planned_start_time', 50).catch(() => []),
          base44.asServiceRole.entities.CalendarEvent.filter({ start_time: { $startsWith: today } }, '-start_time', 50).catch(() => []),
          isAdmin 
            ? base44.asServiceRole.entities.PettyCashEntry.filter({}, '-created_date', 20).catch(() => []) 
            : base44.asServiceRole.entities.PettyCashEntry.filter({ employee_id: currentUser.id }, '-created_date', 20).catch(() => []),
          isAdmin 
            ? base44.asServiceRole.entities.LeaveRequest.filter({}, '-created_date', 20).catch(() => []) 
            : base44.asServiceRole.entities.LeaveRequest.filter({ employee_id: currentUser.id }, '-created_date', 20).catch(() => []),
          base44.asServiceRole.entities.User.list().catch(() => []),
          base44.asServiceRole.entities.PettyCashCategory.list().catch(() => [])
        ]);

        const todayTimesheets = timesheets || [];
        const totalMinutes = todayTimesheets.reduce((sum, ts) => sum + (ts.total_duration_minutes || 0), 0);
        const todayWorkOrders = workOrders || [];
        const projectIds = [...new Set(todayWorkOrders.map(w => w.project_id).filter(Boolean))];
        const projects = (projectIds.length > 0 && projectIds.length < 50) 
          ? await base44.asServiceRole.entities.Project.filter({ id: { $in: projectIds } }).catch(() => [])
          : [];

        const filteredCalendar = (calendarEvents || []).filter(hasAccessToEvent);
        
        // ربط البيانات للبيتي كاش
        const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.full_name || u.name || u.email]));
        const categoryMap = Object.fromEntries(allCategories.map(c => [c.id, c.name]));

        const pc = (pettyCashEntries || []).map(entry => ({
          ...entry,
          employee_name: userMap[entry.employee_id] || 'Unknown',
          category_name: categoryMap[entry.category_id] || 'General'
        }));

        const totalExpenses = pc.filter(e => e.type === 'expense').reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
        const totalInputs = pc.filter(e => e.type === 'input').reduce((sum, e) => sum + (e.amount || 0), 0);
        const pettySummary = { total_expenses: totalExpenses, total_inputs: totalInputs, balance: totalInputs - totalExpenses };

        const sortedLeaves = [...(leaveRequests || [])].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

        return Response.json({
          success: true,
          data: {
            date: today,
            stats: {
              timesheets: { count: todayTimesheets.length, total_minutes: totalMinutes, total_hours: (totalMinutes / 60).toFixed(2), active: todayTimesheets.filter(t => t.is_active).length },
              work_orders: { 
                count: todayWorkOrders.length, 
                by_status: { open: todayWorkOrders.filter(w => w.status === 'open').length, closed: todayWorkOrders.filter(w => w.status === 'closed').length },
                items: todayWorkOrders.map(wo => ({ id: wo.id, work_order_number: wo.work_order_number, title: wo.title, status: wo.status, project_id: wo.project_id, planned_start_time: wo.planned_start_time }))
              }
            },
            calendar: filteredCalendar,
            projects,
            petty_cash: { summary: pettySummary, transactions: pc.slice(0, 10) },
            leaves: { count: sortedLeaves.length, pending: sortedLeaves.filter(l => l.status === 'Pending').length, approved: sortedLeaves.filter(l => l.status === 'Approved').length, items: sortedLeaves.slice(0, 10) },
          },
          authenticated_as: { user_id: currentUser.id, role: currentUser.role }
        });
      } catch (error) {
        return Response.json({ success: false, error: 'Data processing error', details: error.message }, { status: 500 });
      }
    }
    
    // ACTION: Get Sidebar Items
    if (method === 'GET' && action === 'getSidebarItems') {
        let currentCompany = {}; 
        if (currentUser.company_id) { 
            try { 
                const companies = await base44.asServiceRole.entities.Branch.filter({ id: currentUser.company_id });
                if (companies && companies.length > 0) {
                    currentCompany = companies[0];
                }
            } catch (e) {
                console.warn('Failed to fetch company details:', e);
            }
        }

        try {
            let navConfig;
            try {
                const configs = await base44.entities.NavigationConfig.filter({ is_active: true });
                navConfig = configs[0];
            } catch (e) { console.log('Using default navigation'); }

            const defaultNavigation = [
                {
                    title: 'Admin',
                    items: [
                        { name: 'Calendar', icon: 'CalendarDays', path: '/calendar', type: 'page', color: 'bg-purple-100 text-purple-600', customIconUrl: currentCompany.calendar_tab_icon_url },
                        { name: 'Clients', icon: 'Building2', path: '/clients', type: 'page', color: 'bg-indigo-100 text-indigo-600', customIconUrl: currentCompany.clients_tab_icon_url }
                    ]
                },
                {
                    title: 'Operations',
                    items: [
                        { name: 'Planner', icon: 'ClipboardList', path: '/work-orders', type: 'page', color: 'bg-orange-100 text-orange-600', customIconUrl: currentCompany.schedule_tab_icon_url },
                        { name: 'Time Tracker', icon: 'Clock', path: '/time-tracker', type: 'page', color: 'bg-blue-600 text-white', customIconUrl: currentCompany.time_tracker_tab_icon_url },
                        { name: 'Quick Tasks', icon: 'ListTodo', path: '/quick-tasks', type: 'page', color: 'bg-emerald-100 text-emerald-600', customIconUrl: currentCompany.quick_tasks_tab_icon_url },
                        { name: 'Projects', icon: 'Briefcase', path: '/projects', type: 'page', color: 'bg-pink-100 text-pink-600', customIconUrl: currentCompany.projects_tab_icon_url },
                        { name: 'Contacts', icon: 'Building', path: '/contacts', type: 'page', color: 'bg-cyan-100 text-cyan-600', customIconUrl: currentCompany.contacts_tab_icon_url }
                    ]
                },
                {
                    title: 'Connection',
                    items: [
                        { name: 'AI Assistant', icon: 'Bot', path: '/ai-assistant', type: 'page', badge: 'AI', color: 'bg-violet-100 text-violet-600', customIconUrl: currentCompany.ai_assistant_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/ddfcb84fc_Gemini_Generated_Image_8uh0068uh0068uh0.png' },
                        { name: 'Chat', icon: 'MessageSquare', path: '/chat', type: 'page', color: 'bg-green-100 text-green-600', customIconUrl: currentCompany.chat_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/5280bc6a8_Gemini_Generated_Image_lxhgu9lxhgu9lxhg.png' }
                    ]
                },
                {
                    title: 'Resources',
                    items: [
                        { name: 'Assets', icon: 'Package', path: '/assets', type: 'page', customIconUrl: currentCompany.documents_assets_tab_icon_url },
                        { name: 'Client Equipment', icon: 'Equipment', path: '/equipment', type: 'page', customIconUrl: currentCompany.calendar_tab_icon_url }
                    ]
                },
                {
                    title: 'HR',
                    items: [
                        { name: 'Users', icon: 'Users', path: '/users', type: 'page', adminOnly: true, customIconUrl: currentCompany.users_tab_icon_url },
                        { name: 'Petty Cash', icon: 'Wallet', path: '/petty-cash', type: 'page', customIconUrl: currentCompany.petty_cash_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/e4658121a_payroll.png' },
                        { name: 'Payroll', icon: 'Dollar', path: '/payroll', type: 'page', customIconUrl: currentCompany.payroll_tab_icon_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68be895889fc1a618ee5fab2/69f93a109_Gemini_Generated_Image_hfvozihfvozihfvo.png' }
                    ]
                }
            ];

            const navigation = navConfig?.sections || defaultNavigation;

            const filteredNavigation = navigation.map(section => ({
                ...section,
                items: section.items.filter(item => {
                    if (item.adminOnly === true && !isAdmin) return false;
                    return true;
                })
            })).filter(section => section.items.length > 0);

            return Response.json({
                success: true,
                data: {
                    user: { id: currentUser.id, full_name: currentUser.full_name, email: currentUser.email, role: currentUser.role, avatar_url: currentUser.avatar_url },
                    navigation: filteredNavigation
                }
            });
        } catch (error) {
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }
    }

      // if (method === 'GET' && action === 'getStats') {
      //     const date = url.searchParams.get('date'); 
          
      //     if (!date) {
      //       return Response.json({ error: 'date parameter is required (YYYY-MM-DD)' }, { status: 400 });
      //     }

      //     try {
      //       // تحسين 1: الفلترة في قاعدة البيانات بدلاً من الجلب الكامل
      //       // هذا يمنع الانهيار بسبب كثرة البيانات
      //       const [dayTimesheets, dayWorkOrders] = await Promise.all([
      //         // جلب فقط سجلات الموظف لهذا التاريخ المحدد
      //         base44.asServiceRole.entities.TimesheetEntry.filter({
      //           employee_id: userId,
      //           clock_in_time: { $startsWith: date } 
      //         }).catch(() => []),

      //         // جلب أوامر العمل المخطط لها لهذا اليوم فقط والمخصصة لهذا المستخدم
      //         base44.asServiceRole.entities.TimeEntry.filter({
      //           planned_start_time: { $startsWith: date },
      //           status: { $ne: 'closed' } // استبعاد المغلقة من قاعدة البيانات
      //         }).catch(() => [])
      //       ]);

      //       // تحسين 2: التحقق من التكليف (Assignment) برمجياً للمصفوفة المصغرة
      //       const assignedWorkOrders = dayWorkOrders.filter(wo => {
      //         const employeeIds = wo.employee_ids || (wo.employee_id ? [wo.employee_id] : []);
      //         return employeeIds.includes(userId);
      //       });

      //       const totalMinutes = dayTimesheets.reduce((sum, ts) => sum + (ts.total_duration_minutes || 0), 0);
      //       const totalHours = (totalMinutes / 60).toFixed(2);

      //       const workOrdersByStatus = {
      //         on_queue: assignedWorkOrders.filter(wo => wo.status === 'on_queue').length,
      //         ongoing: assignedWorkOrders.filter(wo => wo.status === 'ongoing').length,
      //         closed: assignedWorkOrders.filter(wo => wo.status === 'closed').length
      //       };

      //       const projectIds = [...new Set(assignedWorkOrders.map(wo => wo.project_id).filter(Boolean))];
            
      //       // تحسين 3: جلب المشاريع فقط إذا كانت القائمة صغيرة
      //       let projects = [];
      //       if (projectIds.length > 0) {
      //         projects = await base44.asServiceRole.entities.Project.filter({ 
      //           id: { $in: projectIds.slice(0, 20) } 
      //         }).catch(() => []);
      //       }

      //       return Response.json({
      //         success: true,
      //         data: {
      //           date: date,
      //           user_id: userId,
      //           timesheets: {
      //             count: dayTimesheets.length,
      //             total_hours: totalHours,
      //             total_minutes: totalMinutes,
      //             active: dayTimesheets.filter(ts => ts.is_active === true).length
      //           },
      //           work_orders: {
      //             count: assignedWorkOrders.length,
      //             by_status: workOrdersByStatus,
      //             items: assignedWorkOrders.map(wo => ({
      //               id: wo.id,
      //               work_order_number: wo.work_order_number,
      //               title: wo.title,
      //               status: wo.status,
      //               project_id: wo.project_id,
      //               planned_start_time: wo.planned_start_time
      //             }))
      //           },
      //           projects: projects.map(p => ({
      //             id: p.id,
      //             name: p.name
      //           }))
      //         }
      //       });
      //     } catch (error) {
      //       console.error('Stats processing error:', error);
      //       return Response.json({ success: false, error: error.message }, { status: 500 });
      //     }
      //   }





// if (method === 'GET' && action === 'getStats') {
//     const date = url.searchParams.get('date'); // المتوقع YYYY-MM-DD

//     if (!date) {
//         return Response.json({ error: 'date parameter is required' }, { status: 400 });
//     }

//     try {
//         // 1️⃣ جلب البيانات: سنقلل القيود في الاستعلام لضمان وصول البيانات ثم نفلترها برمجياً
//         const [rawTimesheets, rawWorkOrders] = await Promise.all([
//             // جلب سجلات الموظف (بدون فلتر التاريخ حالياً للتأكد من وصول البيانات)
//             base44.asServiceRole.entities.TimesheetEntry.filter({
//                 employee_id: userId
//             }).catch(() => []),

//             // جلب أوامر العمل (سنعتمد على الترتيب والحد لجلب أحدث البيانات)
//             base44.asServiceRole.entities.TimeEntry.filter(
//                 { archived: false }, 
//                 '-planned_start_time', 
//                 100 
//             ).catch(() => [])
//         ]);

//         // 2️⃣ الفلترة البرمجية الدقيقة للتاريخ (لحل مشكلة $startsWith)
//         const dayTimesheets = rawTimesheets.filter(ts => 
//             ts.clock_in_time && ts.clock_in_time.includes(date)
//         );

//         // 3️⃣ حساب الساعات والأوفر تايم
//         let totalMinutes = 0, totalOvertimePaid = 0, totalOvertimeNonPaid = 0, totalRegularHours = 0;

//         dayTimesheets.forEach(ts => {
//             totalMinutes += (ts.total_duration_minutes || 0);
//             totalOvertimePaid += (ts.overtime_hours_paid_calculated || 0);
//             totalOvertimeNonPaid += (ts.overtime_hours_non_paid_calculated || 0);
//             totalRegularHours += (ts.regular_hours_calculated || 0);
//         });

//         // 4️⃣ استخراج المهام (Tasks) بدقة من داخل الـ Work Orders
//         const assignedTasks = [];
        
//         rawWorkOrders.forEach(wo => {
//             // فحص إذا كان الـ Work Order نفسه في هذا التاريخ
//             const isSameDay = wo.planned_start_time && wo.planned_start_time.includes(date);
            
//             if (isSameDay && Array.isArray(wo.tasks)) {
//                 wo.tasks.forEach(task => {
//                     // فحص التكليف: هل الموظف موجود في المصفوفة؟
//                     const isEmployeeAssigned = 
//                         (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) ||
//                         (task.leader_id === userId);

//                     if (isEmployeeAssigned) {
//                         assignedTasks.push({
//                             task_id: task.id,
//                             task_name: task.name,
//                             status: task.status || 'pending',
//                             parent_wo_title: wo.title
//                         });
//                     }
//                 });
//             }
//         });

//         const completedTasks = assignedTasks.filter(t => t.status === 'completed').length;

//         // 5️⃣ جلب المشاريع
//         const projectIds = [...new Set(rawWorkOrders.filter(wo => wo.planned_start_time?.includes(date)).map(wo => wo.project_id).filter(Boolean))];
//         let projects = [];
//         if (projectIds.length > 0) {
//             projects = await base44.asServiceRole.entities.Project.filter({
//                 id: { $in: projectIds.slice(0, 20) }
//             }).catch(() => []);
//         }

//         return Response.json({
//             success: true,
//             debug_info: { // هذا الجزء للفحص فقط، يمكنك حذفه لاحقاً
//                 total_raw_timesheets: rawTimesheets.length,
//                 total_raw_work_orders: rawWorkOrders.length,
//                 searching_for_date: date,
//                 searching_for_user: userId
//             },
//             data: {
//                 date: date,
//                 user_id: userId,
//                 timesheets: {
//                     count: dayTimesheets.length,
//                     total_hours: (totalMinutes / 60).toFixed(2),
//                     total_minutes: totalMinutes,
//                     active: dayTimesheets.filter(ts => ts.is_active === true).length,
//                     overtime: {
//                         paid: totalOvertimePaid.toFixed(2),
//                         non_paid: totalOvertimeNonPaid.toFixed(2),
//                         total: (totalOvertimePaid + totalOvertimeNonPaid).toFixed(2)
//                     },
//                     regular_hours: totalRegularHours.toFixed(2)
//                 },
//                 tasks: {
//                     total_count: assignedTasks.length,
//                     completed_count: completedTasks,
//                     pending_count: assignedTasks.length - completedTasks,
//                     items: assignedTasks
//                 },
//                 projects: projects.map(p => ({ id: p.id, name: p.name }))
//             }
//         });

//     } catch (error) {
//         return Response.json({ success: false, error: error.message }, { status: 500 });
//     }
// }

// if (method === 'GET' && action === 'getStats') {
//     const date = url.searchParams.get('date'); // المتوقع YYYY-MM-DD

//     if (!date) {
//         return Response.json({ error: 'date parameter is required' }, { status: 400 });
//     }

//     try {
//         const currentMonth = date.substring(0, 7); // استخراج YYYY-MM
//         const [year, month] = currentMonth.split('-').map(Number);

//         // 1️⃣ جلب البيانات: جلب بيانات واسعة للسماح بالتحليل الشهري
//         const [rawTimesheets, rawWorkOrders] = await Promise.all([
//             base44.asServiceRole.entities.TimesheetEntry.filter({
//                 employee_id: userId
//             }).catch(() => []),

//             base44.asServiceRole.entities.TimeEntry.filter(
//                 { archived: false }, 
//                 '-planned_start_time', 
//                 500 
//             ).catch(() => [])
//         ]);

//         // 2️⃣ الفلترة البرمجية لليوم المحدد
//         const dayTimesheets = rawTimesheets.filter(ts => 
//             ts.clock_in_time && ts.clock_in_time.includes(date)
//         );

//         // 3️⃣ حساب إحصائيات اليوم (ساعات وأوفر تايم)
//         let totalMinutes = 0, totalOvertimePaid = 0, totalOvertimeNonPaid = 0, totalRegularHours = 0;

//         dayTimesheets.forEach(ts => {
//             totalMinutes += (ts.total_duration_minutes || 0);
//             totalOvertimePaid += (ts.overtime_hours_paid_calculated || 0);
//             totalOvertimeNonPaid += (ts.overtime_hours_non_paid_calculated || 0);
//             totalRegularHours += (ts.regular_hours_calculated || 0);
//         });

//         // 4️⃣ استخراج مهام اليوم المحدد
//         const assignedTasks = [];
//         rawWorkOrders.forEach(wo => {
//             const isSameDay = wo.planned_start_time && wo.planned_start_time.includes(date);
//             if (isSameDay && Array.isArray(wo.tasks)) {
//                 wo.tasks.forEach(task => {
//                     const isEmployeeAssigned = 
//                         (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) ||
//                         (task.leader_id === userId);

//                     if (isEmployeeAssigned) {
//                         assignedTasks.push({
//                             task_id: task.id,
//                             task_name: task.name,
//                             status: task.status || 'pending',
//                             parent_wo_title: wo.title
//                         });
//                     }
//                 });
//             }
//         });

//         const completedTasks = assignedTasks.filter(t => t.status === 'completed').length;

//         // 5️⃣ تحليل البيانات شهرياً (توليد كافة أيام الشهر الحالي)
//         const dailyBreakdown = {};
//         const daysInMonth = new Date(year, month, 0).getDate();

//         // تهيئة كافة أيام الشهر بقيم صفرية
//         for (let i = 1; i <= daysInMonth; i++) {
//             const dayString = `${currentMonth}-${String(i).padStart(2, '0')}`;
//             dailyBreakdown[dayString] = { completed: 0, pending: 0, overtime: 0 };
//         }

//         // ملء بيانات الوقت الإضافي من السجلات الموجودة
//         rawTimesheets.forEach(ts => {
//             if (ts.clock_in_time && ts.clock_in_time.includes(currentMonth)) {
//                 const day = ts.clock_in_time.split('T')[0];
//                 if (dailyBreakdown[day]) {
//                     dailyBreakdown[day].overtime += ((ts.overtime_hours_paid_calculated || 0) + (ts.overtime_hours_non_paid_calculated || 0));
//                 }
//             }
//         });

//         // ملء بيانات المهام من السجلات الموجودة
//         rawWorkOrders.forEach(wo => {
//             if (wo.planned_start_time && wo.planned_start_time.includes(currentMonth)) {
//                 const day = wo.planned_start_time.split('T')[0];
//                 if (dailyBreakdown[day] && Array.isArray(wo.tasks)) {
//                     wo.tasks.forEach(task => {
//                         const isEmployeeAssigned = 
//                             (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) ||
//                             (task.leader_id === userId);
                        
//                         if (isEmployeeAssigned) {
//                             if (task.status === 'completed') dailyBreakdown[day].completed++;
//                             else dailyBreakdown[day].pending++;
//                         }
//                     });
//                 }
//             }
//         });

//         // 6️⃣ جلب المشاريع
//         const projectIds = [...new Set(rawWorkOrders.filter(wo => wo.planned_start_time?.includes(date)).map(wo => wo.project_id).filter(Boolean))];
//         let projects = [];
//         if (projectIds.length > 0) {
//             projects = await base44.asServiceRole.entities.Project.filter({
//                 id: { $in: projectIds.slice(0, 20) }
//             }).catch(() => []);
//         }

//         return Response.json({
//             success: true,
//             debug_info: {
//                 total_raw_timesheets: rawTimesheets.length,
//                 total_raw_work_orders: rawWorkOrders.length,
//                 searching_for_date: date,
//                 current_month: currentMonth
//             },
//             data: {
//                 date: date,
//                 user_id: userId,
//                 timesheets: {
//                     count: dayTimesheets.length,
//                     total_hours: (totalMinutes / 60).toFixed(2),
//                     total_minutes: totalMinutes,
//                     active: dayTimesheets.filter(ts => ts.is_active === true).length,
//                     overtime: {
//                         paid: totalOvertimePaid.toFixed(2),
//                         non_paid: totalOvertimeNonPaid.toFixed(2),
//                         total: (totalOvertimePaid + totalOvertimeNonPaid).toFixed(2)
//                     },
//                     regular_hours: totalRegularHours.toFixed(2)
//                 },
//                 tasks: {
//                     total_count: assignedTasks.length,
//                     completed_count: completedTasks,
//                     pending_count: assignedTasks.length - completedTasks,
//                     items: assignedTasks
//                 },
//                 projects: projects.map(p => ({ id: p.id, name: p.name })),
//                 monthly_stats: {
//                     month: currentMonth,
//                     daily_detail: dailyBreakdown,
//                     total_monthly_overtime: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.overtime, 0).toFixed(2),
//                     total_monthly_completed_tasks: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.completed, 0),
//                     total_monthly_pending_tasks: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.pending, 0)
//                 }
//             }
//         });

//     } catch (error) {
//         return Response.json({ success: false, error: error.message }, { status: 500 });
//     }
// }




// if (method === 'GET' && action === 'getStats') {
//     const date = url.searchParams.get('date'); // المتوقع YYYY-MM-DD

//     if (!date) {
//         return Response.json({ error: 'date parameter is required' }, { status: 400 });
//     }

//     try {
//         const currentMonth = date.substring(0, 7); // استخراج YYYY-MM
//         const [year, month] = currentMonth.split('-').map(Number);
        
//         // التحقق من صلاحية الأدمن (نفترض وجود متغير userRole أو فحص من الـ token)
        

//         // 1️⃣ جلب البيانات: إذا كان أدمن نجلب الجميع، وإذا كان موظف نجلب بياناته فقط
//         const timesheetFilter = isAdmin ? {} : { employee_id: userId };
//         const workOrderFilter = { archived: false };

//         const [rawTimesheets, rawWorkOrders, allUsers] = await Promise.all([
//             base44.asServiceRole.entities.TimesheetEntry.filter(timesheetFilter).catch(() => []),
//             base44.asServiceRole.entities.TimeEntry.filter(workOrderFilter, '-planned_start_time', 1000).catch(() => []),
//             isAdmin ? base44.asServiceRole.entities.User.filter({}, 'name', 100).catch(() => []) : []
//         ]);

//         // 2️⃣ الفلترة البرمجية لليوم المحدد (للمستخدم الحالي)
//         const dayTimesheets = rawTimesheets.filter(ts => 
//             ts.employee_id === userId && ts.clock_in_time && ts.clock_in_time.includes(date)
//         );

//         // 3️⃣ حساب إحصائيات اليوم للمستخدم الحالي
//         let totalMinutes = 0, totalOvertimePaid = 0, totalOvertimeNonPaid = 0, totalRegularHours = 0;
//         dayTimesheets.forEach(ts => {
//             totalMinutes += (ts.total_duration_minutes || 0);
//             totalOvertimePaid += (ts.overtime_hours_paid_calculated || 0);
//             totalOvertimeNonPaid += (ts.overtime_hours_non_paid_calculated || 0);
//             totalRegularHours += (ts.regular_hours_calculated || 0);
//         });

//         // 4️⃣ استخراج مهام اليوم المحدد للمستخدم الحالي
//         const assignedTasks = [];
//         rawWorkOrders.forEach(wo => {
//             const isSameDay = wo.planned_start_time && wo.planned_start_time.includes(date);
//             if (isSameDay && Array.isArray(wo.tasks)) {
//                 wo.tasks.forEach(task => {
//                     const isEmployeeAssigned = 
//                         (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) ||
//                         (task.leader_id === userId);

//                     if (isEmployeeAssigned) {
//                         assignedTasks.push({
//                             task_id: task.id,
//                             task_name: task.name,
//                             status: task.status || 'pending',
//                             parent_wo_title: wo.title
//                         });
//                     }
//                 });
//             }
//         });

//         const completedTasks = assignedTasks.filter(t => t.status === 'completed').length;

//         // 5️⃣ تحليل البيانات شهرياً (للمستخدم الحالي)
//         const dailyBreakdown = {};
//         const daysInMonth = new Date(year, month, 0).getDate();

//         for (let i = 1; i <= daysInMonth; i++) {
//             const dayString = `${currentMonth}-${String(i).padStart(2, '0')}`;
//             dailyBreakdown[dayString] = { completed: 0, pending: 0, overtime: 0 };
//         }

//         rawTimesheets.filter(ts => ts.employee_id === userId).forEach(ts => {
//             if (ts.clock_in_time && ts.clock_in_time.includes(currentMonth)) {
//                 const day = ts.clock_in_time.split('T')[0];
//                 if (dailyBreakdown[day]) {
//                     dailyBreakdown[day].overtime += ((ts.overtime_hours_paid_calculated || 0) + (ts.overtime_hours_non_paid_calculated || 0));
//                 }
//             }
//         });

//         rawWorkOrders.forEach(wo => {
//             if (wo.planned_start_time && wo.planned_start_time.includes(currentMonth)) {
//                 const day = wo.planned_start_time.split('T')[0];
//                 if (dailyBreakdown[day] && Array.isArray(wo.tasks)) {
//                     wo.tasks.forEach(task => {
//                         const isEmployeeAssigned = (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) || (task.leader_id === userId);
//                         if (isEmployeeAssigned) {
//                             if (task.status === 'completed') dailyBreakdown[day].completed++;
//                             else dailyBreakdown[day].pending++;
//                         }
//                     });
//                 }
//             }
//         });

//         // 🆕 6️⃣ إضافة الأدمن: تجميع بيانات كل الموظفين لكل يوم
//         let adminDailyStats = {};
//         if (isAdmin) {
//             for (let i = 1; i <= daysInMonth; i++) {
//                 const dayString = `${currentMonth}-${String(i).padStart(2, '0')}`;
//                 adminDailyStats[dayString] = [];

//                 allUsers.forEach(u => {
//                     let uOvertime = 0;
//                     let uCompleted = 0;
//                     let uPending = 0;

//                     // حساب الأوفر تايم للموظف في هذا اليوم
//                     rawTimesheets.filter(ts => ts.employee_id === u.id && ts.clock_in_time?.startsWith(dayString)).forEach(ts => {
//                         uOvertime += ((ts.overtime_hours_paid_calculated || 0) + (ts.overtime_hours_non_paid_calculated || 0));
//                     });

//                     // حساب مهام الموظف في هذا اليوم
//                     rawWorkOrders.filter(wo => wo.planned_start_time?.startsWith(dayString)).forEach(wo => {
//                         wo.tasks?.forEach(t => {
//                             if (t.employee_ids?.includes(u.id) || t.leader_id === u.id) {
//                                 if (t.status === 'completed') uCompleted++;
//                                 else uPending++;
//                             }
//                         });
//                     });

//                     if (uOvertime > 0 || uCompleted > 0 || uPending > 0) {
//                         adminDailyStats[dayString].push({
//                             user_id: u.id,
//                             user_name: u.full_name,
//                             user_picture: u.avatar_url,
//                             overtime: uOvertime.toFixed(2),
//                             completed_tasks: uCompleted,
//                             pending_tasks: uPending
//                         });
//                     }
//                 });
//             }
//         }

//         // 7️⃣ جلب المشاريع
//         const projectIds = [...new Set(rawWorkOrders.filter(wo => wo.planned_start_time?.includes(date)).map(wo => wo.project_id).filter(Boolean))];
//         let projects = [];
//         if (projectIds.length > 0) {
//             projects = await base44.asServiceRole.entities.Project.filter({
//                 id: { $in: projectIds.slice(0, 20) }
//             }).catch(() => []);
//         }

//         return Response.json({
//             success: true,
//             data: {
//                 date: date,
//                 user_id: userId,
//                 is_admin: isAdmin,
//                 timesheets: {
//                     count: dayTimesheets.length,
//                     total_hours: (totalMinutes / 60).toFixed(2),
//                     total_minutes: totalMinutes,
//                     active: dayTimesheets.filter(ts => ts.is_active === true).length,
//                     overtime: {
//                         paid: totalOvertimePaid.toFixed(2),
//                         non_paid: totalOvertimeNonPaid.toFixed(2),
//                         total: (totalOvertimePaid + totalOvertimeNonPaid).toFixed(2)
//                     },
//                     regular_hours: totalRegularHours.toFixed(2)
//                 },
//                 tasks: {
//                     total_count: assignedTasks.length,
//                     completed_count: completedTasks,
//                     pending_count: assignedTasks.length - completedTasks,
//                     items: assignedTasks
//                 },
//                 projects: projects.map(p => ({ id: p.id, name: p.name })),
//                 monthly_stats: {
//                     month: currentMonth,
//                     daily_detail: dailyBreakdown,
//                     total_monthly_overtime: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.overtime, 0).toFixed(2),
//                     total_monthly_completed_tasks: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.completed, 0),
//                     total_monthly_pending_tasks: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.pending, 0)
//                 },
//                 // إضافة بيانات الأدمن فقط إذا كان أدمن
//                 admin_stats: isAdmin ? { daily_users_summary: adminDailyStats } : null
//             }
//         });

//     } catch (error) {
//         return Response.json({ success: false, error: error.message }, { status: 500 });
//     }
// }
// if (method === 'GET' && action === 'getStats') {
//     const date = url.searchParams.get('date'); // المتوقع YYYY-MM-DD

//     if (!date) {
//         return Response.json({ error: 'date parameter is required' }, { status: 400 });
//     }

//     try {
//         const currentMonth = date.substring(0, 7); // استخراج YYYY-MM
//         const [year, month] = currentMonth.split('-').map(Number);
        
//         // التحقق من صلاحية الأدمن

//         // 1️⃣ جلب البيانات
//         const timesheetFilter = isAdmin ? {} : { employee_id: userId };
//         const workOrderFilter = { archived: false };

//         const [rawTimesheets, rawWorkOrders, allUsers] = await Promise.all([
//             base44.asServiceRole.entities.TimesheetEntry.filter(timesheetFilter).catch(() => []),
//             base44.asServiceRole.entities.TimeEntry.filter(workOrderFilter, '-planned_start_time', 1000).catch(() => []),
//             isAdmin ? base44.asServiceRole.entities.User.filter({}, 'name', 100).catch(() => []) : []
//         ]);

//         // 2️⃣ الفلترة البرمجية لليوم المحدد (للمستخدم الحالي)
//         const dayTimesheets = rawTimesheets.filter(ts => 
//             ts.employee_id === userId && ts.clock_in_time && ts.clock_in_time.includes(date)
//         );

//         // 3️⃣ حساب إحصائيات اليوم للمستخدم الحالي
//         let totalMinutes = 0, totalOvertimePaid = 0, totalOvertimeNonPaid = 0, totalRegularHours = 0;
//         dayTimesheets.forEach(ts => {
//             totalMinutes += (ts.total_duration_minutes || 0);
//             totalOvertimePaid += (ts.overtime_hours_paid_calculated || 0);
//             totalOvertimeNonPaid += (ts.overtime_hours_non_paid_calculated || 0);
//             totalRegularHours += (ts.regular_hours_calculated || 0);
//         });

//         // 4️⃣ استخراج مهام اليوم المحدد للمستخدم الحالي
//         const assignedTasks = [];
//         rawWorkOrders.forEach(wo => {
//             const isSameDay = wo.planned_start_time && wo.planned_start_time.includes(date);
//             if (isSameDay && Array.isArray(wo.tasks)) {
//                 wo.tasks.forEach(task => {
//                     const isEmployeeAssigned = 
//                         (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) ||
//                         (task.leader_id === userId);

//                     if (isEmployeeAssigned) {
//                         assignedTasks.push({
//                             task_id: task.id,
//                             task_name: task.name,
//                             status: task.status || 'pending',
//                             parent_wo_title: wo.title
//                         });
//                     }
//                 });
//             }
//         });

//         const completedTasks = assignedTasks.filter(t => t.status === 'completed').length;

//         // 5️⃣ تحليل البيانات شهرياً (للمستخدم الحالي)
//         const dailyBreakdown = {};
//         const daysInMonth = new Date(year, month, 0).getDate();

//         for (let i = 1; i <= daysInMonth; i++) {
//             const dayString = `${currentMonth}-${String(i).padStart(2, '0')}`;
//             dailyBreakdown[dayString] = { completed: 0, pending: 0, overtime: 0 };
//         }

//         rawTimesheets.filter(ts => ts.employee_id === userId).forEach(ts => {
//             if (ts.clock_in_time && ts.clock_in_time.includes(currentMonth)) {
//                 const day = ts.clock_in_time.split('T')[0];
//                 if (dailyBreakdown[day]) {
//                     dailyBreakdown[day].overtime += ((ts.overtime_hours_paid_calculated || 0) + (ts.overtime_hours_non_paid_calculated || 0));
//                 }
//             }
//         });

//         rawWorkOrders.forEach(wo => {
//             if (wo.planned_start_time && wo.planned_start_time.includes(currentMonth)) {
//                 const day = wo.planned_start_time.split('T')[0];
//                 if (dailyBreakdown[day] && Array.isArray(wo.tasks)) {
//                     wo.tasks.forEach(task => {
//                         const isEmployeeAssigned = (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) || (task.leader_id === userId);
//                         if (isEmployeeAssigned) {
//                             if (task.status === 'completed') dailyBreakdown[day].completed++;
//                             else dailyBreakdown[day].pending++;
//                         }
//                     });
//                 }
//             }
//         });

//         // 6️⃣ إضافة الأدمن: تجميع بيانات كل الموظفين لكل يوم مع التأكد من الأسماء والصور
//         let adminDailyStats = {};
//         if (isAdmin) {
//             for (let i = 1; i <= daysInMonth; i++) {
//                 const dayString = `${currentMonth}-${String(i).padStart(2, '0')}`;
//                 adminDailyStats[dayString] = [];

//                 allUsers.forEach(u => {
//                     let uOvertime = 0;
//                     let uCompleted = 0;
//                     let uPending = 0;

//                     rawTimesheets.filter(ts => ts.employee_id === u.id && ts.clock_in_time?.startsWith(dayString)).forEach(ts => {
//                         uOvertime += ((ts.overtime_hours_paid_calculated || 0) + (ts.overtime_hours_non_paid_calculated || 0));
//                     });

//                     rawWorkOrders.filter(wo => wo.planned_start_time?.startsWith(dayString)).forEach(wo => {
//                         wo.tasks?.forEach(t => {
//                             if (t.employee_ids?.includes(u.id) || t.leader_id === u.id) {
//                                 if (t.status === 'completed') uCompleted++;
//                                 else uPending++;
//                             }
//                         });
//                     });

//                     if (uOvertime > 0 || uCompleted > 0 || uPending > 0) {
//                         adminDailyStats[dayString].push({
//                             user_id: u.id,
//                             user_name: u.full_name || "Unknown", // استخدام name بدلاً من full_name
//                             user_picture: u.avatar_url || "",  // استخدام picture بدلاً من avatar_url
//                             overtime: uOvertime.toFixed(2),
//                             completed_tasks: uCompleted,
//                             pending_tasks: uPending
//                         });
//                     }
//                 });
//             }
//         }

//         // 7️⃣ جلب المشاريع
//         const projectIds = [...new Set(rawWorkOrders.filter(wo => wo.planned_start_time?.includes(date)).map(wo => wo.project_id).filter(Boolean))];
//         let projects = [];
//         if (projectIds.length > 0) {
//             projects = await base44.asServiceRole.entities.Project.filter({
//                 id: { $in: projectIds.slice(0, 20) }
//             }).catch(() => []);
//         }

//         return Response.json({
//             success: true,
//             data: {
//                 date: date,
//                 user_id: userId,
//                 is_admin: isAdmin,
//                 timesheets: {
//                     count: dayTimesheets.length,
//                     total_hours: (totalMinutes / 60).toFixed(2),
//                     total_minutes: totalMinutes,
//                     active: dayTimesheets.filter(ts => ts.is_active === true).length,
//                     overtime: {
//                         paid: totalOvertimePaid.toFixed(2),
//                         non_paid: totalOvertimeNonPaid.toFixed(2),
//                         total: (totalOvertimePaid + totalOvertimeNonPaid).toFixed(2)
//                     },
//                     regular_hours: totalRegularHours.toFixed(2)
//                 },
//                 tasks: {
//                     total_count: assignedTasks.length,
//                     completed_count: completedTasks,
//                     pending_count: assignedTasks.length - completedTasks,
//                     items: assignedTasks
//                 },
//                 projects: projects.map(p => ({ id: p.id, name: p.name })),
//                 monthly_stats: {
//                     month: currentMonth,
//                     daily_detail: dailyBreakdown,
//                     total_monthly_overtime: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.overtime, 0).toFixed(2),
//                     total_monthly_completed_tasks: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.completed, 0),
//                     total_monthly_pending_tasks: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.pending, 0)
//                 },
//                 admin_stats: isAdmin ? { daily_users_summary: adminDailyStats } : null
//             }
//         });

//     } catch (error) {
//         return Response.json({ success: false, error: error.message }, { status: 500 });
//     }
// }



if (method === 'GET' && action === 'getStats') {
    const date = url.searchParams.get('date');

    if (!date) {
        return Response.json({ error: 'date parameter is required' }, { status: 400 });
    }

    try {
        const currentMonth = date.substring(0, 7);
        const [year, month] = currentMonth.split('-').map(Number);
        
        const timesheetFilter = isAdmin ? {} : { employee_id: userId };
        const workOrderFilter = { archived: false };

        const [rawTimesheets, rawWorkOrders, allUsers, settings, overtimeRules] = await Promise.all([
            base44.asServiceRole.entities.TimesheetEntry.filter(timesheetFilter).catch(() => []),
            base44.asServiceRole.entities.TimeEntry.filter(workOrderFilter, '-planned_start_time', 1000).catch(() => []),
            isAdmin ? base44.asServiceRole.entities.User.filter({}, 'name', 100).catch(() => []) : [],
            base44.asServiceRole.entities.AppSettings.list('setting_key', 1000).catch(() => []),
            base44.asServiceRole.entities.OvertimeRulePeriod.list('-start_date', 100).catch(() => [])
        ]);

        let globalHoursSettings = { regular_hours_per_day: 8, non_payable_overtime_hours: 0 };
        settings.forEach(s => {
            if (s.setting_key.startsWith('timesheet_hours_')) {
                const key = s.setting_key.replace('timesheet_hours_', '');
                const val = parseFloat(s.setting_value);
                if (!isNaN(val)) globalHoursSettings[key] = val;
            }
        });

        const getActiveRule = (dateStr) => {
            return overtimeRules.find(r => r.start_date <= dateStr && r.end_date >= dateStr) || null;
        };

        // --- حساب بيانات اليوم المحدد ---
        const dayTimesheets = rawTimesheets.filter(ts => 
            ts.employee_id === userId && ts.clock_in_time && ts.clock_in_time.includes(date)
        );

        const totalDayMinutes = dayTimesheets.reduce((sum, ts) => sum + (ts.total_duration_minutes || 0), 0);
        const activeRule = getActiveRule(date);

        const regularHoursPerDay = activeRule?.regular_hours_per_day ?? globalHoursSettings.regular_hours_per_day ?? 8;
        const nonPayableOvertimeHours = activeRule?.non_payable_overtime_hours ?? globalHoursSettings.non_payable_overtime_hours ?? 0;

        const totalHours = totalDayMinutes / 60;
        const extraHours = Math.max(0, totalHours - regularHoursPerDay);

        // حساب الساعات غير المدفوعة (تأخذ من الساعات الإضافية بحد أقصى القيمة المحددة في الإعدادات)
        const unpaidOTHours = Math.min(extraHours, nonPayableOvertimeHours);
        const paidOTHours = Math.max(0, extraHours - unpaidOTHours);

        const totalOvertimePaid = paidOTHours;
        const totalOvertimeNonPaid = unpaidOTHours;
        const totalRegularHours = Math.min(totalHours, regularHoursPerDay);

        // --- حساب المهام ---
        const assignedTasks = [];
        rawWorkOrders.forEach(wo => {
            const isSameDay = wo.planned_start_time && wo.planned_start_time.includes(date);
            if (isSameDay && Array.isArray(wo.tasks)) {
                wo.tasks.forEach(task => {
                    const isEmployeeAssigned = 
                        (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) ||
                        (task.leader_id === userId);

                    if (isEmployeeAssigned) {
                        assignedTasks.push({
                            task_id: task.id,
                            task_name: task.name,
                            status: task.status || 'pending',
                            parent_wo_title: wo.title
                        });
                    }
                });
            }
        });

        const completedTasks = assignedTasks.filter(t => t.status === 'completed').length;

        // --- حساب الإحصائيات الشهرية ---
        const dailyBreakdown = {};
        const daysInMonth = new Date(year, month, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            const dayString = `${currentMonth}-${String(i).padStart(2, '0')}`;
            dailyBreakdown[dayString] = { completed: 0, pending: 0, overtime: 0 };
        }

        const monthlyMap = {};
        rawTimesheets.filter(ts => ts.employee_id === userId).forEach(ts => {
            if (ts.clock_in_time && ts.clock_in_time.includes(currentMonth)) {
                const day = ts.clock_in_time.split('T')[0];
                if (!monthlyMap[day]) monthlyMap[day] = 0;
                monthlyMap[day] += (ts.total_duration_minutes || 0);
            }
        });

        Object.entries(monthlyMap).forEach(([day, mins]) => {
            const rule = getActiveRule(day);
            const regH = rule?.regular_hours_per_day ?? globalHoursSettings.regular_hours_per_day ?? 8;
            const nonPayH = rule?.non_payable_overtime_hours ?? globalHoursSettings.non_payable_overtime_hours ?? 0;

            const totalH = mins / 60;
            const extraH = Math.max(0, totalH - regH);
            const unpaidH = Math.min(extraH, nonPayH);
            const paidH = Math.max(0, extraH - unpaidH);

            if (dailyBreakdown[day]) {
                dailyBreakdown[day].overtime = paidH; 
            }
        });

        rawWorkOrders.forEach(wo => {
            if (wo.planned_start_time && wo.planned_start_time.includes(currentMonth)) {
                const day = wo.planned_start_time.split('T')[0];
                if (dailyBreakdown[day] && Array.isArray(wo.tasks)) {
                    wo.tasks.forEach(task => {
                        const isEmployeeAssigned = (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) || (task.leader_id === userId);
                        if (isEmployeeAssigned) {
                            if (task.status === 'completed') dailyBreakdown[day].completed++;
                            else dailyBreakdown[day].pending++;
                        }
                    });
                }
            }
        });

        // --- إحصائيات المدير (Admin) ---
        let adminDailyStats = {};
        if (isAdmin) {
            for (let i = 1; i <= daysInMonth; i++) {
                const dayString = `${currentMonth}-${String(i).padStart(2, '0')}`;
                adminDailyStats[dayString] = [];

                allUsers.forEach(u => {
                    let uCompleted = 0;
                    let uPending = 0;

                    const userDayMinutes = rawTimesheets
                        .filter(ts => ts.employee_id === u.id && ts.clock_in_time?.startsWith(dayString))
                        .reduce((sum, ts) => sum + (ts.total_duration_minutes || 0), 0);

                    const rule = getActiveRule(dayString);
                    const regH = rule?.regular_hours_per_day ?? globalHoursSettings.regular_hours_per_day ?? 8;
                    const nonPayH = rule?.non_payable_overtime_hours ?? globalHoursSettings.non_payable_overtime_hours ?? 0;

                    const totalH = userDayMinutes / 60;
                    const extraH = Math.max(0, totalH - regH);
                    const unpaidH = Math.min(extraH, nonPayH);
                    const paidH = Math.max(0, extraH - unpaidH);

                    rawWorkOrders.filter(wo => wo.planned_start_time?.startsWith(dayString)).forEach(wo => {
                        wo.tasks?.forEach(t => {
                            if (t.employee_ids?.includes(u.id) || t.leader_id === u.id) {
                                if (t.status === 'completed') uCompleted++;
                                else uPending++;
                            }
                        });
                    });

                    if (paidH > 0 || uCompleted > 0 || uPending > 0 || userDayMinutes > 0) {
                        adminDailyStats[dayString].push({
                            user_id: u.id,
                            user_name: u.full_name || "Unknown",
                            user_picture: u.avatar_url || "",
                            overtime: paidH.toFixed(2),
                            completed_tasks: uCompleted,
                            pending_tasks: uPending
                        });
                    }
                });
            }
        }

        const projectIds = [...new Set(rawWorkOrders.filter(wo => wo.planned_start_time?.includes(date)).map(wo => wo.project_id).filter(Boolean))];
        let projects = [];
        if (projectIds.length > 0) {
            projects = await base44.asServiceRole.entities.Project.filter({
                id: { $in: projectIds.slice(0, 20) }
            }).catch(() => []);
        }

        return Response.json({
            success: true,
            data: {
                date: date,
                user_id: userId,
                is_admin: isAdmin,
                timesheets: {
                    count: dayTimesheets.length,
                    total_hours: totalHours.toFixed(2),
                    total_minutes: totalDayMinutes,
                    active: dayTimesheets.filter(ts => ts.is_active === true).length,
                    overtime: {
                        paid: totalOvertimePaid.toFixed(2),
                        non_paid: totalOvertimeNonPaid.toFixed(2),
                        total: extraHours.toFixed(2)
                    },
                    regular_hours: totalRegularHours.toFixed(2)
                },
                tasks: {
                    total_count: assignedTasks.length,
                    completed_count: completedTasks,
                    pending_count: assignedTasks.length - completedTasks,
                    items: assignedTasks
                },
                projects: projects.map(p => ({ id: p.id, name: p.name })),
                monthly_stats: {
                    month: currentMonth,
                    daily_detail: dailyBreakdown,
                    total_monthly_overtime: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.overtime, 0).toFixed(2),
                    total_monthly_completed_tasks: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.completed, 0),
                    total_monthly_pending_tasks: Object.values(dailyBreakdown).reduce((sum, day) => sum + day.pending, 0)
                },
                admin_stats: isAdmin ? { daily_users_summary: adminDailyStats } : null
            }
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
        // --- بقية الأكواد (getSidebarItems, appInit, إلخ) تتبع نفس المنطق ---
        // (بناءً على طلبك بعدم الحذف، تأكد من تطبيق مبدأ $startsWith في appInit أيضاً)

       
       
       
        return Response.json({ error: 'Invalid action' }, { status: 400 });

      } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    });