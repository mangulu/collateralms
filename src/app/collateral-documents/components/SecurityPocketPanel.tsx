'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, User, Edit2, Save, X, Plus, RefreshCw, AlertTriangle, CheckCircle, Clock, ChevronDown, Package, Calendar, ArrowDownCircle, ArrowUpCircle, FileWarning, MessageSquare, Send, Loader2, Building2, Search } from 'lucide-react';
import {
  securityPocketService,
  SecurityPocket,
  PocketCheckoutLog,
} from '@/lib/supabase/securityPocketService';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { smsAlertService } from '@/lib/supabase/smsAlertService';
import { archiveLocationService, ArchiveLocation } from '@/lib/supabase/archiveService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Vault Slot Picker ────────────────────────────────────────────────────────

interface VaultSlotPickerProps {
  selectedSlotId: string | null;
  onSelect: (slot: ArchiveLocation | null) => void;
}

function VaultSlotPicker({ selectedSlotId, onSelect }: VaultSlotPickerProps) {
  const [locations, setLocations] = useState<ArchiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    archiveLocationService.getAll()
      .then((all) => {
        setLocations(all.filter((l) => l.isActive));
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load vault locations');
        setLoading(false);
      });
  }, []);

  // Build breadcrumb path for a location
  const getPath = (loc: ArchiveLocation): string => {
    const map = new Map(locations.map((l) => [l.id, l]));
    const parts: string[] = [];
    let current: ArchiveLocation | undefined = loc;
    while (current) {
      parts.unshift(current.name);
      current = current.parentId ? map.get(current.parentId) : undefined;
    }
    return parts.join(' › ');
  };

  // Only show slots (leaf-level locations)
  const slots = locations.filter((l) => l.locationType === 'slot');
  const filtered = slots.filter((s) =>
    !search || getPath(s).toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())
  );

  const selected = selectedSlotId ? locations.find((l) => l.id === selectedSlotId) ?? null : null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 size={13} className="animate-spin" /> Loading vault slots…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
        <AlertTriangle size={13} /> {error}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <AlertTriangle size={13} />
        No vault slots found. Please create slots in Archive › Vault Management first.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border border-border rounded-lg px-3 py-2.5 text-sm bg-white hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
      >
        {selected ? (
          <span className="flex items-center gap-2 text-foreground">
            <Building2 size={13} className="text-primary shrink-0" />
            <span className="truncate">{getPath(selected)}</span>
            <span className="text-muted-foreground text-xs shrink-0">({selected.code})</span>
          </span>
        ) : (
          <span className="text-muted-foreground">— Select a vault slot —</span>
        )}
        <ChevronDown size={13} className={`text-muted-foreground transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Clear button */}
      {selected && (
        <button
          type="button"
          onClick={() => { onSelect(null); setOpen(false); }}
          className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        >
          <X size={12} />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search slots…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No slots match your search.</p>
            ) : (
              filtered.map((slot) => {
                const path = getPath(slot);
                const isSelected = slot.id === selectedSlotId;
                const isFull = slot.currentOccupancy >= slot.capacity;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={isFull && !isSelected}
                    onClick={() => { onSelect(slot); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-primary/5' : ''}`}
                  >
                    <Building2 size={13} className={`mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{path}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Code: {slot.code} · {slot.currentOccupancy}/{slot.capacity} used
                        {isFull && <span className="ml-1 text-red-500 font-medium">· Full</span>}
                      </p>
                    </div>
                    {isSelected && <CheckCircle size={13} className="text-primary shrink-0 mt-0.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Location Form ────────────────────────────────────────────────────────────

interface LocationFormProps {
  pocket: SecurityPocket | null;
  collateralRecord: CollateralRecord;
  userId: string;
  userName: string;
  onSaved: (pocket: SecurityPocket) => void;
  onCancel: () => void;
}

function LocationForm({ pocket, collateralRecord, userId, userName, onSaved, onCancel }: LocationFormProps) {
  const [pocketName, setPocketName] = useState(
    pocket?.pocketName ?? `${collateralRecord.collateralId} — Security Pocket`
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ArchiveLocation | null>(null);
  const [locationNotes, setLocationNotes] = useState(pocket?.locationNotes ?? '');
  const [custodianName, setCustodianName] = useState(pocket?.custodianName ?? '');
  const [hasDiscrepancy, setHasDiscrepancy] = useState(pocket?.hasDiscrepancy ?? false);
  const [discrepancyNotes, setDiscrepancyNotes] = useState(pocket?.discrepancyNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-populate slot from existing pocket data (match by slot name/code if possible)
  // We store the slot reference in locationNotes or we derive from building/floor/room/cabinet/drawer/slot fields
  // For existing pockets, we show the old location as read-only and let user re-select
  const existingLocationSummary = pocket
    ? [pocket.building, pocket.floor, pocket.room, pocket.cabinet, pocket.drawer, pocket.slot]
        .filter(Boolean)
        .join(' › ')
    : null;

  const handleSlotSelect = (slot: ArchiveLocation | null) => {
    setSelectedSlot(slot);
    setSelectedSlotId(slot?.id ?? null);
  };

  const handleSave = async () => {
    if (!pocketName.trim()) { setError('Pocket name is required.'); return; }
    if (!selectedSlotId && !pocket) { setError('Please select a vault slot from the Archive.'); return; }
    setSaving(true);
    setError('');

    // Build location fields from selected slot path
    // We store the slot's path info into the existing fields for backward compatibility
    let locationFields: {
      pocketName: string;
      building: string;
      floor: string;
      room: string;
      cabinet: string;
      drawer: string;
      slot: string;
      locationNotes: string;
      custodianId: string | null;
      custodianName: string;
      hasDiscrepancy: boolean;
      discrepancyNotes: string;
    };

    if (selectedSlot) {
      // Derive hierarchy from the slot's ancestors
      // We'll store the slot code and name in the slot field, and the path in locationNotes
      locationFields = {
        pocketName: pocketName.trim(),
        building: selectedSlot.code, // use code as building reference
        floor: '',
        room: '',
        cabinet: '',
        drawer: '',
        slot: selectedSlot.name,
        locationNotes: locationNotes.trim(),
        custodianId: null,
        custodianName: custodianName.trim(),
        hasDiscrepancy,
        discrepancyNotes,
      };
    } else {
      // Editing existing pocket without changing slot — keep existing location fields
      locationFields = {
        pocketName: pocketName.trim(),
        building: pocket?.building ?? '',
        floor: pocket?.floor ?? '',
        room: pocket?.room ?? '',
        cabinet: pocket?.cabinet ?? '',
        drawer: pocket?.drawer ?? '',
        slot: pocket?.slot ?? '',
        locationNotes: locationNotes.trim(),
        custodianId: pocket?.custodianId ?? null,
        custodianName: custodianName.trim(),
        hasDiscrepancy,
        discrepancyNotes,
      };
    }

    const result = await securityPocketService.upsert(
      collateralRecord.id,
      collateralRecord.collateralId,
      locationFields,
      userId,
      userName,
      pocket?.id
    );
    setSaving(false);
    if (!result) { setError('Failed to save. Please try again.'); return; }
    onSaved(result);
  };

  return (
    <div className="space-y-4">
      {/* Pocket name */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Pocket Name</label>
        <input
          value={pocketName}
          onChange={(e) => setPocketName(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="e.g. COL-001 Security Pocket"
        />
      </div>

      {/* Vault Slot Picker */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Vault Slot (from Archive)
        </p>
        {/* Show existing location if editing without re-selecting */}
        {pocket && existingLocationSummary && !selectedSlotId && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
            <Building2 size={12} className="shrink-0" />
            <span>Current: <span className="font-medium">{existingLocationSummary}</span></span>
            <span className="text-blue-400 ml-1">(select below to change)</span>
          </div>
        )}
        <VaultSlotPicker selectedSlotId={selectedSlotId} onSelect={handleSlotSelect} />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Select a slot created in Archive › Vault Management. Only active slots are shown.
        </p>
      </div>

      {/* Location Notes */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Location Notes</label>
        <textarea
          value={locationNotes}
          onChange={(e) => setLocationNotes(e.target.value)}
          rows={2}
          placeholder="Additional directions or notes about this pocket's location…"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      {/* Custodian */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Custodian</p>
        <input
          value={custodianName}
          onChange={(e) => setCustodianName(e.target.value)}
          placeholder="Custodian full name"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Discrepancy flag */}
      <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
        <input
          type="checkbox"
          id="discrepancy"
          checked={hasDiscrepancy}
          onChange={(e) => setHasDiscrepancy(e.target.checked)}
          className="mt-0.5 accent-amber-600"
        />
        <div className="flex-1">
          <label htmlFor="discrepancy" className="text-xs font-medium text-amber-800 cursor-pointer">
            Flag discrepancy (digital docs exist but physical copy not confirmed)
          </label>
          {hasDiscrepancy && (
            <textarea
              value={discrepancyNotes}
              onChange={(e) => setDiscrepancyNotes(e.target.value)}
              rows={2}
              placeholder="Describe the discrepancy…"
              className="mt-2 w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
            />
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Pocket'}
        </button>
      </div>
    </div>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

interface CheckoutModalProps {
  pocket: SecurityPocket;
  collateralRecord: CollateralRecord;
  userId: string;
  userName: string;
  onClose: () => void;
  onDone: () => void;
}

function CheckoutModal({ pocket, collateralRecord, userId, userName, onClose, onDone }: CheckoutModalProps) {
  const [purpose, setPurpose] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!purpose.trim()) { setError('Purpose is required.'); return; }
    setSaving(true);
    const result = await securityPocketService.checkOut(
      pocket.id,
      collateralRecord.id,
      userId,
      userName,
      purpose,
      expectedReturn || null
    );
    setSaving(false);
    if (!result) { setError('Check-out failed. Please try again.'); return; }
    onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ArrowUpCircle size={16} className="text-amber-600" /> Check Out Originals
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{pocket.pocketName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Purpose / Reason</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              placeholder="e.g. Court submission, Valuation review, Audit inspection…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Expected Return Date <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
            {saving ? 'Processing…' : 'Confirm Check-Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Checkin Modal ────────────────────────────────────────────────────────────

interface CheckinModalProps {
  log: PocketCheckoutLog;
  userId: string;
  userName: string;
  onClose: () => void;
  onDone: () => void;
}

function CheckinModal({ log, userId, userName, onClose, onDone }: CheckinModalProps) {
  const [returnNotes, setReturnNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSaving(true);
    const ok = await securityPocketService.checkIn(log.id, userId, userName, returnNotes);
    setSaving(false);
    if (!ok) { setError('Check-in failed. Please try again.'); return; }
    onDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ArrowDownCircle size={16} className="text-emerald-600" /> Check In Originals
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Checked out by {log.checkedOutByName} on {formatDateTime(log.checkedOutAt)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Return Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              rows={3}
              placeholder="Condition of documents, any missing items, notes…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
            {saving ? 'Processing…' : 'Confirm Check-In'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface SecurityPocketPanelProps {
  collateralRecord: CollateralRecord;
  userId: string;
  userName: string;
}

export default function SecurityPocketPanel({ collateralRecord, userId, userName }: SecurityPocketPanelProps) {
  const [pocket, setPocket] = useState<SecurityPocket | null>(null);
  const [checkoutLog, setCheckoutLog] = useState<PocketCheckoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [checkinModal, setCheckinModal] = useState<PocketCheckoutLog | null>(null);
  const [smsPhone, setSmsPhone] = useState('');
  const [showSmsPrompt, setShowSmsPrompt] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ success: boolean; message: string } | null>(null);

  const activeCheckout = checkoutLog.find((l) => l.checkoutStatus === 'checked_out') ?? null;

  const fetchPocket = useCallback(async () => {
    setLoading(true);
    const p = await securityPocketService.getByCollateralId(collateralRecord.id);
    setPocket(p);
    if (p) {
      const log = await securityPocketService.getCheckoutLog(p.id);
      setCheckoutLog(log);
    }
    setLoading(false);
  }, [collateralRecord.id]);

  useEffect(() => { fetchPocket(); }, [fetchPocket]);

  const handleSaved = async (saved: SecurityPocket) => {
    setPocket(saved);
    setEditing(false);
    fetchPocket();
    if (saved.hasDiscrepancy) {
      setShowSmsPrompt(true);
      setSmsResult(null);
    }
  };

  const handleSendDiscrepancySms = async () => {
    if (!smsPhone.trim()) return;
    setSmsSending(true);
    setSmsResult(null);
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const detail = pocket?.discrepancyNotes || 'Physical copy not confirmed';
    const message = smsAlertService.buildCustodyMessage(
      collateralRecord.collateralId,
      detail,
      appUrl
    );
    const res = await smsAlertService.sendAlertViaApi({
      to: smsPhone.trim(),
      alertType: 'CUSTODY_DISCREPANCY',
      collateralId: collateralRecord.collateralId,
      message,
      actionUrl: `${appUrl}/collateral-documents`,
    });
    setSmsSending(false);
    setSmsResult({
      success: res.success,
      message: res.success
        ? `SMS sent to ${smsPhone.trim()}`
        : `Failed: ${res.error}`,
    });
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="border border-border rounded-xl bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ─── No pocket yet — create form ────────────────────────────────────────────
  if (!pocket && !editing) {
    return (
      <div className="border border-dashed border-border rounded-xl bg-white p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Package size={22} className="text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">No Security Pocket</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
          Create a security pocket by selecting an existing vault slot from the Archive module.
        </p>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Create Security Pocket
        </button>
      </div>
    );
  }

  // ─── Edit form ───────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="border border-primary/30 rounded-xl bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package size={15} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {pocket ? 'Edit Security Pocket' : 'Create Security Pocket'}
          </h3>
        </div>
        <LocationForm
          pocket={pocket}
          collateralRecord={collateralRecord}
          userId={userId}
          userName={userName}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  // ─── Pocket view ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="border border-border rounded-xl bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">{pocket!.pocketName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Security Pocket</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeCheckout ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                <ArrowUpCircle size={11} /> Checked Out
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircle size={11} /> In Vault
              </span>
            )}
            {pocket!.hasDiscrepancy && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                <FileWarning size={11} /> Discrepancy
              </span>
            )}
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Edit pocket"
            >
              <Edit2 size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Physical location */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin size={13} className="text-primary" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Physical Location</p>
            </div>
            <div className="bg-muted/40 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {securityPocketService.formatLocation(pocket!)}
              </p>
              {pocket!.locationNotes && (
                <p className="text-xs text-muted-foreground mt-1 italic">{pocket!.locationNotes}</p>
              )}
            </div>
            {/* Location chips */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { label: 'Vault Ref', value: pocket!.building },
                { label: 'Floor', value: pocket!.floor },
                { label: 'Room', value: pocket!.room },
                { label: 'Cabinet', value: pocket!.cabinet },
                { label: 'Drawer', value: pocket!.drawer },
                { label: 'Slot', value: pocket!.slot },
              ].filter((c) => c.value).map(({ label, value }) => (
                <span key={label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="text-blue-400">{label}:</span> {value}
                </span>
              ))}
            </div>
          </div>

          {/* Custodian */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <User size={13} className="text-primary" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Custodian</p>
            </div>
            {pocket!.custodianName ? (
              <div className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{pocket!.custodianName}</p>
                  {pocket!.custodianAssignedAt && (
                    <p className="text-xs text-muted-foreground">Assigned {formatDate(pocket!.custodianAssignedAt)}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic px-1">No custodian assigned</p>
            )}
          </div>

          {/* Discrepancy alert */}
          {pocket!.hasDiscrepancy && (
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800">Discrepancy Flagged</p>
                  {pocket!.discrepancyNotes && (
                    <p className="text-xs text-amber-700 mt-0.5">{pocket!.discrepancyNotes}</p>
                  )}
                </div>
                <button
                  onClick={() => { setShowSmsPrompt((v) => !v); setSmsResult(null); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shrink-0"
                  title="Notify officer via SMS"
                >
                  <MessageSquare size={11} /> Notify
                </button>
              </div>

              {showSmsPrompt && (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <MessageSquare size={12} /> Send Custody Discrepancy SMS
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={smsPhone}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      placeholder="+255712345678"
                      className="flex-1 px-3 py-1.5 text-xs border border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                    <button
                      onClick={handleSendDiscrepancySms}
                      disabled={!smsPhone.trim() || smsSending}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {smsSending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                      {smsSending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                  {smsResult && (
                    <p className={`text-xs font-medium ${smsResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                      {smsResult.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active checkout alert */}
          {activeCheckout && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
              <ArrowUpCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">Currently Checked Out</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  By <span className="font-medium">{activeCheckout.checkedOutByName}</span> on {formatDateTime(activeCheckout.checkedOutAt)}
                </p>
                {activeCheckout.purpose && (
                  <p className="text-xs text-amber-700 mt-0.5">Purpose: {activeCheckout.purpose}</p>
                )}
                {activeCheckout.expectedReturnDate && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    Expected return: {formatDate(activeCheckout.expectedReturnDate)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setCheckinModal(activeCheckout)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shrink-0"
              >
                <ArrowDownCircle size={12} /> Check In
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {!activeCheckout && (
              <button
                onClick={() => setCheckoutModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <ArrowUpCircle size={13} /> Check Out Originals
              </button>
            )}
            <button
              onClick={() => setShowLog((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-muted text-foreground border border-border rounded-lg hover:bg-muted/70 transition-colors ml-auto"
            >
              <Clock size={13} />
              {showLog ? 'Hide' : 'View'} Log
              {checkoutLog.length > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                  {checkoutLog.length}
                </span>
              )}
              <ChevronDown size={12} className={`transition-transform ${showLog ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Checkout log */}
          {showLog && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Clock size={13} className="text-primary" />
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Check-Out / Check-In Log</p>
              </div>
              {checkoutLog.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">No check-out activity recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {checkoutLog.map((log) => (
                    <div
                      key={log.id}
                      className={`rounded-lg border p-3 ${
                        log.checkoutStatus === 'checked_out' ? 'border-amber-200 bg-amber-50' : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {log.checkoutStatus === 'checked_out' ? (
                            <ArrowUpCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                          ) : (
                            <ArrowDownCircle size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {log.checkoutStatus === 'checked_out' ? 'Checked Out' : 'Returned'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.checkoutStatus === 'checked_out'
                                ? `By ${log.checkedOutByName} · ${formatDateTime(log.checkedOutAt)}`
                                : `Returned by ${log.returnedByName} · ${formatDateTime(log.returnedAt ?? '')}`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          log.checkoutStatus === 'checked_out' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                          {log.checkoutStatus === 'checked_out' ? 'Out' : 'Returned'}
                        </span>
                      </div>
                      {log.purpose && (
                        <p className="text-xs text-muted-foreground mt-1.5 pl-5">
                          <span className="font-medium text-foreground">Purpose:</span> {log.purpose}
                        </p>
                      )}
                      {log.expectedReturnDate && log.checkoutStatus === 'checked_out' && (
                        <p className="text-xs text-muted-foreground mt-0.5 pl-5 flex items-center gap-1">
                          <Calendar size={11} /> Expected: {formatDate(log.expectedReturnDate)}
                        </p>
                      )}
                      {log.returnNotes && (
                        <p className="text-xs text-muted-foreground mt-0.5 pl-5 italic">"{log.returnNotes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {checkoutModal && pocket && (
        <CheckoutModal
          pocket={pocket}
          collateralRecord={collateralRecord}
          userId={userId}
          userName={userName}
          onClose={() => setCheckoutModal(false)}
          onDone={fetchPocket}
        />
      )}

      {checkinModal && (
        <CheckinModal
          log={checkinModal}
          userId={userId}
          userName={userName}
          onClose={() => setCheckinModal(null)}
          onDone={fetchPocket}
        />
      )}
    </>
  );
}
