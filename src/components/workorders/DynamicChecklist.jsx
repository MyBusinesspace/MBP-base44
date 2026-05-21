import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import Avatar from '../Avatar';
import { useData } from '../DataProvider';
import { Textarea } from '@/components/ui/textarea';

export default function DynamicChecklist({ items = [], onChange, placeholder = "Add item...", disabled = false, showSequence = false, taskUsers = [] }) {
  const { currentUser, users: allUsers = [] } = useData();
  // Ensure we always have at least one empty item if the list is empty, 
  // BUT only if we want to force at least one input.
  // The requirement is "start with only one checkbox/note".
  
  const [localItems, setLocalItems] = useState([]);

  useEffect(() => {
    if (!items || items.length === 0) {
      setLocalItems([{ id: Date.now().toString(), text: '', checked: false }]);
    } else {
      setLocalItems(items.map(item => item.id ? item : { ...item, id: Date.now().toString() + Math.random() }));
    }
  }, [items]);

  const handleChange = (id, field, value) => {
    if (disabled) return;
    const newItems = localItems.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      // Assign author when user starts typing if not already set
      if (field === 'text' && !updated.created_by && currentUser?.email) {
        updated.created_by = currentUser.email;
      }
      return updated;
    });
    setLocalItems(newItems);
    onChange(newItems);
  };

  const handleAdd = (index) => {
    if (disabled) return;
    const newItem = { id: Date.now().toString() + Math.random(), text: '', checked: false };
    const newItems = [...localItems];
    newItems.splice(index + 1, 0, newItem);
    setLocalItems(newItems);
    onChange(newItems);
    
    // Focus the new input after render
    setTimeout(() => {
      const inputs = document.querySelectorAll('.dynamic-checklist-input');
      if (inputs[index + 1]) inputs[index + 1].focus();
    }, 0);
  };

  const handleRemove = (id) => {
    if (disabled) return;
    if (localItems.length <= 1) {
        // Don't remove the last item, just clear it
        handleChange(id, 'text', '');
        handleChange(id, 'checked', false);
        return;
    }
    const newItems = localItems.filter(item => item.id !== id);
    setLocalItems(newItems);
    onChange(newItems);
  };

  const handleKeyDown = (e, index, id) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(index);
    }
    if (e.key === 'Backspace' && localItems[index].text === '') {
        // If empty and not the only item, remove it and focus previous
        if (localItems.length > 1) {
            e.preventDefault();
            handleRemove(id);
            setTimeout(() => {
                const inputs = document.querySelectorAll('.dynamic-checklist-input');
                if (inputs[index - 1]) inputs[index - 1].focus();
            }, 0);
        }
    }
  };

  return (
    <div className="space-y-3">
      {localItems.map((item, index) => (
        <div key={item.id} className="flex items-start gap-2 group">
          <Checkbox
           checked={item.checked}
           onCheckedChange={(checked) => handleChange(item.id, 'checked', checked)}
           disabled={disabled}
           className="mt-3"
          />
          {showSequence && (
            <span className="w-10 text-[11px] text-slate-500 select-none">{index + 1}/{localItems.length}</span>
          )}
          {(() => {
            // Show avatar of the author if created_by is set and resolves to a real user
            if (item.created_by) {
              const author = allUsers.find(u => u.id === item.created_by || u.email === item.created_by)
                || taskUsers.find(u => u.id === item.created_by || u.email === item.created_by)
                || (currentUser?.id === item.created_by || currentUser?.email === item.created_by ? currentUser : null);
              if (author) return <Avatar user={author} size="xs" />;
              // created_by is set but user not found — show empty placeholder, never show wrong avatar
              return <div className="w-5 h-5 flex-shrink-0" />;
            }
            return <div className="w-5 h-5 flex-shrink-0" />;
          })()}
          <Textarea
            value={item.text}
            onChange={(e) => handleChange(item.id, 'text', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(index); } if (e.key === 'Backspace' && item.text === '' && localItems.length > 1) { e.preventDefault(); handleRemove(item.id); setTimeout(() => { const inputs = document.querySelectorAll('.dynamic-checklist-input'); if (inputs[index - 1]) inputs[index - 1].focus(); }, 0); } }}
            placeholder={placeholder}
            rows={3}
            className={`flex-1 text-sm dynamic-checklist-input resize-none whitespace-pre-wrap break-words ${item.checked ? 'line-through text-slate-400 bg-green-50' : ''}`}
            disabled={disabled}
          />
          {!disabled && (
           <Button
             variant="ghost"
             size="icon"
             onClick={() => handleRemove(item.id)}
             className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
             tabIndex={-1}
           >
             <X className="w-4 h-4" />
           </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAdd(localItems.length - 1)}
          className="text-xs text-slate-500 hover:text-indigo-600 px-2 h-7"
        >
          <Plus className="w-3 h-3 mr-1" />
          Save and Add
        </Button>
      )}
    </div>
  );
}