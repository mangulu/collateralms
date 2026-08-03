'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import Link from 'next/link';
import { BookOpen, ArrowRight, ShieldCheck, Scale, BarChart2, Settings2, FlaskConical } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const ROLE_GUIDES = [
  {
    role: 'Credit Officer',
    slug: 'credit-officer',
    tagline: 'Collateral intake, valuation scheduling, and substitution requests',
    description: 'Your daily workflow covers registering new collateral, scheduling valuations, initiating substitution requests, and monitoring LTV thresholds. This guide walks through every task step by step.',
    icon: BarChart2,
    color: '#1D4ED8',
    bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
    iconBg: '#2563EB',
    badge: 'credit_officer',
    tasks: ['Register collateral', 'Schedule valuations', 'Submit substitution requests', 'Monitor LTV alerts'],
  },
  {
    role: 'Legal Officer',
    slug: 'legal-officer',
    tagline: 'Perfection, document approvals, covenants, and release approvals',
    description: 'You own the legal lifecycle of every collateral asset — from perfection review and document sign-off to covenant tracking and release authorisation. This guide covers your full scope.',
    icon: Scale,
    color: '#7C3AED',
    bg: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
    iconBg: '#7C3AED',
    badge: 'legal_officer',
    tasks: ['Review perfection submissions', 'Approve/reject documents', 'Track covenants', 'Authorise releases'],
  },
  {
    role: 'Legal / Credit Manager',
    slug: 'manager',
    tagline: 'Workflow oversight, escalation management, and portfolio governance',
    description: 'As a manager you oversee the full approval pipeline, handle escalations, reassign tasks, and run portfolio-level analytics. This guide covers your oversight and governance responsibilities.',
    icon: ShieldCheck,
    color: '#065F46',
    bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
    iconBg: '#059669',
    badge: 'manager',
    tasks: ['Oversee approval queues', 'Manage escalations', 'Run portfolio analytics', 'Generate regulatory reports'],
  },
  {
    role: 'System Admin',
    slug: 'system-admin',
    tagline: 'User management, workflow templates, trigger rules, and migration tools',
    description: 'You control the entire platform — user accounts, role permissions, workflow engine configuration, alert thresholds, and system settings. This guide covers every admin capability.',
    icon: Settings2,
    color: '#374151',
    bg: 'linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%)',
    iconBg: '#4B5563',
    badge: 'system_admin',
    tasks: ['Manage users & roles', 'Configure workflow templates', 'Set trigger rules', 'Run migration tools'],
  },
];

const TESTING_GUIDE = {
  title: 'Testing & Training Guide',
  slug: 'testing',
  tagline: 'End-to-end test flow, feature checklists, and test data references',
  description: 'A step-by-step guide for testers and trainers covering the full collateral lifecycle — from obligor creation to release approval — with per-module checklists and known test data.',
  icon: FlaskConical,
  color: '#1D4ED8',
  bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
  iconBg: '#1D4ED8',
  tasks: ['Prerequisites & setup', 'E2E test phases', 'Feature checklists', 'Test data references'],
};

export default function GuidesIndexPage() {
  return (
    <AppLayout>
      <div className="min-h-screen" style={{ backgroundColor: '#F0F7FF' }}>
        {/* Header */}
        <div
          className="px-6 py-10"
          style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #2563EB 100%)' }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <BookOpen size={16} color="#fff" />
              </div>
              <span className="text-blue-200 text-sm font-medium">Guides</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Guides & Training
            </h1>
            <p className="text-blue-200 text-sm max-w-2xl leading-relaxed">
              Role-specific guides tailored to your daily tasks, plus a full end-to-end testing and training guide for testers and new team members.
            </p>
          </div>
        </div>

        {/* Role Cards */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94A3B8' }}>Role Guides</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {ROLE_GUIDES.map((guide) => {
              const Icon = guide.icon;
              return (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="group rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: guide.bg,
                    border: `1.5px solid ${guide.color}22`,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px ${guide.color}22`;
                    (e.currentTarget as HTMLElement).style.borderColor = `${guide.color}55`;
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
                    (e.currentTarget as HTMLElement).style.borderColor = `${guide.color}22`;
                  }}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: guide.iconBg }}
                      >
                        <Icon size={22} color="#fff" />
                      </div>
                      <ArrowRight
                        size={18}
                        style={{ color: guide.color }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                      />
                    </div>

                    <h2 className="text-base font-bold mb-1" style={{ color: '#1E293B', fontFamily: 'DM Sans, sans-serif' }}>
                      {guide.role}
                    </h2>
                    <p className="text-xs font-medium mb-3" style={{ color: guide.color }}>
                      {guide.tagline}
                    </p>
                    <p className="text-xs leading-relaxed mb-4" style={{ color: '#475569' }}>
                      {guide.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {guide.tasks.map((task) => (
                        <span
                          key={task}
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: guide.color + '14', color: guide.color }}
                        >
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div
                    className="px-6 py-3 flex items-center justify-between"
                    style={{ backgroundColor: guide.color + '0D', borderTop: `1px solid ${guide.color}18` }}
                  >
                    <span className="text-xs font-semibold" style={{ color: guide.color }}>
                      Open Guide
                    </span>
                    <ArrowRight size={13} style={{ color: guide.color }} />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Testing & Training Guide */}
          <p className="text-xs font-semibold uppercase tracking-wider mt-8 mb-3" style={{ color: '#94A3B8' }}>Testing & Training</p>
          <Link
            href="/guides/testing"
            className="group block rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: TESTING_GUIDE.bg,
              border: `1.5px solid ${TESTING_GUIDE.color}22`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px ${TESTING_GUIDE.color}22`;
              (e.currentTarget as HTMLElement).style.borderColor = `${TESTING_GUIDE.color}55`;
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = `${TESTING_GUIDE.color}22`;
            }}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: TESTING_GUIDE.iconBg }}
                  >
                    <FlaskConical size={22} color="#fff" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: '#1E293B', fontFamily: 'DM Sans, sans-serif' }}>
                      {TESTING_GUIDE.title}
                    </h2>
                    <p className="text-xs font-medium" style={{ color: TESTING_GUIDE.color }}>
                      {TESTING_GUIDE.tagline}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  style={{ color: TESTING_GUIDE.color }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0"
                />
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: '#475569' }}>
                {TESTING_GUIDE.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TESTING_GUIDE.tasks.map((task) => (
                  <span
                    key={task}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: TESTING_GUIDE.color + '14', color: TESTING_GUIDE.color }}
                  >
                    {task}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="px-6 py-3 flex items-center justify-between"
              style={{ backgroundColor: TESTING_GUIDE.color + '0D', borderTop: `1px solid ${TESTING_GUIDE.color}18` }}
            >
              <span className="text-xs font-semibold" style={{ color: TESTING_GUIDE.color }}>
                Open Testing Guide
              </span>
              <ArrowRight size={13} style={{ color: TESTING_GUIDE.color }} />
            </div>
          </Link>

          {/* Also see */}
          <div
            className="mt-8 flex items-start gap-3 p-4 rounded-xl"
            style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
          >
            <BookOpen size={15} style={{ color: '#2563EB', marginTop: 1, flexShrink: 0 }} />
            <p className="text-xs leading-relaxed" style={{ color: '#1D4ED8' }}>
              <strong>Looking for the full module guide?</strong>{' '}
              <Link href="/onboarding-guide" className="underline font-semibold">
                Visit the Onboarding Guide
              </Link>{' '}
              for a complete walkthrough of all 9 modules, user journeys, and quick-access shortcuts.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
