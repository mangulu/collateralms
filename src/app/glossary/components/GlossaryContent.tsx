'use client';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, BookOpen, ArrowLeft, ChevronRight } from 'lucide-react';

interface GlossaryTerm {
  term: string;
  category: 'Financial' | 'Legal' | 'Workflow' | 'Risk & Compliance' | 'Archive & Custody';
  definition: string;
  relatedTerms?: string[];
}

const TERMS: GlossaryTerm[] = [
  // Financial
  {
    term: 'Collateral',
    category: 'Financial',
    definition: 'An asset pledged by a borrower to a lender as security for a loan. If the borrower defaults, the lender may seize and sell the collateral to recover the outstanding debt.',
    relatedTerms: ['Pledge', 'Security Interest', 'LTV'],
  },
  {
    term: 'Loan-to-Value (LTV)',
    category: 'Financial',
    definition: 'A ratio expressing the loan amount as a percentage of the appraised value of the collateral. A higher LTV indicates greater lender risk. LTV breaches occur when the ratio exceeds a defined threshold.',
    relatedTerms: ['Collateral', 'Valuation', 'LTV Breach'],
  },
  {
    term: 'LTV Breach',
    category: 'Financial',
    definition: 'A condition where the loan-to-value ratio exceeds the maximum permitted threshold, typically triggering an alert, top-up request, or collateral substitution requirement.',
    relatedTerms: ['Loan-to-Value (LTV)', 'Collateral Substitution', 'Alert Threshold'],
  },
  {
    term: 'Valuation',
    category: 'Financial',
    definition: 'The process of determining the current market or forced-sale value of a collateral asset. Valuations are conducted periodically and recorded in the system to maintain accurate LTV calculations.',
    relatedTerms: ['Loan-to-Value (LTV)', 'Revaluation', 'Forced Sale Value'],
  },
  {
    term: 'Forced Sale Value (FSV)',
    category: 'Financial',
    definition: 'The estimated price at which a collateral asset could be sold quickly, typically under distressed conditions. FSV is usually lower than open market value and is used for conservative risk calculations.',
    relatedTerms: ['Valuation', 'Loan-to-Value (LTV)'],
  },
  {
    term: 'Exposure',
    category: 'Financial',
    definition: 'The total outstanding loan amount or credit risk associated with a borrower or a portfolio of collateral. Exposure metrics help assess concentration risk.',
    relatedTerms: ['Obligor', 'Concentration Risk', 'Portfolio'],
  },
  {
    term: 'Covenant',
    category: 'Financial',
    definition: 'A contractual condition in a loan agreement that the borrower must comply with. Covenants may be financial (e.g., maintain a minimum equity ratio) or non-financial (e.g., provide audited accounts annually).',
    relatedTerms: ['Covenant Tracking', 'Breach', 'Loan Facility'],
  },
  {
    term: 'Covenant Breach',
    category: 'Financial',
    definition: 'A failure by the borrower to meet a covenant condition. A breach may trigger remediation actions, penalty clauses, or loan acceleration.',
    relatedTerms: ['Covenant', 'Loan Facility'],
  },
  {
    term: 'Loan Facility',
    category: 'Financial',
    definition: 'A formal credit arrangement between a lender and a borrower specifying the loan amount, tenor, interest rate, repayment schedule, and associated collateral requirements.',
    relatedTerms: ['Obligor', 'Collateral', 'Covenant'],
  },
  {
    term: 'Obligor',
    category: 'Financial',
    definition: 'The party legally obligated to repay a debt. In collateral management, an obligor is the borrower whose credit exposure is secured by one or more collateral assets.',
    relatedTerms: ['Loan Facility', 'Exposure', 'Risk Rating'],
  },
  {
    term: 'Risk Rating',
    category: 'Financial',
    definition: 'A score or classification assigned to an obligor or collateral asset reflecting the assessed level of credit or market risk. Ratings range from low risk to high risk and influence monitoring frequency.',
    relatedTerms: ['Obligor', 'Exposure', 'Risk Assessment'],
  },
  {
    term: 'Concentration Risk',
    category: 'Financial',
    definition: 'The risk arising from excessive exposure to a single obligor, collateral type, sector, or geographic region. High concentration can amplify losses if that segment deteriorates.',
    relatedTerms: ['Exposure', 'Portfolio Monitoring', 'Collateral Type'],
  },
  {
    term: 'Collateral Substitution',
    category: 'Financial',
    definition: 'The replacement of an existing collateral asset with a new one of equivalent or greater value, typically initiated when the original asset no longer meets coverage requirements.',
    relatedTerms: ['Collateral', 'LTV Breach', 'Perfection'],
  },
  {
    term: 'Insurance Tracking',
    category: 'Financial',
    definition: 'The monitoring of insurance policies covering collateral assets to ensure continuous coverage, timely renewal, and adequate insured value relative to the loan outstanding.',
    relatedTerms: ['Collateral', 'Deadline Reminders'],
  },
  // Legal
  {
    term: 'Perfection',
    category: 'Legal',
    definition: 'The legal process of making a security interest enforceable against third parties. Perfection typically involves registration with a relevant authority (e.g., land registry, BRELA) and ensures the lender\'s priority claim over the collateral.',
    relatedTerms: ['Security Interest', 'Registration', 'Charge'],
  },
  {
    term: 'Security Interest',
    category: 'Legal',
    definition: 'A legal right granted by a borrower to a lender over a collateral asset, giving the lender the ability to take possession or sell the asset in the event of default.',
    relatedTerms: ['Perfection', 'Pledge', 'Charge', 'Mortgage'],
  },
  {
    term: 'Pledge',
    category: 'Legal',
    definition: 'A form of security interest where the borrower delivers possession of an asset to the lender as collateral. The lender holds the asset until the debt is repaid.',
    relatedTerms: ['Security Interest', 'Collateral', 'Pledge Documents'],
  },
  {
    term: 'Charge',
    category: 'Legal',
    definition: 'A legal claim over an asset as security for a debt, without transferring possession. A fixed charge applies to specific assets; a floating charge covers a class of assets that may change over time.',
    relatedTerms: ['Security Interest', 'Mortgage', 'Debenture'],
  },
  {
    term: 'Mortgage',
    category: 'Legal',
    definition: 'A security interest over real property (land or buildings) where the borrower retains possession but the lender holds a legal or equitable interest until the loan is repaid.',
    relatedTerms: ['Charge', 'Security Interest', 'Land Registry'],
  },
  {
    term: 'Debenture',
    category: 'Legal',
    definition: 'A document that creates or acknowledges a debt and grants a charge (fixed and/or floating) over the assets of a company as security for that debt.',
    relatedTerms: ['Charge', 'Security Interest'],
  },
  {
    term: 'Encumbrance',
    category: 'Legal',
    definition: 'Any claim, lien, charge, or liability attached to a collateral asset that may affect its value or transferability. Encumbrances must be disclosed and assessed during collateral intake.',
    relatedTerms: ['Charge', 'Lien', 'Title Search'],
  },
  {
    term: 'Lien',
    category: 'Legal',
    definition: 'A legal right or claim against an asset, typically used as security for a debt. A lien prevents the asset from being sold or transferred until the underlying obligation is satisfied.',
    relatedTerms: ['Encumbrance', 'Security Interest'],
  },
  {
    term: 'Legal Sign-Off',
    category: 'Legal',
    definition: 'Formal approval by a legal officer confirming that all legal documentation for a collateral record is complete, valid, and enforceable. Required before a collateral record can be fully perfected.',
    relatedTerms: ['Perfection', 'Document Approval', 'Legal Officer'],
  },
  {
    term: 'Title Search',
    category: 'Legal',
    definition: 'An examination of public records to verify the legal ownership of a property and identify any existing encumbrances, liens, or claims that may affect the collateral.',
    relatedTerms: ['Encumbrance', 'Mortgage', 'Land Registry'],
  },
  {
    term: 'BRELA',
    category: 'Legal',
    definition: 'Business Registrations and Licensing Agency — the Tanzanian government body responsible for registering companies, business names, and intellectual property. Collateral over company assets may require BRELA registration.',
    relatedTerms: ['Perfection', 'Registration', 'Charge'],
  },
  {
    term: 'Pledge Documents',
    category: 'Legal',
    definition: 'Legal instruments that formalise a pledge arrangement, including the pledge agreement, board resolutions (for corporate pledgors), and any supporting schedules listing the pledged assets.',
    relatedTerms: ['Pledge', 'Security Interest', 'Legal Sign-Off'],
  },
  // Workflow
  {
    term: 'Perfection Workflow',
    category: 'Workflow',
    definition: 'A structured sequence of tasks and approvals that must be completed to legally perfect a collateral security interest. Steps typically include document collection, legal review, registration, and sign-off.',
    relatedTerms: ['Perfection', 'Workflow Stage', 'Legal Sign-Off'],
  },
  {
    term: 'Workflow Stage',
    category: 'Workflow',
    definition: 'A discrete step within a workflow process, each with defined responsible parties, required actions, and completion criteria. Stages advance sequentially or in parallel depending on the workflow template.',
    relatedTerms: ['Perfection Workflow', 'Workflow Template', 'Escalation'],
  },
  {
    term: 'Workflow Template',
    category: 'Workflow',
    definition: 'A reusable blueprint defining the stages, assignees, trigger conditions, and escalation rules for a particular type of workflow (e.g., perfection, valuation, release).',
    relatedTerms: ['Workflow Stage', 'Trigger Rule', 'Escalation'],
  },
  {
    term: 'Trigger Rule',
    category: 'Workflow',
    definition: 'A condition-based rule that automatically initiates a workflow or sends a notification when specific criteria are met (e.g., LTV exceeds 80%, insurance expires within 30 days).',
    relatedTerms: ['Workflow Template', 'Alert Threshold', 'Automation'],
  },
  {
    term: 'Escalation',
    category: 'Workflow',
    definition: 'The automatic or manual elevation of a task or approval to a higher authority when it has not been completed within a defined time limit or when a critical condition is detected.',
    relatedTerms: ['Workflow Stage', 'Trigger Rule', 'SLA'],
  },
  {
    term: 'SLA (Service Level Agreement)',
    category: 'Workflow',
    definition: 'A defined time limit within which a task or workflow stage must be completed. Breaching an SLA typically triggers an escalation or alert.',
    relatedTerms: ['Escalation', 'Deadline Reminders', 'Workflow Stage'],
  },
  {
    term: 'Approval Inbox',
    category: 'Workflow',
    definition: 'A centralised queue where pending approval requests (perfection, document, release, archive) are presented to the appropriate approver for action.',
    relatedTerms: ['Workflow Stage', 'Legal Sign-Off', 'Release Approval'],
  },
  {
    term: 'Release Approval',
    category: 'Workflow',
    definition: 'The formal authorisation process for releasing a collateral asset from its security arrangement, typically following full loan repayment or substitution with equivalent collateral.',
    relatedTerms: ['Collateral Substitution', 'Approval Inbox', 'Legal Sign-Off'],
  },
  {
    term: 'Batch Release',
    category: 'Workflow',
    definition: 'The simultaneous processing of multiple collateral release requests in a single operation, used to improve efficiency when releasing collateral across a portfolio of settled loans.',
    relatedTerms: ['Release Approval', 'Collateral'],
  },
  {
    term: 'Fast-Track',
    category: 'Workflow',
    definition: 'An expedited processing path for collateral records that meet predefined low-risk criteria, allowing them to bypass standard workflow stages and reach perfection more quickly.',
    relatedTerms: ['Perfection Workflow', 'Workflow Stage', 'Risk Rating'],
  },
  // Risk & Compliance
  {
    term: 'Alert Threshold',
    category: 'Risk & Compliance',
    definition: 'A configurable limit that, when breached, triggers an automated alert or notification. Common thresholds include LTV ratios, insurance expiry days, and covenant review dates.',
    relatedTerms: ['LTV Breach', 'Trigger Rule', 'Deadline Reminders'],
  },
  {
    term: 'Compliance Audit',
    category: 'Risk & Compliance',
    definition: 'A systematic review of collateral records, workflows, and documentation to verify adherence to internal policies, regulatory requirements, and legal standards.',
    relatedTerms: ['Audit Trail', 'Compliance Rules', 'Regulatory Submission'],
  },
  {
    term: 'Audit Trail',
    category: 'Risk & Compliance',
    definition: 'A chronological record of all actions, changes, and approvals made to a collateral record or system entity. Audit trails provide accountability and support regulatory examination.',
    relatedTerms: ['Compliance Audit', 'Audit Log', 'Change History'],
  },
  {
    term: 'Fraud Prevention',
    category: 'Risk & Compliance',
    definition: 'Controls and monitoring mechanisms designed to detect and prevent fraudulent collateral submissions, including duplicate asset detection, valuation anomaly flags, and document authenticity checks.',
    relatedTerms: ['Audit Trail', 'Risk Assessment', 'Compliance Audit'],
  },
  {
    term: 'Regulatory Submission',
    category: 'Risk & Compliance',
    definition: 'The formal filing of collateral or loan data with a regulatory authority (e.g., Bank of Tanzania) as required by law. The system tracks submission status, deadlines, and acknowledgements.',
    relatedTerms: ['Compliance Audit', 'Compliance Rules', 'Reporting'],
  },
  {
    term: 'Compliance Rules',
    category: 'Risk & Compliance',
    definition: 'Configurable policy rules that define mandatory requirements for collateral records (e.g., required document types, minimum valuation frequency, insurance coverage minimums).',
    relatedTerms: ['Compliance Audit', 'Alert Threshold', 'Document Types'],
  },
  {
    term: 'Geomapping',
    category: 'Risk & Compliance',
    definition: 'The process of validating and visualising the geographic location of collateral assets on a map. Address matching scores (EXACT, PARTIAL, MISMATCH) are computed to flag discrepancies between obligor and collateral addresses.',
    relatedTerms: ['Collateral', 'Obligor', 'Address Validation'],
  },
  {
    term: 'Cohort Analytics',
    category: 'Risk & Compliance',
    definition: 'Analysis of collateral records grouped by shared characteristics (e.g., collateral type, origination period, risk rating) to identify trends, performance patterns, and portfolio vulnerabilities.',
    relatedTerms: ['Portfolio Monitoring', 'Concentration Risk', 'Reporting'],
  },
  // Archive & Custody
  {
    term: 'Archive',
    category: 'Archive & Custody',
    definition: 'The physical or digital repository where original collateral documents and instruments are stored. The archive module manages vault slots, custody tracking, and document retrieval workflows.',
    relatedTerms: ['Vault', 'Chain of Custody', 'Custody Tracker'],
  },
  {
    term: 'Vault',
    category: 'Archive & Custody',
    definition: 'A secure physical storage unit within the archive facility, divided into slots. Each vault slot is assigned to specific collateral documents and tracked for occupancy and access history.',
    relatedTerms: ['Archive', 'Vault Slot', 'Occupancy Heatmap'],
  },
  {
    term: 'Vault Slot',
    category: 'Archive & Custody',
    definition: 'An individual storage position within a vault, identified by a unique reference. Vault slots are assigned to collateral records and tracked for placement, retrieval, and return events.',
    relatedTerms: ['Vault', 'Archive', 'Chain of Custody'],
  },
  {
    term: 'Chain of Custody',
    category: 'Archive & Custody',
    definition: 'A documented record of every person who has handled a collateral document or asset, including dates and reasons for each transfer. Maintains the integrity and admissibility of physical evidence.',
    relatedTerms: ['Archive', 'Custody Tracker', 'Audit Trail'],
  },
  {
    term: 'Custody Tracker',
    category: 'Archive & Custody',
    definition: 'A system feature that monitors the current location and status of physical collateral documents, tracking movements between vault, officer desks, and external parties.',
    relatedTerms: ['Chain of Custody', 'Archive', 'Vault Slot'],
  },
  {
    term: 'File Loan',
    category: 'Archive & Custody',
    definition: 'A temporary withdrawal of physical collateral documents from the archive for review or legal proceedings, subject to an approved request workflow and mandatory return deadline.',
    relatedTerms: ['Archive', 'Custody Tracker', 'Request Workflow'],
  },
  {
    term: 'Occupancy Heatmap',
    category: 'Archive & Custody',
    definition: 'A visual representation of vault utilisation, showing which slots are occupied, available, or reserved. Helps archive managers plan capacity and identify storage bottlenecks.',
    relatedTerms: ['Vault', 'Archive', 'Vault Slot'],
  },
];

const CATEGORIES = ['All', 'Financial', 'Legal', 'Workflow', 'Risk & Compliance', 'Archive & Custody'] as const;
type CategoryFilter = typeof CATEGORIES[number];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Financial: { bg: '#e8f8fd', text: '#007CB3', border: '#9be1f7' },
  Legal: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  Workflow: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  'Risk & Compliance': { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
  'Archive & Custody': { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
};

export default function GlossaryContent() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return TERMS.filter((t) => {
      const matchesSearch =
        !search ||
        t.term.toLowerCase().includes(search.toLowerCase()) ||
        t.definition.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
      const matchesLetter = !activeLetter || t.term.toUpperCase().startsWith(activeLetter);
      return matchesSearch && matchesCategory && matchesLetter;
    }).sort((a, b) => a.term.localeCompare(b.term));
  }, [search, activeCategory, activeLetter]);

  const availableLetters = useMemo(() => {
    const letters = new Set(TERMS.map((t) => t.term[0].toUpperCase()));
    return Array.from(letters).sort();
  }, []);

  const groupedByLetter = useMemo(() => {
    const groups: Record<string, GlossaryTerm[]> = {};
    filtered.forEach((t) => {
      const letter = t.term[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(t);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--izou-bg)' }}>
      {/* Header */}
      <div
        className="px-6 py-5 flex items-center gap-4"
        style={{ backgroundColor: 'var(--izou-card)', borderBottom: '1px solid var(--izou-border)' }}
      >
        <Link
          href="/module-hub"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors shrink-0"
          style={{ color: 'var(--izou-text-muted)', border: '1px solid var(--izou-border)' }}
          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--izou-primary)'; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--izou-text-muted)'; }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--izou-primary-light)' }}
          >
            <BookOpen size={18} style={{ color: 'var(--izou-primary)' }} />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--izou-text)' }}>
              Glossary of Terms
            </h1>
            <p className="text-xs leading-tight" style={{ color: 'var(--izou-text-muted)' }}>
              Financial and legal terminology used across CollateralMS
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-primary)' }}>
          {TERMS.length} terms
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--izou-text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveLetter(null); }}
            placeholder="Search terms or definitions…"
            className="w-full h-11 pl-9 pr-4 rounded-xl text-sm outline-none transition focus:ring-2"
            style={{
              backgroundColor: 'var(--izou-card)',
              border: '1px solid var(--izou-border)',
              color: 'var(--izou-text)',
            }}
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            const colors = cat !== 'All' ? CATEGORY_COLORS[cat] : null;
            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setActiveLetter(null); }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={
                  isActive
                    ? {
                        backgroundColor: colors ? colors.bg : 'var(--izou-primary)',
                        color: colors ? colors.text : '#fff',
                        border: `1px solid ${colors ? colors.border : 'var(--izou-primary)'}`,
                      }
                    : {
                        backgroundColor: 'var(--izou-card)',
                        color: 'var(--izou-text-muted)',
                        border: '1px solid var(--izou-border)',
                      }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Alphabet index */}
        {!search && (
          <div className="flex flex-wrap gap-1">
            {availableLetters.map((letter) => (
              <button
                key={letter}
                onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
                className="w-7 h-7 rounded-lg text-xs font-bold transition-colors"
                style={
                  activeLetter === letter
                    ? { backgroundColor: 'var(--izou-primary)', color: '#fff' }
                    : { backgroundColor: 'var(--izou-card)', color: 'var(--izou-text-muted)', border: '1px solid var(--izou-border)' }
                }
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        {(search || activeLetter || activeCategory !== 'All') && (
          <p className="text-xs" style={{ color: 'var(--izou-text-muted)' }}>
            Showing <span className="font-semibold" style={{ color: 'var(--izou-text)' }}>{filtered.length}</span> term{filtered.length !== 1 ? 's' : ''}
            {search && <> matching &ldquo;<span className="font-semibold" style={{ color: 'var(--izou-primary)' }}>{search}</span>&rdquo;</>}
          </p>
        )}

        {/* Terms grouped by letter */}
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ backgroundColor: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
          >
            <BookOpen size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--izou-text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--izou-text)' }}>No terms found</p>
            <p className="text-xs mt-1" style={{ color: 'var(--izou-text-muted)' }}>Try a different search or filter</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByLetter).map(([letter, terms]) => (
              <div key={letter}>
                {/* Letter divider */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                    style={{ backgroundColor: 'var(--izou-primary)', color: '#fff' }}
                  >
                    {letter}
                  </div>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--izou-border)' }} />
                </div>

                {/* Terms in this letter group */}
                <div className="space-y-3">
                  {terms.map((term) => {
                    const colors = CATEGORY_COLORS[term.category];
                    return (
                      <div
                        key={term.term}
                        className="rounded-xl p-4 transition-shadow"
                        style={{
                          backgroundColor: 'var(--izou-card)',
                          border: '1px solid var(--izou-border)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="text-sm font-bold leading-snug" style={{ color: 'var(--izou-text)' }}>
                            {term.term}
                          </h3>
                          <span
                            className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                          >
                            {term.category}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--izou-text-muted)' }}>
                          {term.definition}
                        </p>
                        {term.relatedTerms && term.relatedTerms.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--izou-border)' }}>
                            <span className="text-xs" style={{ color: 'var(--izou-text-muted)' }}>See also:</span>
                            {term.relatedTerms.map((rel) => (
                              <button
                                key={rel}
                                onClick={() => { setSearch(rel); setActiveLetter(null); setActiveCategory('All'); }}
                                className="inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
                                style={{ color: 'var(--izou-primary)' }}
                              >
                                {rel}
                                <ChevronRight size={10} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        <p className="text-xs text-center pb-4" style={{ color: 'var(--izou-text-muted)' }}>
          Definitions reflect standard usage within CollateralMS and may vary by institution or jurisdiction.
        </p>
      </div>
    </div>
  );
}
