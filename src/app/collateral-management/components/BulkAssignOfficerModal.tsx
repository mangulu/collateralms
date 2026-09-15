'use client';
import React, { useState } from 'react';
import { UserCog, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { collateralService, auditService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';

interface BulkAssignOfficerModalProps {
  open: boolean;
  records: CollateralRecord[];
  officers: string[];
  onClose: () => void;
  onAssigned: () => void;
}

export default function BulkAssignOfficerModal({
  open,
  records,
  officers,
  onClose,
  onAssigned,
}: BulkAssignOfficerModalProps) {
  const { user } = useAuth();
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (saving) return;
    setSelectedOfficer('');
    onClose();
  };

  const handleAssign = async () => {
    if (!selectedOfficer || records.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        records.map(async (record) => {
          await collateralService.update(record.id, { assignedOfficer: selectedOfficer });
          await auditService.log({
            collateralRecordId: record.id,
            collateralId: record.collateralId,
            action: 'officer_assigned',
            message: `Assigned officer changed to ${selectedOfficer} for ${record.collateralId}`,
            detail: `${record.obligor} · ${record.type} (was ${record.assignedOfficer || 'Unassigned'})`,
            performedBy: user?.id,
            performedByName: user?.email ?? '',
          });
        })
      );
      toast.success(`${records.length} record${records.length > 1 ? 's' : ''} reassigned to ${selectedOfficer}`);
      setSelectedOfficer('');
      onAssigned();
    } catch {
      toast.error('Failed to assign officer to one or more records. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Assign Officer"
      subtitle={`${records.length} record${records.length > 1 ? 's' : ''} selected`}
      size="sm"
    >
      <div className="space-y-4">
        <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-muted/30 divide-y divide-border">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="font-mono font-600 text-foreground shrink-0">{r.collateralId}</span>
              <span className="text-muted-foreground truncate">{r.assignedOfficer || 'Unassigned'}</span>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-500 text-foreground mb-1.5">Assign to</label>
          <select
            value={selectedOfficer}
            onChange={(e) => setSelectedOfficer(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            <option value="">Select officer...</option>
            {officers.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-500 text-muted-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedOfficer || saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <UserCog size={14} />}
            {saving ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
