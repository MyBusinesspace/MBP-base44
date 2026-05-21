import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';

export default function ClientApprovalSection({ formData, setFormData, isReadOnly, createMode }) {
  return (
    <div className="rounded-xl border border-red-400 bg-white shadow-sm mt-6 mb-20">
      <div className="bg-red-50 px-4 py-3 border-b border-red-200 rounded-t-xl">
        <h3 className="text-sm font-semibold text-red-900">
          5. Client Approval
        </h3>
        <p className="text-xs text-red-700 mt-0.5">To be signed at finishing time</p>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
            Comments from the client
          </Label>
          <Textarea
            value={formData.client_feedback_comments || ''}
            onChange={(e) => setFormData({ ...formData, client_feedback_comments: e.target.value })}
            placeholder="Enter client comments..."
            className="min-h-[80px]"
            disabled={isReadOnly && !createMode}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
              Client responsible signature
            </Label>
            <Input
              value={formData.client_representative_name || ''}
              onChange={(e) => setFormData({ ...formData, client_representative_name: e.target.value })}
              placeholder="Name / Signature"
              disabled={isReadOnly && !createMode}
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
              Mobile
            </Label>
            <Input
              value={formData.client_representative_phone || ''}
              onChange={(e) => setFormData({ ...formData, client_representative_phone: e.target.value })}
              placeholder="Mobile number"
              type="tel"
              disabled={isReadOnly && !createMode}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
              Leader in charge signature
            </Label>
            <Input
              value={formData.leader_in_charge_signature || ''}
              onChange={(e) => setFormData({ ...formData, leader_in_charge_signature: e.target.value })}
              placeholder="Leader name / Signature"
              disabled={isReadOnly && !createMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}