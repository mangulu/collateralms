'use client';
import React from 'react';
import WorkflowDrawer from './WorkflowDrawer';
import { resolvePageHelpSteps, type PageHelpContent } from '@/lib/pageHelp';

interface PageHelpDrawerProps {
  open: boolean;
  onClose: () => void;
  content: PageHelpContent | null;
  role: string | null | undefined;
}

export default function PageHelpDrawer({ open, onClose, content, role }: PageHelpDrawerProps) {
  if (!content) return null;
  const steps = resolvePageHelpSteps(content, role);

  return (
    <WorkflowDrawer open={open} onClose={onClose} title="Page Help" subtitle={content.title}>
      <div className="p-5 overflow-y-auto space-y-4">
        <p className="text-sm text-foreground leading-relaxed">{content.narrative}</p>
        {steps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              How to use this page
            </p>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </WorkflowDrawer>
  );
}
