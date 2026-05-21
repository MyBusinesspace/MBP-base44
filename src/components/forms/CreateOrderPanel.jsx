import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

export default function CreateOrderPanel({ projects = [], customers = [], onOrderCreated }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    project_id: '',
    work_order_category_id: '',
    status: 'open',
    work_notes: '',
    estimated_duration_hours: 8,
    tasks: []
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.project_id) {
      toast.error('Please fill in title and project');
      return;
    }

    setLoading(true);
    try {
      await base44.entities.TimeEntry.create(formData);
      toast.success('Order created successfully');
      setFormData({
        title: '',
        project_id: '',
        work_order_category_id: '',
        status: 'open',
        work_notes: '',
        estimated_duration_hours: 8,
        tasks: []
      });
      if (onOrderCreated) onOrderCreated();
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium text-slate-700">
              Order Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Enter order title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="h-10"
              disabled={loading}
            />
          </div>

          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project" className="text-sm font-medium text-slate-700">
              Project <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.project_id}
              onValueChange={(value) => handleChange('project_id', value)}
              disabled={loading}
            >
              <SelectTrigger id="project" className="h-10">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Work Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium text-slate-700">
              Work Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Add work notes or instructions"
              value={formData.work_notes}
              onChange={(e) => handleChange('work_notes', e.target.value)}
              className="h-24"
              disabled={loading}
            />
          </div>

          {/* Estimated Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm font-medium text-slate-700">
              Estimated Duration (hours)
            </Label>
            <Input
              id="duration"
              type="number"
              min="1"
              step="0.5"
              value={formData.estimated_duration_hours}
              onChange={(e) => handleChange('estimated_duration_hours', parseFloat(e.target.value))}
              className="h-10"
              disabled={loading}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium text-slate-700">
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange('status', value)}
              disabled={loading}
            >
              <SelectTrigger id="status" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Order
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}