'use client';
import React, { useState, useEffect, useRef } from 'react';
import { UserCog, MapPin, ShieldCheck, Workflow, Scale, FileSearch, ArrowLeftRight, Unlock, Archive, Flag, FileBarChart2, ChevronDown, X, Loader2, Send, AlertTriangle, Info,  } from 'lucide-react';
import { CollateralRecord, collateralService, auditService } from '@/lib/supabase/collateralService';
import { perfectionService } from '@/lib/supabase/perfectionService';
import { createValuation } from '@/lib/supabase/valuationService';
import { workflowInstanceService, workflowTemplateService } from '@/lib/supabase/workflowEngineService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface CollateralActionToolbarProps {
  collateral: CollateralRecord;
  onRefresh: () => void;
}

type QuickEditType = 'assignee' | 'geolocation' | 'status' | null;
type WorkflowType = 'perfection' | 'valuation' | 'document-review' | 'substitution' | 'release' | null;
type ActionType = 'archive' | 'flag' | 'report' | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function startWorkflowEngineInstance(
  workflowType: 'valuation' | 'substitution' | 'perfection' | 'release',
  collateral: CollateralRecord,
  userId: string,
  referenceLabel: string
): Promise<void> {
  try {
    const templates = await workflowTemplateService.getAll();
    const template = templates.find((t) => t.workflowType === workflowType && t.isActive);
    if (!template) return;
    await workflowInstanceService.start({
      templateId: template.id,
      referenceType: workflowType,
      referenceId: collateral.id,
      referenceLabel,
      startedBy: userId,
      metadata: {
        collateralId: collateral.collateralId,
        obligor: collateral.obligor,
        collateralType: collateral.type,
      },
    });
  } catch {
    // non-blocking
  }
}

// ─── Workflow gate rules ──────────────────────────────────────────────────────

interface WorkflowGate {
  disabled: boolean;
  reason: string;
}

function getWorkflowGates(collateral: CollateralRecord): Record<string, WorkflowGate> {
  const s = collateral.status;
  return {
    perfection: {
      disabled: s === 'Perfected' || s === 'Submitted' || s === 'Under Review',
      reason:
        s === 'Perfected' ?'Already perfected'
          : s === 'Submitted'|| s === 'Under Review' ?'Perfection already in progress' :'',
    },
    valuation: {
      disabled: s === 'Released' || s === 'Rejected',
      reason:
        s === 'Released' ?'Collateral is released'
          : s === 'Rejected' ?'Collateral is rejected' :'',
    },
    'document-review': {
      disabled: s === 'Released' || s === 'Rejected',
      reason:
        s === 'Released' ?'Collateral is released'
          : s === 'Rejected' ?'Collateral is rejected' :'',
    },
    substitution: {
      disabled: s === 'Released' || s === 'Rejected',
      reason:
        s === 'Released' ?'Cannot substitute a released collateral'
          : s === 'Rejected' ?'Cannot substitute a rejected collateral' :'',
    },
    release: {
      disabled: s !== 'Perfected' && s !== 'Monitoring',
      reason:
        s !== 'Perfected' && s !== 'Monitoring'
          ? `Collateral must be Perfected or Monitoring to release (current: ${s})`
          : '',
    },
  };
}

// ─── Tooltip wrapper ──────────────────────────────────────────────────────────

function DisabledTooltip({ children, tip }: { children: React.ReactNode; tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && tip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-max max-w-[200px] bg-gray-900 text-white text-[11px] rounded-md px-2.5 py-1.5 leading-snug shadow-lg pointer-events-none">
          <div className="flex items-start gap-1.5">
            <Info size={11} className="shrink-0 mt-0.5 text-amber-300" />
            {tip}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// ─── Quick Edit: Assignee ─────────────────────────────────────────────────────

function AssigneeEditModal({
  collateral,
  onClose,
  onSaved,
}: {
  collateral: CollateralRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState(collateral.assignedOfficer ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('user_profiles')
      .select('id, full_name')
      .order('full_name')
      .then(({ data }) => {
        if (data) setOfficers(data.map((r: any) => ({ id: r.id, name: r.full_name })));
      });
  }, []);

  const handleSave = async () => {
    if (!selected.trim()) return;
    setSaving(true);
    try {
      await collateralService.update(collateral.id, { assignedOfficer: selected });
      await auditService.log({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        action: 'updated',
        message: `Assigned officer updated to ${selected}`,
        detail: `Previous: ${collateral.assignedOfficer ?? 'unassigned'}`,
        performedBy: user?.id,
        performedByName: user?.email ?? '',
      });
      toast.success('Assignee updated');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to update assignee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Quick Edit — Assignee" icon={<UserCog size={16} className="text-blue-600" />} iconBg="bg-blue-100" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Reassign this collateral to a different credit officer.</p>
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">Assigned Officer</label>
          {officers.length > 0 ? (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Select officer —</option>
              {officers.map((o) => (
                <option key={o.id} value={o.name}>{o.name}</option>
              ))}
            </select>
          ) : (
            <input
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              placeholder="Officer name"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
        </div>
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleSave} saving={saving} confirmLabel="Save Assignee" />
    </ModalShell>
  );
}

// ─── Quick Edit: Geolocation ──────────────────────────────────────────────────

function GeolocationEditModal({
  collateral,
  onClose,
  onSaved,
}: {
  collateral: CollateralRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [lat, setLat] = useState(collateral.latitude?.toString() ?? '');
  const [lng, setLng] = useState(collateral.longitude?.toString() ?? '');
  const [address, setAddress] = useState(collateral.physicalAddress ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<CollateralRecord> = { physicalAddress: address };
      if (lat && !isNaN(parseFloat(lat))) updates.latitude = parseFloat(lat);
      if (lng && !isNaN(parseFloat(lng))) updates.longitude = parseFloat(lng);
      await collateralService.update(collateral.id, updates);
      await auditService.log({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        action: 'updated',
        message: `Geolocation updated`,
        detail: `Lat: ${lat}, Lng: ${lng}, Address: ${address}`,
        performedBy: user?.id,
        performedByName: user?.email ?? '',
      });
      toast.success('Geolocation updated');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to update geolocation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Quick Edit — Geolocation" icon={<MapPin size={16} className="text-emerald-600" />} iconBg="bg-emerald-100" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Update the physical location coordinates and address for this collateral.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Latitude</label>
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-6.7924" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Longitude</label>
            <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="39.2083" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">Physical Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Plot 12, Msasani Peninsula, Dar es Salaam" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleSave} saving={saving} confirmLabel="Save Location" />
    </ModalShell>
  );
}

// ─── Quick Edit: Status Override ──────────────────────────────────────────────

const ALL_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected'] as const;

function StatusEditModal({
  collateral,
  onClose,
  onSaved,
}: {
  collateral: CollateralRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>(collateral.status);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!reason.trim()) { toast.error('Please provide a reason for the status override'); return; }
    setSaving(true);
    try {
      await collateralService.update(collateral.id, { status: status as any });
      await auditService.log({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        action: 'status_changed',
        message: `Status overridden: ${collateral.status} → ${status}`,
        detail: `Reason: ${reason}`,
        performedBy: user?.id,
        performedByName: user?.email ?? '',
      });
      toast.success(`Status updated to ${status}`);
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Quick Edit — Status Override" icon={<ShieldCheck size={16} className="text-amber-600" />} iconBg="bg-amber-100" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">Admin-only action. Status overrides are permanently logged in the audit trail.</p>
        </div>
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">New Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">Reason <span className="text-red-500">*</span></label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Explain why this status override is required…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleSave} saving={saving} confirmLabel="Override Status" confirmClass="bg-amber-600 hover:bg-amber-700" />
    </ModalShell>
  );
}

// ─── Initiate Workflow: Perfection ────────────────────────────────────────────

function PerfectionModal({ collateral, onClose, onSaved }: { collateral: CollateralRecord; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await perfectionService.create({
        collateralId: collateral.id,
        collateralRefId: collateral.collateralId,
        obligor: collateral.obligor,
        type: collateral.type,
        registry: collateral.registry,
        submittedBy: user?.id ?? '',
        submittedByName: user?.email ?? '',
        notes: notes || undefined,
      });
      await startWorkflowEngineInstance('perfection', collateral, user?.id ?? '', `Perfection — ${collateral.collateralId}`);
      toast.success('Perfection workflow initiated');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to initiate perfection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Initiate Perfection" icon={<Workflow size={16} className="text-blue-600" />} iconBg="bg-blue-100" onClose={onClose}>
      <CollateralSummaryBlock collateral={collateral} />
      <div className="mt-3">
        <label className="block text-xs font-600 text-foreground mb-1.5">Submission Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add context or instructions…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleSubmit} saving={saving} confirmLabel="Submit for Perfection" confirmClass="bg-blue-600 hover:bg-blue-700" />
    </ModalShell>
  );
}

// ─── Initiate Workflow: Valuation ─────────────────────────────────────────────

const VALUATION_TYPES = ['Full Valuation', 'Desk Review', 'Drive-By Inspection', 'Insurance Valuation', 'Forced Sale Valuation'];

function ValuationModal({ collateral, onClose, onSaved }: { collateral: CollateralRecord; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ valuationType: 'Full Valuation', scheduledDate: '', valuerName: '', valuerFirm: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.scheduledDate) { toast.error('Please select a scheduled date'); return; }
    setSaving(true);
    try {
      await createValuation({
        collateralId: collateral.id,
        valuationType: form.valuationType,
        scheduledDate: form.scheduledDate,
        valuerName: form.valuerName || undefined,
        valuerFirm: form.valuerFirm || undefined,
        valuationMethod: 'Market Value',
        notes: form.notes || undefined,
        createdBy: user?.id ?? '',
      });
      await startWorkflowEngineInstance('valuation', collateral, user?.id ?? '', `${form.valuationType} — ${collateral.collateralId}`);
      toast.success('Valuation scheduled');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to schedule valuation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Initiate Valuation" icon={<Scale size={16} className="text-indigo-600" />} iconBg="bg-indigo-100" onClose={onClose}>
      <CollateralSummaryBlock collateral={collateral} />
      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">Valuation Type</label>
          <select value={form.valuationType} onChange={(e) => setForm({ ...form, valuationType: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
            {VALUATION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">Scheduled Date <span className="text-red-500">*</span></label>
          <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Valuer Name</label>
            <input value={form.valuerName} onChange={(e) => setForm({ ...form, valuerName: e.target.value })} placeholder="Optional" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Valuer Firm</label>
            <input value={form.valuerFirm} onChange={(e) => setForm({ ...form, valuerFirm: e.target.value })} placeholder="Optional" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional instructions…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleSubmit} saving={saving} confirmLabel="Schedule Valuation" confirmClass="bg-indigo-600 hover:bg-indigo-700" />
    </ModalShell>
  );
}

// ─── Initiate Workflow: Document Review ───────────────────────────────────────

function DocumentReviewModal({ collateral, onClose, onSaved }: { collateral: CollateralRecord; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from('document_approval_workflows').insert({
        collateral_record_id: collateral.id,
        collateral_id: collateral.collateralId,
        status: 'Pending',
        submitted_by: user?.id,
        submitted_by_name: user?.email ?? '',
        notes: notes || null,
      });
      await auditService.log({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        action: 'updated',
        message: `Document review workflow initiated`,
        detail: notes || 'No notes',
        performedBy: user?.id,
        performedByName: user?.email ?? '',
      });
      toast.success('Document review initiated');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to initiate document review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Initiate Document Review" icon={<FileSearch size={16} className="text-teal-600" />} iconBg="bg-teal-100" onClose={onClose}>
      <CollateralSummaryBlock collateral={collateral} />
      <div className="mt-3">
        <label className="block text-xs font-600 text-foreground mb-1.5">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Specify which documents require review…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleSubmit} saving={saving} confirmLabel="Initiate Review" confirmClass="bg-teal-600 hover:bg-teal-700" />
    </ModalShell>
  );
}

// ─── Initiate Workflow: Substitution ─────────────────────────────────────────

function SubstitutionModal({ collateral, onClose, onSaved }: { collateral: CollateralRecord; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error('Please provide a substitution reason'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from('collateral_substitutions').insert({
        original_collateral_id: collateral.id,
        status: 'Pending',
        requested_by: user?.id,
        requested_by_name: user?.email ?? '',
        reason,
      });
      await startWorkflowEngineInstance('substitution', collateral, user?.id ?? '', `Substitution — ${collateral.collateralId}`);
      toast.success('Substitution request submitted');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to initiate substitution');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Initiate Substitution" icon={<ArrowLeftRight size={16} className="text-orange-600" />} iconBg="bg-orange-100" onClose={onClose}>
      <CollateralSummaryBlock collateral={collateral} />
      <div className="mt-3">
        <label className="block text-xs font-600 text-foreground mb-1.5">Substitution Reason <span className="text-red-500">*</span></label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Explain why this collateral needs to be substituted…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleSubmit} saving={saving} confirmLabel="Submit Request" confirmClass="bg-orange-600 hover:bg-orange-700" />
    </ModalShell>
  );
}

// ─── Initiate Workflow: Release ───────────────────────────────────────────────

function ReleaseModal({ collateral, onClose, onSaved }: { collateral: CollateralRecord; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from('release_requests').insert({
        collateral_record_id: collateral.id,
        collateral_id: collateral.collateralId,
        status: 'Pending',
        requested_by: user?.id,
        requested_by_name: user?.email ?? '',
        notes: notes || null,
      });
      await startWorkflowEngineInstance('release', collateral, user?.id ?? '', `Release — ${collateral.collateralId}`);
      toast.success('Release request submitted');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to initiate release');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Initiate Release" icon={<Unlock size={16} className="text-amber-600" />} iconBg="bg-amber-100" onClose={onClose}>
      <CollateralSummaryBlock collateral={collateral} />
      <div className="mt-3">
        <label className="block text-xs font-600 text-foreground mb-1.5">Release Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Reason for release / discharge…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>
      <ModalFooter onClose={onClose} onConfirm={handleSubmit} saving={saving} confirmLabel="Initiate Release" confirmClass="bg-amber-600 hover:bg-amber-700" />
    </ModalShell>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function CollateralSummaryBlock({ collateral }: { collateral: CollateralRecord }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
      {[
        { label: 'Collateral ID', value: collateral.collateralId, mono: true },
        { label: 'Obligor', value: collateral.obligor },
        { label: 'Type', value: collateral.type },
        { label: 'Registry', value: collateral.registry },
      ].map(({ label, value, mono }) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={`text-xs font-600 text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function ModalShell({
  title,
  icon,
  iconBg,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
            <h2 className="text-base font-700 text-foreground">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  onConfirm,
  saving,
  confirmLabel,
  confirmClass = 'bg-primary hover:bg-primary/90',
}: {
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
  confirmLabel: string;
  confirmClass?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-border">
      <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={saving}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${confirmClass}`}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {saving ? 'Processing…' : confirmLabel}
      </button>
    </div>
  );
}

// ─── Dropdown menu ────────────────────────────────────────────────────────────

interface DropdownItem {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  color?: string;
}

function ToolbarDropdown({
  label,
  icon: Icon,
  items,
  accentColor = 'text-foreground',
}: {
  label: string;
  icon: React.ElementType;
  items: DropdownItem[];
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm font-500 hover:bg-muted transition-colors ${accentColor}`}
      >
        <Icon size={13} />
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-border shadow-xl w-52 py-1.5 overflow-hidden">
          {items.map((item) =>
            item.disabled ? (
              <DisabledTooltip key={item.label} tip={item.disabledReason ?? ''}>
                <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none">
                  <item.icon size={14} className="shrink-0" />
                  <span>{item.label}</span>
                </div>
              </DisabledTooltip>
            ) : (
              <button
                key={item.label}
                onClick={() => { item.onClick(); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left ${item.color ?? 'text-foreground'}`}
              >
                <item.icon size={14} className="shrink-0" />
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Toolbar ─────────────────────────────────────────────────────────────

export default function CollateralActionToolbar({ collateral, onRefresh }: CollateralActionToolbarProps) {
  const { userRole } = useAuth();
  const [activeModal, setActiveModal] = useState<{
    quickEdit?: QuickEditType;
    workflow?: WorkflowType;
    action?: ActionType;
  }>({});
  const [generatingReport, setGeneratingReport] = useState(false);

  const gates = getWorkflowGates(collateral);
  const isAdmin = userRole === 'admin' || userRole === 'system_admin';

  const closeAll = () => setActiveModal({});

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const response = await fetch(`/api/collateral/summary-report?id=${collateral.id}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Failed to generate report');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collateral-summary-${collateral.collateralId}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Quick Edit items
  const quickEditItems: DropdownItem[] = [
    { label: 'Assignee', icon: UserCog, onClick: () => setActiveModal({ quickEdit: 'assignee' }) },
    { label: 'Geolocation', icon: MapPin, onClick: () => setActiveModal({ quickEdit: 'geolocation' }) },
    ...(isAdmin
      ? [{ label: 'Status Override', icon: ShieldCheck, onClick: () => setActiveModal({ quickEdit: 'status' }), color: 'text-amber-700' }]
      : []),
  ];

  // Workflow items
  const workflowItems: DropdownItem[] = [
    {
      label: 'Perfection',
      icon: Workflow,
      onClick: () => setActiveModal({ workflow: 'perfection' }),
      disabled: gates.perfection.disabled,
      disabledReason: gates.perfection.reason,
    },
    {
      label: 'Valuation',
      icon: Scale,
      onClick: () => setActiveModal({ workflow: 'valuation' }),
      disabled: gates.valuation.disabled,
      disabledReason: gates.valuation.reason,
    },
    {
      label: 'Document Review',
      icon: FileSearch,
      onClick: () => setActiveModal({ workflow: 'document-review' }),
      disabled: gates['document-review'].disabled,
      disabledReason: gates['document-review'].reason,
    },
    {
      label: 'Substitution',
      icon: ArrowLeftRight,
      onClick: () => setActiveModal({ workflow: 'substitution' }),
      disabled: gates.substitution.disabled,
      disabledReason: gates.substitution.reason,
    },
    {
      label: 'Release',
      icon: Unlock,
      onClick: () => setActiveModal({ workflow: 'release' }),
      disabled: gates.release.disabled,
      disabledReason: gates.release.reason,
      color: 'text-amber-700',
    },
  ];

  // Actions items
  const actionItems: DropdownItem[] = [
    {
      label: 'Archive',
      icon: Archive,
      onClick: () => {
        toast.info('Redirecting to Archive module…');
        window.location.href = '/archive/collateral-placement';
      },
    },
    {
      label: 'Flag for Review',
      icon: Flag,
      onClick: async () => {
        const supabase = createClient();
        await supabase.from('audit_logs').insert({
          collateral_record_id: collateral.id,
          collateral_id: collateral.collateralId,
          entity_type: 'collateral',
          action: 'updated',
          message: `Collateral ${collateral.collateralId} flagged for review`,
          detail: 'Manually flagged via action toolbar',
          event_category: 'collateral_change',
        });
        toast.success('Flagged for review');
      },
      color: 'text-orange-700',
    },
    {
      label: generatingReport ? 'Generating…' : 'Generate Report',
      icon: FileBarChart2,
      onClick: handleGenerateReport,
    },
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <ToolbarDropdown label="Quick Edit" icon={UserCog} items={quickEditItems} accentColor="text-foreground" />
        <ToolbarDropdown label="Initiate Workflow" icon={Workflow} items={workflowItems} accentColor="text-primary" />
        <ToolbarDropdown label="Actions" icon={generatingReport ? Loader2 : FileBarChart2} items={actionItems} accentColor="text-foreground" />
      </div>

      {/* Quick Edit Modals */}
      {activeModal.quickEdit === 'assignee' && (
        <AssigneeEditModal collateral={collateral} onClose={closeAll} onSaved={onRefresh} />
      )}
      {activeModal.quickEdit === 'geolocation' && (
        <GeolocationEditModal collateral={collateral} onClose={closeAll} onSaved={onRefresh} />
      )}
      {activeModal.quickEdit === 'status' && (
        <StatusEditModal collateral={collateral} onClose={closeAll} onSaved={onRefresh} />
      )}

      {/* Workflow Modals */}
      {activeModal.workflow === 'perfection' && (
        <PerfectionModal collateral={collateral} onClose={closeAll} onSaved={onRefresh} />
      )}
      {activeModal.workflow === 'valuation' && (
        <ValuationModal collateral={collateral} onClose={closeAll} onSaved={onRefresh} />
      )}
      {activeModal.workflow === 'document-review' && (
        <DocumentReviewModal collateral={collateral} onClose={closeAll} onSaved={onRefresh} />
      )}
      {activeModal.workflow === 'substitution' && (
        <SubstitutionModal collateral={collateral} onClose={closeAll} onSaved={onRefresh} />
      )}
      {activeModal.workflow === 'release' && (
        <ReleaseModal collateral={collateral} onClose={closeAll} onSaved={onRefresh} />
      )}
    </>
  );
}
