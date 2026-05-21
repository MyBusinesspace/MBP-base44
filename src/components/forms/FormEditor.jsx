import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';

export default function FormEditor({ form, departmentId, onSave, onCancel }) {
  const [formData, setFormData] = useState(form || { title: '', department_id: departmentId, fields: [], header_config: {}, footer_config: {} });
  const [saving, setSaving] = useState(false);

  const addField = () => {
    const newField = {
      id: `field-${Date.now()}`,
      type: 'text',
      label: 'New Field',
      required: false
    };
    setFormData({
      ...formData,
      fields: [...(formData.fields || []), newField]
    });
  };

  const removeField = (fieldId) => {
    setFormData({
      ...formData,
      fields: (formData.fields || []).filter(f => f.id !== fieldId)
    });
  };

  const updateField = (fieldId, updates) => {
    setFormData({
      ...formData,
      fields: (formData.fields || []).map(f => f.id === fieldId ? { ...f, ...updates } : f)
    });
  };

  const saveForm = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a form title');
      return;
    }

    setSaving(true);
    try {
      if (form?.id) {
        await base44.entities.FormTemplate.update(form.id, formData);
      } else {
        await base44.entities.FormTemplate.create(formData);
      }
      toast.success('Form saved successfully');
      onSave();
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Form Details</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Form Title</Label>
            <Input
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Form title"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Form description"
              className="h-20"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm">Header Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Header Color</Label>
            <Input
              type="color"
              value={formData.header_config?.header_color || '#1e293b'}
              onChange={(e) => setFormData({
                ...formData,
                header_config: { ...formData.header_config, header_color: e.target.value }
              })}
            />
          </div>

          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input
              value={formData.header_config?.company_name || ''}
              onChange={(e) => setFormData({
                ...formData,
                header_config: { ...formData.header_config, company_name: e.target.value }
              })}
              placeholder="Your company name"
            />
          </div>

          <div className="space-y-2">
            <Label>Custom Header Text</Label>
            <Input
              value={formData.header_config?.custom_header_text || ''}
              onChange={(e) => setFormData({
                ...formData,
                header_config: { ...formData.header_config, custom_header_text: e.target.value }
              })}
              placeholder="Additional header text"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Form Fields</CardTitle>
          <Button size="sm" onClick={addField} className="gap-1">
            <Plus className="w-3 h-3" />
            Add Field
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(formData.fields || []).length === 0 ? (
            <p className="text-sm text-slate-500">No fields yet. Add one to get started!</p>
          ) : (
            (formData.fields || []).map(field => (
              <div key={field.id} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={field.label || ''}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    placeholder="Field label"
                    className="flex-1"
                  />
                  <Select value={field.type} onValueChange={(type) => updateField(field.id, { type })}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="signature">Signature</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeField(field.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={saveForm} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Form'}
        </Button>
      </div>
    </div>
  );
}