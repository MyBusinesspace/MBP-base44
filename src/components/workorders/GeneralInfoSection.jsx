import React from 'react';
import ProjectCombobox from './ProjectCombobox';
import WorkingOrderSelector from './WorkingOrderSelector';
import CategoryCombobox from './CategoryCombobox';
import Avatar from '@/components/Avatar';
import { cn } from '@/lib/utils';

export default function GeneralInfoSection({
  formData,
  setFormData,
  safeProjects,
  safeCustomers,
  safeAssets,
  safeClientEquipments,
  safeCategories,
  openWorkOrders,
  isReadOnly,
  createMode,
  setCreateMode,
  onSelectExistingWorkOrder,
  onCreateNewWorkOrder,
  projectAssets
}) {
  const handleEquipmentToggle = (equipmentId) => {
    const currentEquipment = formData.equipment_ids || [];
    const newEquipment = currentEquipment.includes(equipmentId)
      ? currentEquipment.filter(id => id !== equipmentId)
      : [...currentEquipment, equipmentId];
    setFormData({ ...formData, equipment_ids: newEquipment });
  };

  return (
    <div className="rounded-lg bg-white shadow-sm" style={{ borderWidth: '1px', borderColor: '#007B80' }}>
      <div className="p-3 space-y-2.5">
        {/* Header with Work Order label */}
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-700 flex-1">Work Order</span>
        </div>
        <div className="w-full">
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Project <span className="text-red-500">*</span>
          </label>
          <div className="w-full">
          <ProjectCombobox
            projects={safeProjects}
            customers={safeCustomers}
            selectedProjectId={formData.project_id}
            onSelectProject={(projectId) => setFormData({ ...formData, project_id: projectId })}
            disabled={isReadOnly && !createMode}
          />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block italic">
            Select an existing Work Order or type a new name:
          </label>
          <WorkingOrderSelector
             openWorkOrders={openWorkOrders}
             projects={safeProjects}
             onSelectWorkOrder={(existing) => {
               if (onSelectExistingWorkOrder) onSelectExistingWorkOrder(existing);
             }}
             onCreateNew={() => {
               setCreateMode(true);
               setFormData({
                 title: '', project_id: '', work_order_category_id: '', status: 'open', task_status: '',
                 work_notes: '', estimated_duration_hours: 8, equipment_ids: [], is_repeating: false,
                 recurrence_type: 'daily', recurrence_end_date: '', skip_weekends: false, moved_from_sunday: false,
                 file_urls: [], tasks: [], job_completion_status: '', client_feedback_comments: '',
                 client_representative_name: '', client_representative_phone: ''
               });
               if (onCreateNewWorkOrder) onCreateNewWorkOrder();
             }}
             newTitle={formData.title || ''}
             onNewTitleChange={(val) => setFormData({ ...formData, title: val })}
             disabled={isReadOnly && !createMode}
             disableSelection={!createMode && !!formData.id}
           />
        </div>

        {formData.project_id && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Equipment / Assets
              </label>
              {projectAssets.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  No equipment
                </div>
              ) : (
                <div className="space-y-0.5 max-h-[80px] overflow-y-auto border border-slate-200 rounded-lg p-1.5 bg-white">
                  {projectAssets.map(asset => {
                    const isSelected = (formData.equipment_ids || []).includes(asset.id);
                    return (
                      <div
                        key={asset.id}
                        className={cn(
                          "flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer transition-colors",
                          isSelected && ""
                        )}
                        onClick={() => !isReadOnly && handleEquipmentToggle(asset.id)}
                        style={isSelected ? { background: 'rgba(0, 123, 128, 0.08)' } : {}}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (!isReadOnly) handleEquipmentToggle(asset.id);
                          }}
                          disabled={isReadOnly && !createMode}
                          className="h-3 w-3 cursor-pointer"
                        />
                        <span className="text-xs font-medium truncate">{asset.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Category <span className="text-red-500">*</span>
              </label>
              <CategoryCombobox
                categories={safeCategories}
                selectedCategoryId={formData.work_order_category_id}
                onSelectCategory={(categoryId) => setFormData({ ...formData, work_order_category_id: categoryId })}
                disabled={isReadOnly && !createMode}
              />
            </div>
          </div>
        )}
        </div>
        </div>
        );
        }