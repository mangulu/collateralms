'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Clock, Send, AlertTriangle, RefreshCw, Plus, Trash2, Play, Pause } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { collateralService } from '@/lib/supabase/collateralService';
import { smsAlertService, type SmsAlertType } from '@/lib/supabase/smsAlertService';
import {
  deadlineReminderRulesService,
  type DeadlineReminderRule,
} from '@/lib/supabase/deadlineReminderRulesService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function DeadlineRemindersContent() {
  const { user } = useAuth();
  const [rules, setRules] = useState<DeadlineReminderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', days: '7', role: 'credit_officer', template: '' });

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await deadlineReminderRulesService.listRules();
      setRules(data);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const toggleRule = async (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    const nextActive = !rule.isActive;
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: nextActive } : r)));
    const ok = await deadlineReminderRulesService.setActive(id, nextActive);
    if (!ok) {
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: !nextActive } : r)));
      toast.error('Failed to update rule');
    }
  };

  const deleteRule = async (id: string) => {
    const previous = rules;
    setRules((prev) => prev.filter((r) => r.id !== id));
    const ok = await deadlineReminderRulesService.remove(id);
    if (!ok) {
      setRules(previous);
      toast.error('Failed to delete rule');
    }
  };

  const runRule = async (rule: DeadlineReminderRule) => {
    setRunning(rule.id);
    try {
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

      const collaterals = await collateralService.getByDeadlineWindow(rule.daysBeforeDeadline);

      if (collaterals.length === 0) {
        toast.info(`No collateral matches rule "${rule.name}" right now`);
        setRunning(null);
        return;
      }

      const supabase = createClient();
      const { data: officers } = await supabase
        .from('user_profiles')
        .select('id, full_name, phone')
        .eq('role', rule.recipientRole)
        .not('phone', 'is', null);

      let sentCount = 0;
      for (const col of collaterals) {
        for (const officer of (officers ?? [])) {
          if (!officer.phone) continue;
          const msg = rule.messageTemplate
            .replace('{collateralId}', col.collateralId)
            .replace('{id}', col.collateralId)
            .replace('{registry}', col.registry ?? 'Registry')
            .replace('{url}', `${appUrl}/collateral-management`);

          await smsAlertService.sendAlertViaApi({
            to: officer.phone,
            message: msg,
            alertType: rule.alertType as SmsAlertType,
            collateralId: col.collateralId,
            recipientName: officer.full_name,
          });
          sentCount++;
        }
      }

      await deadlineReminderRulesService.recordRun(rule.id, sentCount);
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id
            ? { ...r, lastRunAt: new Date().toISOString(), sentCount: r.sentCount + sentCount }
            : r
        )
      );
      toast.success(`Sent ${sentCount} reminder${sentCount !== 1 ? 's' : ''} for "${rule.name}"`);
    } catch (err: any) {
      toast.error('Failed to run reminder: ' + err?.message);
    } finally {
      setRunning(null);
    }
  };

  const addRule = async () => {
    if (!newRule.name.trim()) return;
    const created = await deadlineReminderRulesService.create({
      name: newRule.name,
      daysBeforeDeadline: Number(newRule.days),
      alertType: 'BRELA_DEADLINE',
      recipientRole: newRule.role,
      messageTemplate: newRule.template || `[CollateralMS] Collateral {collateralId} deadline reminder. Action required: {url}`,
      createdBy: user?.id,
    });
    if (!created) {
      toast.error('Failed to add rule');
      return;
    }
    setRules((prev) => [...prev, created]);
    setNewRule({ name: '', days: '7', role: 'credit_officer', template: '' });
    setShowAddForm(false);
    toast.success('Reminder rule added');
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell size={18} className="text-primary" />
            <h2 className="text-lg font-bold text-foreground">Automated Deadline Reminders</h2>
          </div>
          <p className="text-sm text-muted-foreground">Configure and trigger SMS reminder rules for approaching perfection deadlines</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-all self-start sm:self-auto"
        >
          <Plus size={14} /> Add Rule
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">New Reminder Rule</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Rule Name</label>
              <input type="text" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="e.g. 7-Day Warning" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Days Before Deadline</label>
              <input type="number" value={newRule.days} onChange={(e) => setNewRule({ ...newRule, days: e.target.value })}
                placeholder="7" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Recipient Role</label>
              <select value={newRule.role} onChange={(e) => setNewRule({ ...newRule, role: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30">
                <option value="credit_officer">Credit Officer</option>
                <option value="legal_officer">Legal Officer</option>
                <option value="system_admin">System Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Message Template</label>
              <input type="text" value={newRule.template} onChange={(e) => setNewRule({ ...newRule, template: e.target.value })}
                placeholder="Use {collateralId}, {registry}, {url}" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={addRule} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">Add Rule</button>
          </div>
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className={`border rounded-xl p-4 ${rule.isActive ? 'bg-white border-border' : 'bg-muted/20 border-border/50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className={`text-sm font-semibold ${rule.isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{rule.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {rule.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {rule.daysBeforeDeadline < 0 ? 'Triggers when overdue' : `Triggers ${rule.daysBeforeDeadline} days before deadline`}
                    {' · '}Recipient: <span className="font-medium">{rule.recipientRole.replace(/_/g, ' ')}</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded truncate">{rule.messageTemplate}</p>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={9} /> Last run: {fmtDate(rule.lastRunAt)}</span>
                    <span className="flex items-center gap-1"><Send size={9} /> {rule.sentCount} sent total</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => runRule(rule)}
                    disabled={running === rule.id || !rule.isActive}
                    title="Run now"
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                  >
                    {running === rule.id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  </button>
                  <button onClick={() => toggleRule(rule.id)} title={rule.isActive ? 'Pause' : 'Resume'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors text-muted-foreground">
                    {rule.isActive ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button onClick={() => deleteRule(rule.id)} title="Delete"
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={15} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-800 mb-1">How Reminders Work</p>
            <p className="text-xs text-blue-700">
              Each rule scans collateral records matching the deadline window and sends SMS alerts to officers with the matching role who have a phone number configured.
              Twilio credentials must be configured in environment variables for SMS delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
