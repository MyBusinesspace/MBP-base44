import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Briefcase, Users, Zap, Package, DollarSign, Settings } from 'lucide-react';

const departmentIcons = {
  admin: Briefcase,
  hr: Users,
  operations: Zap,
  assets: Package,
  finance: DollarSign
};

export default function FormsDepartmentSidebar({ selectedDept, onSelectDept, onSettings }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await base44.entities.FormDepartment.list('sort_order', 50);
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-screen overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="font-bold text-slate-900">Departments</h2>
        <p className="text-xs text-slate-600">Select a department</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Loading...</div>
        ) : departments.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No departments found</div>
        ) : (
          <nav className="space-y-1 p-2">
            {departments.map(dept => {
              const Icon = departmentIcons[dept.slug] || Briefcase;
              const isSelected = selectedDept === dept.id;

              return (
                <button
                  key={dept.id}
                  onClick={() => onSelectDept(dept.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{dept.name}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <div className="p-4 border-t border-slate-200">
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}