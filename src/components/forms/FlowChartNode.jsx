import React, { useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const nodeColors = {
  form: 'bg-blue-100 border-blue-300 text-blue-900',
  decision: 'bg-yellow-100 border-yellow-300 text-yellow-900',
  action: 'bg-green-100 border-green-300 text-green-900',
  end: 'bg-red-100 border-red-300 text-red-900'
};

export default function FlowChartNode({ node, onDrag, onDelete, isSelected, onSelect }) {
  const nodeRef = useRef(null);

  const handleMouseDown = (e) => {
    onSelect(node.id);
    const rect = nodeRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const handleMouseMove = (moveEvent) => {
      onDrag(node.id, moveEvent.clientX - offsetX, moveEvent.clientY - offsetY);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={nodeRef}
      onMouseDown={handleMouseDown}
      className={cn(
        'absolute w-32 p-3 rounded-lg border-2 cursor-move transition-all shadow-md',
        nodeColors[node.type] || nodeColors.form,
        isSelected && 'ring-2 ring-blue-500'
      )}
      style={{ left: `${node.x}px`, top: `${node.y}px` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 text-sm font-semibold truncate">{node.label}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="text-slate-600 hover:text-red-600 flex-shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="text-xs mt-1 opacity-75">{node.type}</div>
    </div>
  );
}