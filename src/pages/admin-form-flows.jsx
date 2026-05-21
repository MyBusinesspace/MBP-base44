import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import FlowChartBuilder from '@/components/forms/FlowChartBuilder';

export default function AdminFormFlows() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      const data = await base44.entities.FormFlowConfig.list('-updated_date', 50);
      setFlows(data || []);
    } catch (error) {
      console.error('Error loading flows:', error);
      toast.error('Failed to load flows');
    } finally {
      setLoading(false);
    }
  };

  const createNewFlow = async () => {
    if (!newFlowName.trim()) {
      toast.error('Please enter a flow name');
      return;
    }

    try {
      const newFlow = await base44.entities.FormFlowConfig.create({
        name: newFlowName,
        nodes: [],
        connections: []
      });
      setFlows([newFlow, ...flows]);
      setSelectedFlow(newFlow.id);
      setShowBuilder(true);
      setNewFlowName('');
      toast.success('Flow created');
    } catch (error) {
      console.error('Error creating flow:', error);
      toast.error('Failed to create flow');
    }
  };

  const deleteFlow = async (id) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;

    try {
      await base44.entities.FormFlowConfig.delete(id);
      setFlows(flows.filter(f => f.id !== id));
      if (selectedFlow === id) {
        setSelectedFlow(null);
        setShowBuilder(false);
      }
      toast.success('Flow deleted');
    } catch (error) {
      console.error('Error deleting flow:', error);
      toast.error('Failed to delete flow');
    }
  };

  const editFlow = (flowId) => {
    setSelectedFlow(flowId);
    setShowBuilder(true);
  };

  const currentFlow = flows.find(f => f.id === selectedFlow);

  if (showBuilder && currentFlow) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{currentFlow.name}</h1>
            <p className="text-sm text-slate-600">Edit your form flow diagram</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setShowBuilder(false);
              loadFlows();
            }}
          >
            Back to List
          </Button>
        </div>
        <FlowChartBuilder flowId={selectedFlow} initialData={currentFlow} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Form Flows</h1>
        <p className="text-slate-600">Create and manage form workflow diagrams</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Create New Flow</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Flow name (e.g., Order Approval Flow)"
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && createNewFlow()}
          />
          <Button onClick={createNewFlow} className="gap-1">
            <Plus className="w-4 h-4" />
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Existing Flows</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading flows...</p>
          ) : flows.length === 0 ? (
            <p className="text-slate-500 text-sm">No flows created yet</p>
          ) : (
            <div className="space-y-2">
              {flows.map(flow => (
                <div key={flow.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">{flow.name}</p>
                    <p className="text-xs text-slate-600">{flow.nodes?.length || 0} nodes • {flow.connections?.length || 0} connections</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editFlow(flow.id)}
                      className="gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteFlow(flow.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}