'use client';
import React, { useEffect, useState } from 'react';
import { X, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

interface WorkflowDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
  /** ISO date string or date-only string (YYYY-MM-DD) for the task deadline */
  deadline?: string | null;
  /** Whether this task has been escalated */
  escalated?: boolean;
  /** Hours the task is overdue (auto-flag shown when >= 1) */
  overdueHours?: number | null;
}

// ─── Countdown helpers ────────────────────────────────────────────────────────

function parseDeadline(deadline: string): Date {
  // If it's a date-only string (YYYY-MM-DD), treat as end-of-day
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    const d = new Date(deadline);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return new Date(deadline);
}

interface CountdownState {
  label: string;
  isOverdue: boolean;
  isUrgent: boolean; // < 24 h remaining
  overdueHours: number;
}

function computeCountdown(deadline: string): CountdownState {
  const now = new Date();
  const due = parseDeadline(deadline);
  const diffMs = due.getTime() - now.getTime();

  if (diffMs <= 0) {
    const hoursOver = Math.abs(diffMs) / (1000 * 60 * 60);
    const daysOver = Math.floor(hoursOver / 24);
    const hOver = Math.floor(hoursOver % 24);
    let label = daysOver > 0 ? `${daysOver}d ${hOver}h overdue` : `${Math.ceil(hoursOver)}h overdue`;
    return { label, isOverdue: true, isUrgent: false, overdueHours: hoursOver };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  let label: string;
  if (days > 0) label = `${days}d ${hours}h left`;
  else if (hours > 0) label = `${hours}h ${minutes}m left`;
  else label = `${minutes}m left`;

  return { label, isOverdue: false, isUrgent: diffMs < 24 * 60 * 60 * 1000, overdueHours: 0 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkflowDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'w-[480px]',
  deadline,
  escalated = false,
  overdueHours,
}: WorkflowDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Live countdown — computed client-side only to avoid hydration mismatch
  const [countdown, setCountdown] = useState<CountdownState | null>(null);

  useEffect(() => {
    if (!deadline) { setCountdown(null); return; }
    setCountdown(computeCountdown(deadline));
    const interval = setInterval(() => setCountdown(computeCountdown(deadline)), 60_000);
    return () => clearInterval(interval);
  }, [deadline]);

  // Determine effective overdue hours: prefer prop, fall back to countdown
  const effectiveOverdueHours =
    overdueHours != null ? overdueHours : (countdown?.overdueHours ?? 0);
  const isAutoFlagged = effectiveOverdueHours >= 1;

  const hasIndicators = countdown || escalated || isAutoFlagged;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full ${width} max-w-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header — only shown if title or indicators are present */}
        {(title || subtitle || hasIndicators) && (
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0 bg-white">
            <div className="min-w-0 flex-1 pr-3 space-y-2">
              {/* Title + subtitle */}
              {(title || subtitle) && (
                <div>
                  {title && <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>}
                  {subtitle && <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
                </div>
              )}

              {/* Indicator badges row */}
              {hasIndicators && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Countdown deadline badge */}
                  {countdown && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        countdown.isOverdue
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : countdown.isUrgent
                          ? 'bg-amber-50 text-amber-700 border-amber-200' :'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      <Clock size={11} />
                      {countdown.label}
                    </span>
                  )}

                  {/* Escalation indicator */}
                  {escalated && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
                      <TrendingUp size={11} />
                      Escalated
                    </span>
                  )}

                  {/* Auto-flag: overdue by 1+ hours */}
                  {isAutoFlagged && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-red-100 text-red-800 border-red-300">
                      <AlertTriangle size={11} />
                      {effectiveOverdueHours >= 24
                        ? `${Math.floor(effectiveOverdueHours / 24)}d overdue`
                        : `${Math.ceil(effectiveOverdueHours)}h overdue`}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Drawer content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
