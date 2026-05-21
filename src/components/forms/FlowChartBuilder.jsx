import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Save, RotateCcw } from 'lucide-react';
import FlowChartNode from './FlowChartNode';

export default function FlowChartBuilder({ flowId, initialData }) {
  const canvasRef = useRef(null);
  const [nodes, setNodes] = useState(initialData?.nodes || []);
  const [connections, setConnections] = useState(initialData?.connections || []);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [nodeType, setNodeType] = useState('form');
  const [nodeLabel, setNodeLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const addNode = () => {
    if (!nodeLabel.trim()) {
      toast.error('Please enter a node label');
      return;
    }

    const newNode = {
      id: `node-${Date.now()}`,
      type: nodeType,
      label: nodeLabel,
      x: Math.random() * 400 + 50,
      y: Math.random() * 300 + 50,
      data: {}
    };

    setNodes([...nodes, newNode]);
    setNodeLabel('');
    toast.success('Node added');
  };

  const deleteNode = (nodeId) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    setConnections(connections.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
  };

  const updateNodePosition = (nodeId, x, y) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, x, y } : n));
  };

  const startConnection = (fromNodeId, e) => {
    e.stopPropagation();
    setConnecting(fromNodeId);
  };

  const endConnection = (toNodeId) => {
    if (connecting && connecting !== toNodeId) {
      const exists = connections.some(c => c.from === connecting && c.to === toNodeId);
      if (!exists) {
        const newConnection = {
          id: `conn-${Date.now()}`,
          from: connecting,
          to: toNodeId,
          label: ''
        };
        setConnections([...connections, newConnection]);
        toast.success('Connection created');
      }
    }
    setConnecting(null);
  };

  const deleteConnection = (connId) => {
    setConnections(connections.filter(c => c.id !== connId));
  };

  const getNodeById = (id) => nodes.find(n => n.id === id);

  const drawConnections = () => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    connections.forEach(conn => {
      const fromNode = getNodeById(conn.from);
      const toNode = getNodeById(conn.to);

      if (fromNode && toNode) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromNode.x + 64, fromNode.y + 32);
        ctx.lineTo(toNode.x + 64, toNode.y + 32);
        ctx.stroke();

        // Arrow
        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(toNode.x + 64, toNode.y + 32);
        ctx.lineTo(toNode.x + 64 - 12 * Math.cos(angle - Math.PI / 6), toNode.y + 32 - 12 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toNode.x + 64 - 12 * Math.cos(angle + Math.PI / 6), toNode.y + 32 - 12 * Math.sin(angle + Math.PI / 6));
        ctx.fill();
      }
    });
  };

  React.useEffect(() => {
    drawConnections();
  }, [nodes, connections]);

  const saveFlow = async () => {
    setSaving(true);
    try {
      if (flowId) {
        await base44.entities.FormFlowConfig.update(flowId, { nodes, connections });
      } else {
        await base44.entities.FormFlowConfig.create({ 
          name: 'New Flow',
          nodes, 
          connections 
        });
      }
      toast.success('Flow saved successfully');
    } catch (error) {
      console.error('Error saving flow:', error);
      toast.error('Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add New Node</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={nodeType} onValueChange={setNodeType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="form">Form</SelectItem>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="action">Action</SelectItem>
                <SelectItem value="end">End</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Node label"
              value={nodeLabel}
              onChange={(e) => setNodeLabel(e.target.value)}
              className="flex-1"
              onKeyPress={(e) => e.key === 'Enter' && addNode()}
            />
            <Button onClick={addNode} size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="relative bg-white overflow-hidden">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm">Flow Canvas</CardTitle>
            <Button onClick={saveFlow} disabled={saving} size="sm" className="gap-1">
              <Save className="w-4 h-4" />
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative w-full h-96 bg-slate-50 rounded border-2 border-slate-200">
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              className="absolute inset-0 pointer-events-none"
            />
            {nodes.map(node => (
              <FlowChartNode
                key={node.id}
                node={node}
                onDrag={updateNodePosition}
                onDelete={deleteNode}
                isSelected={selectedNode === node.id}
                onSelect={setSelectedNode}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}