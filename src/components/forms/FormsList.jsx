import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit2, Trash2, Plus } from 'lucide-react';

export default function FormsList({ departmentId, onSelect, onEdit, onAdd }) {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (departmentId) loadForms();
  }, [departmentId]);

  const loadForms = async () => {
    try {
      const data = await base44.entities.FormTemplate.filter(
        { department_id: departmentId },
        'sort_order',
        50
      );
      setForms(data || []);
    } catch (error) {
      console.error('Error loading forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteForm = async (id) => {
    if (!confirm('Delete this form?')) return;
    try {
      await base44.entities.FormTemplate.delete(id);
      setForms(forms.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting form:', error);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Forms in Department</CardTitle>
        <Button size="sm" onClick={onAdd} className="gap-1">
          <Plus className="w-3 h-3" />
          New
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : forms.length === 0 ? (
          <p className="text-sm text-slate-500">No forms in this department</p>
        ) : (
          <div className="space-y-2">
            {forms.map(form => (
              <div key={form.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <div className="flex-1">
                  <p className="font-medium text-sm text-slate-900">{form.title}</p>
                  <p className="text-xs text-slate-600">{form.fields?.length || 0} fields</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onSelect(form)}>
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onEdit(form)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteForm(form.id)}>
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}