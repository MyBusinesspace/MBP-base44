import React from 'react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { Download, ArrowLeft } from 'lucide-react';

export default function WorkOrderPDFGenerator({ 
  workOrder, 
  project, 
  customer, 
  branch,
  assignedUsers = [], // ✅ Already filtered by parent component
  assignedTeams = [],
  assignedAssets = [],
  allEntries = [],
  onComplete 
}) {
  React.useEffect(() => {
    console.log('🖨️ [PDF] Component mounted');
    console.log('🖨️ [PDF] Work Order data:', workOrder);
    
    // Log content height
    const timer = setTimeout(() => {
      const content = document.querySelector('.pdf-content');
      if (content) {
        console.log('🖨️ [PDF] Content height:', content.scrollHeight);
        console.log('🖨️ [PDF] Content offsetHeight:', content.offsetHeight);
        console.log('🖨️ [PDF] Window height:', window.innerHeight);
      }
      console.log('🖨️ [PDF] Triggering print...');
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, [workOrder]);

  const getWorkOrderSequence = (entry, day, projectId) => {
    const dayEntries = allEntries.filter(e => {
      const entryDate = e.planned_start_time ? parseISO(e.planned_start_time) : null;
      if (!entryDate) return false;
      const isSameDayMatch = entryDate.toDateString() === day.toDateString();
      return isSameDayMatch && e.project_id === projectId;
    });
    
    const sortedEntries = dayEntries.sort((a, b) => {
      const timeA = a.planned_start_time ? parseISO(a.planned_start_time).getTime() : 0;
      const timeB = b.planned_start_time ? parseISO(b.planned_start_time).getTime() : 0;
      
      if (timeA !== timeB) return timeA - timeB;

      const extractNumber = (str) => {
        if (!str) return 0;
        const match = String(str).match(/N(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };
      
      return extractNumber(a.work_order_number) - extractNumber(b.work_order_number);
    });
    
    const position = sortedEntries.findIndex(e => e.id === entry.id) + 1;
    const total = sortedEntries.length;
    
    return { position, total };
  };

  const handlePrint = () => {
    console.log('🖨️ [PDF] Manual print triggered');
    const content = document.querySelector('.pdf-content');
    if (content) {
      console.log('🖨️ [PDF] Content scrollHeight:', content.scrollHeight);
      console.log('🖨️ [PDF] All sections:', {
        header: document.querySelector('.pdf-content')?.querySelectorAll('h2').length || 0,
        checklists: document.querySelectorAll('table').length
      });
    }
    window.print();
  };

  const handleClose = () => {
    if (onComplete) onComplete();
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    try {
      return format(parseISO(isoString), 'HH:mm');
    } catch {
      return '-';
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      return format(parseISO(isoString), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  const renderChecklistTable = (items, title) => {
    if (!items || items.length === 0) return (
      <div className="mb-1">
        <div className="font-semibold text-[10px] mb-0.5">{title}</div>
        <div className="border-2 border-black p-1" style={{ minHeight: '50px' }}></div>
      </div>
    );
    
    return (
      <div className="mb-1">
        <div className="font-semibold text-[10px] mb-0.5">{title}</div>
        <table className="w-full border-2 border-black text-[10px]">
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className={idx < items.length - 1 ? 'border-b border-black' : ''}>
                <td className="p-0.5 w-5 text-center border-r-2 border-black font-bold">
                  {item.checked ? '✓' : (idx + 1)}
                </td>
                <td className="p-0.5">{item.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col z-50">
      {/* Controls */}
      <div className="flex-shrink-0 p-4 flex gap-2 items-center no-print bg-white border-b shadow-sm">
        <Button variant="outline" size="sm" onClick={handleClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button size="sm" onClick={handlePrint}>
          <Download className="w-4 h-4 mr-2" />
          Print / Save PDF
        </Button>
      </div>

      {/* Scrollable container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {/* PDF Content */}
        <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none print:max-w-full pdf-content">
          <div className="p-4 print:p-2" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="mb-2 border-b-2 border-red-600 pb-1">
              <div className="flex justify-between items-start">
                <div>
                  {branch?.logo_url && (
                    <img src={branch.logo_url} alt="Company Logo" className="h-8 mb-0.5 print:h-6" />
                  )}
                  <h1 className="text-base font-bold text-red-600 print:text-sm">Work Order Edition</h1>
                  <div className="text-[8px] text-slate-600 mt-0.5 leading-tight">
                    {branch?.name && <div>{branch.name}</div>}
                    {branch?.address && <div>{branch.address}</div>}
                    {branch?.phone && <div>Tel: {branch.phone}</div>}
                    {branch?.email && <div>Email: {branch.email}</div>}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-sm">
                    Ref:{(() => {
                      const seq = getWorkOrderSequence(workOrder, parseISO(workOrder.planned_start_time), project?.id);
                      const dateRef = workOrder?.planned_start_time 
                        ? format(parseISO(workOrder.planned_start_time), 'ddMM')
                        : '';
                      return dateRef;
                    })()}
                  </div>
                  <div className="text-slate-600 text-[9px]">
                    Day {workOrder?.planned_start_time && format(parseISO(workOrder.planned_start_time), 'dd/MM/yyyy')} (WO {(() => {
                      const seq = getWorkOrderSequence(workOrder, parseISO(workOrder.planned_start_time), project?.id);
                      return seq.position;
                    })()} in month {workOrder?.planned_start_time && format(parseISO(workOrder.planned_start_time), 'MM/yyyy')})
                  </div>
                  <div className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold mt-0.5 ${
                    workOrder?.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {workOrder?.status === 'open' ? 'OPEN' : 'CLOSED'}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: General Information */}
            <div className="print-section mb-1.5 border-2 border-black p-2">
              <h2 className="text-sm font-bold bg-red-100 text-red-800 px-2 py-1 mb-1 rounded">
                1. General Information
              </h2>
              <div className="grid grid-cols-4 gap-1 text-xs mb-1">
                <div>
                  <div className="text-[9px] text-slate-500 font-semibold">Customer</div>
                  <div className="text-[10px]">{customer?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 font-semibold">Project</div>
                  <div className="text-[10px]">{project?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 font-semibold">Date</div>
                  <div className="text-[10px]">{workOrder?.planned_start_time ? formatDate(workOrder.planned_start_time) : '-'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 font-semibold">Time</div>
                  <div className="text-[10px]">
                    {formatTime(workOrder?.planned_start_time)} - {formatTime(workOrder?.planned_end_time)}
                  </div>
                </div>
                <div className="col-span-4">
                  <div className="text-[9px] text-slate-500 font-semibold">Title</div>
                  <div className="text-[10px]">{workOrder?.title || '-'}</div>
                </div>
              </div>

              {workOrder?.work_description_items && workOrder.work_description_items.length > 0 ? (
                <div className="mt-1">
                  {renderChecklistTable(workOrder.work_description_items, 'Instructions from Management')}
                </div>
              ) : (
                <div className="mt-1">
                  <div className="font-semibold text-[10px] mb-0.5">Instructions from Management</div>
                  <div className="border-2 border-black p-1" style={{ minHeight: '50px' }}></div>
                </div>
              )}
            </div>

            {/* Section 2: Assigned Resources */}
            <div className="print-section mb-1.5 border-2 border-black p-2">
              <h2 className="text-sm font-bold bg-red-100 text-red-800 px-2 py-1 mb-1 rounded">
                2. Assigned Resources
              </h2>
              <div className="text-[10px] space-y-0.5">
                <div>
                  <span className="font-semibold">Teams: </span>
                  {assignedTeams.length > 0 ? assignedTeams.map(t => t.name).join(', ') : '-'}
                </div>
                <div>
                  <span className="font-semibold">Workers: </span>
                  {assignedUsers.length > 0 ? assignedUsers.map(u => u.nickname || u.first_name || u.full_name).join(', ') : '-'}
                </div>
                <div>
                  <span className="font-semibold">Equipment: </span>
                  {assignedAssets.length > 0 ? assignedAssets.map(a => a.name).join(', ') : '-'}
                </div>
              </div>
            </div>

            {/* Section 3: Site Report */}
            <div className="print-section mb-1.5 border-2 border-black p-2">
              <h2 className="text-sm font-bold bg-red-100 text-red-800 px-2 py-1 mb-2 rounded">
                3. Site Report
              </h2>
              {(() => {
                console.log('📋 [PDF] Work Order data for checklists:', {
                  hasWorkDone: !!workOrder?.work_done_items,
                  workDoneCount: workOrder?.work_done_items?.length,
                  hasTasks: !!workOrder?.tasks,
                  tasksCount: workOrder?.tasks?.length,
                  workDoneItems: workOrder?.work_done_items,
                  tasks: workOrder?.tasks
                });

                // Collect from both main work order AND tasks
                const allWorkDone = [...(workOrder?.work_done_items || [])];
                const allSpareParts = [...(workOrder?.spare_parts_items || [])];
                const allWorkPending = [...(workOrder?.work_pending_items || [])];
                const allSparePartsPending = [...(workOrder?.spare_parts_pending_items || [])];
                
                if (workOrder?.tasks && workOrder.tasks.length > 0) {
                  workOrder.tasks.forEach(task => {
                    if (task.work_done_items) allWorkDone.push(...task.work_done_items);
                    if (task.spare_parts_items) allSpareParts.push(...task.spare_parts_items);
                    if (task.work_pending_items) allWorkPending.push(...task.work_pending_items);
                    if (task.spare_parts_pending_items) allSparePartsPending.push(...task.spare_parts_pending_items);
                  });
                }
                
                console.log('📋 [PDF] Collected items:', {
                  workDone: allWorkDone.length,
                  spareParts: allSpareParts.length,
                  workPending: allWorkPending.length,
                  sparePartsPending: allSparePartsPending.length
                });
                
                return (
                  <>
                    {renderChecklistTable(allWorkDone, 'Work Done')}
                    {renderChecklistTable(allSpareParts, 'Spare Parts Installed')}
                    {renderChecklistTable(allWorkPending, 'Work Pending')}
                    {renderChecklistTable(allSparePartsPending, 'Spare Parts Pending')}
                  </>
                );
              })()}
            </div>

            {/* Section 4: Time Tracking */}
            <div className="print-section mb-1.5 border-2 border-black p-2">
              <h2 className="text-sm font-bold bg-red-100 text-red-800 px-2 py-1 mb-1 rounded">
                4. Time Tracking
              </h2>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold">Clock In</div>
                  <div>{workOrder?.start_time ? format(parseISO(workOrder.start_time), 'dd/MM/yyyy HH:mm') : '-'}</div>
                  {workOrder?.start_address && (
                    <div className="text-[9px] text-slate-500 mt-0.5">{workOrder.start_address}</div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold">Clock Out</div>
                  <div>{workOrder?.end_time ? format(parseISO(workOrder.end_time), 'dd/MM/yyyy HH:mm') : '-'}</div>
                  {workOrder?.end_address && (
                    <div className="text-[9px] text-slate-500 mt-0.5">{workOrder.end_address}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 5: Client Approval */}
            <div className="print-section mb-1.5 border-2 border-black p-2">
              <h2 className="text-sm font-bold bg-red-100 text-red-800 px-2 py-1 mb-1 rounded">
                5. Client Approval
              </h2>
              <div className="text-[10px] space-y-1">
                <div>
                  <div className="text-[9px] text-slate-500 font-semibold">Comments</div>
                  <div className="border-2 border-black p-1 rounded" style={{ minHeight: '50px' }}>
                    {workOrder?.client_feedback_comments || ''}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div>
                    <div className="text-[9px] text-slate-500 font-semibold">Client Signature</div>
                    <div className="text-[10px] border-b border-black mt-3 pb-0.5">{workOrder?.client_representative_name || ''}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 font-semibold">Mobile</div>
                    <div className="text-[10px] border-b border-black mt-3 pb-0.5">{workOrder?.client_representative_phone || ''}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 font-semibold">Leader in Charge</div>
                    <div className="text-[10px] border-b border-black mt-3 pb-0.5">{workOrder?.leader_in_charge_signature || ''}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { 
            size: A4; 
            margin: 8mm; 
          }

          /* Hide no-print elements */
          .no-print {
            display: none !important;
          }

          /* PDF content styling */
          .pdf-content {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }

          /* Reset root elements */
          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Prevent page breaks */
          .print-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          h2 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Compact spacing for single page */
          .pdf-content > div {
            padding: 2mm !important;
          }
        }
      `}</style>
    </div>
  );
}