'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, ArrowLeft, ChevronDown, ChevronRight, Lightbulb,
  AlertTriangle, Info, ArrowRight, Map, CheckSquare,
} from 'lucide-react';
import type { RoleGuide, GuideTask, GuideModule, GuideTip } from '../data/guideData';
import Icon from '@/components/ui/AppIcon';


// ─── Task Accordion ───────────────────────────────────────────────────────────

function TaskCard({ task, color }: { task: GuideTask; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${color}20` }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
        style={{ backgroundColor: open ? color + '08' : '#FFFFFF' }}
        onMouseOver={(e) => { if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = color + '05'; }}
        onMouseOut={(e) => { if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = '#FFFFFF'; }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: color + '15' }}
          >
            <CheckSquare size={14} style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{task.title}</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{task.description}</p>
          </div>
        </div>
        <ChevronDown
          size={16}
          style={{
            color,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
            marginLeft: 12,
          }}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-2" style={{ backgroundColor: color + '04' }}>
          <div className="space-y-2.5">
            {task.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-white font-bold"
                  style={{ backgroundColor: color, fontSize: '10px' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>{step.action}</p>
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1 text-xs font-medium mt-0.5 hover:underline"
                    style={{ color }}
                  >
                    <ArrowRight size={10} />
                    {step.where}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tip Card ─────────────────────────────────────────────────────────────────

function TipCard({ tip }: { tip: GuideTip }) {
  const config = {
    tip: { icon: Lightbulb, bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', iconColor: '#2563EB' },
    warning: { icon: AlertTriangle, bg: '#FFF7ED', border: '#FED7AA', text: '#92400E', iconColor: '#D97706' },
    info: { icon: Info, bg: '#F0FDF4', border: '#BBF7D0', text: '#065F46', iconColor: '#059669' },
  }[tip.type];

  const TipIcon = config.icon;

  return (
    <div
      className="flex items-start gap-3 p-3.5 rounded-xl"
      style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}
    >
      <TipIcon size={15} style={{ color: config.iconColor, marginTop: 1, flexShrink: 0 }} />
      <p className="text-xs leading-relaxed" style={{ color: config.text }}>{tip.text}</p>
    </div>
  );
}

// ─── Module Map ───────────────────────────────────────────────────────────────

function ModuleRow({ mod, color }: { mod: GuideModule; color: string }) {
  const ModIcon = mod.icon;
  return (
    <Link
      href={mod.href}
      className="flex items-start gap-3 p-3 rounded-xl transition-all duration-150 group"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)' }}
      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = color + '40'; }}
      onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.06)'; }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + '15' }}
      >
        <ModIcon size={15} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold flex items-center gap-1" style={{ color: '#1E293B' }}>
          {mod.label}
          <ChevronRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }} />
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>{mod.why}</p>
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RoleGuideContent({ guide }: { guide: RoleGuide }) {
  const [activeSection, setActiveSection] = useState<'modules' | 'tasks' | 'tips'>('modules');
  const RoleIcon = guide.icon;

  const tabs: { key: typeof activeSection; label: string; count: number }[] = [
    { key: 'modules', label: 'Module Map', count: guide.modules.length },
    { key: 'tasks', label: 'Task Walkthroughs', count: guide.tasks.length },
    { key: 'tips', label: 'Tips & Watchouts', count: guide.tips.length },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F7FF' }}>
      {/* Header */}
      <div className="px-6 py-10" style={{ background: guide.bg }}>
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5">
            <Link
              href="/guides"
              className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <ArrowLeft size={13} />
              All Role Guides
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>/</span>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{guide.role}</span>
          </div>

          {/* Role header */}
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <RoleIcon size={28} color="#fff" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}>
                  Role Guide
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                {guide.role}
              </h1>
            </div>
          </div>

          {/* Summary */}
          <div
            className="mt-5 p-4 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {guide.summary}
            </p>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-5 mt-5">
            {[
              { label: `${guide.modules.length} modules`, icon: Map },
              { label: `${guide.tasks.length} task walkthroughs`, icon: CheckSquare },
              { label: `${guide.tips.length} tips & watchouts`, icon: Lightbulb },
            ].map(({ label, icon: StatIcon }) => (
              <div key={label} className="flex items-center gap-1.5">
                <StatIcon size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ backgroundColor: '#E2E8F0' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150"
              style={
                activeSection === tab.key
                  ? { backgroundColor: '#FFFFFF', color: guide.color, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                  : { color: '#64748B' }
              }
            >
              {tab.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={
                  activeSection === tab.key
                    ? { backgroundColor: guide.color + '18', color: guide.color }
                    : { backgroundColor: '#CBD5E1', color: '#64748B' }
                }
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Module Map */}
        {activeSection === 'modules' && (
          <div>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: '#64748B' }}>
              These are the modules you will use most as a {guide.role}. Click any module to navigate directly to it.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {guide.modules.map((mod) => (
                <ModuleRow key={mod.href + mod.label} mod={mod} color={guide.color} />
              ))}
            </div>
          </div>
        )}

        {/* Task Walkthroughs */}
        {activeSection === 'tasks' && (
          <div>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: '#64748B' }}>
              Step-by-step walkthroughs for the core tasks you perform as a {guide.role}. Click any task to expand the steps.
            </p>
            <div className="space-y-3">
              {guide.tasks.map((task, i) => (
                <TaskCard key={i} task={task} color={guide.color} />
              ))}
            </div>
          </div>
        )}

        {/* Tips & Watchouts */}
        {activeSection === 'tips' && (
          <div>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: '#64748B' }}>
              Key tips, SLA watchouts, and common pitfalls specific to the {guide.role} role.
            </p>
            <div className="space-y-3">
              {guide.tips.map((tip, i) => (
                <TipCard key={i} tip={tip} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="mt-8 flex items-start gap-3 p-4 rounded-xl"
          style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
        >
          <BookOpen size={15} style={{ color: '#2563EB', marginTop: 1, flexShrink: 0 }} />
          <p className="text-xs leading-relaxed" style={{ color: '#1D4ED8' }}>
            <strong>Need the full module guide?</strong>{' '}
            <Link href="/onboarding-guide" className="underline font-semibold">
              Visit the Onboarding Guide
            </Link>{' '}
            for a complete walkthrough of all 9 modules, user journeys, and quick-access shortcuts.{' '}
            <Link href="/guides" className="underline font-semibold">
              View all role guides →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
