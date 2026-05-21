import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Copy, Trash2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AssetActionsMenu({ asset, onReload }) {
  const [duplicating, setDuplicating] = useState(false);

  const handleDuplicate = async (e) => {
    e.stopPropagation();
    setDuplicating(true);
    try {
      const { id, created_date, updated_date, created_by, activity_log, status_history, ...assetData } = asset;
      await base44.entities.Asset.create({
        ...assetData,
        name: `${assetData.name} (Copy)`,
        status: 'Available',
        last_status_change_date: new Date().toISOString(),
      });
      toast.success('Asset duplicated');
      onReload();
    } catch (err) {
      toast.error('Failed to duplicate asset');
      console.error(err);
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${asset.name}"?`)) return;
    try {
      await base44.entities.Asset.delete(asset.id);
      toast.success('Asset deleted');
      onReload();
    } catch (err) {
      toast.error('Failed to delete');
      console.error(err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating}>
          {duplicating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Copy className="w-3 h-3 mr-2" />}
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-red-600">
          <Trash2 className="w-3 h-3 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}