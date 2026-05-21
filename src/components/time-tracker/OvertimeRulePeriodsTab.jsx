import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Plus, Pencil, Trash2, X, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';

export default function OvertimeRulePeriodsTab() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null); // null = not editing, {} = new rule
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.OvertimeRulePeriod.list('-start_date', 100);
      setRules(data || []);
    } catch (e) {
      toast.error('Failed to load overtime rule periods');
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setEditingRule({
      name: '',
      start_date: '',
      end_date: '',
      regular_hours_per_day: 6,
      non_payable_overtime_hours: 0,
      overtime_multiplier: 1.5
    });
  };

  const startEdit = (rule) => {
    setEditingRule({ ...rule });
  };

  const cancelEdit = () => {
    setEditingRule(null);
  };

  const saveRule = async () => {
    if (!editingRule.name || !editingRule.start_date || !editingRule.end_date || !editingRule.regular_hours_per_day) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsSaving(true);
    try {
      if (editingRule.id) {
        await base44.entities.OvertimeRulePeriod.update(editingRule.id, editingRule);
        toast.success('Rule period updated');
      } else {
        await base44.entities.OvertimeRulePeriod.create(editingRule);
        toast.success('Rule period created');
      }
      setEditingRule(null);
      await loadRules();
    } catch (e) {
      toast.error('Failed to save rule period');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRule = async (id) => {
    if (!confirm('Delete this overtime rule period?')) return;
    try {
      await base44.entities.OvertimeRulePeriod.delete(id);
      toast.success('Rule period deleted');
      await loadRules();
    } catch (e) {
      toast.error('Failed to delete rule period');
    }
  };

  const updateField = (field, value) => {
    setEditingRule(prev => ({ ...prev, [field]: value }));
  };

  const isActive = (rule) => {
    const today = new Date().toISOString().slice(0, 10);
    return rule.start_date <= today && rule.end_date >= today;
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-900">
          Define special overtime rule periods (e.g., Ramadan) where regular hours differ from the global setting. The system will automatically apply the matching rule based on the timesheet date.
        </p>
      </div>

      {/* Rule form */}
      {editingRule && (
        <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50 space-y-4">
          <h4 className="font-semibold text-sm text-indigo-800">
            {editingRule.id ? 'Edit Rule Period' : 'New Rule Period'}
          </h4>

          <div>
            <Label className="text-xs font-medium">Period Name *</Label>
            <Input
              value={editingRule.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="e.g. Ramadan 2026"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Start Date *</Label>
              <Input
                type="date"
                value={editingRule.start_date}
                onChange={e => updateField('start_date', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">End Date *</Label>
              <Input
                type="date"
                value={editingRule.end_date}
                onChange={e => updateField('end_date', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium">Regular Hours/Day *</Label>
              <Input
                type="number"
                step="0.5"
                min="1"
                max="24"
                value={editingRule.regular_hours_per_day}
                onChange={e => updateField('regular_hours_per_day', parseFloat(e.target.value) || 6)}
                className="mt-1"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">OT starts after this</p>
            </div>
            <div>
              <Label className="text-xs font-medium">Non-Payable OT (h)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="8"
                value={editingRule.non_payable_overtime_hours}
                onChange={e => updateField('non_payable_overtime_hours', parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">OT Multiplier</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="3"
                value={editingRule.overtime_multiplier}
                onChange={e => updateField('overtime_multiplier', parseFloat(e.target.value) || 1.5)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Preview */}
          {editingRule.regular_hours_per_day > 0 && (
            <div className="bg-white rounded-lg p-3 border border-indigo-100 text-xs space-y-1">
              <p className="font-semibold text-slate-700">Preview (example: 9h worked)</p>
              <div className="flex justify-between text-slate-600">
                <span>Regular:</span>
                <span className="font-medium text-green-600">{editingRule.regular_hours_per_day}h</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Non-Payable OT:</span>
                <span className="font-medium text-orange-600">
                  {Math.min(editingRule.non_payable_overtime_hours, Math.max(0, 9 - editingRule.regular_hours_per_day))}h
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Paid OT (×{editingRule.overtime_multiplier}):</span>
                <span className="font-medium text-blue-600">
                  {Math.max(0, 9 - editingRule.regular_hours_per_day - editingRule.non_payable_overtime_hours)}h
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancelEdit}>
              <X className="w-3 h-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={saveRule} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="w-3 h-3 mr-1" /> {isSaving ? 'Saving...' : 'Save Rule'}
            </Button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
      ) : rules.length === 0 && !editingRule ? (
        <div className="text-center py-10 text-slate-400">
          <CalendarRange className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No overtime rule periods defined yet.</p>
          <p className="text-xs mt-1">Create one for Ramadan, public holidays, etc.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-white"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive(rule) ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">{rule.name}</span>
                    {isActive(rule) && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {rule.start_date} → {rule.end_date}
                    <span className="mx-2">·</span>
                    <span className="text-indigo-600 font-medium">{rule.regular_hours_per_day}h regular</span>
                    {rule.non_payable_overtime_hours > 0 && (
                      <><span className="mx-1">·</span>{rule.non_payable_overtime_hours}h non-payable OT</>
                    )}
                    <span className="mx-1">·</span>×{rule.overtime_multiplier} multiplier
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(rule)}>
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRule(rule.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!editingRule && (
        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={startNew} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-1" /> New Rule Period
          </Button>
        </div>
      )}
    </div>
  );
}