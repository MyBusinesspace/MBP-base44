import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { FolderOpen, Download, Trash2, Loader2, Settings, Package, X, Plus, Car, Construction, ArrowUpFromLine, Boxes, Wrench, Laptop, Truck, Hammer, Drill, Monitor, Building, ChevronDown, ChevronRight, SlidersHorizontal, Copy, GripVertical, Search } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { useData } from '../components/DataProvider';
import Avatar from '../components/Avatar';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '../components/skeletons/PageSkeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import AssetDetailsPanel from '../components/assets/AssetDetailsPanel';
import AddAssetPanel from '../components/assets/AddAssetPanel';
import AssetSettingsPanel from '../components/assets/AssetSettingsPanel';
import EquipmentDetailsPanel from '../components/equipment/EquipmentDetailsPanel';
import AddEquipmentPanel from '../components/equipment/AddEquipmentPanel';
import AssetFilterPanel from '../components/assets/AssetFilterPanel';
import DateRangeFilter from '../components/assets/DateRangeFilter';
import ProjectCombobox from '../components/workorders/ProjectCombobox';
import AssetDocumentMatrixTab from '../components/assets/AssetDocumentMatrixTab';
import WorkOrderDetailsDialog from '../components/workorders/WorkOrderDetailsDialog';
import WorkOrderHistoryTable from '../components/assets/WorkOrderHistoryTable';



export default function DocumentsPage() {
  const { currentUser, currentCompany, loadUsers, loadProjects } = useData();
  
  // Get URL params for navigation from other pages
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get('tab');
  const urlEquipmentId = urlParams.get('equipment_id');
  const urlAssetId = urlParams.get('asset_id');
  
  // Local states
  const [allEmployees, setAllEmployees] = useState([]);

  const [localLoading, setLocalLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [currentTab, setCurrentTab] = useState(urlTab === 'equipment' ? 'equipment-docs' : 'asset-docs');
  


  // Asset docs states
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [assetCategories, setAssetCategories] = useState([]);
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showAssetDetailsPanel, setShowAssetDetailsPanel] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [equipmentSortConfig, setEquipmentSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [showAddAssetPanel, setShowAddAssetPanel] = useState(false);
  const [showAssetSettingsPanel, setShowAssetSettingsPanel] = useState(false);
  const [assetLoadLimit, setAssetLoadLimit] = useState(5000);
  const [totalAssetsCount, setTotalAssetsCount] = useState(0);

  const [exporting, setExporting] = useState(false);

  // Client Equipment states
  const [equipment, setEquipment] = useState([]);
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
  const [selectedEquipmentCategories, setSelectedEquipmentCategories] = useState([]);
  const [selectedEquipmentStatuses, setSelectedEquipmentStatuses] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [showEquipmentDetailsPanel, setShowEquipmentDetailsPanel] = useState(false);
  const [isEquipmentMultiSelectMode, setIsEquipmentMultiSelectMode] = useState(false);
  const [selectedEquipments, setSelectedEquipments] = useState(new Set());

  const [showAddEquipmentPanel, setShowAddEquipmentPanel] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [expandedEquipments, setExpandedEquipments] = useState(new Set());
  const [expandedAssets, setExpandedAssets] = useState(new Set());
  const [selectedAssetProject, setSelectedAssetProject] = useState('');
  const [selectedEquipmentProject, setSelectedEquipmentProject] = useState('');
  const [workOrderCategories, setWorkOrderCategories] = useState([]);
  const [selectedAssetWOCategories, setSelectedAssetWOCategories] = useState([]);
  const [assetDateRange, setAssetDateRange] = useState(null);
  const [selectedFinanceCategories, setSelectedFinanceCategories] = useState([]);
  const [financeCategories, setFinanceCategories] = useState([]);
  const [selectedEquipmentWOCategories, setSelectedEquipmentWOCategories] = useState([]);
  const [equipmentDateRange, setEquipmentDateRange] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showWorkOrderPanel, setShowWorkOrderPanel] = useState(false);
  const [teams, setTeams] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  
  // Work Orders History table states for Assets
  const [assetWOSort, setAssetWOSort] = useState({ key: 'date', direction: 'desc' });
  const [assetWOStatusFilter, setAssetWOStatusFilter] = useState([]);
  const [assetWOCategoryFilter, setAssetWOCategoryFilter] = useState([]);
  
  // Work Orders History table states for Equipment
  const [equipmentWOSort, setEquipmentWOSort] = useState({ key: 'date', direction: 'desc' });
  const [equipmentWOStatusFilter, setEquipmentWOStatusFilter] = useState([]);
  const [equipmentWOCategoryFilter, setEquipmentWOCategoryFilter] = useState([]);
  
  // Asset visible columns toggle - persisted in localStorage
  const DEFAULT_ASSET_COL_ORDER = ['category', 'subcategory', 'finance_category', 'plate_number', 'identifier', 'quantity', 'brand', 'year_of_manufacture', 'mast_type', 'height', 'status', 'status_duration', 'status_since', 'assigned_client', 'project'];
  const DEFAULT_VISIBLE_COLS = { category: true, subcategory: true, finance_category: true, plate_number: true, identifier: true, quantity: true, brand: true, year_of_manufacture: true, mast_type: true, height: true, status: true, status_since: true, status_duration: true, assigned_client: true, project: true };

  const [visibleAssetColumns, setVisibleAssetColumnsState] = useState(DEFAULT_VISIBLE_COLS);
  const setVisibleAssetColumns = (updater) => {
    setVisibleAssetColumnsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('asset-visible-cols', JSON.stringify(next));
      return next;
    });
  };

  const [assetColumnOrder, setAssetColumnOrderState] = useState(() => {
    try { const s = localStorage.getItem('asset-col-order'); return s ? JSON.parse(s) : DEFAULT_ASSET_COL_ORDER; } catch { return DEFAULT_ASSET_COL_ORDER; }
  });
  const setAssetColumnOrder = (val) => {
    const next = typeof val === 'function' ? val(assetColumnOrder) : val;
    localStorage.setItem('asset-col-order', JSON.stringify(next));
    setAssetColumnOrderState(next);
  };

  const isAdmin = currentUser?.role === 'admin';

  // Helper function to format duration as "Xm Yd" or just "Xd"
  const formatStatusDuration = (dateString) => {
    if (!dateString) return '-';
    const startDate = new Date(dateString);
    const now = new Date();
    const totalDays = differenceInDays(now, startDate);
    const months = differenceInMonths(now, startDate);
    const remainingDays = totalDays - (months * 30); // Approximate
    
    if (months > 0) {
      return `${months}m ${remainingDays}d`;
    }
    return `${totalDays}d`;
  };

  // Get duration of previous status from activity log
  const getPreviousStatusDuration = (asset) => {
    if (!asset.activity_log || asset.activity_log.length === 0) return '-';
    
    // Find status changes, most recent first
    const statusChanges = [...asset.activity_log]
      .filter(log => log.changes?.status)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (statusChanges.length < 2) return '-';
    
    // Calculate duration between the two most recent status changes
    const lastChange = statusChanges[0];
    const previousChange = statusChanges[1];
    
    const totalDays = differenceInDays(
      new Date(lastChange.timestamp),
      new Date(previousChange.timestamp)
    );
    
    const months = differenceInMonths(
      new Date(lastChange.timestamp),
      new Date(previousChange.timestamp)
    );
    const remainingDays = totalDays - (months * 30);
    
    if (months > 0) {
      return `${months}m ${remainingDays}d`;
    }
    return totalDays >= 1 ? `${totalDays}d` : '-';
  };

  // Equipment Columns
  const allEquipmentColumns = [
    { id: 'name', label: 'Name', locked: true },
    { id: 'category', label: 'Category', locked: false },
    { id: 'brand', label: 'Brand', locked: false },
    { id: 'year_of_manufacture', label: 'YOM', locked: false },
    { id: 'mast_type', label: 'Mast Type', locked: false },
    { id: 'height', label: 'Height', locked: false },
    { id: 'serial_number', label: 'Serial Number', locked: false },
    { id: 'plate_number', label: 'Plate Number', locked: false },
    { id: 'status', label: 'Status', locked: false },
    { id: 'status_since', label: 'Status Since', locked: false },
    { id: 'status_duration', label: 'Time in Status', locked: false },
    { id: 'client_name', label: 'Client', locked: false },
    { id: 'project', label: 'Project', locked: false },
  ];

  const [visibleEquipmentColumns, setVisibleEquipmentColumns] = useState(allEquipmentColumns.map(c => c.id));
  const [equipmentColumnOrder, setEquipmentColumnOrder] = useState(allEquipmentColumns.map(c => c.id));

  const handleToggleEquipmentColumn = (columnId) => {
    setVisibleEquipmentColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId) 
        : [...prev, columnId]
    );
  };

  const toggleEquipmentExpansion = (equipmentId) => {
    setExpandedEquipments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(equipmentId)) {
        newSet.delete(equipmentId);
      } else {
        newSet.add(equipmentId);
      }
      return newSet;
    });
  };

  const toggleAssetExpansion = (assetId) => {
    setExpandedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  // Load initial data on mount
  useEffect(() => {
    loadData();
  }, []);
  
  // Reload when limit changes
  useEffect(() => {
    if (isDataLoaded) {
      loadData();
    }
  }, [assetLoadLimit]);

  // Handle equipment navigation from URL
  useEffect(() => {
    if (urlEquipmentId && equipment.length > 0) {
      const targetEquipment = equipment.find(eq => eq.id === urlEquipmentId);
      if (targetEquipment) {
        setSelectedEquipment(targetEquipment);
        setShowEquipmentDetailsPanel(true);
      }
    }
  }, [urlEquipmentId, equipment]);

  // Handle asset navigation from URL
  useEffect(() => {
    if (urlAssetId && assets.length > 0) {
      const targetAsset = assets.find(a => a.id === urlAssetId);
      if (targetAsset) {
        setSelectedAsset(targetAsset);
        setShowAssetDetailsPanel(true);
      }
    }
  }, [urlAssetId, assets]);

  const loadData = async () => {
        if (!isDataLoaded) setLocalLoading(true);
        try {
          
          
          // ✅ FASE 1: Solo lo esencial (assets + equipment)
          const [assetsData, equipmentData, categoriesData, financeCatsData] = await Promise.all([
            base44.entities.Asset.list('-updated_date', assetLoadLimit),
            base44.entities.ClientEquipment.list('-updated_date', 200),
            base44.entities.AssetCategory.list('sort_order'),
            base44.entities.FinanceCategory.list('sort_order')
          ]);

          setAssets(assetsData || []);
          setEquipment(equipmentData || []);
          setAssetCategories(categoriesData || []);
          setFinanceCategories(financeCatsData || []);
          window._assetCategories = categoriesData || [];
          
          // Get total count for display
          base44.entities.Asset.list('-updated_date', 1000).then(allAssets => {
            setTotalAssetsCount(allAssets?.length || 0);
          });
          
          setLocalLoading(false);
          setIsDataLoaded(true);
          
          // ✅ FASE 2: Background
          Promise.all([
            loadUsers(true),
            base44.entities.Project.filter({ status: 'active' }, '-updated_date', 1000),
            base44.entities.Customer.list('-updated_date', 300),
            base44.entities.TimeEntry.list('-created_date', 300),
            base44.entities.WorkOrderCategory.list('sort_order'),
            base44.entities.Team.list('sort_order'),
            base44.entities.ShiftType.list('sort_order')
          ]).then(([usersData, activeProjectsData, customersData, workOrdersData, workOrderCategoriesData, teamsData, shiftTypesData]) => {
            setAllEmployees(usersData || []);
            setProjects(activeProjectsData || []);
            setCustomers(customersData || []);
            setWorkOrders(workOrdersData || []);
            setWorkOrderCategories(workOrderCategoriesData || []);
            setTeams(teamsData || []);
            setShiftTypes(shiftTypesData || []);
          }).catch(console.error);
          
        } catch (error) {
          toast.error('Failed to load documents');
          setLocalLoading(false);
          setIsDataLoaded(true);
        }
      };





  const getDynamicFullName = (user) => {
    if (!user) return 'Unknown User';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return `${firstName} ${lastName}`.trim() || user.full_name || user.email;
  };

  // Asset functions
  const handleSort = (columnKey) => {
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEquipmentSort = (columnKey) => {
    setEquipmentSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredCategories = useMemo(() => {
    const categoryCounts = {};
    assets.forEach(asset => {
      const category = asset.category || 'Other';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    return Object.entries(categoryCounts).map(([name, count]) => ({ name, count }));
  }, [assets]);

  const filteredStatuses = useMemo(() => {
    const statusCounts = {};
    assets.forEach(asset => {
      const status = asset.status || 'Available';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([name, count]) => ({ name, count }));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    let filtered = assets.filter(asset => {
      const project = projects.find(p => p.id === asset.project_id);
      const customer = customers.find(c => c.id === project?.customer_id);
      
      const matchesSearch = (
        asset.name?.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        asset.identifier?.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        asset.notes?.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        asset.category?.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        asset.status?.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        project?.name?.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        customer?.name?.toLowerCase().includes(assetSearchTerm.toLowerCase())
      );

      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(asset.category);
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(asset.status);
      const matchesProject = !selectedAssetProject || asset.project_id === selectedAssetProject;
      const matchesFinanceCategory = selectedFinanceCategories.length === 0 || selectedFinanceCategories.includes(asset.finance_category);

      // Work Order Category filter
      const assetWorkOrders = workOrders.filter(wo => (wo.equipment_ids || []).includes(asset.id));
      const matchesWOCategory = selectedAssetWOCategories.length === 0 || 
        assetWorkOrders.some(wo => wo.work_order_category_id && selectedAssetWOCategories.includes(wo.work_order_category_id));

      // Date range filter (based on work orders)
      let matchesDateRange = true;
      if (assetDateRange?.start && assetDateRange?.end) {
        matchesDateRange = assetWorkOrders.some(wo => {
          const woDate = wo.task_start_date || wo.planned_start_time;
          if (!woDate) return false;
          const date = new Date(woDate);
          // Normalize to start of day for comparison
          const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const startOnly = new Date(assetDateRange.start.getFullYear(), assetDateRange.start.getMonth(), assetDateRange.start.getDate());
          const endOnly = new Date(assetDateRange.end.getFullYear(), assetDateRange.end.getMonth(), assetDateRange.end.getDate());
          return dateOnly >= startOnly && dateOnly <= endOnly;
        });
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesProject && matchesWOCategory && matchesDateRange && matchesFinanceCategory;
    });

    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'assigned_to') {
          const userA = allEmployees.find(u => u.id === a.assigned_to_user_id);
          const userB = allEmployees.find(u => u.id === b.assigned_to_user_id);
          aVal = userA ? `${userA.first_name || ''} ${userA.last_name || ''}`.trim() : '';
          bVal = userB ? `${userB.first_name || ''} ${userB.last_name || ''}`.trim() : '';
        } else if (sortConfig.key === 'project') {
          const projA = projects.find(p => p.id === a.project_id);
          const projB = projects.find(p => p.id === b.project_id);
          aVal = projA?.name || '';
          bVal = projB?.name || '';
        }

        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [assets, assetSearchTerm, selectedCategories, selectedStatuses, sortConfig, allEmployees, projects, selectedAssetProject, customers, selectedAssetWOCategories, workOrders, assetDateRange, selectedFinanceCategories]);

  const handleAssetRowClick = (asset) => {
    if (isMultiSelectMode) {
      handleToggleAssetSelection(asset.id);
    } else {
      setSelectedAsset(asset);
      setShowAssetDetailsPanel(true);
    }
  };

  const handleToggleAssetSelection = (assetId) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const handleCategoryToggle = (categoryName) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryName)) {
        return prev.filter(c => c !== categoryName);
      }
      return [...prev, categoryName];
    });
  };

  const handleStatusToggle = (statusName) => {
    setSelectedStatuses(prev => {
      if (prev.includes(statusName)) {
        return prev.filter(s => s !== statusName);
      }
      return [...prev, statusName];
    });
  };

  const handleAssetUpdated = async (updatedAsset) => {
    await loadData();
    setSelectedAsset(updatedAsset);
  };

  const handleAssetDeleted = async () => {
    setShowAssetDetailsPanel(false);
    setSelectedAsset(null);
    await loadData();
  };

  const handleBulkDeleteAssets = async () => {
    if (selectedAssets.size === 0) return;

    if (!confirm(`Delete ${selectedAssets.size} asset(s)? This action cannot be undone.`)) return;

    const idsToDelete = Array.from(selectedAssets);

    try {
      await Promise.all(idsToDelete.map(id => base44.entities.Asset.delete(id)));

      toast.success(`${idsToDelete.length} asset(s) deleted successfully`);
      setSelectedAssets(new Set());
      setIsMultiSelectMode(false);
      await loadData();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete some assets');
      await loadData();
    }
  };



  const handleSelectAllAssets = (checked) => {
    if (checked) {
      setSelectedAssets(new Set(filteredAssets.map(a => a.id)));
    } else {
      setSelectedAssets(new Set());
    }
  };



  const handleExportAssets = () => {
    setExporting(true);
    try {
      const assetsToExport = selectedAssets.size > 0
        ? filteredAssets.filter(a => selectedAssets.has(a.id))
        : filteredAssets;

      const headers = ['Name', 'Category', 'Subcategory', 'Status', 'Identifier', 'Assigned To', 'Project'];

      const rows = assetsToExport.map(asset => {
        const assignedUser = allEmployees.find(u => u.id === asset.assigned_to_user_id);
        const project = projects.find(p => p.id === asset.project_id);

        return [
          asset.name || '',
          asset.category || '',
          asset.subcategory || '',
          asset.status || '',
          asset.identifier || '',
          assignedUser ? `${assignedUser.first_name || ''} ${assignedUser.last_name || ''}`.trim() : '',
          project?.name || ''
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `assets_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Assets exported successfully');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Failed to export assets');
    } finally {
      setExporting(false);
    }
  };

  if (localLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <TableSkeleton rows={10} columns={8} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-600">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <Card className="p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 header-express">Documents & Assets</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAssetSettingsPanel(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </Card>

      {/* Content */}
      <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          {/* Tab Switcher inside Content container */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setCurrentTab('asset-docs')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    currentTab === 'asset-docs' 
                      ? "bg-white shadow-sm text-slate-900" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {currentCompany?.assets_tab_icon_url ? (
                    <img src={currentCompany.assets_tab_icon_url} alt="Assets" className="w-5 h-5 object-contain" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                  Our Assets ({filteredAssets.length})
                </button>
                <button
                  onClick={() => setCurrentTab('equipment-docs')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    currentTab === 'equipment-docs' 
                      ? "bg-white shadow-sm text-slate-900" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {currentCompany?.equipment_tab_icon_url ? (
                    <img src={currentCompany.equipment_tab_icon_url} alt="Equipment" className="w-5 h-5 object-contain" />
                  ) : (
                    <Building className="w-4 h-4" />
                  )}
                  Client Equipment ({equipment.length})
                </button>
                <button
                  onClick={() => setCurrentTab('doc-matrix')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    currentTab === 'doc-matrix' 
                      ? "bg-white shadow-sm text-slate-900" 
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Document Matrix
                </button>
              </div>

            </div>
          </div>

          <TabsList className="hidden">
          </TabsList>



          {/* Asset Documents Tab */}
          <TabsContent value="asset-docs" className="m-0 p-4 space-y-3">
            {/* Asset Controls - Single row */}
            <div className="flex items-center gap-3 flex-wrap">
              <AssetFilterPanel
                categories={filteredCategories}
                selectedCategories={selectedCategories}
                onCategoryToggle={handleCategoryToggle}
                statuses={filteredStatuses}
                selectedStatuses={selectedStatuses}
                onStatusToggle={handleStatusToggle}
                financeCategories={financeCategories.map(fc => {
                  const count = assets.filter(asset => asset.finance_category === fc.name).length;
                  return { id: fc.id, name: fc.name, count };
                })}
                selectedFinanceCategories={selectedFinanceCategories}
                onFinanceCategoryToggle={(name) => {
                  setSelectedFinanceCategories(prev => 
                    prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
                  );
                }}
                workOrderCategories={workOrderCategories.map(cat => {
                  const count = assets.filter(asset => {
                    const assetWOs = workOrders.filter(wo => (wo.equipment_ids || []).includes(asset.id));
                    return assetWOs.some(wo => wo.work_order_category_id === cat.id);
                  }).length;
                  return { id: cat.id, name: cat.name, count };
                })}
                selectedWOCategories={selectedAssetWOCategories}
                onWOCategoryToggle={(id) => {
                  setSelectedAssetWOCategories(prev => 
                    prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
                  );
                }}
                onClearAll={() => {
                  setSelectedCategories([]);
                  setSelectedStatuses([]);
                  setSelectedAssetWOCategories([]);
                  setSelectedFinanceCategories([]);
                }}
              />

              <DateRangeFilter
                dateRange={assetDateRange}
                onDateRangeChange={setAssetDateRange}
              />

                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Search assets..."
                    value={assetSearchTerm}
                    onChange={(e) => setAssetSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {assetSearchTerm && (
                    <button onClick={() => setAssetSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <Button
                  variant={isMultiSelectMode ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setIsMultiSelectMode(!isMultiSelectMode);
                    setSelectedAssets(new Set());
                  }}
                  className="gap-1.5"
                >
                  {isMultiSelectMode ? <X className="w-4 h-4" /> : <Checkbox className="w-4 h-4" />}
                  {isMultiSelectMode ? 'Cancel' : 'Select'}
                </Button>

                {isMultiSelectMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAllAssets(selectedAssets.size !== filteredAssets.length);
                    }}
                  >
                    {selectedAssets.size === filteredAssets.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}

                {isMultiSelectMode && selectedAssets.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDeleteAssets}
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedAssets.size})
                  </Button>
                )}

                <div className="min-w-[200px]">
                  <ProjectCombobox
                    projects={[{ id: '', name: 'All Projects' }, ...projects]}
                    customers={customers}
                    selectedProjectId={selectedAssetProject}
                    onSelectProject={(id) => setSelectedAssetProject(id)}
                    placeholder="All Projects"
                  />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportAssets}
                    disabled={exporting}
                    className="gap-1.5"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export CSV
                  </Button>

                  <Button
                    onClick={() => setShowAddAssetPanel(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
                    size="sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Asset
                  </Button>
                </div>
              </div>

            {/* Assets Table */}
            {(() => {
              const ASSET_COL_DEFS = {
                category:           { label: 'Category',        sortField: 'category' },
                subcategory:        { label: 'Subcategory',     sortField: 'subcategory' },
                finance_category:   { label: 'Finance Cat.',    sortField: 'finance_category' },
                plate_number:       { label: 'Plate Number',    sortField: 'plate_number' },
                identifier:         { label: 'Identifier',      sortField: 'identifier' },
                quantity:           { label: 'Units',           sortField: 'quantity' },
                brand:              { label: 'Brand',           sortField: 'brand' },
                year_of_manufacture:{ label: 'YOM',             sortField: 'year_of_manufacture' },
                mast_type:          { label: 'Mast Type',       sortField: 'mast_type' },
                height:             { label: 'Height',          sortField: 'height' },
                status:             { label: 'Status',          sortField: 'status' },
                status_duration:    { label: 'Time Status',     sortField: null },
                status_since:       { label: 'Time Last Status',sortField: 'last_status_change_date' },
                assigned_client:    { label: 'Assigned / Client',sortField: 'assigned_to' },
                project:            { label: 'Project',         sortField: 'project' },
              };
              const orderedCols = assetColumnOrder.filter(k => visibleAssetColumns[k]);
              const handleAssetDragEnd = (result) => {
                if (!result.destination) return;
                const newOrder = [...assetColumnOrder];
                const [moved] = newOrder.splice(result.source.index, 1);
                newOrder.splice(result.destination.index, 0, moved);
                setAssetColumnOrder(newOrder);
              };
              const renderAssetCell = (key, asset, assignedUser, project) => {
                switch (key) {
                  case 'category': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.category || '-'}</TableCell>;
                  case 'subcategory': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.subcategory || '-'}</TableCell>;
                  case 'finance_category': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.finance_category || '-'}</TableCell>;
                  case 'plate_number': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.plate_number || '-'}</TableCell>;
                  case 'identifier': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.identifier || '-'}</TableCell>;
                  case 'quantity': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.quantity || 1}</TableCell>;
                  case 'brand': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.brand || '-'}</TableCell>;
                  case 'year_of_manufacture': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.year_of_manufacture || '-'}</TableCell>;
                  case 'mast_type': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.mast_type || '-'}</TableCell>;
                  case 'height': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.height || '-'}</TableCell>;
                  case 'status': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.status || '-'}</TableCell>;
                  case 'status_duration': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{asset.last_status_change_date ? <span className="text-indigo-600 font-medium">{formatStatusDuration(asset.last_status_change_date)}</span> : '-'}</TableCell>;
                  case 'status_since': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{getPreviousStatusDuration(asset)}</TableCell>;
                  case 'assigned_client': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{(() => { const customer = customers.find(c => c.id === project?.customer_id); if (assignedUser) return <div className="flex items-center gap-2"><Avatar user={assignedUser} size="sm" />{`${assignedUser.first_name || ''} ${assignedUser.last_name || ''}`.trim()}</div>; if (customer) return <span>{customer.name}</span>; return '-'; })()}</TableCell>;
                  case 'project': return <TableCell key={key} className="px-2 py-1 text-xs font-light text-slate-600">{project?.name || '-'}</TableCell>;
                  default: return null;
                }
              };
              return (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                      <TableRow>
                        <TableHead className="w-10 px-2 py-1"></TableHead>
                        {isMultiSelectMode && <TableHead className="w-12 px-2 py-1"></TableHead>}
                        <TableHead className="px-2 py-1 text-left text-xs font-light text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                          <div className="flex items-center gap-2">Type {sortConfig.key === 'name' && <span className="text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                        </TableHead>
                        {orderedCols.map(key => {
                          const def = ASSET_COL_DEFS[key];
                          return (
                            <TableHead key={key} className="px-2 py-1 text-left text-xs font-light text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => def.sortField && handleSort(def.sortField)}>
                              <div className="flex items-center gap-1">{def.label}{def.sortField && sortConfig.key === def.sortField && <span className="text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                            </TableHead>
                          );
                        })}
                        <TableHead className="w-72 px-2 py-1 text-right">
                           <Popover>
                             <PopoverTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-6 w-6">
                                 <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                               </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-64" align="end" side="bottom" sideOffset={8}>
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm mb-1">Columns (drag to reorder)</h4>
                                <DragDropContext onDragEnd={handleAssetDragEnd}>
                                  <Droppable droppableId="asset-cols">
                                    {(provided) => (
                                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                                        {assetColumnOrder.map((key, index) => {
                                          const def = ASSET_COL_DEFS[key];
                                          return (
                                            <Draggable key={key} draggableId={key} index={index}>
                                              {(provided, snapshot) => (
                                                <div ref={provided.innerRef} {...provided.draggableProps} className={cn("flex items-center justify-between py-1 px-1 rounded", snapshot.isDragging && "bg-slate-100 shadow")}>
                                                  <div className="flex items-center gap-2">
                                                    <span {...provided.dragHandleProps} className="cursor-grab text-slate-400 hover:text-slate-600"><GripVertical className="w-3.5 h-3.5" /></span>
                                                    <span className="text-sm text-slate-600">{def.label}</span>
                                                  </div>
                                                  <Switch checked={visibleAssetColumns[key]} onCheckedChange={(checked) => setVisibleAssetColumns(prev => ({ ...prev, [key]: checked }))} />
                                                </div>
                                              )}
                                            </Draggable>
                                          );
                                        })}
                                        {provided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>
                                </DragDropContext>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200">
                      {filteredAssets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={orderedCols.length + (isMultiSelectMode ? 4 : 3)} className="px-4 py-8 text-center text-slate-500">
                            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">No assets found</p>
                            <p className="text-sm mt-1">Try adjusting your filters or search term</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAssets.map(asset => {
                          const assignedUser = allEmployees.find(u => u.id === asset.assigned_to_user_id);
                          const project = projects.find(p => p.id === asset.project_id);
                          const isExpanded = expandedAssets.has(asset.id);
                          const assetWorkOrders = workOrders.filter(wo => (wo.equipment_ids || []).includes(asset.id));
                          return (
                            <React.Fragment key={asset.id}>
                              <TableRow onClick={() => handleAssetRowClick(asset)} className={cn("hover:bg-slate-50 cursor-pointer transition-colors", isMultiSelectMode && selectedAssets.has(asset.id) && "bg-indigo-50", isExpanded && "bg-slate-50")}>
                                <TableCell className="px-2 py-1 w-10" onClick={(e) => { e.stopPropagation(); toggleAssetExpansion(asset.id); }}>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">{isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</Button>
                                </TableCell>
                                {isMultiSelectMode && (
                                  <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox checked={selectedAssets.has(asset.id)} onCheckedChange={() => handleToggleAssetSelection(asset.id)} />
                                  </TableCell>
                                )}
                                <TableCell className="px-2 py-1 text-xs font-light text-slate-900">
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const category = assetCategories.find(c => c.name === asset.category);
                                      if (category?.icon_url) return <img src={category.icon_url} alt={asset.category} className="w-8 h-8 object-contain flex-shrink-0" />;
                                      const iconName = category?.icon || 'Package';
                                      const iconMap = { Package, Car, Construction, ArrowUpFromLine, Boxes, Wrench, Laptop, Truck, Hammer, Drill, Monitor, Building };
                                      const IconComponent = iconMap[iconName] || Package;
                                      return <IconComponent className="w-8 h-8 text-slate-500 flex-shrink-0" />;
                                    })()}
                                    {asset.name}
                                  </div>
                                </TableCell>
                                {orderedCols.map(key => renderAssetCell(key, asset, assignedUser, project))}
                                <TableCell className="w-10 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                  <button title="Duplicate" onClick={async (e) => { e.stopPropagation(); const { id, created_date, updated_date, created_by, activity_log, status_history, ...d } = asset; await base44.entities.Asset.create({ ...d, name: `${d.name} (Copy)`, status: 'Available', last_status_change_date: new Date().toISOString() }); toast.success('Asset duplicated'); loadData(); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                  <TableCell colSpan={orderedCols.length + (isMultiSelectMode ? 4 : 3)} className="px-8 py-4">
                                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                                      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Settings className="w-4 h-4 text-indigo-600" />Work Orders History ({assetWorkOrders.length})</h4>
                                      <WorkOrderHistoryTable workOrders={assetWorkOrders} workOrderCategories={workOrderCategories} allEmployees={allEmployees} woSort={assetWOSort} setWOSort={setAssetWOSort} woCategoryFilter={assetWOCategoryFilter} setWOCategoryFilter={setAssetWOCategoryFilter} woStatusFilter={assetWOStatusFilter} setWOStatusFilter={setAssetWOStatusFilter} onClickWO={(wo) => { setSelectedWorkOrder(wo); setShowWorkOrderPanel(true); }} />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Rows per page:</span>
                <select
                  value={assetLoadLimit}
                  onChange={(e) => setAssetLoadLimit(Number(e.target.value))}
                  className="h-8 w-24 rounded-md border border-slate-300 bg-white text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={5000}>All</option>
                </select>
              </div>
              
              <div className="text-sm text-slate-600">
                Showing {filteredAssets.length} of {totalAssetsCount} assets
              </div>
            </div>
          </TabsContent>

          {/* Document Matrix Tab */}
          <TabsContent value="doc-matrix" className="m-0 p-6">
            <AssetDocumentMatrixTab isAdmin={isAdmin} />
          </TabsContent>

          {/* Client Equipment Tab */}
          <TabsContent value="equipment-docs" className="m-0 p-4 space-y-3">
            {/* Equipment Controls - Single row */}
              <div className="flex items-center gap-3 flex-wrap">
                <AssetFilterPanel
                  categories={(() => {
                    const categoryCounts = {};
                    equipment.forEach(eq => {
                      const category = eq.category || 'Other';
                      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
                    });
                    return Object.entries(categoryCounts).map(([name, count]) => ({ name, count }));
                  })()}
                  selectedCategories={selectedEquipmentCategories}
                  onCategoryToggle={(name) => {
                    setSelectedEquipmentCategories(prev => 
                      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
                    );
                  }}
                  statuses={(() => {
                    const statusCounts = {};
                    equipment.forEach(eq => {
                      const status = eq.status || 'Unknown';
                      statusCounts[status] = (statusCounts[status] || 0) + 1;
                    });
                    return Object.entries(statusCounts).map(([name, count]) => ({ name, count }));
                  })()}
                  selectedStatuses={selectedEquipmentStatuses}
                  onStatusToggle={(name) => {
                    setSelectedEquipmentStatuses(prev => 
                      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
                    );
                  }}
                  workOrderCategories={workOrderCategories.map(cat => {
                    const count = equipment.filter(eq => {
                      const eqWOs = workOrders.filter(wo => (wo.equipment_ids || []).includes(eq.id));
                      return eqWOs.some(wo => wo.work_order_category_id === cat.id);
                    }).length;
                    return { id: cat.id, name: cat.name, count };
                  })}
                  selectedWOCategories={selectedEquipmentWOCategories}
                  onWOCategoryToggle={(id) => {
                    setSelectedEquipmentWOCategories(prev => 
                      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
                    );
                  }}
                  onClearAll={() => {
                    setSelectedEquipmentCategories([]);
                    setSelectedEquipmentStatuses([]);
                    setSelectedEquipmentWOCategories([]);
                  }}
                />
                
                <DateRangeFilter
                  dateRange={equipmentDateRange}
                  onDateRangeChange={setEquipmentDateRange}
                />

                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Search equipment..."
                    value={equipmentSearchTerm}
                    onChange={(e) => setEquipmentSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {equipmentSearchTerm && (
                    <button onClick={() => setEquipmentSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <Button
                  variant={isEquipmentMultiSelectMode ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setIsEquipmentMultiSelectMode(!isEquipmentMultiSelectMode);
                    setSelectedEquipments(new Set());
                  }}
                  className="gap-1.5"
                >
                  {isEquipmentMultiSelectMode ? <X className="w-4 h-4" /> : <Checkbox className="w-4 h-4" />}
                  {isEquipmentMultiSelectMode ? 'Cancel' : 'Select'}
                </Button>

                {isEquipmentMultiSelectMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const allEquipmentIds = equipment.map(eq => eq.id);
                      setSelectedEquipments(selectedEquipments.size !== equipment.length ? new Set(allEquipmentIds) : new Set());
                    }}
                  >
                    {selectedEquipments.size === equipment.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}

                {isEquipmentMultiSelectMode && selectedEquipments.size > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Delete ${selectedEquipments.size} equipment? This action cannot be undone.`)) return;
                      try {
                        await Promise.all(Array.from(selectedEquipments).map(id => base44.entities.ClientEquipment.delete(id)));
                        toast.success(`${selectedEquipments.size} equipment deleted`);
                        setEquipment(prev => prev.filter(eq => !selectedEquipments.has(eq.id)));
                        setSelectedEquipments(new Set());
                        setIsEquipmentMultiSelectMode(false);
                      } catch (error) {
                        console.error('Delete error:', error);
                        toast.error('Failed to delete equipment');
                      }
                    }}
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedEquipments.size})
                  </Button>
                )}

                <div className="min-w-[200px]">
                  <ProjectCombobox
                    projects={[{ id: '', name: 'All Projects' }, ...projects]}
                    customers={customers}
                    selectedProjectId={selectedEquipmentProject}
                    onSelectProject={(id) => setSelectedEquipmentProject(id)}
                    placeholder="All Projects"
                  />
                </div>

                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExporting(true);
                      try {
                        const headers = ['Name', 'Category', 'Status', 'Client Name', 'Project'];
                        const rows = equipment.map(eq => {
                          const project = projects.find(p => p.id === eq.project_id);
                          return [
                            eq.name || '',
                            eq.category || '',
                            eq.status || '',
                            eq.client_name || '',
                            project?.name || ''
                          ];
                        });

                        const csvContent = [
                          headers.join(','),
                          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                        ].join('\n');

                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `client-equipment_${format(new Date(), 'yyyy-MM-dd')}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                        toast.success('Equipment exported successfully');
                      } catch (error) {
                        console.error('Error exporting:', error);
                        toast.error('Failed to export equipment');
                      } finally {
                        setExporting(false);
                      }
                    }}
                    disabled={exporting}
                    className="gap-1.5"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export CSV
                  </Button>

                  <Button
                    onClick={() => setShowAddEquipmentPanel(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
                    size="sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Equipment
                  </Button>
                </div>
              </div>

            {/* Equipment Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="w-10 px-2 py-1"></TableHead>
                    {isEquipmentMultiSelectMode && (
                      <TableHead className="w-12 px-2 py-1"></TableHead>
                    )}
                    {equipmentColumnOrder.filter(id => visibleEquipmentColumns.includes(id)).map(id => {
                      const col = allEquipmentColumns.find(c => c.id === id);
                      return col ? <TableHead key={id} className="px-2 py-1 text-left text-xs font-light text-slate-600">{col.label}</TableHead> : null;
                    })}
                    <TableHead className="w-72 px-2 py-1 text-right">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64" align="end" side="bottom" sideOffset={8}>
                           <div className="space-y-2">
                             <h4 className="font-medium text-sm mb-1">Columns (drag to reorder)</h4>
                             <DragDropContext onDragEnd={(result) => {
                               if (!result.destination) return;
                               const newOrder = [...equipmentColumnOrder];
                               const [moved] = newOrder.splice(result.source.index, 1);
                               newOrder.splice(result.destination.index, 0, moved);
                               setEquipmentColumnOrder(newOrder);
                             }}>
                               <Droppable droppableId="equipment-cols">
                                 {(provided) => (
                                   <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                                     {equipmentColumnOrder.filter(id => id !== 'name').map((colId, index) => {
                                       const col = allEquipmentColumns.find(c => c.id === colId);
                                       if (!col || col.locked) return null;
                                       return (
                                         <Draggable key={colId} draggableId={colId} index={index}>
                                           {(provided, snapshot) => (
                                             <div ref={provided.innerRef} {...provided.draggableProps} className={cn("flex items-center justify-between py-1 px-1 rounded", snapshot.isDragging && "bg-slate-100 shadow")}>
                                               <div className="flex items-center gap-2">
                                                 <span {...provided.dragHandleProps} className="cursor-grab text-slate-400 hover:text-slate-600"><GripVertical className="w-3.5 h-3.5" /></span>
                                                 <span className="text-sm text-slate-600">{col.label}</span>
                                               </div>
                                               <Switch checked={visibleEquipmentColumns.includes(colId)} onCheckedChange={(checked) => { if (checked) { setVisibleEquipmentColumns(prev => [...prev, colId]); } else { setVisibleEquipmentColumns(prev => prev.filter(id => id !== colId)); } }} />
                                             </div>
                                           )}
                                         </Draggable>
                                       );
                                     })}
                                     {provided.placeholder}
                                   </div>
                                 )}
                               </Droppable>
                             </DragDropContext>
                           </div>
                         </PopoverContent>
                       </Popover>
                     </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-200">
                  {equipment.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isEquipmentMultiSelectMode ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="font-medium">No client equipment found</p>
                        <p className="text-sm mt-1">Add equipment to get started</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (() => {
                      let filteredEq = equipment.filter(eq => {
                        const customer = customers.find(c => c.id === eq.customer_id);
                        const clientName = customer?.name || eq.client_name || '';
                        const project = projects.find(p => p.id === eq.project_id);

                        // Search filter - includes project name
                        const matchesSearch = (
                          eq.name?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                          clientName.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                          eq.category?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                          eq.status?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                          eq.serial_number?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                          eq.plate_number?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                          project?.name?.toLowerCase().includes(equipmentSearchTerm.toLowerCase())
                        );

                        // Category filter
                        const matchesCategory = selectedEquipmentCategories.length === 0 || 
                          selectedEquipmentCategories.includes(eq.category || 'Other');

                        // Status filter
                        const matchesStatus = selectedEquipmentStatuses.length === 0 || 
                          selectedEquipmentStatuses.includes(eq.status || 'Unknown');

                        // Project filter
                        const matchesProjectFilter = !selectedEquipmentProject || eq.project_id === selectedEquipmentProject;

                        // Work Order Category filter
                        const equipmentWorkOrders = workOrders.filter(wo => (wo.equipment_ids || []).includes(eq.id));
                        const matchesWOCategory = selectedEquipmentWOCategories.length === 0 || 
                          equipmentWorkOrders.some(wo => wo.work_order_category_id && selectedEquipmentWOCategories.includes(wo.work_order_category_id));

                        // Date range filter (based on work orders)
                        let matchesDateRange = true;
                        if (equipmentDateRange?.start && equipmentDateRange?.end) {
                          matchesDateRange = equipmentWorkOrders.some(wo => {
                            const woDate = wo.task_start_date || wo.planned_start_time;
                            if (!woDate) return false;
                            const date = new Date(woDate);
                            // Normalize to start of day for comparison
                            const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                            const startOnly = new Date(equipmentDateRange.start.getFullYear(), equipmentDateRange.start.getMonth(), equipmentDateRange.start.getDate());
                            const endOnly = new Date(equipmentDateRange.end.getFullYear(), equipmentDateRange.end.getMonth(), equipmentDateRange.end.getDate());
                            return dateOnly >= startOnly && dateOnly <= endOnly;
                          });
                        }

                        return matchesSearch && matchesCategory && matchesStatus && matchesProjectFilter && matchesWOCategory && matchesDateRange;
                      });

                      // Sort equipment
                      if (equipmentSortConfig.key) {
                        filteredEq = [...filteredEq].sort((a, b) => {
                          let aVal = a[equipmentSortConfig.key];
                          let bVal = b[equipmentSortConfig.key];

                          if (equipmentSortConfig.key === 'client_name') {
                            const customerA = customers.find(c => c.id === a.customer_id);
                            const customerB = customers.find(c => c.id === b.customer_id);
                            aVal = customerA?.name || a.client_name || '';
                            bVal = customerB?.name || b.client_name || '';
                          } else if (equipmentSortConfig.key === 'project') {
                            const projA = projects.find(p => p.id === a.project_id);
                            const projB = projects.find(p => p.id === b.project_id);
                            aVal = projA?.name || '';
                            bVal = projB?.name || '';
                          }

                          if (aVal === null || aVal === undefined) aVal = '';
                          if (bVal === null || bVal === undefined) bVal = '';

                          if (typeof aVal === 'string' && typeof bVal === 'string') {
                            aVal = aVal.toLowerCase();
                            bVal = bVal.toLowerCase();
                          }

                          if (aVal < bVal) return equipmentSortConfig.direction === 'asc' ? -1 : 1;
                          if (aVal > bVal) return equipmentSortConfig.direction === 'asc' ? 1 : -1;
                          return 0;
                        });
                      }

                      return filteredEq.map(eq => {
                        const project = projects.find(p => p.id === eq.project_id);
                        const customer = customers.find(c => c.id === eq.customer_id);
                        const isExpanded = expandedEquipments.has(eq.id);
                        const eqWorkOrders = workOrders.filter(wo => (wo.equipment_ids || []).includes(eq.id));

                        return (
                          <React.Fragment key={eq.id}>
                          <TableRow
                            className={cn(
                              "hover:bg-slate-50 cursor-pointer transition-colors",
                              isEquipmentMultiSelectMode && selectedEquipments.has(eq.id) && "bg-indigo-50",
                              isExpanded && "bg-slate-50"
                            )}
                            onClick={() => {
                              if (isEquipmentMultiSelectMode) {
                                const newSet = new Set(selectedEquipments);
                                if (newSet.has(eq.id)) {
                                  newSet.delete(eq.id);
                                } else {
                                  newSet.add(eq.id);
                                }
                                setSelectedEquipments(newSet);
                              } else {
                                setSelectedEquipment(eq);
                                setShowEquipmentDetailsPanel(true);
                              }
                            }}
                          >
                            <TableCell className="px-2 py-1 w-10" onClick={(e) => { e.stopPropagation(); toggleEquipmentExpansion(eq.id); }}>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                              </Button>
                            </TableCell>
                            {isEquipmentMultiSelectMode && (
                              <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedEquipments.has(eq.id)}
                                  onCheckedChange={() => {
                                    const newSet = new Set(selectedEquipments);
                                    if (newSet.has(eq.id)) {
                                      newSet.delete(eq.id);
                                    } else {
                                      newSet.add(eq.id);
                                    }
                                    setSelectedEquipments(newSet);
                                  }}
                                />
                              </TableCell>
                            )}
                            {equipmentColumnOrder.filter(id => visibleEquipmentColumns.includes(id)).map(id => {
                              switch (id) {
                                case 'name': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-900"><div className="flex items-center gap-2">{(() => { const cat = assetCategories.find(c => c.name === eq.category); if (cat?.icon_url) return <img src={cat.icon_url} alt={eq.category} className="w-8 h-8 object-contain flex-shrink-0" />; const IconComponent = { Package, Car, Construction, ArrowUpFromLine, Boxes, Wrench, Laptop, Truck, Hammer, Drill, Monitor, Building }[cat?.icon || 'Package'] || Package; return <IconComponent className="w-8 h-8 text-slate-500 flex-shrink-0" />; })()}{eq.name}</div></TableCell>;
                                case 'category': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.category || '-'}</TableCell>;
                                case 'brand': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.brand || '-'}</TableCell>;
                                case 'year_of_manufacture': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.year_of_manufacture || '-'}</TableCell>;
                                case 'mast_type': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.mast_type || '-'}</TableCell>;
                                case 'height': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.height || '-'}</TableCell>;
                                case 'serial_number': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.serial_number || '-'}</TableCell>;
                                case 'plate_number': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.plate_number || '-'}</TableCell>;
                                case 'status': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.status || '-'}</TableCell>;
                                case 'status_since': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.last_status_change_date ? format(new Date(eq.last_status_change_date), 'dd/MM/yyyy') : '-'}</TableCell>;
                                case 'status_duration': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{eq.last_status_change_date ? <span className="text-indigo-600 font-medium">{formatStatusDuration(eq.last_status_change_date)}</span> : '-'}</TableCell>;
                                case 'client_name': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{customer?.name || eq.client_name || '-'}</TableCell>;
                                case 'project': return <TableCell key={id} className="px-2 py-1 text-xs font-light text-slate-600">{project?.name || '-'}</TableCell>;
                                default: return null;
                              }
                            })}
                            <TableCell className="w-10 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                              <button title="Duplicate" onClick={async (e) => { e.stopPropagation(); const { id, created_date, updated_date, created_by, activity_log, ...d } = eq; await base44.entities.ClientEquipment.create({ ...d, name: `${d.name} (Copy)` }); toast.success('Equipment duplicated'); loadData(); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                            </TableCell>
                            </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                              <TableCell colSpan={visibleEquipmentColumns.length + (isEquipmentMultiSelectMode ? 1 : 0) + 1} className="px-8 py-4">
                                <div className="bg-white rounded-lg border border-slate-200 p-4">
                                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-indigo-600" />
                                    Work Orders History ({eqWorkOrders.length})
                                  </h4>
                                  <WorkOrderHistoryTable workOrders={eqWorkOrders} workOrderCategories={workOrderCategories} allEmployees={allEmployees} woSort={equipmentWOSort} setWOSort={setEquipmentWOSort} woCategoryFilter={equipmentWOCategoryFilter} setWOCategoryFilter={setEquipmentWOCategoryFilter} woStatusFilter={equipmentWOStatusFilter} setWOStatusFilter={setEquipmentWOStatusFilter} onClickWO={(wo) => { setSelectedWorkOrder(wo); setShowWorkOrderPanel(true); }} />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          </React.Fragment>
                        );
                      });
                    })()
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>



      {showAssetDetailsPanel && selectedAsset && (
        <AssetDetailsPanel
          isOpen={showAssetDetailsPanel}
          onClose={() => {
            setShowAssetDetailsPanel(false);
            setSelectedAsset(null);
          }}
          asset={selectedAsset}
          users={allEmployees}
          projects={projects}
          customers={customers}
          onAssetUpdated={handleAssetUpdated}
          onAssetDeleted={handleAssetDeleted}
          isAdmin={isAdmin}
        />
      )}

      {showAddAssetPanel && (
        <AddAssetPanel
          isOpen={showAddAssetPanel}
          onClose={() => setShowAddAssetPanel(false)}
          onAssetAdded={loadData}
          users={allEmployees}
          projects={projects}
          customers={customers}
        />
      )}

      <AssetSettingsPanel
        isOpen={showAssetSettingsPanel}
        onClose={() => setShowAssetSettingsPanel(false)}
        onSettingsChanged={loadData}
      />

      {showEquipmentDetailsPanel && selectedEquipment && (
        <EquipmentDetailsPanel
          isOpen={showEquipmentDetailsPanel}
          onClose={() => {
            setShowEquipmentDetailsPanel(false);
            setSelectedEquipment(null);
          }}
          equipment={selectedEquipment}
          customers={customers}
          projects={projects}
          onEquipmentUpdated={(updated) => {
            setEquipment(prev => prev.map(eq => eq.id === updated.id ? updated : eq));
            // Force update selected equipment reference to trigger useEffect in panel if needed
            setSelectedEquipment({...updated}); 
          }}
          onEquipmentDeleted={async () => {
            setShowEquipmentDetailsPanel(false);
            setSelectedEquipment(null);
            await loadData();
          }}
          isAdmin={isAdmin}
        />
      )}

      {showAddEquipmentPanel && (
        <AddEquipmentPanel
          isOpen={showAddEquipmentPanel}
          onClose={() => setShowAddEquipmentPanel(false)}
          onEquipmentAdded={loadData}
          customers={customers}
          projects={projects}
        />
      )}

      {showWorkOrderPanel && selectedWorkOrder && (
        <WorkOrderDetailsDialog
          isOpen={showWorkOrderPanel}
          entry={selectedWorkOrder}
          onClose={() => {
            setShowWorkOrderPanel(false);
            setSelectedWorkOrder(null);
          }}
          onSave={async (updatedData) => {
            try {
              await base44.entities.TimeEntry.update(selectedWorkOrder.id, updatedData);
              setWorkOrders(prev => prev.map(wo => wo.id === selectedWorkOrder.id ? { ...wo, ...updatedData } : wo));
              setSelectedWorkOrder({ ...selectedWorkOrder, ...updatedData });
              toast.success('Work order updated');
            } catch (error) {
              toast.error('Failed to update work order');
            }
          }}
          onDelete={async (id) => {
            try {
              await base44.entities.TimeEntry.delete(id);
              setWorkOrders(prev => prev.filter(wo => wo.id !== id));
              setShowWorkOrderPanel(false);
              setSelectedWorkOrder(null);
              toast.success('Work order deleted');
            } catch (error) {
              toast.error('Failed to delete work order');
            }
          }}
          projects={projects}
          users={allEmployees}
          teams={teams}
          customers={customers}
          assets={assets}
          clientEquipments={equipment}
          categories={workOrderCategories}
          shiftTypes={shiftTypes}
          isAdmin={isAdmin}
          allEntries={workOrders}
        />
      )}
      </div>
      );
      }