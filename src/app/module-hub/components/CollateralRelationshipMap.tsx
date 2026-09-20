'use client';
import React from 'react';

// ─── Box layout (viewBox 900x440) ─────────────────────────────────────────────
// Obligor → Loan A / Loan B → collateral pool, with the delivery fleet shared
// by both loans (1st charge for Loan A, 2nd for Loan B) to make the many-to-many
// loan↔collateral relationship concrete rather than abstract. Each column gets
// its own category color (navy / amber / green); the shared collateral breaks
// that column's own color to flag it as the special case.

const SHADOW = { filter: 'drop-shadow(0 1px 2px rgba(16,24,40,0.10))' };

export default function CollateralRelationshipMap() {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl" style={{ backgroundColor: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}>
        <svg width="900" height="440" viewBox="0 0 900 440" role="img" style={{ display: 'block', margin: '0 auto', minWidth: 700 }}
          aria-label="Kilimanjaro Traders, a borrower, has two loans. Loan A is secured by a warehouse and a delivery fleet. Loan B is secured by the same delivery fleet and a fixed deposit. The delivery fleet secures both loans, with Loan A holding first charge and Loan B holding second charge.">
          <defs>
            <marker id="crm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M2 1L8 5L2 9" fill="none" stroke="var(--izou-muted)" strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>

          <rect x={0} y={0} width={900} height={440} rx={14} fill="var(--izou-bg)" />

          <circle cx={95} cy={36} r={3} fill="var(--izou-secondary)" />
          <text x={130} y={36} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', fill: 'var(--izou-secondary)' }}>BORROWER</text>
          <circle cx={420} cy={36} r={3} fill="var(--izou-warning)" />
          <text x={445} y={36} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', fill: 'var(--izou-warning)' }}>LOANS</text>
          <circle cx={725} cy={36} r={3} fill="var(--izou-success)" />
          <text x={770} y={36} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', fill: 'var(--izou-success)' }}>PLEDGED COLLATERAL</text>

          {/* Obligor → loans */}
          <path d="M230 215 C290 215, 290 167, 350 167" fill="none" stroke="var(--izou-muted)" strokeOpacity={0.5} strokeWidth={1.75} markerEnd="url(#crm-arrow)" />
          <path d="M230 245 C290 245, 290 292, 350 292" fill="none" stroke="var(--izou-muted)" strokeOpacity={0.5} strokeWidth={1.75} markerEnd="url(#crm-arrow)" />

          {/* Loans → collateral */}
          <path d="M540 150 C605 150, 605 105, 670 105" fill="none" stroke="var(--izou-muted)" strokeOpacity={0.5} strokeWidth={1.75} markerEnd="url(#crm-arrow)" />
          <path d="M540 184 C605 184, 605 215, 670 215" fill="none" stroke="var(--izou-muted)" strokeOpacity={0.5} strokeWidth={1.75} markerEnd="url(#crm-arrow)" />
          <path d="M540 275 C605 275, 605 245, 670 245" fill="none" stroke="var(--izou-muted)" strokeOpacity={0.5} strokeWidth={1.75} markerEnd="url(#crm-arrow)" />
          <path d="M540 309 C605 309, 605 355, 670 355" fill="none" stroke="var(--izou-muted)" strokeOpacity={0.5} strokeWidth={1.75} markerEnd="url(#crm-arrow)" />

          <rect x={567} y={169} width={76} height={18} rx={9} fill="var(--izou-primary-light)" />
          <text x={605} y={178} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--izou-primary-dark)' }}>1st charge</text>
          <rect x={567} y={273} width={76} height={18} rx={9} fill="var(--izou-primary-light)" />
          <text x={605} y={282} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--izou-primary-dark)' }}>2nd charge</text>

          {/* Obligor */}
          <rect x={30} y={175} width={200} height={110} rx={10} fill="var(--izou-secondary-light)" stroke="var(--izou-secondary)" strokeOpacity={0.55} strokeWidth={1.5} style={SHADOW} />
          <text x={130} y={208} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--izou-text)' }}>Kilimanjaro Traders</text>
          <text x={130} y={230} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fill: 'var(--izou-muted)' }}>Manufacturing obligor</text>
          <text x={130} y={252} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, fill: 'var(--izou-secondary)' }}>2 loan facilities</text>

          {/* Loan A */}
          <rect x={350} y={122} width={190} height={90} rx={10} fill="var(--izou-warning-light)" stroke="var(--izou-warning)" strokeOpacity={0.55} strokeWidth={1.5} style={SHADOW} />
          <text x={445} y={146} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--izou-text)' }}>Loan A</text>
          <text x={445} y={167} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fill: 'var(--izou-muted)' }}>Working capital</text>
          <text x={445} y={188} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, fill: 'var(--izou-secondary)' }}>TZS 800,000,000</text>

          {/* Loan B */}
          <rect x={350} y={247} width={190} height={90} rx={10} fill="var(--izou-warning-light)" stroke="var(--izou-warning)" strokeOpacity={0.55} strokeWidth={1.5} style={SHADOW} />
          <text x={445} y={271} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--izou-text)' }}>Loan B</text>
          <text x={445} y={292} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fill: 'var(--izou-muted)' }}>Trade finance</text>
          <text x={445} y={313} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, fill: 'var(--izou-secondary)' }}>TZS 350,000,000</text>

          {/* Warehouse */}
          <rect x={670} y={60} width={200} height={90} rx={10} fill="var(--izou-success-light)" stroke="var(--izou-success)" strokeOpacity={0.55} strokeWidth={1.5} style={SHADOW} />
          <text x={770} y={84} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--izou-text)' }}>City warehouse</text>
          <text x={770} y={105} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fill: 'var(--izou-muted)' }}>Title deed</text>
          <text x={770} y={126} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, fill: 'var(--izou-success)' }}>Loan A only</text>

          {/* Delivery fleet — shared collateral, breaks the column's own color */}
          <rect x={670} y={185} width={200} height={90} rx={10} fill="var(--izou-primary-light)" stroke="var(--izou-primary)" strokeWidth={2} style={SHADOW} />
          <text x={770} y={209} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--izou-text)' }}>Delivery fleet</text>
          <text x={770} y={230} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fill: 'var(--izou-muted)' }}>Vehicle registration</text>
          <text x={770} y={251} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, fill: 'var(--izou-primary-dark)' }}>Secures both loans</text>

          {/* Fixed deposit */}
          <rect x={670} y={310} width={200} height={90} rx={10} fill="var(--izou-success-light)" stroke="var(--izou-success)" strokeOpacity={0.55} strokeWidth={1.5} style={SHADOW} />
          <text x={770} y={334} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--izou-text)' }}>Fixed deposit</text>
          <text x={770} y={355} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fill: 'var(--izou-muted)' }}>Cash-backed</text>
          <text x={770} y={376} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--izou-success)' }}>Loan B only</text>
        </svg>
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--izou-muted)' }}>
        Kilimanjaro Traders holds two loans; each draws on its own collateral, but the delivery fleet secures both — Loan A with first charge, Loan B with second.
      </p>
    </div>
  );
}
