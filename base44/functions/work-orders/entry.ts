import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { format, parseISO } from 'npm:date-fns@4.1.0';

/**
 * Work Orders API with API Key Authentication
 * 
 * Authentication:
 * - Pass user_id in request headers as 'X-User-ID' or 'user_id'
 * - Or pass API key as 'X-API-Key' or 'api_key'
 * 
 * Endpoints:
 * - GET /api/work-orders - List work orders with filters
 * - GET /api/work-orders/:id - Get single work order
 * - POST /api/work-orders - Create work order (admin only)
 * - PUT /api/work-orders/:id - Update work order (admin only)
 * - DELETE /api/work-orders/:id - Delete work order (admin only)
 * - PATCH /api/work-orders/:id/archive - Archive work order (admin only)
 * - PATCH /api/work-orders/bulk-delete - Bulk delete work orders (admin only)
 * - PATCH /api/work-orders/bulk-archive - Bulk archive work orders (admin only)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const method = req.method;


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


    // Get user ID from headers or query params
    const userId = req.headers.get('X-User-ID') || 
                   req.headers.get('user_id') ||
                   url.searchParams.get('user_id');

    const apiKey = req.headers.get('X-API-Key') || 
                   req.headers.get('api_key') ||
                   url.searchParams.get('api_key');

    if (!userId && !apiKey) {
      return Response.json({ 
        error: 'Authentication required. Provide user_id or api_key in headers or query params.',
        example: 'Headers: X-User-ID: your-user-id or X-API-Key: your-api-key'
      }, { status: 401 });
    }

    // Verify user exists and get their role
    let user = null;
     
    if (userId) {
      const users = await base44.asServiceRole.entities.User.list(); 
      user = users.find(u => u.id === userId);
      
      if (!user) {
        return Response.json({ error: 'Invalid user_id' }, { status: 401 });
      }

      // Check if user is active
      // if (user.status !== 'Active') {
      //   return Response.json({ error: 'User account is not active' }, { status: 403 });
      // }

      // Check if user is archived
      if (user.archived) {
        return Response.json({ error: 'User account is archived' }, { status: 403 });
      }
    } else if (apiKey) {
      // Validate API key (you can store API keys in a separate entity or in user records)
      // For now, we'll check if the API key matches a user's ID (temporary solution)
      const users = await base44.asServiceRole.entities.User.list();
      user = users.find(u => u.id === apiKey || u.email === apiKey);
      
      if (!user) {
        return Response.json({ error: 'Invalid api_key' }, { status: 401 });
      }
    } 

    // Helper function to check if user is admin
    const isAdmin = () => user && user.role === 'admin';
// ======================================================================
//  Unified GET Handler Based on Action Parameter
// ======================================================================
if (method === "GET") {
    const action = url.searchParams.get("action");

if (action === "getTaskReport") {
    try {
        const taskId = url.searchParams.get("taskId");
        if (!taskId) return Response.json({ success: false, error: "Task ID is required" }, { status: 400 });

        // 1️⃣ جلب كافة الوورك أوردرز للبحث عن المهمة والأب (Work Order)
        const allWorkOrders = await base44.asServiceRole.entities.TimeEntry.list();
        const wo = allWorkOrders.find(w => w.tasks?.some(t => t.id === taskId));
        if (!wo) return Response.json({ success: false, error: "Task associated Work Order not found" }, { status: 404 });

        const currentTask = wo.tasks.find(t => t.id === taskId);

        // 2️⃣ البحث في سجلات التايم شيت عن السيجمنت (Segment) الخاص بهذه التاسك
        const allTimesheets = await base44.asServiceRole.entities.TimesheetEntry.list();
        
        let taskSegment = null;
        for (const ts of allTimesheets) {
            if (ts.work_order_segments && Array.isArray(ts.work_order_segments)) {
                const found = ts.work_order_segments.find(segment => segment.task_id === taskId);
                if (found) {
                    taskSegment = found;
                    break;
                }
            }
        }

        // 3️⃣ استخراج الأوقات وحساب الدوريشن من السيجمنت
        let clockIn = "N/A";
        let clockOut = "N/A";
        let calculatedDuration = "0h 0m";

        if (taskSegment) {
            clockIn = taskSegment.start_time;
            clockOut = taskSegment.end_time || "In Progress";

            if (taskSegment.start_time && taskSegment.end_time) {
                const start = new Date(taskSegment.start_time);
                const end = new Date(taskSegment.end_time);
                const diffMs = end - start;
                
                if (diffMs > 0) {
                    const totalMinutes = Math.floor(diffMs / (1000 * 60));
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    calculatedDuration = `${hours}h ${minutes}m`;
                }
            } else if (taskSegment.duration_minutes) {
                const h = Math.floor(taskSegment.duration_minutes / 60);
                const m = taskSegment.duration_minutes % 60;
                calculatedDuration = `${h}h ${m}m`;
            }
        }

        // 4️⃣ جلب بيانات المشروع والمستخدمين والفرق (تصحيح الخطأ هنا)
        const [project, allUsers, allTeams] = await Promise.all([
            wo.project_id ? base44.asServiceRole.entities.Project.get(wo.project_id) : null,
            base44.asServiceRole.entities.User.list(),
            base44.asServiceRole.entities.Team.list() // هذا السطر كان مفقوداً ويسبب الخطأ
        ]);

        const userMap = Object.fromEntries(allUsers.map(u => [u.id, u.full_name || u.email]));
        const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));
        
        const getWorkerNames = (ids) => {
            if (!ids || !Array.isArray(ids)) return "N/A";
            return ids.map(id => userMap[id]).filter(Boolean).join(", ") || "N/A";
        };

        const reportData = {
            header: {
                work_order_no: wo.work_order_number || "N/A",
                working_report_no: wo.work_order_ref || "-",
                title: wo.title || ""
            },
            general_information: {
                company: (project?.customer_id ? (await base44.asServiceRole.entities.Customer.get(project.customer_id))?.name : null) || "N/A",
                category: "Service HST",
                location: wo.start_address || "-",
                project: project?.name || "N/A",
                date: currentTask.date || (clockIn !== "N/A" ? clockIn.split('T')[0] : "N/A"),
                time: `${currentTask.start_time || "07:00"} - ${currentTask.end_time || "17:00"}`,
                management_instructions: [{
                    task_name: currentTask.name,
                    instruction: currentTask.instructions
                }]
            },
            assigned_resources: {
                teams: currentTask.team_ids?.map(id => teamMap[id]).filter(Boolean).join(", ") || "N/A",
                workers: getWorkerNames(currentTask.employee_ids)
            },
            site_report: {
                work_done: currentTask.work_done_items || [],
                work_pending: currentTask.work_pending_items || [],
                spare_parts_installed: currentTask.spare_parts_items || [],
                spare_parts_pending: currentTask.spare_parts_pending_items || [],
                status: currentTask.status
            },
            time_tracker: {
                clock_in: clockIn,
                clock_out: clockOut,
                duration: calculatedDuration
            },
            client_approval: {
                worker_names: getWorkerNames(currentTask.employee_ids),
                client_name: wo.client_representative_name || "-",
                client_signature_url: wo.client_signature_url || ""
            }
        };

        return Response.json({ success: true, data: reportData });

    } catch (error) {
        return Response.json({ success: false, error: "Report Error", details: error.message }, { status: 500 });
    }
}


   if (action === "get-shift-types") {
    try {
        const id = url.searchParams.get("id");
        const branchId = url.searchParams.get("branch_id");

        // 1️⃣ حالة جلب وردية محددة بالـ ID
        if (id) {
            const shiftType = await base44.asServiceRole.entities.ShiftType.get(id);
            
            if (!shiftType) {
                return Response.json({ 
                    success: false, 
                    error: "Shift type not found" 
                }, { status: 404 });
            }

            return Response.json({
                success: true,
                data: shiftType
            });
        }

        // 2️⃣ حالة جلب القائمة كاملة مع إمكانية الفلترة حسب الفرع
        let shiftTypes;
        
        if (branchId) {
            // جلب الورديات الخاصة بفرع معين فقط
            shiftTypes = await base44.asServiceRole.entities.ShiftType.filter({
                branch_id: branchId
            });
        } else {
            // جلب كل الورديات وترتيبها حسب حقل sort_order
            shiftTypes = await base44.asServiceRole.entities.ShiftType.list('sort_order');
        }

        // ترتيب النتائج يدوياً للتأكد من سلاسة العرض في التطبيق
        const sortedShiftTypes = shiftTypes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        return Response.json({
            success: true,
            count: sortedShiftTypes.length,
            data: sortedShiftTypes
        });

    } catch (error) {
        console.error("Error fetching shift types:", error);
        return Response.json({
            success: false,
            error: "Failed to fetch shift types",
            details: error.message
        }, { status: 500 });
    }
}

if (action === "listTasks") {
  try {
    const projectId = url.searchParams.get('project_id');
    const teamId = url.searchParams.get('team_id');
    const categoryId = url.searchParams.get('category_id');
    const status = url.searchParams.get('status');
    const filterDate = url.searchParams.get('date');
    const filterEmployeeId = url.searchParams.get('employee_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    let limit = parseInt(url.searchParams.get('limit') || '100');
    if (limit > 500) limit = 500; // حماية من 502
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // ==========================================
    // 1️⃣ جلب أوامر العمل (استخدام filter بدلاً من list لتقليل البيانات)
    // ==========================================
    const queryFilters = { archived: false };
    if (projectId && projectId !== 'null') queryFilters.project_id = projectId;
    if (categoryId && categoryId !== 'null') queryFilters.work_order_category_id = categoryId;
    
    // تحسين جلب التاريخ ليعمل مع ISO Strings في قاعدة البيانات
    if (filterDate) {
      queryFilters.planned_start_time = { 
        $gte: `${filterDate}T00:00:00.000Z`, 
        $lte: `${filterDate}T23:59:59.999Z` 
      };
    }

    let rawWorkOrders = await base44.asServiceRole.entities.TimeEntry.filter(
      queryFilters, 
      '-planned_start_time', 
      500 
    ).catch(() => []);
    
    let workOrders = Array.isArray(rawWorkOrders) ? rawWorkOrders : (rawWorkOrders ? [rawWorkOrders] : []);

    // فلترة الصلاحيات (نفس منطقك الأصلي تماماً)
    let myTeamIds = [];
    if (!isAdmin()) {
      const allTeams = await base44.asServiceRole.entities.Team.list().catch(() => []);
      myTeamIds = (allTeams || []).filter(t => (t.employee_ids || []).includes(user.id)).map(t => t.id);

      workOrders = workOrders.filter(wo => {
        if (wo.employee_id === user.id) return true;
        if ((wo.employee_ids || []).includes(user.id)) return true;
        if ((wo.team_ids || []).some(id => myTeamIds.includes(id))) return true;

        if (wo.tasks && Array.isArray(wo.tasks)) {
          return wo.tasks.some(task => 
            (task.employee_ids || []).includes(user.id) || 
            (task.team_ids || []).some(id => myTeamIds.includes(id))
          );
        }
        return false;
      });
    }

    // =========================
    // 2️⃣ Flatten Tasks
    // =========================
    let tasks = [];
    workOrders.forEach(wo => {
      if (!wo.tasks || !Array.isArray(wo.tasks)) return;
      wo.tasks.forEach(task => {
        tasks.push({
          ...task,
          work_order_id: wo.id,
          work_order_number: wo.work_order_number,
          work_order_title: wo.title,
          project_id: wo.project_id,
          branch_id: wo.branch_id,
          work_order_status: wo.status,
          work_order_category_id: wo.work_order_category_id,
          archived: wo.archived,
          planned_start_time: wo.planned_start_time 
        });
      });
    });

    // =========================
    // 3️⃣ Apply Filters (نفس فلاترك الأصلية)
    // =========================
    tasks = tasks.filter(task => {
      if (projectId && task.project_id !== projectId) return false;
      if (categoryId && task.work_order_category_id !== categoryId) return false;
      if (status && task.status !== status) return false;
      if (teamId && !(task.team_ids || []).includes(teamId)) return false;
      if (filterEmployeeId && !(task.employee_ids || []).includes(filterEmployeeId)) return false;
      if (filterDate && (task.date || task.planned_start_time?.substring(0,10)) !== filterDate) return false;

      if ((startDate || endDate) && task.planned_start_time) {
        const woDate = new Date(task.planned_start_time);
        if (startDate && woDate < new Date(startDate)) return false;
        if (endDate && woDate > new Date(endDate)) return false;
      }
      return true;
    });

    // =============================================================
    // 4️⃣ Enrichment (إعادة بناء المنطق الأصلي بالكامل)
    // =============================================================
    const workOrderIds = [...new Set(tasks.map(t => t.work_order_id).filter(Boolean))];
    const workOrderMap = Object.fromEntries(workOrders.filter(wo => workOrderIds.includes(wo.id)).map(wo => [wo.id, wo]));

    const employeeIdsSet = new Set();
    const projectIdsSet = new Set();
    const teamIdsSet = new Set();
    const branchIdsSet = new Set();
    const customerIdsSet = new Set();

    tasks.forEach(task => {
      const workOrder = workOrderMap[task.work_order_id];
      if (task.employee_ids) task.employee_ids.forEach(id => employeeIdsSet.add(id));
      if (workOrder?.employee_ids) workOrder.employee_ids.forEach(id => employeeIdsSet.add(id));
      if (workOrder?.employee_id) employeeIdsSet.add(workOrder.employee_id);
      if (task.team_ids) task.team_ids.forEach(id => teamIdsSet.add(id));
      if (workOrder?.team_ids) workOrder.team_ids.forEach(id => teamIdsSet.add(id));
      if (workOrder?.team_id) teamIdsSet.add(workOrder.team_id);
      if (task.project_id) projectIdsSet.add(task.project_id);
      if (task.branch_id) branchIdsSet.add(task.branch_id);
      if (workOrder?.customer_id) customerIdsSet.add(workOrder.customer_id);
    });

    const [employees, projects, teams, branches] = await Promise.all([
      [...employeeIdsSet].length ? base44.asServiceRole.entities.User.filter({ id: { $in: [...employeeIdsSet].slice(0, 100) } }) : [],
      [...projectIdsSet].length ? base44.asServiceRole.entities.Project.filter({ id: { $in: [...projectIdsSet].slice(0, 100) } }) : [],
      [...teamIdsSet].length ? base44.asServiceRole.entities.Team.filter({ id: { $in: [...teamIdsSet].slice(0, 100) } }) : [],
      [...branchIdsSet].length ? base44.asServiceRole.entities.Branch.filter({ id: { $in: [...branchIdsSet].slice(0, 100) } }) : []
    ]).catch(() => [[], [], [], []]);

    const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    const branchMap = Object.fromEntries(branches.map(b => [b.id, b]));

    projects.forEach(p => { if (p.customer_id) customerIdsSet.add(p.customer_id); });
    const customers = [...customerIdsSet].length
      ? await base44.asServiceRole.entities.Customer.filter({ id: { $in: [...customerIdsSet].slice(0, 100) } }).catch(() => [])
      : [];
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

    const enrichedTasks = tasks.map(task => {
      const workOrder = workOrderMap[task.work_order_id];
      const project = task.project_id ? projectMap[task.project_id] : null;
      const customerId = workOrder?.customer_id || project?.customer_id || null;
      const customer = customerId ? customerMap[customerId] : null;

      const allEmployeeIds = new Set([
        ...(task.employee_ids || []),
        ...(workOrder?.employee_ids || []),
        ...(workOrder?.employee_id ? [workOrder.employee_id] : [])
      ]);

      const allTeamIds = new Set([
        ...(task.team_ids || []),
        ...(workOrder?.team_ids || []),
        ...(workOrder?.team_id ? [workOrder.team_id] : [])
      ]);

      return {
        ...task,
        employees: [...allEmployeeIds].map(id => employeeMap[id]).filter(Boolean),
        teams: [...allTeamIds].map(id => teamMap[id]).filter(Boolean),
        project: project ? { ...project, customer: customer || null } : null,
        customer: customer || null,
        branch: task.branch_id ? branchMap[task.branch_id] : null,
        work_order: workOrder || null
      };
    });

    const paginated = enrichedTasks.slice(offset, offset + limit);

    return Response.json({
      success: true,
      data: paginated,
      pagination: {
        total: enrichedTasks.length,
        limit,
        offset,
        hasMore: enrichedTasks.length > offset + limit
      },
      authenticated_as: { user_id: user.id, email: user.email, role: user.role }
    });

  } catch (error) {
    console.error('Error listing tasks:', error);
    return Response.json({
      success: false,
      error: 'Failed to list tasks',
      details: error.message
    }, { status: 500 });
  }
}

    // -------------------------------------------------------------
    // ACTION 1: LIST WORK ORDERS (FILTERED)
    // -------------------------------------------------------------
  //   if (action === "list") {
  //       try {
  //           // Parse query parameters
  //           const projectId = url.searchParams.get('project_id');
  //           const teamId = url.searchParams.get('team_id');
  //           const categoryId = url.searchParams.get('category_id');
  //           const status = url.searchParams.get('status');
  //           const startDate = url.searchParams.get('start_date');
  //           const endDate = url.searchParams.get('end_date');
  //           const limit = parseInt(url.searchParams.get('limit') || '100');
  //           const offset = parseInt(url.searchParams.get('offset') || '0');
  //           const sortBy = url.searchParams.get('sort_by') || '-created_date';
  //           const filterDate = url.searchParams.get('date');

  //           // Fetch all work orders by user
  //           // let workOrders = await base44.asServiceRole.entities.TimeEntry.list(sortBy, limit + offset);
  //           // workOrders = workOrders.filter(wo => wo.employee_id === user.id || (wo.employee_ids || []).includes(user.id));

  //       // Fetch all work orders
  //       let workOrders = await base44.asServiceRole.entities.TimeEntry.list(sortBy, limit + offset);

  //       // 🔥 إذا كان المستخدم Admin → إرجاع كل on-going فقط
  //       if (isAdmin()) {
  //           workOrders = workOrders.filter(wo => !wo.archived);
  //       } 
  //       else {
  //           // 🟡 مستخدم عادي → إرجاع التايم شيت الخاصة به فقط
  //           workOrders = workOrders.filter(wo =>
  //               !wo.archived &&
  //               (wo.employee_id === user.id || (wo.employee_ids || []).includes(user.id))
  //           );
  //       }

  //     ////////////////

  //         // Apply filters
  //         workOrders = workOrders.filter(wo => {
  //           if (wo.archived) return false;
  //           if (projectId && wo.project_id !== projectId) return false;
  //           if (teamId) {
  //             const teamIds = wo.team_ids || (wo.team_id ? [wo.team_id] : []);
  //             if (!teamIds.includes(teamId)) return false;
  //           }
  //           if (categoryId && wo.work_order_category_id !== categoryId) return false;
  //           if (status && wo.status !== status) return false;

  //           if ((startDate || endDate) && wo.planned_start_time) {
  //             const woDate = new Date(wo.planned_start_time);
  //             const start = startDate ? new Date(startDate) : null;
  //             const end = endDate ? new Date(endDate) : null;
  //             if (start && woDate < start) return false;
  //             if (end && woDate > end) return false;
  //           }

  //           if (filterDate && wo.planned_start_time) {
  //             const woDateStr = wo.planned_start_time.slice(0, 10);
  //             if (woDateStr !== filterDate) return false;
  //           }

  //           return true;
  //         });

  //         // اجمع كل معرفات الموظفين بدون تكرار
  //         const employeeIdsSet = new Set();
  //         const projectIdsSet = new Set();
  //         const teamIdsSet = new Set();
  //         const branchIdsSet = new Set();

  //         workOrders.forEach(wo => {
  //           if (wo.employee_id) employeeIdsSet.add(wo.employee_id);
  //           if (wo.employee_ids && Array.isArray(wo.employee_ids)) wo.employee_ids.forEach(id => employeeIdsSet.add(id));
  //           if (wo.project_id) projectIdsSet.add(wo.project_id);
  //           if (wo.team_id) teamIdsSet.add(wo.team_id);
  //           if (wo.team_ids && Array.isArray(wo.team_ids)) wo.team_ids.forEach(id => teamIdsSet.add(id));
  //           if (wo.branch_id) branchIdsSet.add(wo.branch_id);
  //         });

  //         const employeeIds = [...employeeIdsSet];
  //         const projectIds = [...projectIdsSet];
  //         const teamIdsArr = [...teamIdsSet];
  //         const branchIds = [...branchIdsSet];

  //         // استرجاع بيانات الموظفين والمشاريع والفِرق والفروع
  //         const [employees, projects, teams, branches] = await Promise.all([
  //           base44.asServiceRole.entities.User.filter({ id: { $in: employeeIds } }),
  //           base44.asServiceRole.entities.Project.filter({ id: { $in: projectIds } }),
  //           base44.asServiceRole.entities.Team.filter({ id: { $in: teamIdsArr } }),
  //           base44.asServiceRole.entities.Branch.filter({ id: { $in: branchIds } })
  //         ]);

  //         const employeeMap = Object.fromEntries(employees.map(emp => [emp.id, emp]));
  //         const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  //         const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  //         const branchMap = Object.fromEntries(branches.map(b => [b.id, b]));

  //         // 🔥 جمع معرفات الزبائن من المشاريع
  //         const customerIdsSet = new Set();
  //         projects.forEach(p => {
  //           if (p.customer_id) customerIdsSet.add(p.customer_id);
  //         });

  //         const customerIds = [...customerIdsSet];

  //         // 🔥 جلب بيانات الزبائن
  //         const customers = await base44.asServiceRole.entities.Customer.filter({
  //           id: { $in: customerIds }
  //         });

  //         const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));


  //         const calculateSequence = async (workOrder, allEntries) => {
  //             if (!workOrder?.planned_start_time) return null;

  //         const entryDate = new Date(workOrder.planned_start_time);

  //         // الفريق الأساسي
  //         const entryTeamId =
  //             workOrder.team_ids && workOrder.team_ids.length > 0
  //                 ? workOrder.team_ids[0]
  //                 : null;

  //         if (!entryTeamId) return null;

  //         // 🔥 تصفية Work Orders حسب نفس اليوم ونفس الفريق
  //         const dayEntries = allEntries.filter(e => {
  //           if (!e.planned_start_time) return false;

  //             const eDate = new Date(e.planned_start_time);
  //             const sameDay =
  //                 eDate.getFullYear() === entryDate.getFullYear() &&
  //                 eDate.getMonth() === entryDate.getMonth() &&
  //                 eDate.getDate() === entryDate.getDate();

  //             if (!sameDay) return false;

  //             const eTeam =
  //                 e.team_ids && e.team_ids.length > 0
  //                     ? e.team_ids[0]
  //                     : null;

  //             return eTeam === entryTeamId;
  //       });

  //       // ترتيب حسب الوقت
  //       dayEntries.sort((a, b) =>
  //           new Date(a.planned_start_time).getTime() -
  //           new Date(b.planned_start_time).getTime()
  //       );

  //       const position = dayEntries.findIndex(e => e.id === workOrder.id) + 1;

  //       return {
  //           position,
  //           total: dayEntries.length
  //       };
  //     };
  //     // ⚡ جلب كل الإدخالات لحساب sequence
  //           const allEntriesForSequence = await base44.asServiceRole.entities.TimeEntry.list();

  //           const enrichedWorkOrders = await Promise.all(
  //               workOrders.map(async wo => {
  //                   const sequence = await calculateSequence(wo, allEntriesForSequence);

  //                   return {
  //                       ...wo,
  //                       employees: [
  //                           ...(wo.employee_id ? [employeeMap[wo.employee_id]] : []),
  //                           ...(wo.employee_ids ? wo.employee_ids.map(id => employeeMap[id]).filter(Boolean) : [])
  //                       ],

  //                       project: wo.project_id 
  //                           ? { 
  //                               ...projectMap[wo.project_id],
  //                               customer: projectMap[wo.project_id]?.customer_id
  //                                   ? customerMap[projectMap[wo.project_id].customer_id]
  //                                   : null
  //                           }
  //                           : null,

  //                       teams: [
  //                           ...(wo.team_id ? [teamMap[wo.team_id]] : []),
  //                           ...(wo.team_ids ? wo.team_ids.map(id => teamMap[id]).filter(Boolean) : [])
  //                       ],

  //                       branch: wo.branch_id ? branchMap[wo.branch_id] : null,

  //                       // 🔥 إضافة سيكوانس لكل وورك أوردر
  //                       sequence
  //                   };
  //               })
  //               );



  //                   // Apply pagination
  //                   const paginatedWorkOrders = enrichedWorkOrders.slice(offset, offset + limit);

  //                   return Response.json({
  //                     success: true,
  //                     data: paginatedWorkOrders,
  //                     pagination: {
  //                       total: enrichedWorkOrders.length,
  //                       limit,
  //                       offset,
  //                       hasMore: enrichedWorkOrders.length > offset + limit
  //                     },
  //                     authenticated_as: {
  //                       user_id: user.id,
  //                       email: user.email,
  //                       role: user.role
  //                     }
  //                   });
  //                 } catch (error) {
  //                   console.error('Error listing work orders:', error);
  //                   return Response.json({
  //                     success: false,
  //                     error: 'Failed to list work orders',
  //                     details: error.message
  //                   }, { status: 500 });
  //                 }

  // }


if (action === "search") {
    try {
        const query = url.searchParams.get('q')?.toLowerCase() || "";
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        if (!query) {
            return Response.json({ success: false, error: "Search query is required" }, { status: 400 });
        }

        // 1️⃣ جلب البيانات الأساسية (Work Orders, Projects, Customers) لعمل الربط
        // نستخدم Promise.all للأداء العالي
        const [rawWorkOrders, allProjects, allCustomers] = await Promise.all([
            base44.asServiceRole.entities.TimeEntry.list('-planned_start_time', 1000),
            base44.asServiceRole.entities.Project.list(),
            base44.asServiceRole.entities.Customer.list()
        ]);

        // 2️⃣ تحويل البيانات لخرائط (Maps) لسهولة الوصول إليها أثناء البحث
        const projectMap = Object.fromEntries(allProjects.map(p => [p.id, p]));
        const customerMap = Object.fromEntries(allCustomers.map(c => [c.id, c]));

        // 3️⃣ عملية البحث المتقدم
        const searchResults = rawWorkOrders.filter(wo => {
            if (wo.archived) return false;

            // أ- البحث في بيانات الوورك أوردر نفسه (العنوان والرقم المرجعي)
            const titleMatch = wo.title?.toLowerCase().includes(query);
            const refMatch = wo.work_order_ref?.toLowerCase().includes(query);
            const numMatch = wo.work_order_number?.toLowerCase().includes(query);

            // ب- البحث في اسم المشروع المرتبط
            const project = projectMap[wo.project_id];
            const projectMatch = project?.name?.toLowerCase().includes(query);

            // ج- البحث في اسم الزبون المرتبط بالمشروع
            const customer = project?.customer_id ? customerMap[project.customer_id] : null;
            const customerMatch = customer?.name?.toLowerCase().includes(query);

            // إرجاع العنصر إذا تحقق أي شرط من شروط البحث
            return titleMatch || refMatch || numMatch || projectMatch || customerMatch;
        });

        // 4️⃣ إثراء البيانات الناتجة (Enrichment) لإظهار الأسماء في الرد
        const enrichedResults = searchResults.map(wo => {
            const project = projectMap[wo.project_id];
            const customer = project?.customer_id ? customerMap[project.customer_id] : null;

            return {
                ...wo,
                project_name: project?.name || "N/A",
                customer_name: customer?.name || "N/A",
                // إضافة الموظفين المسؤولين من داخل التأسكات (اختياري)
                assigned_count: wo.tasks?.length || 0
            };
        });

        // 5️⃣ Pagination
        const finalData = enrichedResults.slice(offset, offset + limit);

        return Response.json({
            success: true,
            query: query,
            data: finalData,
            pagination: {
                total: enrichedResults.length,
                limit,
                offset,
                hasMore: enrichedResults.length > offset + limit
            }
        });

    } catch (error) {
        return Response.json({ 
            success: false, 
            error: 'Search operation failed', 
            details: error.message 
        }, { status: 500 });
    }
}

if (action === "list") {
    try {
        const projectId = url.searchParams.get('project_id');
        const teamId = url.searchParams.get('team_id');
        const categoryId = url.searchParams.get('work_order_category_id'); // حسب الـ Entity
        const status = url.searchParams.get('status');
        const startDateStr = url.searchParams.get('start_date');
        const endDateStr = url.searchParams.get('end_date') || url.searchParams.get('endDate');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const sortBy = url.searchParams.get('sort_by') || '-planned_start_time';
        const filterDate = url.searchParams.get('date');

        // جلب البيانات (نستخدم list لجلب كمية كافية للفلترة البرمجية)
        let workOrders = await base44.asServiceRole.entities.TimeEntry.list(sortBy, 1000);

        // 1️⃣ الفلترة بناءً على الصلاحيات وهيكلية الـ Entity الجديدة
        workOrders = workOrders.filter(wo => {
            if (wo.archived) return false;

            if (isAdmin()) return true;

            // للمستخدم العادي: يجب أن يكون الموظف موجوداً في إحدى المهام (tasks) داخل الوورك أوردر
            const isAssignedToAnyTask = wo.tasks?.some(task => 
                (task.employee_ids || []).includes(user.id) || task.leader_id === user.id
            );

            return isAssignedToAnyTask;
        });

        // 2️⃣ تطبيق فلاتر الـ Query Params
        workOrders = workOrders.filter(wo => {
            if (projectId && wo.project_id !== projectId) return false;
            if (categoryId && wo.work_order_category_id !== categoryId) return false;
            if (status && wo.status !== status) return false;

            // فلترة الفريق (موجود في التأسكات أيضاً)
            if (teamId) {
                const hasTeam = wo.tasks?.some(task => (task.team_ids || []).includes(teamId));
                if (!hasTeam) return false;
            }

            // فلترة التاريخ YYYY-MM-DD
            if (wo.planned_start_time) {
                const woDateOnly = wo.planned_start_time.slice(0, 10);
                if (startDateStr && woDateOnly < startDateStr) return false;
                if (endDateStr && woDateOnly > endDateStr) return false;
                if (filterDate && woDateOnly !== filterDate) return false;
            } else if (startDateStr || endDateStr || filterDate) {
                return false;
            }

            return true;
        });

        // 3️⃣ جلب البيانات المرتبطة (مشاريع، مستخدمين، الخ)
        const employeeIdsSet = new Set();
        const projectIdsSet = new Set();
        const branchIdsSet = new Set();

        workOrders.forEach(wo => {
            if (wo.project_id) projectIdsSet.add(wo.project_id);
            if (wo.branch_id) branchIdsSet.add(wo.branch_id);
            // جمع الموظفين من داخل المهام
            wo.tasks?.forEach(task => {
                if (task.leader_id) employeeIdsSet.add(task.leader_id);
                task.employee_ids?.forEach(id => employeeIdsSet.add(id));
            });
        });

        const [employees, projects, branches] = await Promise.all([
            employeeIdsSet.size ? base44.asServiceRole.entities.User.filter({ id: { $in: [...employeeIdsSet] } }) : [],
            projectIdsSet.size ? base44.asServiceRole.entities.Project.filter({ id: { $in: [...projectIdsSet] } }) : [],
            branchIdsSet.size ? base44.asServiceRole.entities.Branch.filter({ id: { $in: [...branchIdsSet] } }) : []
        ]);

        const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
        const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
        const branchMap = Object.fromEntries(branches.map(b => [b.id, b]));

        // 4️⃣ إثراء البيانات (Enrichment)
        const enrichedWorkOrders = workOrders.map(wo => {
            // تجميع كل الموظفين الفريدين في هذا الوورك أوردر للعرض
            const uniqueEmpIds = new Set();
            wo.tasks?.forEach(t => {
                if (t.leader_id) uniqueEmpIds.add(t.leader_id);
                t.employee_ids?.forEach(id => uniqueEmpIds.add(id));
            });

            return {
                ...wo,
                assigned_employees: [...uniqueEmpIds].map(id => employeeMap[id]).filter(Boolean),
                project: projectMap[wo.project_id] || null,
                branch: wo.branch_id ? branchMap[wo.branch_id] : null
            };
        });

        // 5️⃣ Pagination والرد النهائي
        const paginatedData = enrichedWorkOrders.slice(offset, offset + limit);

        return Response.json({
            success: true,
            data: paginatedData,
            pagination: {
                total: enrichedWorkOrders.length,
                limit,
                offset,
                hasMore: enrichedWorkOrders.length > offset + limit
            },
            authenticated_as: {
                user_id: user.id,
                role: user.role
            }
        });

    } catch (error) {
        return Response.json({ 
            success: false, 
            error: 'Failed to list work orders', 
            details: error.message 
        }, { status: 500 });
    }
}
    // -------------------------------------------------------------
    // ACTION 2: GET SINGLE WORK ORDER
    // -------------------------------------------------------------

// -------------------------------------------------------------
// ACTION 2: GET SINGLE WORK ORDER (ENRICHED LIKE LIST)
// -------------------------------------------------------------

if (action === "get") {
    try {
        const id = url.searchParams.get("id");

        if (!id) {
            return Response.json({ error: "ID is required" }, { status: 400 });
        }

        // 1️⃣ جلب الـ Work Order المحدد فقط بالـ ID (بدلاً من list) لتجنب الـ Rate Limit
        const wo = await base44.asServiceRole.entities.TimeEntry.get(id);

        if (!wo) {
            return Response.json({ error: "Work order not found" }, { status: 404 });
        }

        // 2️⃣ تجميع المعرفات
        const employeeIds = new Set();
        const projectIds = new Set();
        const teamIds = new Set();
        const branchIds = new Set();

        if (wo.employee_id) employeeIds.add(wo.employee_id);
        if (Array.isArray(wo.employee_ids)) wo.employee_ids.forEach(id => employeeIds.add(id));

        if (wo.project_id) projectIds.add(wo.project_id);

        if (wo.team_id) teamIds.add(wo.team_id);
        if (Array.isArray(wo.team_ids)) wo.team_ids.forEach(id => teamIds.add(id));

        if (wo.branch_id) branchIds.add(wo.branch_id);

        // 3️⃣ جلب العلاقات
        const [employees, projects, teams, branches] = await Promise.all([
            employeeIds.size
                ? base44.asServiceRole.entities.User.filter({ id: { $in: [...employeeIds] } })
                : [],
            projectIds.size
                ? base44.asServiceRole.entities.Project.filter({ id: { $in: [...projectIds] } })
                : [],
            teamIds.size
                ? base44.asServiceRole.entities.Team.filter({ id: { $in: [...teamIds] } })
                : [],
            branchIds.size
                ? base44.asServiceRole.entities.Branch.filter({ id: { $in: [...branchIds] } })
                : []
        ]);

        const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
        const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
        const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
        const branchMap = Object.fromEntries(branches.map(b => [b.id, b]));

        // 4️⃣ جلب Customer الخاص بالمشروع
        let customer = null;
        const project = projectMap[wo.project_id];

        if (project?.customer_id) {
            const customers = await base44.asServiceRole.entities.Customer.filter({
                id: { $in: [project.customer_id] }
            });
            customer = customers[0] || null;
        }

        // 5️⃣ حساب sequence (نفس منطقك الأصلي ولكن بجلب البيانات الضرورية فقط)
        const calculateSequence = async (workOrder) => {
            if (!workOrder?.planned_start_time) return null;

            const entryDate = new Date(workOrder.planned_start_time);
            const entryTeamId = workOrder.team_ids?.length ? workOrder.team_ids[0] : null;

            if (!entryTeamId) return null;

            // جلب السجلات الخاصة بنفس اليوم والفريق فقط لتقليل الضغط
            const dateStr = workOrder.planned_start_time.slice(0, 10);
            const allEntries = await base44.asServiceRole.entities.TimeEntry.filter({
                planned_start_time: { $startsWith: dateStr }
            });

            const dayEntries = allEntries.filter(e => {
                const team = e.team_ids?.length ? e.team_ids[0] : null;
                return team === entryTeamId;
            });

            dayEntries.sort(
                (a, b) =>
                    new Date(a.planned_start_time) -
                    new Date(b.planned_start_time)
            );

            return {
                position: dayEntries.findIndex(e => e.id === workOrder.id) + 1,
                total: dayEntries.length
            };
        };

        const sequence = await calculateSequence(wo);

        // 6️⃣ بناء نفس شكل list حرفيًا كما طلبت
        const enrichedWorkOrder = {
            ...wo,

            employees: [
                ...(wo.employee_id ? [employeeMap[wo.employee_id]] : []),
                ...(wo.employee_ids
                    ? wo.employee_ids.map(id => employeeMap[id]).filter(Boolean)
                    : [])
            ],

            project: wo.project_id
                ? {
                    ...projectMap[wo.project_id],
                    customer
                }
                : null,

            teams: [
                ...(wo.team_id ? [teamMap[wo.team_id]] : []),
                ...(wo.team_ids
                    ? wo.team_ids.map(id => teamMap[id]).filter(Boolean)
                    : [])
            ],

            branch: wo.branch_id ? branchMap[wo.branch_id] : null,
            sequence
        };

        return Response.json({
            success: true,
            data: enrichedWorkOrder
        });

    } catch (error) {
        console.error("Error getting work order:", error);
        return Response.json({
            success: false,
            error: "Failed to get work order",
            details: error.message
        }, { status: 500 });
    }
}

// if (action === "get") {
//     try {
//         const id = url.searchParams.get("id");

//         if (!id) {
//             return Response.json({ error: "ID is required" }, { status: 400 });
//         }

//         // 1️⃣ جلب الـ Work Order
//         const allEntries = await base44.asServiceRole.entities.TimeEntry.list();
//         const wo = allEntries.find(w => w.id === id);

//         if (!wo) {
//             return Response.json({ error: "Work order not found" }, { status: 404 });
//         }

//         // 2️⃣ تجميع المعرفات
//         const employeeIds = new Set();
//         const projectIds = new Set();
//         const teamIds = new Set();
//         const branchIds = new Set();

//         if (wo.employee_id) employeeIds.add(wo.employee_id);
//         if (Array.isArray(wo.employee_ids)) wo.employee_ids.forEach(id => employeeIds.add(id));

//         if (wo.project_id) projectIds.add(wo.project_id);

//         if (wo.team_id) teamIds.add(wo.team_id);
//         if (Array.isArray(wo.team_ids)) wo.team_ids.forEach(id => teamIds.add(id));

//         if (wo.branch_id) branchIds.add(wo.branch_id);

//         // 3️⃣ جلب العلاقات
//         const [employees, projects, teams, branches] = await Promise.all([
//             employeeIds.size
//                 ? base44.asServiceRole.entities.User.filter({ id: { $in: [...employeeIds] } })
//                 : [],
//             projectIds.size
//                 ? base44.asServiceRole.entities.Project.filter({ id: { $in: [...projectIds] } })
//                 : [],
//             teamIds.size
//                 ? base44.asServiceRole.entities.Team.filter({ id: { $in: [...teamIds] } })
//                 : [],
//             branchIds.size
//                 ? base44.asServiceRole.entities.Branch.filter({ id: { $in: [...branchIds] } })
//                 : []
//         ]);

//         const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
//         const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
//         const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
//         const branchMap = Object.fromEntries(branches.map(b => [b.id, b]));

//         // 4️⃣ جلب Customer الخاص بالمشروع
//         let customer = null;
//         const project = projectMap[wo.project_id];

//         if (project?.customer_id) {
//             const customers = await base44.asServiceRole.entities.Customer.filter({
//                 id: { $in: [project.customer_id] }
//             });
//             customer = customers[0] || null;
//         }

//         // 5️⃣ حساب sequence (نفس list تمامًا)
//         const calculateSequence = async (workOrder, allEntries) => {
//             if (!workOrder?.planned_start_time) return null;

//             const entryDate = new Date(workOrder.planned_start_time);
//             const entryTeamId =
//                 workOrder.team_ids?.length ? workOrder.team_ids[0] : null;

//             if (!entryTeamId) return null;

//             const dayEntries = allEntries.filter(e => {
//                 if (!e.planned_start_time) return false;

//                 const d = new Date(e.planned_start_time);
//                 const sameDay =
//                     d.getFullYear() === entryDate.getFullYear() &&
//                     d.getMonth() === entryDate.getMonth() &&
//                     d.getDate() === entryDate.getDate();

//                 const team =
//                     e.team_ids?.length ? e.team_ids[0] : null;

//                 return sameDay && team === entryTeamId;
//             });

//             dayEntries.sort(
//                 (a, b) =>
//                     new Date(a.planned_start_time) -
//                     new Date(b.planned_start_time)
//             );

//             return {
//                 position: dayEntries.findIndex(e => e.id === workOrder.id) + 1,
//                 total: dayEntries.length
//             };
//         };

//         const sequence = await calculateSequence(wo, allEntries);

//         // 6️⃣ بناء نفس شكل list حرفيًا
//         const enrichedWorkOrder = {
//             ...wo,

//             employees: [
//                 ...(wo.employee_id ? [employeeMap[wo.employee_id]] : []),
//                 ...(wo.employee_ids
//                     ? wo.employee_ids.map(id => employeeMap[id]).filter(Boolean)
//                     : [])
//             ],

//             project: wo.project_id
//                 ? {
//                     ...projectMap[wo.project_id],
//                     customer
//                 }
//                 : null,

//             teams: [
//                 ...(wo.team_id ? [teamMap[wo.team_id]] : []),
//                 ...(wo.team_ids
//                     ? wo.team_ids.map(id => teamMap[id]).filter(Boolean)
//                     : [])
//             ],

//             branch: wo.branch_id ? branchMap[wo.branch_id] : null,
//             sequence
//         };

//         return Response.json({
//             success: true,
//             data: enrichedWorkOrder
//         });

//     } catch (error) {
//         console.error("Error getting work order:", error);
//         return Response.json({
//             success: false,
//             error: "Failed to get work order",
//             details: error.message
//         }, { status: 500 });
//     }
// }




// if (action === "generatePdf") {
//     const id = url.searchParams.get("id");

//     if (!id) {
//         return Response.json({ success: false, message: "id required" }, { status: 400 });
//     } 

//     try {
//         // جلب البيانات الأساسية
//         const workOrder = await base44.asServiceRole.entities.TimeEntry.get(id);
//         if (!workOrder) return Response.json({ success: false, message: "Work order not found" }, { status: 404 });

//         const project = workOrder.project_id ? await base44.asServiceRole.entities.Project.get(workOrder.project_id) : null;
//         const customer = project?.customer_id ? await base44.asServiceRole.entities.Customer.get(project.customer_id) : null;
//         const branch = project?.branch_id ? await base44.asServiceRole.entities.Branch.get(project.branch_id) : null;
//         const woCategory = workOrder.work_order_category_id ? await base44.asServiceRole.entities.WorkOrderCategory.get(workOrder.work_order_category_id) : null;

//         // جلب الموارد
//         const [users, teams, assets, clientEquipments] = await Promise.all([
//             base44.asServiceRole.entities.User.list(),
//             base44.asServiceRole.entities.Team.list(),
//             base44.asServiceRole.entities.Asset.list(),
//             base44.asServiceRole.entities.ClientEquipment.list()
//         ]);

//         const assignedUsers = (users || []).filter(u => (workOrder.employee_ids || []).includes(u.id));
//         const assignedTeams = (teams || []).filter(t => (workOrder.team_ids || []).includes(t.id));
//         const assignedAssets = (workOrder.equipment_ids || []).map(id => assets.find(a => a.id === id) || clientEquipments.find(e => e.id === id)).filter(Boolean);

//         // تجميع عناصر التقارير من التاسكات
//         const allWorkDone = [...(workOrder.work_done_items || [])];
//         const allWorkPending = [...(workOrder.work_pending_items || [])];
//         const allSpareParts = [...(workOrder.spare_parts_items || [])];
//         const allSparePartsPending = [...(workOrder.spare_parts_pending_items || [])];

//         if (workOrder.tasks) {
//             workOrder.tasks.forEach(t => {
//                 if (t.work_done_items) allWorkDone.push(...t.work_done_items);
//                 if (t.work_pending_items) allWorkPending.push(...t.work_pending_items);
//                 if (t.spare_parts_items) allSpareParts.push(...t.spare_parts_items);
//                 if (t.spare_parts_pending_items) allSparePartsPending.push(...t.spare_parts_pending_items);
//             });
//         }

//         const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' }) : '-';
//         const formatFullDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { hour12: true, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Dubai' }).replace(',', '') : '-';

//         const html = `
//         <!DOCTYPE html>
//         <html>
//         <head>
//             <meta charset="UTF-8">
//             <style>
//                 @page { size: A4; margin: 5mm; }
//                 body { font-family: sans-serif; font-size: 11px; margin: 0; padding: 10px; color: #333; }
//                 .container { width: 210mm; margin: auto; }
                
//                 /* Header */
//                 .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
//                 .header-title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
//                 .header-info { text-align: right; font-size: 12px; font-weight: bold; }
                
//                 /* Sections */
//                 .section-header { background: #d32f2f; color: white; padding: 5px 10px; font-weight: bold; text-transform: uppercase; margin-top: 10px; border: 1px solid #333; }
//                 table { width: 100%; border-collapse: collapse; table-layout: fixed; }
//                 th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: middle; }
//                 th { background: #f8f9fa; font-weight: bold; text-transform: uppercase; width: 100px; }
                
//                 .report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-left: 1px solid #ccc; border-right: 1px solid #ccc; }
//                 .report-col { border-bottom: 1px solid #ccc; }
//                 .sub-label { background: #d32f2f; color: white; font-weight: bold; padding: 4px 8px; display: flex; justify-content: space-between; }
//                 .green-text { color: #2e7d32; font-weight: bold; margin: 10px 0; }
                
//                 .signature-box { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #ccc; min-height: 80px; }
//                 .sig-col { border-right: 1px solid #ccc; padding: 5px; }
//                 .sig-img { max-height: 50px; display: block; margin-top: 5px; }
//                 .logo { max-height: 60px; }
//             </style>
//         </head>
//         <body>
//             <div class="container">
//                 <div class="page-header">
//                     <div>
//                          ${branch?.logo_url ? `<img src="${branch.logo_url}" class="logo" />` : ''}
//                         <div class="header-title">Service & Maintenance Report</div>
//                     </div>
//                     <div class="header-info">
//                         <div>Working order N: ${workOrder.work_order_number || '-'}</div>
//                         <div>Working report N: -</div>
//                         <div style="font-weight: normal; font-size: 10px; color: #666;">Title: ${workOrder.title || '-'}</div>
//                     </div>
//                 </div>

//                 <div class="section-header">1. General Information</div>
//                 <table>
//                     <tr>
//                         <th>Company</th><td>${customer?.name || '-'}</td>
//                         <th>Category</th><td>${woCategory?.name || '-'}</td>
//                     </tr>
//                     <tr>
//                         <th>Location</th><td>${project?.address || '-'}</td>
//                         <th>Shift</th><td>-</td>
//                     </tr>
//                     <tr>
//                         <th>Project</th><td>${project?.name || '-'}</td>
//                         <th>Date</th><td>${formatDate(workOrder.planned_start_time)}</td>
//                     </tr>
//                     <tr>
//                         <th>Equipment</th><td>${assignedAssets.map(a => a.name).join(', ') || '-'}</td>
//                         <th>Time</th><td>${workOrder.planned_start_time ? new Date(workOrder.planned_start_time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : ''} - ${workOrder.planned_end_time ? new Date(workOrder.planned_end_time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : ''}</td>
//                     </tr>
//                     <tr>
//                         <th>Title</th><td colspan="3">${workOrder.title || '-'}</td>
//                     </tr>
//                 </table>
//                 <div style="border: 1px solid #ccc; padding: 5px; font-size: 10px; border-top: none;">
//                     <strong>MANAGEMENT INSTRUCTIONS:</strong><br>
//                     <div style="display:flex; justify-content: space-between;">
//                         <span>${workOrder.work_description_items?.map(i => i.text).join(', ')}</span>
//                         <span>-</span>
//                     </div>
//                 </div>

//                 <div class="section-header">2. Assigned Resources</div>
//                 <table>
//                     <tr><th>Teams</th><td>${assignedTeams.map(t => t.name).join(', ') || '-'}</td></tr>
//                     <tr><th>Workers</th><td>${assignedUsers.map(u => u.full_name || u.email).join(', ') || '-'}</td></tr>
//                 </table>

//                 <div class="section-header">3. Site Report</div>
//                 <div style="display: flex; color: #2e7d32; font-weight: bold; padding: 5px 0;">
//                     <div style="flex: 1;">WORK DONE</div>
//                     <div style="flex: 1;">WORK PENDING</div>
//                 </div>
                
//                 <div class="report-grid">
//                     <div class="report-col" style="border-right: 1px solid #333;">
//                         <div class="sub-label"><span>TASK COMPLETED</span><span>✓</span></div>
//                         <table>
//                             ${(allWorkDone.length ? allWorkDone : [{text:''},{text:''},{text:''}]).map(i => `<tr><td>${i.text}</td><td style="width:20px; text-align:center;">${i.text ? '☐' : ''}</td></tr>`).join('')}
//                         </table>
//                     </div>
//                     <div class="report-col">
//                         <div class="sub-label"><span>TASK PENDING</span><span>✓</span></div>
//                         <table>
//                             ${(allWorkPending.length ? allWorkPending : [{text:''},{text:''},{text:''}]).map(i => `<tr><td>${i.text}</td><td style="width:20px; text-align:center;">${i.text ? '☐' : ''}</td></tr>`).join('')}
//                         </table>
//                     </div>
//                     <div class="report-col" style="border-right: 1px solid #333;">
//                         <div style="color: #2e7d32; font-weight: bold; padding: 5px;">SPARE PARTS INSTALLED</div>
//                         <div class="sub-label"><span>PART</span><span style="display:flex; gap: 20px;"><span>✓</span><span>QTY</span></span></div>
//                         <table>
//                             ${(allSpareParts.length ? allSpareParts : [{text:''},{text:''},{text:''}]).map(i => `<tr><td>${i.text}</td><td style="width:20px;">☐</td><td style="width:40px;"></td></tr>`).join('')}
//                         </table>
//                     </div>
//                     <div class="report-col">
//                         <div style="color: #e65100; font-weight: bold; padding: 5px;">SPARE PARTS PENDING</div>
//                         <div class="sub-label"><span>PART</span><span style="display:flex; gap: 20px;"><span>✓</span><span>QTY</span></span></div>
//                         <table>
//                             ${(allSparePartsPending.length ? allSparePartsPending : [{text:''},{text:''},{text:''}]).map(i => `<tr><td>${i.text}</td><td style="width:20px;">☐</td><td style="width:40px;"></td></tr>`).join('')}
//                         </table>
//                     </div>
//                 </div>
//                 <div class="green-text">STATUS: ${workOrder.status?.toUpperCase() || 'OPEN'}</div>

//                 <div class="section-header">4. Time Tracker Data</div>
//                 <table>
//                     <tr>
//                         <th>Clock In</th><td>${formatFullDateTime(workOrder.start_time)}</td>
//                         <th>Clock Out</th><td>${formatFullDateTime(workOrder.end_time)}</td>
//                     </tr>
//                     <tr>
//                         <th>Duration</th><td colspan="3">${workOrder.duration_minutes ? Math.floor(workOrder.duration_minutes/60) + 'h ' + (workOrder.duration_minutes%60) + 'm' : '-'}</td>
//                     </tr>
//                 </table>

//                 <div class="section-header">5. Client Approval</div>
//                 <div style="border: 1px solid #ccc; padding: 5px; border-bottom: none;">
//                     <strong>CLIENT COMMENTS:</strong><br>
//                     ${workOrder.client_feedback_comments || '-'}
//                 </div>
//                 <div class="signature-box">
//                     <div class="sig-col">
//                         <strong>WORKERS:</strong><br>
//                         ${assignedUsers.map(u => u.full_name).join(', ') || '-'}
//                     </div>
//                     <div class="sig-col">
//                         <strong>CLIENT:</strong><br>
//                         - ${workOrder.client_representative_name || ''}<br>
//                         - ${workOrder.client_representative_phone || ''}
//                     </div>
//                     <div class="sig-col" style="border-right: none;">
//                         <strong>SIGNATURE:</strong><br>
//                         ${workOrder.client_signature_url ? `<img src="${workOrder.client_signature_url}" class="sig-img" />` : ''}
//                     </div>
//                 </div>
//             </div>
//         </body>
//         </html>
//         `;

//         return new Response(html, { headers: { "Content-Type": "text/html" }, status: 200 });

//     } catch (err) {
//         return Response.json({ success:false, error: err.message }, { status:500 });
//     }
// }

if (action === "generatePdf") {
    const id = url.searchParams.get("id");

    if (!id) {
        return Response.json({ success: false, message: "id required" }, { status: 400 });
    }

    try {
        // 1. جلب البيانات الأساسية لأمر العمل
        const workOrder = await base44.asServiceRole.entities.TimeEntry.get(id);
        if (!workOrder) return Response.json({ success: false, message: "Work order not found" }, { status: 404 });

        // 2. جلب بيانات المشروع والموقع والعميل والفرع
        const project = workOrder.project_id ? await base44.asServiceRole.entities.Project.get(workOrder.project_id) : null;
        const customer = project?.customer_id ? await base44.asServiceRole.entities.Customer.get(project.customer_id) : null;
        const branch = project?.branch_id ? await base44.asServiceRole.entities.Branch.get(project.branch_id) : null;
        const woCategory = workOrder.work_order_category_id ? await base44.asServiceRole.entities.WorkOrderCategory.get(workOrder.work_order_category_id) : null;
       
        // 3. تجميع كافة الـ IDs للعمال والفرق والمعدات
        const allEmployeeIds = new Set();
        const allTeamIds = new Set();
        const allEquipmentIds = new Set();

        // دالة مساعدة لإضافة المعرفات بشكل آمن (تتعامل مع النصوص أو الكائنات التي تحتوي على id)
        const addId = (set, val) => {
            if (!val) return;
            if (typeof val === 'string') set.add(val);
            else if (val.id) set.add(val.id);
        };

        // إضافة من المستوى الأعلى
        if (Array.isArray(workOrder.employee_ids)) workOrder.employee_ids.forEach(eid => addId(allEmployeeIds, eid));
        if (Array.isArray(workOrder.team_ids)) workOrder.team_ids.forEach(tid => addId(allTeamIds, tid));
        if (Array.isArray(workOrder.equipment_ids)) workOrder.equipment_ids.forEach(eqid => addId(allEquipmentIds, eqid));
        
        addId(allEmployeeIds, workOrder.employee_id);
        addId(allTeamIds, workOrder.team_id);
        addId(allEmployeeIds, workOrder.leader_id);

        // إضافة من داخل المهام (Tasks) - الجزء الحيوي لبياناتك
        if (workOrder.tasks && Array.isArray(workOrder.tasks)) {
            workOrder.tasks.forEach(t => {
                if (Array.isArray(t.employee_ids)) t.employee_ids.forEach(eid => addId(allEmployeeIds, eid));
                if (Array.isArray(t.team_ids)) t.team_ids.forEach(tid => addId(allTeamIds, tid));
                addId(allEmployeeIds, t.employee_id);
                addId(allTeamIds, t.team_id);
                addId(allEmployeeIds, t.leader_id);
            });
        }

        // تحويل الـ Sets إلى مصفوفات نظيفة من النصوص فقط
        const employeeIdArray = Array.from(allEmployeeIds).filter(id => typeof id === 'string' && id.length > 5);
        const teamIdArray = Array.from(allTeamIds).filter(id => typeof id === 'string' && id.length > 5);
        const equipmentIdArray = Array.from(allEquipmentIds).filter(id => typeof id === 'string' && id.length > 5);

 
        const employeeIds = Array.from(allEmployeeIds).filter(Boolean);
        // const teamIds = Array.from(allTeamIds).filter(Boolean);
        const teamIds = Array.from(allTeamIds).filter(id => typeof id === 'string' && id.length > 5);


        // 4. جلب الموارد المطلوبة
        const [usersRes, teamsRes, assetsRes, clientEquipmentsRes] = await Promise.all([
                employeeIds.length > 0 
                ? Promise.all(employeeIds.map(id => base44.asServiceRole.entities.User.get(id).catch(() => null)))
                : Promise.resolve([]),

             teamIds.length > 0 
                ? Promise.all(teamIds.map(id => base44.asServiceRole.entities.Team.get(id).catch(() => null)))
                : Promise.resolve([]),


            employeeIdArray.length > 0 ? base44.asServiceRole.entities.User.list({ filter: { id: { _in: employeeIdArray } } }) : Promise.resolve([]),
            teamIdArray.length > 0 ? base44.asServiceRole.entities.Team.list({ filter: { id: { _in: teamIdArray } } }) : Promise.resolve([]),
            equipmentIdArray.length > 0 ? base44.asServiceRole.entities.Asset.list({ filter: { id: { _in: equipmentIdArray } } }) : Promise.resolve([]),
            equipmentIdArray.length > 0 ? base44.asServiceRole.entities.ClientEquipment.list({ filter: { id: { _in: equipmentIdArray } } }) : Promise.resolve([])
        ]);

        const assignedUsers = Array.isArray(usersRes) ? usersRes : (usersRes?.data || []);
        const assignedTeams = Array.isArray(teamsRes) ? teamsRes : (teamsRes?.data || []);
        const fetchedAssets = Array.isArray(assetsRes) ? assetsRes : (assetsRes?.data || []);
        const fetchedClientEquip = Array.isArray(clientEquipmentsRes) ? clientEquipmentsRes : (clientEquipmentsRes?.data || []);

        const assignedAssets = equipmentIdArray.map(id => 
            fetchedAssets.find(a => a.id === id) || fetchedClientEquip.find(e => e.id === id)
        ).filter(Boolean);

        // 5. تجميع عناصر التقارير والتعليمات
        const allWorkDone = [...(workOrder.work_done_items || [])];
        const allWorkPending = [...(workOrder.work_pending_items || [])];
        const allSpareParts = [...(workOrder.spare_parts_items || [])];
        const allSparePartsPending = [...(workOrder.spare_parts_pending_items || [])];
        const taskInstructions = [];

        if (workOrder.work_description_items) {
            workOrder.work_description_items.forEach(i => taskInstructions.push(i.text));
        }

        if (workOrder.tasks && Array.isArray(workOrder.tasks)) {
            workOrder.tasks.forEach(t => {
                if (t.instructions) taskInstructions.push(t.instructions);
                if (t.work_done_items) allWorkDone.push(...t.work_done_items);
                if (t.work_pending_items) allWorkPending.push(...t.work_pending_items);
                if (t.spare_parts_items) allSpareParts.push(...t.spare_parts_items);
                if (t.spare_parts_pending_items) allSparePartsPending.push(...t.spare_parts_pending_items);
            });
        }

        const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' }) : '-';
        const formatFullDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { hour12: true, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Dubai' }).replace(',', '') : '-';

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page { size: A4; margin: 5mm; }
                body { font-family: sans-serif; font-size: 11px; margin: 0; padding: 10px; color: #333; }
                .container { width: 210mm; margin: auto; }
                .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
                .header-title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
                .header-info { text-align: right; font-size: 12px; font-weight: bold; }
                .section-header { background: #d32f2f; color: white; padding: 5px 10px; font-weight: bold; text-transform: uppercase; margin-top: 10px; border: 1px solid #333; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: middle; }
                th { background: #f8f9fa; font-weight: bold; text-transform: uppercase; width: 100px; }
                .report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-left: 1px solid #ccc; border-right: 1px solid #ccc; }
                .report-col { border-bottom: 1px solid #ccc; }
                .sub-label { background: #d32f2f; color: white; font-weight: bold; padding: 4px 8px; display: flex; justify-content: space-between; }
                .green-text { color: #2e7d32; font-weight: bold; margin: 10px 0; }
                .signature-box { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #ccc; min-height: 80px; }
                .sig-col { border-right: 1px solid #ccc; padding: 5px; }
                .sig-img { max-height: 50px; display: block; margin-top: 5px; }
                .logo { max-height: 60px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="page-header">
                    <div>
                         ${branch?.logo_url ? `<img src="${branch.logo_url}" class="logo" />` : ''}
                        <div class="header-title">Service & Maintenance Report</div>
                    </div>
                    <div class="header-info">
                        <div>Working order N: ${workOrder.work_order_number || '-'}</div>
                        <div>Working report N: -</div>
                        <div style="font-weight: normal; font-size: 10px; color: #666;">Title: ${workOrder.title || '-'}</div>
                    </div>
                </div>

                <div class="section-header">1. General Information</div>
                <table>
                    <tr>
                        <th>Company</th><td>${customer?.name || '-'}</td>
                        <th>Category</th><td>${woCategory?.name || '-'}</td>
                    </tr>
                    <tr>
                        <th>Location</th><td>${project?.address || workOrder?.start_address || '-'}</td>
                        <th>Shift</th><td>-</td>
                    </tr>
                    <tr>
                        <th>Project</th><td>${project?.name || '-'}</td>
                        <th>Date</th><td>${formatDate(workOrder.planned_start_time)}</td>
                    </tr>
                    <tr>
                        <th>Equipment</th><td>${assignedAssets.map(a => a.name).join(', ') || '-'}</td>
                        <th>Time</th><td>${workOrder.planned_start_time ? new Date(workOrder.planned_start_time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : ''} - ${workOrder.planned_end_time ? new Date(workOrder.planned_end_time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : ''}</td>
                    </tr>
                    <tr>
                        <th>Title</th><td colspan="3">${workOrder.title || '-'}</td>
                    </tr>
                </table>
                <div style="border: 1px solid #ccc; padding: 5px; font-size: 10px; border-top: none;">
                    <strong>MANAGEMENT INSTRUCTIONS:</strong><br>
                    <div style="display:flex; flex-direction: column;">
                        ${taskInstructions.length > 0 ? taskInstructions.map(txt => `<span>• ${txt}</span>`).join('') : '<span>-</span>'}
                    </div>
                </div>

                <div class="section-header">2. Assigned Resources</div>
                <table>
                    <tr><th>Teams</th><td>${assignedTeams.map(t => t.name).join(', ') || '-'}</td></tr>
                    <tr><th>Workers</th><td>${assignedUsers.map(u => u.full_name || u.email).join(', ') || '-'}</td></tr>
                    
                </table>

                <div class="section-header">3. Site Report</div>
                <div style="display: flex; color: #2e7d32; font-weight: bold; padding: 5px 0;">
                    <div style="flex: 1;">WORK DONE</div>
                    <div style="flex: 1;">WORK PENDING</div>
                </div>
                
                <div class="report-grid">
                    <div class="report-col" style="border-right: 1px solid #333;">
                        <div class="sub-label"><span>TASK COMPLETED</span><span>✓</span></div>
                        <table>
                            ${(allWorkDone.length ? allWorkDone : [{text:''},{text:''},{text:''}]).map(i => `<tr><td>${i.text}</td><td style="width:20px; text-align:center;">${i.text ? '☐' : ''}</td></tr>`).join('')}
                        </table>
                    </div>
                    <div class="report-col">
                        <div class="sub-label"><span>TASK PENDING</span><span>✓</span></div>
                        <table>
                            ${(allWorkPending.length ? allWorkPending : [{text:''},{text:''},{text:''}]).map(i => `<tr><td>${i.text}</td><td style="width:20px; text-align:center;">${i.text ? '☐' : ''}</td></tr>`).join('')}
                        </table>
                    </div>
                    <div class="report-col" style="border-right: 1px solid #333;">
                        <div style="color: #2e7d32; font-weight: bold; padding: 5px;">SPARE PARTS INSTALLED</div>
                        <div class="sub-label"><span>PART</span><span style="display:flex; gap: 20px;"><span>✓</span><span>QTY</span></span></div>
                        <table>
                            ${(allSpareParts.length ? allSpareParts : [{text:''},{text:''},{text:''}]).map(i => `<tr><td>${i.text}</td><td style="width:20px;">☐</td><td style="width:40px;"></td></tr>`).join('')}
                        </table>
                    </div>
                    <div class="report-col">
                        <div style="color: #e65100; font-weight: bold; padding: 5px;">SPARE PARTS PENDING</div>
                        <div class="sub-label"><span>PART</span><span style="display:flex; gap: 20px;"><span>✓</span><span>QTY</span></span></div>
                        <table>
                            ${(allSparePartsPending.length ? allSparePartsPending : [{text:''},{text:''},{text:''}]).map(i => `<tr><td>${i.text}</td><td style="width:20px;">☐</td><td style="width:40px;"></td></tr>`).join('')}
                        </table>
                    </div>
                </div>
                <div class="green-text">STATUS: ${workOrder.status?.toUpperCase() || 'OPEN'}</div>

                <div class="section-header">4. Time Tracker Data</div>
                <table>
                    <tr>
                        <th>Clock In</th><td>${formatFullDateTime(workOrder.start_time)}</td>
                        <th>Clock Out</th><td>${formatFullDateTime(workOrder.end_time)}</td>
                    </tr>
                    <tr>
                        <th>Duration</th><td colspan="3">${workOrder.duration_minutes ? Math.floor(workOrder.duration_minutes/60) + 'h ' + (workOrder.duration_minutes%60) + 'm' : '-'}</td>
                    </tr>
                </table>

                <div class="section-header">5. Client Approval</div>
                <div style="border: 1px solid #ccc; padding: 5px; border-bottom: none;">
                    <strong>CLIENT COMMENTS:</strong><br>
                    ${workOrder.client_feedback_comments || '-'}
                </div>
                <div class="signature-box">
                    <div class="sig-col">
                        <strong>WORKERS:</strong><br>
                        ${assignedUsers.map(u => u.full_name || u.email).join(', ') || '-'}
                    </div>
                    <div class="sig-col">
                        <strong>CLIENT:</strong><br>
                        - ${workOrder.client_representative_name || ''}<br>
                        - ${workOrder.client_representative_phone || ''}
                    </div>
                    <div class="sig-col" style="border-right: none;">
                        <strong>SIGNATURE:</strong><br>
                        ${workOrder.client_signature_url ? `<img src="${workOrder.client_signature_url}" class="sig-img" />` : ''}
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        return new Response(html, { headers: { "Content-Type": "text/html" }, status: 200 });

    } catch (err) {
        return Response.json({ success:false, error: err.message }, { status:500 });
    }
}


    return Response.json({ error: "Unknown action" }, { status: 400 });
}





  if (method === 'POST' && url.searchParams.get('action') === 'addTask') {
    try {
        // 1️⃣ استخدام req.json() للحصول على البيانات كما في دالة create
        const body = await req.json();
        const { work_order_id, task_data } = body;

        // التحقق من وجود المعرفات المطلوبة
        if (!work_order_id) {
            return Response.json({ success: false, error: "work_order_id is required" }, { status: 400 });
        }

        if (!task_data || !task_data.name) {
            return Response.json({ success: false, error: "Task name is required (task_data.name)" }, { status: 400 });
        }

        // 2️⃣ جلب الوورك أوردر الحالي
        const wo = await base44.asServiceRole.entities.TimeEntry.get(work_order_id);
        if (!wo) {
            return Response.json({ success: false, error: "Work order not found" }, { status: 404 });
        }

        // 3️⃣ بناء كائن المهمة (Task Object) بكامل تفاصيله
        const newTask = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            name: task_data.name,
            instructions: task_data.instructions || "",
            date: task_data.date || new Date().toISOString().split('T')[0],
            start_time: task_data.start_time || "08:00",
            end_time: task_data.end_time || "17:00",
            employee_ids: Array.isArray(task_data.employee_ids) ? task_data.employee_ids : [],
            leader_id: task_data.leader_id || (Array.isArray(task_data.employee_ids) && task_data.employee_ids.length > 0 ? task_data.employee_ids[0] : null),
            team_ids: Array.isArray(task_data.team_ids) ? task_data.team_ids : [],
            shift_type_id: task_data.shift_type_id || null,
            status: task_data.status || "pending",
            work_done_items: Array.isArray(task_data.work_done_items) ? task_data.work_done_items : [],
            spare_parts_items: Array.isArray(task_data.spare_parts_items) ? task_data.spare_parts_items : [],
            work_pending_items: Array.isArray(task_data.work_pending_items) ? task_data.work_pending_items : [],
            spare_parts_pending_items: Array.isArray(task_data.spare_parts_pending_items) ? task_data.spare_parts_pending_items : [],
            other_file_urls: Array.isArray(task_data.other_file_urls) ? task_data.other_file_urls : []
        };

        // 4️⃣ تحديث السجل وإضافة التعديل لـ Activity Log
        const currentTasks = Array.isArray(wo.tasks) ? wo.tasks : [];
        const updatedTasks = [...currentTasks, newTask];

        const updatePayload = {
            tasks: updatedTasks,
            updated_by: user?.email || "unknown",
            activity_log: [
                ...(Array.isArray(wo.activity_log) ? wo.activity_log : []),
                {
                    timestamp: new Date().toISOString(),
                    action: "Edited",
                    user_email: user?.email || "unknown",
                    user_name: user?.name || "System",
                    details: `Added new task: ${newTask.name}`
                }
            ]
        };

        await base44.asServiceRole.entities.TimeEntry.update(work_order_id, updatePayload);

        return Response.json({
            success: true,
            message: "Task added successfully",
            task_id: newTask.id,
            data: newTask
        });

    } catch (error) {
        console.error("Error in addTask:", error);
        return Response.json({
            success: false,
            error: "Failed to add task",
            details: error.message
        }, { status: 500 });
    }
}

if (method === 'POST' && url.searchParams.get('action') === 'create') {
  // Only admins can create work orders
  // if (!isAdmin()) {
  //   return Response.json({
  //     error: 'Only admins can create work orders',
  //     your_role: user.role
  //   }, { status: 403 });
  // }

  try {
    const body = await req.json();

    // Validate required fields
    if (!body.project_id) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }
      // Normalize team_ids
      if (!body.team_ids || !Array.isArray(body.team_ids) || body.team_ids.length === 0) {
          if (body.team_id) {
              body.team_ids = [body.team_id];
          }
      }


      if (!body.planned_start_time) {
          body.planned_start_time = new Date().toISOString();
      }



    // --- تحويل بيانات Flutter إلى Schema Base44 ---
    const mappedInstructions = convertToChecklistArray(body.work_instructions_items);
    const mappedWorkDone = convertToChecklistArray(body.work_done_items);
    const mappedSparesInstalled = convertToChecklistArray(body.spare_parts_installed);


    // Generate work order number if not provided
    const workOrders = await base44.asServiceRole.entities.TimeEntry.list();
    const dateTime = body.planned_start_time ? new Date(body.planned_start_time) : new Date();
    const dateStr = dateTime.toISOString().split('T')[0];

    const existingWOs = workOrders.filter(e => {
      if (e.status === 'on_queue') return false;
      if (!e.planned_start_time) return false;
      if (e.project_id !== body.project_id) return false;
      const entryDate = e.planned_start_time.split('T')[0];
      return entryDate === dateStr;
    });

    const existingNumbers = existingWOs
      .map(e => parseInt(e.work_order_number?.match(/N(\d+)/)?.[1] || '0'))
      .filter(n => !isNaN(n));

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;


    // Build the work order object
    const workOrderData = {
      title: body.title || '',
      project_id: body.project_id,
      branch_id: body.branch_id || null,
      work_notes: body.work_notes || '',
      task: body.task || '',
      planned_start_time: body.planned_start_time || null,
      planned_end_time: body.planned_end_time || null,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      duration_minutes: body.duration_minutes || 0,
      employee_ids: body.employee_ids || [],
      team_ids: body.team_ids || [],
      employee_id: body.employee_id || body.employee_ids?.[0] || null,
      team_id: body.team_id || body.team_ids?.[0] || null,
      equipment_ids: body.equipment_ids || [],
      equipment_id: body.equipment_id || body.equipment_ids?.[0] || null,
      work_order_number: body.work_order_number || `N${nextNumber}`,
      work_order_category_id: body.work_order_category_id || null,
      shift_type_id: body.shift_type_id || null,
      status: body.status || 'open',
      task_status: body.task_status || 'open',
      job_completion_status: body.job_completion_status || null,
      client_feedback_comments: body.client_feedback_comments || '',
      client_representative_name: body.client_representative_name || '',
      client_representative_phone: body.client_representative_phone || '',
      archived: body.archived || false,
      is_active: body.is_active || false,
      is_repeating: body.is_repeating || false,
      recurrence_type: body.recurrence_type || null,
      recurrence_interval: body.recurrence_interval || 1,
      recurrence_end_date: body.recurrence_end_date || null,
      skip_weekends: body.skip_weekends || false,
      moved_from_sunday: body.moved_from_sunday || false,
      task_document_url: body.task_document_url || '',
      start_coords: body.start_coords || null,
      end_coords: body.end_coords || null,
      start_address: body.start_address || '',
      end_address: body.end_address || '',
      file_urls: body.file_urls || [],
      other_file_urls: body.other_file_urls || [],
      breaks: body.breaks || [],
    
      note_1: body.note_1 || '',
      note_2: body.note_2 || '',
      note_3: body.note_3 || '',
      note_4: body.note_4 || '',
      work_done_description: body.work_done_description || '',
      spare_parts: body.spare_parts || '',

      work_description_items: mappedInstructions || [],
      work_done_items: mappedWorkDone || [],
      spare_parts_items: mappedSparesInstalled || [],
      
      work_pending_items: body.work_pending_items || [],
      spare_parts_pending_items: body.spare_parts_pending_items || [],

      updated_by: user.email,

      activity_log: [
        ...(body.activity_log || []),
        {
          timestamp: new Date().toISOString(),
          action: 'Created',
          user_email: user.email,
          user_name: user.name,
          details: 'Work order created'
        }
      ]
    };

    const createdWorkOrder = await base44.asServiceRole.entities.TimeEntry.create(workOrderData);


    return Response.json({
      success: true,
      data: createdWorkOrder,
      message: 'Work order created successfully',
      created_by: {
        user_id: user.id,
        email: user.email
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating work order:', error);
    return Response.json({
      success: false,
      error: 'Failed to create work order',
      details: error.message
    }, { status: 500 });
  }
}

    // DELETE /api/work-orders/:id - Delete work order
    if (method === 'DELETE') {
      // Only admins can delete work orders
      if (!isAdmin()) {
        return Response.json({ 
          error: 'Only admins can delete work orders',
          your_role: user.role
        }, { status: 403 });
      }

      const pathParts = url.pathname.split('/');
      const workOrderId = pathParts[pathParts.length - 1];

      if (!workOrderId || !workOrderId.match(/^[a-f0-9-]{36}$/i)) {
        return Response.json({ error: 'Invalid work order ID' }, { status: 400 });
      }

      try {
        await base44.asServiceRole.entities.TimeEntry.delete(workOrderId);

        return Response.json({
          success: true,
          message: 'Work order deleted successfully',
          deleted_by: {
            user_id: user.id,
            email: user.email
          }
        });
      } catch (error) {
        console.error('Error deleting work order:', error);
        return Response.json({
          success: false,
          error: 'Failed to delete work order',
          details: error.message
        }, { status: 500 });
      }
    }

// ---------------------------------------------------------


if (method === 'POST' && url.searchParams.get('action') === 'upload-timesheet-photo') {
    const timesheetId = url.searchParams.get('id_timesheet');
    const photoType = url.searchParams.get('type'); // المتوقع: 'clock_in', 'clock_out', 'switch'

    // 1. التحقق من المدخلات الأساسية
    if (!timesheetId || !photoType) {
        return Response.json({
            error: 'Missing parameters',
            example: 'POST /api/timesheets?action=upload-timesheet-photo&id_timesheet=<id>&type=clock_in'
        }, { status: 400 });
    }

    try {
        // 2. معالجة الملف المرفوع
        const formData = await req.formData();
        const photoFile = formData.get('photo');

        if (!photoFile) {
            return Response.json({
                error: 'Photo file is required',
                example: 'Send multipart/form-data with field name "photo"'
            }, { status: 400 });
        }

        // 3. جلب سجل التايم شيت للتأكد من وجوده وللتحقق من الصلاحيات
        const timesheet = await base44.asServiceRole.entities.TimesheetEntry.get(timesheetId);

        if (!timesheet) {
            return Response.json({ error: 'Timesheet entry not found' }, { status: 404 });
        }

        // التحقق من أن المستخدم هو صاحب التايم شيت (اختياري حسب سياسة الأمان لديك)
        if (timesheet.employee_id !== user.id) {
             return Response.json({ error: 'Unauthorized: You can only upload photos for your own timesheet' }, { status: 403 });
        }

        // 4. رفع الصورة إلى التخزين السحابي
        console.log(`Uploading ${photoType} photo for timesheet: ${timesheetId}`);
        const uploadResult = await base44
            .asServiceRole
            .integrations
            .Core
            .UploadFile({ file: photoFile });

        if (!uploadResult || !uploadResult.file_url) {
            throw new Error('Photo upload failed');
        }

        const photoUrl = uploadResult.file_url;
        let updateData = {};

        // 5. تحديد الحقل المطلوب تحديثه بناءً على النوع
        switch (photoType) {
            case 'clock_in':
                updateData = { clock_in_photo_url: photoUrl };
                break;
            case 'clock_out':
                updateData = { clock_out_photo_url: photoUrl };
                break;
            case 'switch':
                // بالنسبة لصور السويتش، يتم إضافتها إلى المصفوفة الموجودة مسبقاً
                updateData = { 
                    switch_photo_urls: [
                        ...(timesheet.switch_photo_urls || []), 
                        photoUrl
                    ] 
                };
                break;
            default:
                return Response.json({ error: 'Invalid photo type. Use: clock_in, clock_out, or switch' }, { status: 400 });
        }

        // 6. تحديث سجل التايم شيت في قاعدة البيانات
        const updatedTimesheet = await base44
            .asServiceRole
            .entities
            .TimesheetEntry
            .update(timesheetId, updateData);

        return Response.json({
            success: true,
            message: `${photoType} photo uploaded successfully`,
            data: {
                photo_url: photoUrl,
                timesheet: updatedTimesheet
            }
        }, { status: 200 });

    } catch (error) {
        console.error('Error uploading timesheet photo:', error);
        return Response.json({
            success: false,
            error: 'Failed to upload photo',
            details: error.message
        }, { status: 500 });
    }
}

 
// POST /api/work-orders?action=upload-signature&id_work_order=<id>
// Upload client signature

if (method === 'POST' && url.searchParams.get('action') === 'upload-signature') {
  const workOrderId = url.searchParams.get('id_work_order');

  if (!workOrderId) {
    return Response.json({
      error: 'id_work_order parameter is required',
      example: 'POST /api/work-orders?action=upload-signature&id_work_order=<work-order-id>'
    }, { status: 400 });
  }

  try {
    // Parse multipart form data
    const formData = await req.formData();
    const signatureFile = formData.get('signature');

    if (!signatureFile) {
      return Response.json({
        error: 'Signature file is required',
        example: 'Send multipart/form-data with field name "signature"'
      }, { status: 400 });
    }

    // Get work order
    const workOrders = await base44.asServiceRole.entities.TimeEntry.list();
    const workOrder = workOrders.find(wo => wo.id === workOrderId);

    if (!workOrder) {
      return Response.json({ error: 'Work order not found' }, { status: 404 });
    }

    // Permission check
    const isAssigned = (workOrder.employee_ids || []).includes(user.id);
    // if (!isAdmin() && !isAssigned) {
    //   return Response.json({
    //     error: 'You do not have permission to upload signature for this work order',
    //     your_role: user.role
    //   }, { status: 403 });
    // }

    // Upload signature
    console.log(`Uploading signature: ${signatureFile.name}`);

    const uploadResult = await base44
      .asServiceRole
      .integrations
      .Core
      .UploadFile({ file: signatureFile });

    if (!uploadResult || !uploadResult.file_url) {
      throw new Error('Signature upload failed');
    }

    // Update work order
    const updatedWorkOrder = await base44
      .asServiceRole
      .entities
      .TimeEntry
      .update(workOrderId, {
        client_signature_url: uploadResult.file_url,
        client_signature_uploaded_at: new Date().toISOString(),
        updated_by: user.email,
        activity_log: [
          ...(workOrder.activity_log || []),
          {
            timestamp: new Date().toISOString(),
            action: 'Signature Uploaded',
            user_email: user.email,
            user_name: user.name,
            details: 'Client signature uploaded'
          }
        ]
      });

    return Response.json({
      success: true,
      message: 'Signature uploaded successfully',
      data: {
        signature_url: uploadResult.file_url,
        work_order: updatedWorkOrder
      },
      uploaded_by: {
        user_id: user.id,
        email: user.email
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error uploading signature:', error);
    return Response.json({
      success: false,
      error: 'Failed to upload signature',
      details: error.message
    }, { status: 500 });
  }
}

    // ---------------------------------------------------------
// POST /api/work-orders?action=upload-files&id_work_order=<id> - Upload files
    if (method === 'POST' && url.searchParams.get('action') === 'upload-files') {
      const workOrderId = url.searchParams.get('id_work_order');

      if (!workOrderId) {
        return Response.json({ 
          error: 'id_work_order parameter is required',
          example: 'POST /api/work-orders?action=upload-files&id_work_order=<work-order-id>&user_id=<user-id>'
        }, { status: 400 });
      }

      try {
        // Parse multipart form data
        const formData = await req.formData();
        const files = formData.getAll('file_urls');

        if (!files || files.length === 0) {
          return Response.json({ 
            error: 'No files uploaded. Include files in form-data with key "files"',
            example: 'Send multipart/form-data with field name "files"'
          }, { status: 400 });
        }

        // Get the work order
        const workOrders = await base44.asServiceRole.entities.TimeEntry.list();
        const workOrder = workOrders.find(wo => wo.id === workOrderId);

        if (!workOrder) {
          return Response.json({ error: 'Work order not found' }, { status: 404 });
        }

        // Check if user has permission to upload to this work order
        const isAssigned = (workOrder.employee_ids || []).includes(user.id);
        if (!isAdmin() && !isAssigned) {
          return Response.json({ 
            error: 'You do not have permission to upload files to this work order',
            your_role: user.role
          }, { status: 403 });
        }

        const uploadedFileUrls = [];
        const failedUploads = [];

        // Upload each file
        for (const file of files) {
          try {
            console.log(`Uploading file: ${file.name}, size: ${file.size} bytes`);
            
            // Upload file using Base44 integration
            const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
            
            if (!uploadResult || !uploadResult.file_url) {
              throw new Error('Upload failed - no file URL returned');
            }

            uploadedFileUrls.push({
              name: file.name,
              size: file.size,
              url: uploadResult.file_url,
              uploaded_at: new Date().toISOString()
            });

            console.log(`✅ Successfully uploaded: ${file.name}`);
          } catch (uploadError) {
            console.error(`❌ Failed to upload ${file.name}:`, uploadError);
            failedUploads.push({
              name: file.name,
              error: uploadError.message
            });
          }
        }

        // Update work order with new file URLs
        const existingFileUrls = workOrder.file_urls || [];
        const newFileUrls = uploadedFileUrls.map(f => f.url);
        
        const updatedWorkOrder = await base44.asServiceRole.entities.TimeEntry.update(workOrderId, {
          file_urls: [...existingFileUrls, ...newFileUrls],
          updated_by: user.email
        });

        return Response.json({
          success: true,
          message: `Uploaded ${uploadedFileUrls.length} file(s) successfully`,
          data: {
            work_order: updatedWorkOrder,
            uploaded_files: uploadedFileUrls,
            failed_uploads: failedUploads.length > 0 ? failedUploads : undefined
          },
          uploaded_by: {
            user_id: user.id,
            email: user.email
          }
        }, { status: 200 });

      } catch (error) {
        console.error('Error uploading files:', error);
        return Response.json({
          success: false,
          error: 'Failed to upload files',
          details: error.message
        }, { status: 500 });
      }
    }


function convertToChecklistArray(arr) {
  if (!Array.isArray(arr)) return [];

  return arr.map(item => {
    if (typeof item === "string") {
      return {
        id: null,
        text: item,
        checked: false
      };
    }
    if (typeof item === "object") {
      return {
        id: item.id ?? null,
        text: item.text ?? "",
        checked: item.checked ?? false
      };
    }
    return { id: null, text: "", checked: false };
  });
}



if (method === 'POST' && url.searchParams.get('action') === 'update') {
  try {
    const body = await req.json();

    if (!body.id) {
      return Response.json({ error: 'Work order ID is required' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.TimeEntry.get(body.id);

    if (!existing) {
      return Response.json({ error: 'Work order not found' }, { status: 404 });
    }

    // 1. دمج المهام (Tasks) بذكاء للحفاظ على الموظفين إذا لم يتم إرسالهم
    let updatedTasks = existing.tasks || [];

    if (body.tasks && Array.isArray(body.tasks)) {
      updatedTasks = existing.tasks.map(existingTask => {
        // البحث عن التحديث القادم من التطبيق لنفس التاسك
        const incomingUpdate = body.tasks.find(t => t.id === existingTask.id);
        
        if (incomingUpdate) {
          // دمج بيانات التاسك: نأخذ القديم ونضع فوقه التعديلات (مثل الـ status)
          // هذا يضمن بقاء employee_ids و team_ids إذا لم يرسلهم التطبيق
          return {
            ...existingTask,
            ...incomingUpdate
          };
        }
        return existingTask; // إرجاع التاسك كما هي إذا لم يشملها التعديل
      });
    }

    // 2. بناء البيانات النهائية
    const mappedData = {
      ...existing, 
      ...body,      
      tasks: updatedTasks // نضع مصفوفة التاسكات المدمجة بدلاً من استبدالها
    };

    // 3. حماية الحقول السيادية (التي لا يجب أن تتغير)
    mappedData.work_order_number = existing.work_order_number;
    mappedData.branch_id = existing.branch_id; 
    mappedData.archived = existing.archived ?? false;

    // حذف الـ id من الجسم لكي لا يسبب مشكلة في التحديث
    delete mappedData.id;

    const updated = await base44
      .asServiceRole
      .entities
      .TimeEntry
      .update(body.id, mappedData);

    return Response.json({
      success: true,
      message: "Work order and tasks updated successfully",
      data: updated
    });

  } catch (e) {
    console.error("UPDATE ERROR:", e);
    return Response.json({
      success: false,
      error: "Failed to update work order",
      details: e.message
    }, { status: 500 });
  }
}

// -----------------------------


    // PATCH /api/work-orders/:id/archive - Archive work order
    if (method === 'PATCH' && url.pathname.includes('/archive')) {
      // Only admins can archive work orders
      if (!isAdmin()) {
        return Response.json({ 
          error: 'Only admins can archive work orders',
          your_role: user.role
        }, { status: 403 });
      }

      const pathParts = url.pathname.split('/');
      const workOrderId = pathParts[pathParts.length - 2];

      if (!workOrderId || !workOrderId.match(/^[a-f0-9-]{36}$/i)) {
        return Response.json({ error: 'Invalid work order ID' }, { status: 400 });
      }

      try {
        const updatedWorkOrder = await base44.asServiceRole.entities.TimeEntry.update(workOrderId, {
          archived: true
        });

        return Response.json({
          success: true,
          data: updatedWorkOrder,
          message: 'Work order archived successfully',
          archived_by: {
            user_id: user.id,
            email: user.email
          }
        });
      } catch (error) {
        console.error('Error archiving work order:', error);
        return Response.json({
          success: false,
          error: 'Failed to archive work order',
          details: error.message
        }, { status: 500 });
      }
    }

    // PATCH /api/work-orders/bulk-delete - Bulk delete work orders
    if (method === 'PATCH' && url.pathname.includes('/bulk-delete')) {
      // Only admins can bulk delete
      if (!isAdmin()) {
        return Response.json({ 
          error: 'Only admins can delete work orders',
          your_role: user.role
        }, { status: 403 });
      }

      try {
        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return Response.json({ error: 'ids array is required' }, { status: 400 });
        }

        const results = [];
        for (const id of ids) {
          try {
            await base44.asServiceRole.entities.TimeEntry.delete(id);
            results.push({ id, success: true });
          } catch (error) {
            results.push({ id, success: false, error: error.message });
          }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        return Response.json({
          success: true,
          message: `Deleted ${successCount} work orders, ${failCount} failed`,
          results,
          deleted_by: {
            user_id: user.id,
            email: user.email
          }
        });
      } catch (error) {
        console.error('Error bulk deleting work orders:', error);
        return Response.json({
          success: false,
          error: 'Failed to bulk delete work orders',
          details: error.message
        }, { status: 500 });
      }
    }

    // PATCH /api/work-orders/bulk-archive - Bulk archive work orders
    if (method === 'PATCH' && url.pathname.includes('/bulk-archive')) {
      // Only admins can bulk archive
      if (!isAdmin()) {
        return Response.json({ 
          error: 'Only admins can archive work orders',
          your_role: user.role
        }, { status: 403 });
      }

      try {
        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return Response.json({ error: 'ids array is required' }, { status: 400 });
        }

        const results = [];
        for (const id of ids) {
          try {
            await base44.asServiceRole.entities.TimeEntry.update(id, { archived: true });
            results.push({ id, success: true });
          } catch (error) {
            results.push({ id, success: false, error: error.message });
          }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        return Response.json({
          success: true,
          message: `Archived ${successCount} work orders, ${failCount} failed`,
          results,
          archived_by: {
            user_id: user.id,
            email: user.email
          }
        });
      } catch (error) {
        console.error('Error bulk archiving work orders:', error);
        return Response.json({
          success: false,
          error: 'Failed to bulk archive work orders',
          details: error.message
        }, { status: 500 });
      }
    }

// PATCH /api/work-orders?action=complete&id_work_order=...
if ( method === 'PUT') {
  const action = url.searchParams.get('action');
  const workOrderId = url.searchParams.get('id_work_order');

if (action === 'complete') {
  if (!workOrderId) {
    return Response.json({ error: 'id_work_order parameter is required' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const newStatus = body.status || 'closed';

    // const updatedWorkOrder = await base44.asServiceRole.entities.TimeEntry.update(workOrderId, {
    //   status: newStatus,
    //   completed_date: new Date().toISOString()
    // });

    const updatedWorkOrder = await base44.asServiceRole.entities.TimeEntry.update(workOrderId, body);


    return Response.json({
      success: true,
      data: updatedWorkOrder,
      message: `Work order marked as ${newStatus}`,
      updated_by: {
        user_id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error completing work order:', error);
    return Response.json({
      success: false,
      error: 'Failed to update work order',
      details: error.message
    }, { status: 500 });
  }
}

}


    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return Response.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
});