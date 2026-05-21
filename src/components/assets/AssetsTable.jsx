import React, { useState, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Package, ChevronDown, ChevronRight, SlidersHorizontal, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Avatar from '../Avatar';
import AssetActionsMenu from './AssetActionsMenu';
import InlineEditCell from './InlineEditCell';

export default function AssetsTable({
  filteredAssets,
  isMultiSelectMode,
  selectedAssets,
  handleToggleAssetSelection,
  sortConfig,
  handleSort,
  visibleAssetColumns,
  setVisibleAssetColumns,
  assetCategories,
  allEmployees,
  projects,
  customers,
  handleAssetRowClick,
  expandedAssets,
  toggleAssetExpansion,
  workOrders,
  formatStatusDuration,
  getPreviousStatusDuration,
  copiedAsset,
  setCopiedAsset,
  loadData
}) {
  // Local overrides for inline-edited values (to reflect changes without full reload)
  const [localOverrides, setLocalOverrides] = useState({});
  const nameEditRefs = useRef({});

  const getAsset = (asset) => localOverrides[asset.id] ? { ...asset, ...localOverrides[asset.id] } : asset;

  const handleSaved = (updatedAsset) => {
    setLocalOverrides(prev => ({ ...prev, [updatedAsset.id]: { ...prev[updatedAsset.id], ...updatedAsset } }));
  };

  const iconMap = { Package, Car: Package, Construction: Package, ArrowUpFromLine: Package, Boxes: Package, Wrench: Package, Laptop: Package, Truck: Package, Hammer: Package, Drill: Package, Monitor: Package, Building: Package };

  const SortHead = ({ field, label, className = '' }) => (
    <TableHead className={`px-2 py-1 text-left text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 h-8 ${className}`} onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">{label}{sortConfig.key === field && <span className="text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
    </TableHead>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
          <TableRow>
            {/* Checkbox col */}
            <TableHead className="w-10 px-2 py-1 h-8"></TableHead>
            {/* Pencil icon col */}
            <TableHead className="w-8 px-1 py-1 h-8"></TableHead>
            <SortHead field="name" label="Name" />
            {visibleAssetColumns.category && <SortHead field="category" label="Category" />}
            {visibleAssetColumns.subcategory && <SortHead field="subcategory" label="Subcategory" />}
            {visibleAssetColumns.finance_category && <SortHead field="finance_category" label="Finance Cat." />}
            {visibleAssetColumns.plate_number && <SortHead field="plate_number" label="Plate Number" />}
            {visibleAssetColumns.identifier && <SortHead field="identifier" label="Serial Number" />}
            {visibleAssetColumns.quantity && <SortHead field="quantity" label="Units" />}
            {visibleAssetColumns.brand && <SortHead field="brand" label="Brand" />}
            {visibleAssetColumns.year_of_manufacture && <SortHead field="year_of_manufacture" label="YOM" />}
            {visibleAssetColumns.mast_type && <SortHead field="mast_type" label="Mast Type" />}
            {visibleAssetColumns.height && <SortHead field="height" label="Height" />}
            {visibleAssetColumns.status && <SortHead field="status" label="Status" />}
            {visibleAssetColumns.status_duration && <SortHead field="last_status_change_date" label="Status Since" />}
            {visibleAssetColumns.status_since && <TableHead className="px-2 py-1 text-left text-xs font-semibold text-slate-700 h-8">Time in Status</TableHead>}
            {visibleAssetColumns.assigned_client && <SortHead field="assigned_to" label="Client" />}
            {visibleAssetColumns.project && <SortHead field="project" label="Project" />}
            <TableHead className="w-10 px-2 py-1 text-right">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="end">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Toggle Columns</h4>
                    {[
                      { key: 'category', label: 'Category' },
                      { key: 'subcategory', label: 'Subcategory' },
                      { key: 'finance_category', label: 'Finance Category' },
                      { key: 'plate_number', label: 'Plate Number' },
                      { key: 'identifier', label: 'Identifier' },
                      { key: 'quantity', label: 'Units' },
                      { key: 'brand', label: 'Brand' },
                      { key: 'year_of_manufacture', label: 'YOM' },
                      { key: 'mast_type', label: 'Mast Type' },
                      { key: 'height', label: 'Height' },
                      { key: 'status', label: 'Status' },
                      { key: 'status_duration', label: 'Time Status' },
                      { key: 'status_since', label: 'Time Last Status' },
                      { key: 'assigned_client', label: 'Assigned / Client' },
                      { key: 'project', label: 'Project' },
                    ].map(col => (
                      <div key={col.key} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{col.label}</span>
                        <Switch checked={visibleAssetColumns[col.key]} onCheckedChange={(checked) => setVisibleAssetColumns(prev => ({ ...prev, [col.key]: checked }))} />
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-200">
          {filteredAssets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isMultiSelectMode ? 11 : 10} className="px-4 py-8 text-center text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No assets found</p>
                <p className="text-sm mt-1">Try adjusting your filters or search term</p>
              </TableCell>
            </TableRow>
          ) : (
            filteredAssets.map(rawAsset => {
              const asset = getAsset(rawAsset);
              const assignedUser = allEmployees.find(u => u.id === asset.assigned_to_user_id);
              const project = projects.find(p => p.id === asset.project_id);
              const isExpanded = expandedAssets.has(asset.id);

              return (
                <React.Fragment key={asset.id}>
                  <TableRow
                   className={cn("hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 h-9", selectedAssets.has(asset.id) && "bg-indigo-50", isExpanded && "bg-slate-50")}
                  >
                   {/* Checkbox col */}
                   <TableCell className="px-2 py-1 w-10" onClick={(e) => e.stopPropagation()}>
                     <div className="flex items-center gap-1">
                       <Checkbox
                         checked={selectedAssets.has(asset.id)}
                         onCheckedChange={() => handleToggleAssetSelection(asset.id)}
                         onClick={(e) => e.stopPropagation()}
                       />
                       <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); toggleAssetExpansion(asset.id); }}>
                         {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                       </Button>
                     </div>
                   </TableCell>
                   {/* Pencil icon — dedicated column */}
                   <TableCell className="px-1 py-1 w-7" onClick={(e) => e.stopPropagation()}>
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={(e) => { e.stopPropagation(); nameEditRefs.current[asset.id]?.(); }}
                       className="h-5 w-5 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                       title="Edit name"
                     >
                       <Edit3 className="w-3 h-3" />
                     </Button>
                   </TableCell>
                   {/* Name cell — icon + plain text */}
                   <TableCell className="px-2 py-1 max-w-[200px]" onClick={() => handleAssetRowClick(asset)}>
                     <div className="flex items-center gap-1.5">
                       {(() => {
                         const category = assetCategories.find(c => c.name === asset.category);
                         if (category?.icon_url) return <img src={category.icon_url} alt={asset.category} className="w-5 h-5 object-contain flex-shrink-0" />;
                         const IconComponent = iconMap[category?.icon || 'Package'] || Package;
                         return <IconComponent className="w-4 h-4 text-slate-400 flex-shrink-0" />;
                       })()}
                       <InlineEditCell asset={asset} field="name" onSaved={handleSaved} editRef={{ current: null, get current() { return nameEditRefs.current[asset.id]; }, set current(fn) { nameEditRefs.current[asset.id] = fn; } }} className="text-xs font-medium text-slate-900 truncate" />
                     </div>
                   </TableCell>
                    {visibleAssetColumns.category && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="category" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.subcategory && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="subcategory" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.finance_category && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="finance_category" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.plate_number && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="plate_number" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.identifier && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="identifier" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.quantity && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="quantity" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.brand && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="brand" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.year_of_manufacture && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="year_of_manufacture" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.mast_type && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="mast_type" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.height && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="height" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.status && (
                      <TableCell className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell asset={asset} field="status" onSaved={handleSaved} className="text-xs text-slate-700" />
                      </TableCell>
                    )}
                    {visibleAssetColumns.status_duration && (
                      <TableCell className="px-2 py-1 text-xs text-slate-600" onClick={() => handleAssetRowClick(asset)}>
                        {asset.last_status_change_date
                          ? <span className="text-[11px] text-slate-500">{new Date(asset.last_status_change_date).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })}</span>
                          : <span className="text-slate-400">-</span>}
                      </TableCell>
                    )}
                    {visibleAssetColumns.status_since && (
                      <TableCell className="px-2 py-1 text-xs" onClick={() => handleAssetRowClick(asset)}>
                        {asset.last_status_change_date
                          ? <span className="text-indigo-600 font-semibold">{formatStatusDuration(asset.last_status_change_date)}</span>
                          : <span className="text-slate-400">-</span>}
                      </TableCell>
                    )}
                    {visibleAssetColumns.assigned_client && (
                      <TableCell className="px-2 py-1 text-xs text-slate-600" onClick={() => handleAssetRowClick(asset)}>
                        {(() => {
                          const customer = customers.find(c => c.id === project?.customer_id);
                          if (assignedUser) return <div className="flex items-center gap-2"><Avatar user={assignedUser} size="sm" />{`${assignedUser.first_name || ''} ${assignedUser.last_name || ''}`.trim()}</div>;
                          if (customer) return <span className="text-slate-600">{customer.name}</span>;
                          return '-';
                        })()}
                      </TableCell>
                    )}
                    {visibleAssetColumns.project && (
                      <TableCell className="px-2 py-1 text-xs" onClick={(e) => e.stopPropagation()}>
                        {project ? (
                          <button
                            onClick={() => window.location.href = `/projects?id=${project.id}`}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline text-left truncate block max-w-[120px]"
                            title={project.name}
                          >
                            {project.name}
                          </button>
                        ) : '-'}
                      </TableCell>
                    )}
                    <TableCell className="w-10 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <AssetActionsMenu asset={asset} onReload={loadData} />
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}