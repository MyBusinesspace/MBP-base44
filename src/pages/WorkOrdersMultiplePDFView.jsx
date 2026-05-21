import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useData } from '../components/DataProvider';

// Format WO number into 0019/26 format
function formatWONumber(n, refISO) {
  if (!n) return '';
  const s = String(n).trim();
  if (/^\d{3,4}\/\d{2}$/i.test(s)) return s;
  const m2 = s.match(/^WO-(\d{3,4})\/(\d{2})$/i);
  if (m2) return `${m2[1]}/${m2[2]}`;
  const m3 = s.match(/^WR-(\d{4})-(\d{1,4})$/i);
  if (m3) return `${m3[2].padStart(4,'0')}/${m3[1].slice(-2)}`;
  const m4 = s.match(/^WO-(\d{4})-(\d{1,4})$/i);
  if (m4) return `${m4[2].padStart(4,'0')}/${m4[1].slice(-2)}`;
  const m = s.match(/^(\d{1,4})$/);
  if (m) {
    const yy = (() => { try { return new Date(refISO || new Date()).getFullYear().toString().slice(-2); } catch { return new Date().getFullYear().toString().slice(-2); } })();
    return `${String(m[1]).padStart(4,'0')}/${yy}`;
  }
  return '-';
}

export default function WorkOrdersMultiplePDFView() {
    const { currentCompany, projects, customers, teams, users, workOrderCategories, shiftTypes, assets } = useData();
    const [loading, setLoading] = useState(true);
    const [workOrders, setWorkOrders] = useState([]);
    const [branch, setBranch] = useState(null);

    const urlParams = new URLSearchParams(window.location.search);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Parse URL params
            const workOrderIds = urlParams.get('workOrderIds')?.split(',').filter(Boolean) || [];
            const startDate = urlParams.get('startDate');
            const endDate = urlParams.get('endDate');

            // Fetch all branches
            const branches = await base44.entities.Branch.list();
            setBranch(currentCompany || branches?.[0] || null);

            // Fetch work orders
            let allWorkOrders = await base44.entities.TimeEntry.list('-updated_date', 2000);

            // Filter by IDs or date range
            if (workOrderIds.length > 0) {
                allWorkOrders = allWorkOrders.filter(wo => workOrderIds.includes(wo.id));
            } else if (startDate && endDate) {
                const startDateObj = new Date(startDate + 'T00:00:00');
                const endDateObj = new Date(endDate + 'T23:59:59');
                allWorkOrders = allWorkOrders.filter(wo => {
                    if (!wo.planned_start_time) return false;
                    const woDate = new Date(wo.planned_start_time);
                    return woDate >= startDateObj && woDate <= endDateObj;
                });
            }

            // Sort by time
            allWorkOrders.sort((a, b) => {
                const timeA = a.planned_start_time ? new Date(a.planned_start_time).getTime() : 0;
                const timeB = b.planned_start_time ? new Date(b.planned_start_time).getTime() : 0;
                return timeA - timeB;
            });

            setWorkOrders(allWorkOrders);
        } catch (e) {
            console.error('Error loading data:', e);
            toast.error('Failed to load work orders');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return '-';
        try {
            const date = parseISO(isoString);
            return format(date, 'hh:mm a');
        } catch {
            return '-';
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return '-';
        try {
            const date = parseISO(isoString);
            return format(date, 'dd/MM/yyyy');
        } catch {
            return '-';
        }
    };

    const formatDateLong = (isoString) => {
        if (!isoString) return '-';
        try {
            const date = parseISO(isoString);
            return format(date, 'EEEE, MMMM d, yyyy');
        } catch {
            return '-';
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            </div>
        );
    }

    const logoUrl = branch?.logo_forms_url || branch?.logo_url;
    const companyName = branch?.name || "COMPANY NAME";
    const phoneText = branch?.phone || "";
    const companyEmail = branch?.email || "";
    const trnText = branch?.tax_number || "";

    return (
        <div className="fixed inset-0 z-[100] bg-gray-100 flex flex-col overflow-hidden">
            {/* Controls */}
            <div className="flex-shrink-0 bg-white border-b shadow-sm no-print z-20">
                <div className="max-w-[210mm] mx-auto px-4 py-2 flex gap-2 items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => window.close()}>
                        <X className="w-4 h-4 mr-2" />
                        Close
                    </Button>
                    <Button size="sm" onClick={() => window.print()} className="bg-red-600 hover:bg-red-700">
                        <Download className="w-4 h-4 mr-2" />
                        Print / Save PDF
                    </Button>
                </div>
            </div>

            {/* PDF Preview */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="max-w-[210mm] mx-auto my-4 bg-white shadow-lg print:shadow-none print:my-0 pdf-content">
                    {workOrders.map((wo, woIndex) => {
                        const project = projects.find(p => p.id === wo.project_id);
                        const customer = project?.customer_id ? customers.find(c => c.id === project.customer_id) : null;
                        const assignedUsers = users.filter(u => (wo.employee_ids || []).includes(u.id));
                        const assignedTeams = teams.filter(t => (wo.team_ids || []).includes(t.id));
                        const assignedAssets = assets.filter(a => (wo.equipment_ids || []).includes(a.id));
                        const woCategory = workOrderCategories.find(c => c.id === wo.work_order_category_id);
                        const shiftType = shiftTypes.find(s => s.id === wo.shift_type_id);
                        const woNum = formatWONumber(wo.work_order_number, wo.planned_start_time || wo.created_date);

                        return (
                            <div 
                                key={wo.id} 
                                className={`p-4 text-[10px] ${woIndex > 0 ? 'page-break-before' : ''}`}
                                style={{ fontFamily: 'Arial, sans-serif' }}
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 pr-2">
                                        <h1 className="text-red-600 font-bold text-sm mb-0.5">{companyName}</h1>
                                        <div className="text-[8px] text-gray-700">
                                            {phoneText && <div>Tel: {phoneText}</div>}
                                            {companyEmail && <div>{companyEmail}</div>}
                                            {trnText && <div className="font-semibold">TRN: {trnText}</div>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        {logoUrl && (
                                            <img 
                                                src={logoUrl} 
                                                alt="Logo" 
                                                className="max-w-[200px] max-h-[80px] object-contain"
                                                crossOrigin="anonymous"
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="border-t-2 border-red-600 mb-2"></div>

                                <div className="flex justify-between items-center mb-2">
                                    <h2 className="font-bold text-xs">SERVICE & MAINTENANCE REPORT</h2>
                                    <div className="text-[9px] font-semibold text-slate-600 text-right">
                                        <div>Working order N: {woNum}</div>
                                        <div className="text-[8px] text-slate-500 mt-0.5">Title: {wo.title || 'Untitled'}</div>
                                    </div>
                                </div>

                                {/* Section 1 */}
                                <div className="mb-2">
                                    <div className="bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 mb-0.5">
                                        1. GENERAL INFORMATION
                                    </div>
                                    <table className="w-full border-collapse text-[9px]">
                                        <tbody>
                                            <tr>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold w-16">COMPANY</td>
                                                <td className="border border-slate-400 px-1 py-0.5">{customer?.name || '-'}</td>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold text-center w-16">CATEGORY</td>
                                                <td className="border border-slate-400 px-1 py-0.5 text-center">{woCategory?.name || '-'}</td>
                                            </tr>
                                            <tr>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold">LOCATION</td>
                                                <td className="border border-slate-400 px-1 py-0.5">{project?.location_name || project?.address || '-'}</td>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold text-center">SHIFT</td>
                                                <td className="border border-slate-400 px-1 py-0.5 text-center">{shiftType?.name || '-'}</td>
                                            </tr>
                                            <tr>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold">PROJECT</td>
                                                <td className="border border-slate-400 px-1 py-0.5">{project?.name || '-'}</td>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold text-center">DATE</td>
                                                <td className="border border-slate-400 px-1 py-0.5 text-center">{formatDate(wo.planned_start_time)}</td>
                                            </tr>
                                            <tr>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold">EQUIPMENT</td>
                                                <td className="border border-slate-400 px-1 py-0.5">{assignedAssets.map(a => a.name).join(', ') || '-'}</td>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold text-center">TIME</td>
                                                <td className="border border-slate-400 px-1 py-0.5 text-center">
                                                    {formatTime(wo.planned_start_time)} - {formatTime(wo.planned_end_time)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold">TITLE</td>
                                                <td className="border border-slate-400 px-1 py-0.5" colSpan={3}>{wo.title || '-'}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {wo.tasks && wo.tasks.length > 0 && (
                                        <div className="mt-1">
                                            <div className="text-[8px] font-semibold text-slate-700 mb-0.5">MANAGEMENT INSTRUCTIONS:</div>
                                            <table className="w-full border-collapse text-[9px]">
                                                <tbody>
                                                    {wo.tasks.map((task, idx) => (
                                                        <tr key={task.id || idx}>
                                                            <td className="border border-slate-300 px-1 py-0.5 bg-slate-50 font-semibold w-24">{task.name || `Task ${idx + 1}`}</td>
                                                            <td className="border border-slate-300 px-1 py-0.5 text-[8px]">{task.instructions || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Section 2 */}
                                <div className="mb-2">
                                    <div className="bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 mb-0.5">
                                        2. ASSIGNED RESOURCES
                                    </div>
                                    <table className="w-full border-collapse text-[9px]">
                                        <tbody>
                                            <tr>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold w-16">TEAMS</td>
                                                <td className="border border-slate-400 px-1 py-0.5">{assignedTeams.map(t => t.name).join(', ') || '-'}</td>
                                            </tr>
                                            <tr>
                                                <td className="border border-slate-400 px-1 py-0.5 bg-red-100 font-semibold">WORKERS</td>
                                                <td className="border border-slate-400 px-1 py-0.5">
                                                    {assignedUsers.map(u => u.nickname || u.first_name || u.full_name || u.email).join(', ') || '-'}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Section 3 - Empty for notes */}
                                <div className="mb-2">
                                    <div className="bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 mb-0.5">
                                        3. SITE REPORT
                                    </div>
                                    <div className="border border-slate-300 p-2 min-h-[60px] bg-slate-50">
                                        <div className="text-[8px] text-gray-400 italic">To be filled on site...</div>
                                    </div>
                                </div>

                                {/* Section 4 - CLIENT APPROVAL */}
                                <div>
                                    <div className="bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 mb-0.5">
                                        4. CLIENT APPROVAL
                                    </div>
                                    <div className="grid grid-cols-2 gap-0 text-[9px]">
                                        <div className="border border-slate-400 px-1 py-1 min-h-[40px]">
                                            <p className="font-bold text-[8px] text-slate-600 mb-0.5">WORKERS:</p>
                                            <p className="text-[8px]">
                                                {assignedUsers.map(u => {
                                                    const userName = u.nickname || u.first_name || u.full_name || u.email;
                                                    const isLeader = assignedTeams.some(team => team.team_leader_id === u.id);
                                                    return isLeader ? `${userName} (Leader)` : userName;
                                                }).join(', ') || '-'}
                                            </p>
                                        </div>
                                        <div className="border border-slate-400 px-1 py-1 min-h-[40px]">
                                            <p className="font-bold text-[8px] text-slate-600 mb-0.5">CLIENT SIGNATURE:</p>
                                            <div className="h-12 border border-slate-300 rounded-sm mt-1"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Print styles */}
            <style>{`
                @media print {
                    @page { 
                        size: A4; 
                        margin: 8mm; 
                    }

                    body * {
                        visibility: hidden;
                    }

                    .pdf-content, .pdf-content * {
                        visibility: visible;
                    }

                    .pdf-content {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                    }

                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    .page-break-before {
                        page-break-before: always !important;
                    }
                }
            `}</style>
        </div>
    );
}