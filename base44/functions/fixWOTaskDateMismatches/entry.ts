import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar que sea admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        error: 'Forbidden: Admin access required' 
      }, { status: 403 });
    }

    // Obtener todas las WOs desde febrero 2026 en adelante
    const allWOs = await base44.asServiceRole.entities.TimeEntry.filter(
      { planned_start_time: { $gte: '2026-02-01T00:00:00.000Z' } },
      '-updated_date',
      1000
    );

    console.log(`📊 Found ${allWOs.length} work orders to analyze`);

    const mismatches = [];
    const toUpdate = [];

    for (const wo of allWOs) {
      // Solo procesar WOs que tengan tasks
      if (!wo.tasks || wo.tasks.length === 0) continue;

      // Ordenar tasks por fecha
      const sortedTasks = wo.tasks
        .filter(t => t.date)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (sortedTasks.length === 0) continue;

      const firstTaskDate = sortedTasks[0].date; // Formato: "2026-02-16"
      const plannedStartTime = wo.planned_start_time; // Formato: "2026-02-15T03:00:00.000Z"

      if (!plannedStartTime) continue;

      // Extraer la fecha del planned_start_time (solo YYYY-MM-DD)
      const plannedDate = plannedStartTime.split('T')[0];

      // Comparar fechas
      if (plannedDate !== firstTaskDate) {
        mismatches.push({
          id: wo.id,
          work_order_number: wo.work_order_number,
          planned_date: plannedDate,
          task_date: firstTaskDate,
          title: wo.title
        });

        // Calcular nuevo planned_start_time basado en la task
        const taskStartTime = sortedTasks[0].start_time || '07:00';
        const newPlannedStartTime = `${firstTaskDate}T${taskStartTime}:00.000Z`;
        
        // Calcular nuevo planned_end_time
        const taskEndTime = sortedTasks[0].end_time || '17:00';
        const newPlannedEndTime = `${firstTaskDate}T${taskEndTime}:00.000Z`;

        toUpdate.push({
          id: wo.id,
          work_order_number: wo.work_order_number,
          updates: {
            planned_start_time: newPlannedStartTime,
            planned_end_time: newPlannedEndTime
          }
        });
      }
    }

    console.log(`🔍 Found ${mismatches.length} mismatches`);

    // Actualizar todas las WOs con mismatches
    let updated = 0;
    for (const item of toUpdate) {
      try {
        await base44.asServiceRole.entities.TimeEntry.update(
          item.id,
          item.updates
        );
        updated++;
        console.log(`✅ Updated ${item.work_order_number}: ${item.updates.planned_start_time}`);
      } catch (error) {
        console.error(`❌ Failed to update ${item.work_order_number}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      analyzed: allWOs.length,
      mismatches_found: mismatches.length,
      updated_count: updated,
      mismatches: mismatches
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});