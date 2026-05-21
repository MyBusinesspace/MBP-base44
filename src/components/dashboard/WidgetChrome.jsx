import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Maximize2, Minimize2, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function WidgetChrome({ title, children, editing, onRemove, onToggleSize, onToggleHeight, onToggleHidden, size, hidden, dragHandleProps, pageUrl, onPin }) {
  return (
    <Card className={`relative bg-white h-full flex flex-col ${hidden ? 'opacity-60' : ''} border border-slate-200 rounded-lg overflow-hidden`}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editing && (
            <div className="cursor-grab text-slate-400 hover:text-slate-600 transition-colors" {...dragHandleProps}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="19" r="1"/><circle cx="5" cy="19" r="1"/></svg>
            </div>
          )}
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {editing && (
            <>
              <div className="flex items-center gap-0.5 mr-1">
                <Button 
                  size="sm" 
                  variant="ghost"
                  className={`h-6 px-2 text-xs transition-all ${size === 'sm' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                  onClick={() => onToggleHeight ? onToggleHeight('sm') : onToggleSize('sm')}
                  title="Square (1x1)"
                >
                  ▢
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className={`h-6 px-2 text-xs transition-all ${size === 'tall' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                  onClick={() => onToggleHeight ? onToggleHeight('tall') : onToggleSize('tall')}
                  title="Tall (1x2)"
                >
                  ▯
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className={`h-6 px-2 text-xs transition-all ${size === 'wide' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                  onClick={() => onToggleHeight ? onToggleHeight('wide') : onToggleSize('wide')}
                  title="Wide (2x1)"
                >
                  ▭
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={onToggleHidden} title={hidden ? 'Show' : 'Hide'}>
                {hidden ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5"/>}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={onRemove} title="Remove">×</Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 z-[1000]">
              <DropdownMenuItem disabled={!pageUrl} onClick={() => { if (pageUrl) window.location.href = pageUrl; }}>
                Go to page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                try {
                  const arr = JSON.parse(localStorage.getItem('pinned_pages') || '[]');
                  if (!arr.includes(pageUrl)) arr.push(pageUrl);
                  localStorage.setItem('pinned_pages', JSON.stringify(arr));
                } catch {}
                if (typeof onPin === 'function') onPin();
              }}>
                Pin tab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="px-5 pb-5 overflow-auto flex-1 flex flex-col bg-white">
        <style>{`
          /* Clean table styles for widgets */
          table { 
            border-collapse: collapse !important; 
            width: 100%;
          }
          
          table thead tr {
            background: transparent !important;
          }
          
          table thead th {
            border-bottom: 1px solid #e2e8f0 !important;
            padding: 8px 12px !important;
            font-weight: 500 !important;
            font-size: 0.75rem !important;
            color: #64748b !important;
            text-align: left !important;
          }
          
          table tbody tr {
            border-bottom: 1px solid #f1f5f9 !important;
          }
          
          table tbody tr:hover {
            background: #f8fafc !important;
          }
          
          table tbody td {
            padding: 8px 12px !important;
            font-size: 0.875rem !important;
            color: #0f172a !important;
          }
          
          table tbody tr:last-child {
            border-bottom: none !important;
          }
        `}</style>
        {children}
      </div>
    </Card>
  );
}