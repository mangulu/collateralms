'use client';
import React, { useState, useEffect, useCallback } from 'react';

import {
  Stamp, PenLine, RefreshCw, X, FileText, Clock, BadgeCheck, XCircle, AlertTriangle, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { legalSignOffService, LegalSignOff } from '@/lib/supabase/legalSignOffService';
import { auditLogService } from '@/lib/supabase/auditLogService';
import { useAuth } from '@/contexts/AuthContext';

function SectionHeader({ title, icon: IconComponent }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        {IconComponent && React.createElement(IconComponent, { size: 14, className: 'text-primary' })}
      </div>
      <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}

interface LegalSignOffModalProps {
  collateral: CollateralRecord;
  userId: string;
  userName: string;
  userRole: string;
  onClose: () => void;
  onSigned: () => void;
}

function LegalSignOffModal({ collateral, userId, userName, userRole, onClose, onSigned }: LegalSignOffModalProps) {
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const signedAt = new Date();

  const handleSubmit = async () => {
    if (!confirmed) { setError('Please confirm the sign-off declaration before proceeding.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const signOff = await legalSignOffService.create({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        signedBy: userId,
        signedByName: userName,
        signedByRole: userRole || 'Legal Officer',
        notes: notes.trim() || undefined,
      });
      if (!signOff) { setError('Sign-off failed. Please try again.'); setSubmitting(false); return; }
      await auditLogService.logLegalSignOff({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        performedBy: userId,
        performedByName: userName,
        notes: notes.trim(),
      });
      onSigned();
      onClose();
    } catch {
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Stamp size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Legal Sign-Off</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Perfected collateral record — <span className="font-medium text-foreground font-mono">{collateral.collateralId}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            {[
              { label: 'Obligor', value: collateral.obligor },
              { label: 'Collateral Type', value: collateral.type },
              { label: 'Registry', value: collateral.registry },
              { label: 'Value', value: `TSh ${collateral.valueTSh}` },
              { label: 'Sign-Off Timestamp', value: signedAt.toLocaleString() },
              { label: 'Signing Officer', value: userName },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Sign-Off Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Add any observations, conditions, or remarks regarding this perfection sign-off…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); if (e.target.checked) setError(''); }} className="sr-only" />
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${confirmed ? 'bg-emerald-600 border-emerald-600' : 'border-border group-hover:border-emerald-400'}`}>
                {confirmed && <CheckCircle2 size={10} className="text-white" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              I, <strong className="text-foreground">{userName}</strong>, confirm that I have reviewed this collateral record and hereby digitally sign off on its perfection status. This action is legally binding and will be permanently recorded in the audit trail.
            </p>
          </label>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !confirmed}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <PenLine size={14} />}
            {submitting ? 'Signing…' : 'Sign Off'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LegalSignOffSection({ collateral }: { collateral: CollateralRecord }) {
  const { user, userProfile, userRole } = useAuth();
  const [signOffs, setSignOffs] = useState<LegalSignOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadSignOffs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await legalSignOffService.getByCollateral(collateral.id);
      setSignOffs(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [collateral.id]);

  useEffect(() => { loadSignOffs(); }, [loadSignOffs]);

  const activeSignOffs = signOffs.filter((s) => s.status === 'signed');
  const canSignOff = !!user && collateral.status === 'Perfected';

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Legal Sign-Off" icon={Stamp} />
        <div className="flex items-center gap-2">
          {activeSignOffs.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              <BadgeCheck size={11} /> {activeSignOffs.length} active sign-off{activeSignOffs.length !== 1 ? 's' : ''}
            </span>
          )}
          {canSignOff && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
              <PenLine size={12} /> Sign Off
            </button>
          )}
        </div>
      </div>
      {collateral.status !== 'Perfected' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-3">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            Legal sign-off is only available for collateral records with <strong>Perfected</strong> status. Current status: <strong>{collateral.status}</strong>.
          </p>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : signOffs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <Stamp size={22} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground">No sign-offs recorded</p>
          <p className="text-xs text-muted-foreground mt-1">
            {collateral.status === 'Perfected' ? 'Legal officers can sign off on this perfected record.' : 'Sign-off becomes available once the collateral is perfected.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {signOffs.map((signOff) => (
            <div key={signOff.id} className={`rounded-lg border p-4 ${signOff.status === 'signed' ? 'border-emerald-200 bg-emerald-50/50' : 'border-border bg-muted/20 opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${signOff.status === 'signed' ? 'bg-emerald-100' : 'bg-muted'}`}>
                    {signOff.status === 'signed' ? <BadgeCheck size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{signOff.signedByName}</p>
                    <p className="text-xs text-muted-foreground">{signOff.signedByRole}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${signOff.status === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {signOff.status === 'signed' ? 'SIGNED' : 'REVOKED'}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 pl-10">
                <div className="flex items-center gap-2">
                  <Clock size={11} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Signed at <strong className="text-foreground font-mono">{new Date(signOff.signedAt).toLocaleString()}</strong></span>
                </div>
                {signOff.notes && (
                  <div className="flex items-start gap-2">
                    <FileText size={11} className="text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground italic">{signOff.notes}</p>
                  </div>
                )}
                {signOff.status === 'revoked' && signOff.revokedAt && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <p className="text-xs text-red-600">
                      Revoked by <strong>{signOff.revokedByName}</strong> on {new Date(signOff.revokedAt).toLocaleString()}
                      {signOff.revocationReason && ` — ${signOff.revocationReason}`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal && user && (
        <LegalSignOffModal
          collateral={collateral}
          userId={user.id}
          userName={userProfile?.full_name || user.email || 'Unknown Officer'}
          userRole={userRole || 'Legal Officer'}
          onClose={() => setShowModal(false)}
          onSigned={() => { loadSignOffs(); toast.success('Legal sign-off recorded successfully'); }}
        />
      )}
    </div>
  );
}
