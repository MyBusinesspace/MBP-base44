import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const COLOR_OPTIONS = [
  { value: 'white', label: 'White', bg: 'bg-white border border-slate-300', text: 'text-slate-700' },
  { value: 'gray', label: 'Gray', bg: 'bg-gray-200', text: 'text-gray-800' },
  { value: 'red', label: 'Red', bg: 'bg-red-500', text: 'text-white' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-400', text: 'text-yellow-900' },
  { value: 'green', label: 'Green', bg: 'bg-green-500', text: 'text-white' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-500', text: 'text-white' },
  { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-500', text: 'text-white' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500', text: 'text-white' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-500', text: 'text-white' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-500', text: 'text-white' },
  { value: 'teal', label: 'Teal', bg: 'bg-teal-500', text: 'text-white' },
];

export default function WorkOrderCategoriesSettings() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', color: 'white', description: '' });
  const [newForm, setNewForm] = useState({ name: '', color: 'white', description: '' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.WorkOrderCategory.list('sort_order', 100);
      setCategories(data || []);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newForm.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await base44.entities.WorkOrderCategory.create({
        name: newForm.name.trim(),
        color: newForm.color,
        description: newForm.description.trim(),
        sort_order: categories.length,
      });
      setNewForm({ name: '', color: 'white', description: '' });
      setShowNewForm(false);
      await load();
      toast.success('Category created');
    } catch {
      toast.error('Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editForm.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await base44.entities.WorkOrderCategory.update(id, {
        name: editForm.name.trim(),
        color: editForm.color,
        description: editForm.description.trim(),
      });
      setEditingId(null);
      await load();
      toast.success('Category updated');
    } catch {
      toast.error('Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete category "${name}"? Work orders using it will lose this category.`)) return;
    try {
      await base44.entities.WorkOrderCategory.delete(id);
      await load();
      toast.success('Category deleted');
    } catch {
      toast.error('Failed to delete category');
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditForm({ name: cat.name, color: cat.color || 'white', description: cat.description || '' });
  };

  const ColorPicker = ({ value, onChange }) => (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {COLOR_OPTIONS.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          title={c.label}
          className={cn(
            "w-6 h-6 rounded-full transition-all",
            c.bg,
            value === c.value ? "ring-2 ring-offset-1 ring-slate-600 scale-110" : "hover:scale-105"
          )}
        />
      ))}
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</p>
        <Button size="sm" onClick={() => { setShowNewForm(true); setEditingId(null); }} className="gap-1">
          <Plus className="w-4 h-4" /> New Category
        </Button>
      </div>

      {/* New category form */}
      {showNewForm && (
        <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-indigo-700">New Category</p>
          <Input
            placeholder="Category name..."
            value={newForm.name}
            onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
            className="h-8 text-sm"
            autoFocus
          />
          <Input
            placeholder="Description (optional)"
            value={newForm.description}
            onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
            className="h-8 text-sm"
          />
          <div>
            <p className="text-xs text-slate-600 mb-1">Color</p>
            <ColorPicker value={newForm.color} onChange={v => setNewForm(p => ({ ...p, color: v }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleCreate} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Categories list */}
      <div className="space-y-2">
        {categories.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">No categories yet. Create one above.</p>
        )}
        {categories.map(cat => {
          const colorOpt = COLOR_OPTIONS.find(c => c.value === cat.color) || COLOR_OPTIONS[0];
          return (
            <div key={cat.id} className="border border-slate-200 rounded-lg bg-white">
              {editingId === cat.id ? (
                <div className="p-3 space-y-2">
                  <Input
                    value={editForm.name}
                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={editForm.description}
                    onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Color</p>
                    <ColorPicker value={editForm.color} onChange={v => setEditForm(p => ({ ...p, color: v }))} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => handleUpdate(cat.id)} disabled={saving} className="gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-4 h-4 rounded-full flex-shrink-0", colorOpt.bg)} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{cat.name}</p>
                      {cat.description && <p className="text-xs text-slate-500">{cat.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(cat)}>
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(cat.id, cat.name)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}