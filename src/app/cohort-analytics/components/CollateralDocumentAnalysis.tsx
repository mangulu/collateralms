'use client';
import React, { useState, useEffect } from 'react';
import {
  Brain,
  AlertTriangle,
  TrendingDown,
  Scale,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  Upload,
  Sparkles,
} from 'lucide-react';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskFlag {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  recommendation: string;
}

interface ValuationAnomaly {
  id: string;
  type: string;
  description: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
}

interface LegalExposure {
  area: string;
  risk: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  action: string;
}

interface AnalysisResult {
  summary: string;
  overallRiskScore: number; // 0-100
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskFlags: RiskFlag[];
  valuationAnomalies: ValuationAnomaly[];
  legalExposures: LegalExposure[];
  analysedAt: string;
}

interface DocumentInput {
  name: string;
  type: 'appraisal' | 'legal' | 'title_deed' | 'charge_certificate' | 'other';
  content: string; // text content or description
}

// ─── Sample documents for demo ────────────────────────────────────────────────

const SAMPLE_DOCUMENTS: DocumentInput[] = [
  {
    name: 'Property Appraisal Report – Plot 45, Mikocheni',
    type: 'appraisal',
    content: `VALUATION REPORT
Property: Plot 45, Mikocheni, Dar es Salaam
Appraiser: Tanzanian Valuers Ltd
Date: March 2026
Forced Sale Value: TZS 480,000,000
Open Market Value: TZS 620,000,000
LTV Ratio: 82% (based on loan of TZS 510,000,000)
Last Valuation: September 2024 (TZS 550,000,000)
Methodology: Comparable sales approach
Comparable 1: Plot 43 sold at TZS 580,000,000 (Jan 2026)
Comparable 2: Plot 47 sold at TZS 640,000,000 (Feb 2026)
Note: Property has an unregistered extension built in 2023. Title deed does not reflect current structure. Occupancy status: Partially tenanted with informal lease agreements. Environmental note: Located within 50m of drainage channel.`,
  },
  {
    name: 'Legal Charge Document – Loan #LN-2024-0892',
    type: 'legal',
    content: `DEED OF CHARGE
Borrower: Mwangi Trading Co. Ltd
Lender: National Microfinance Bank
Loan Amount: TZS 510,000,000
Security: Plot 45, Mikocheni (Title No. DSM/MKC/45/2019)
Date of Charge: 15 January 2025
Registration Status: Pending registration at MLHHSD
Charge Type: Fixed charge over immovable property
Guarantor: John Mwangi (Personal guarantee – unlimited)
Covenant: Borrower shall maintain insurance. Insurance policy expired December 2025 and has not been renewed.
Cross-default clause: Linked to Loan #LN-2023-0445 (currently 60 days overdue)
Restriction: Property cannot be sold without lender consent. However, informal tenancy agreements exist that may create third-party rights.
Legal counsel: Mwangi & Associates (related party – same surname as borrower)`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(severity: RiskFlag['severity'] | LegalExposure['severity']) {
  return {
    critical: { badge: 'bg-red-700 text-white', border: 'border-red-200 bg-red-50', icon: 'text-red-600' },
    high: { badge: 'bg-orange-600 text-white', border: 'border-orange-200 bg-orange-50', icon: 'text-orange-600' },
    medium: { badge: 'bg-amber-500 text-white', border: 'border-amber-200 bg-amber-50', icon: 'text-amber-600' },
    low: { badge: 'bg-blue-500 text-white', border: 'border-blue-200 bg-blue-50', icon: 'text-blue-600' },
  }[severity];
}

function confidenceColor(confidence: ValuationAnomaly['confidence']) {
  return {
    high: 'text-red-600 bg-red-50 border-red-200',
    medium: 'text-amber-600 bg-amber-50 border-amber-200',
    low: 'text-blue-600 bg-blue-50 border-blue-200',
  }[confidence];
}

function riskScoreColor(score: number) {
  if (score >= 75) return { bar: 'bg-red-600', text: 'text-red-700', label: 'Critical Risk' };
  if (score >= 55) return { bar: 'bg-orange-500', text: 'text-orange-700', label: 'High Risk' };
  if (score >= 35) return { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Medium Risk' };
  return { bar: 'bg-green-500', text: 'text-green-700', label: 'Low Risk' };
}

// ─── AI Analysis Prompt ───────────────────────────────────────────────────────

function buildAnalysisPrompt(documents: DocumentInput[]): string {
  const docText = documents
    .map((d, i) => `--- Document ${i + 1}: ${d.name} (Type: ${d.type}) ---\n${d.content}`)
    .join('\n\n');

  return `You are a senior credit risk analyst at a commercial bank specializing in collateral assessment. Analyze the following collateral documents and provide a structured risk assessment.

${docText}

Respond ONLY with a valid JSON object in this exact structure (no markdown, no explanation outside JSON):
{
  "summary": "2-3 sentence executive summary of overall risk posture",
  "overallRiskScore": <integer 0-100, where 100 is maximum risk>,
  "riskLevel": "<critical|high|medium|low>",
  "riskFlags": [
    {
      "id": "rf1",
      "severity": "<critical|high|medium|low>",
      "category": "<e.g. Valuation|Legal|Compliance|Documentation|Market>",
      "title": "Short flag title",
      "description": "Detailed description of the risk",
      "recommendation": "Specific action recommended for the credit officer"
    }
  ],
  "valuationAnomalies": [
    {
      "id": "va1",
      "type": "<e.g. LTV Breach|Rapid Appreciation|Forced Sale Gap|Comparable Mismatch|Undisclosed Encumbrance>",
      "description": "Description of the anomaly found",
      "impact": "Quantified or qualified impact on collateral value",
      "confidence": "<high|medium|low>"
    }
  ],
  "legalExposures": [
    {
      "area": "<e.g. Title Registration|Insurance|Cross-Default|Third-Party Rights|Related Party>",
      "risk": "Description of the legal exposure",
      "severity": "<critical|high|medium|low>",
      "action": "Required legal action"
    }
  ]
}

Be thorough, specific, and actionable. Identify all material risks visible in the documents.`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskScoreGauge({ score, level }: { score: number; level: string }) {
  const colors = riskScoreColor(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={score >= 75 ? '#dc2626' : score >= 55 ? '#ea580c' : score >= 35 ? '#d97706' : '#16a34a'}
            strokeWidth="10"
            strokeDasharray={`${(score / 100) * 251.2} 251.2`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-700 ${colors.text}`}>{score}</span>
          <span className="text-[9px] text-muted-foreground font-500">/ 100</span>
        </div>
      </div>
      <span className={`text-xs font-700 uppercase tracking-wide ${colors.text}`}>{colors.label}</span>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  count,
  badgeColor,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  badgeColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm font-700 text-foreground">{title}</span>
          <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${badgeColor}`}>{count}</span>
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollateralDocumentAnalysis() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set([0, 1]));
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDoc = (idx: number) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const runAnalysis = async () => {
    const docs: DocumentInput[] = Array.from(selectedDocs).map(i => SAMPLE_DOCUMENTS[i]);
    if (customText.trim()) {
      docs.push({ name: 'Custom Document', type: 'other', content: customText.trim() });
    }
    if (docs.length === 0) {
      toast.error('Select at least one document to analyse');
      return;
    }

    setIsAnalysing(true);
    setError(null);

    try {
      const prompt = buildAnalysisPrompt(docs);
      const response = await getChatCompletion(
        'OPEN_AI',
        'gpt-4o',
        [
          {
            role: 'system',
            content: 'You are a senior credit risk analyst. Always respond with valid JSON only — no markdown fences, no extra text.',
          },
          { role: 'user', content: prompt },
        ],
        { max_tokens: 2000, temperature: 0.2 }
      );

      const raw = response?.choices?.[0]?.message?.content ?? '';
      // Strip markdown fences if present
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned) as Omit<AnalysisResult, 'analysedAt'>;

      setAnalysisResult({
        ...parsed,
        analysedAt: new Date().toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setError(msg);
      toast.error('AI analysis failed. Please try again.');
    } finally {
      setIsAnalysing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Brain size={20} className="text-violet-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground flex items-center gap-2">
                AI Collateral Document Analysis
                <span className="text-[10px] font-700 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 uppercase tracking-wide">
                  Powered by OpenAI
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automated risk flags, valuation anomalies, and legal exposure summary for officer review
              </p>
            </div>
          </div>
          {analysisResult && (
            <span className="text-xs text-muted-foreground shrink-0">
              Last analysed: {analysisResult.analysedAt}
            </span>
          )}
        </div>

        {/* Document Selection */}
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide mb-3">
            Select Documents to Analyse
          </p>
          <div className="space-y-2">
            {SAMPLE_DOCUMENTS.map((doc, idx) => (
              <label
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedDocs.has(idx)
                    ? 'border-violet-300 bg-violet-50'
                    : 'border-border bg-surface/30 hover:bg-surface'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDocs.has(idx)}
                  onChange={() => toggleDoc(idx)}
                  className="mt-0.5 accent-violet-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-sm font-500 text-foreground truncate">{doc.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize mt-0.5 block">
                    {doc.type.replace('_', ' ')}
                  </span>
                </div>
              </label>
            ))}

            {/* Custom document input toggle */}
            <button
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="flex items-center gap-2 text-xs text-violet-600 font-500 hover:text-violet-700 transition-colors mt-1"
            >
              <Upload size={13} />
              {showCustomInput ? 'Hide custom input' : 'Add custom document text'}
            </button>

            {showCustomInput && (
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="Paste document text here (appraisal, legal paper, etc.)..."
                rows={5}
                className="w-full text-xs border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white text-foreground placeholder:text-muted-foreground"
              />
            )}
          </div>

          <button
            onClick={runAnalysis}
            disabled={isAnalysing || (selectedDocs.size === 0 && !customText.trim())}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-600 rounded-lg transition-colors"
            aria-label="Run AI document analysis"
          >
            {isAnalysing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Analysing documents…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Run AI Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
          <XCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-600 text-red-700">Analysis Error</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isAnalysing && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-5/6" />
                <div className="h-3 bg-muted rounded w-4/6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {analysisResult && !isAnalysing && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <RiskScoreGauge score={analysisResult.overallRiskScore} level={analysisResult.riskLevel} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={15} className="text-violet-600" />
                  <h3 className="text-sm font-700 text-foreground">Executive Summary</h3>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{analysisResult.summary}</p>
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-red-500" />
                    {analysisResult.riskFlags.length} risk flag{analysisResult.riskFlags.length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <TrendingDown size={12} className="text-amber-500" />
                    {analysisResult.valuationAnomalies.length} valuation anomal{analysisResult.valuationAnomalies.length !== 1 ? 'ies' : 'y'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Scale size={12} className="text-blue-500" />
                    {analysisResult.legalExposures.length} legal exposure{analysisResult.legalExposures.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Flags */}
          {analysisResult.riskFlags.length > 0 && (
            <CollapsibleSection
              title="Risk Flags"
              icon={<AlertTriangle size={16} className="text-red-500" />}
              count={analysisResult.riskFlags.length}
              badgeColor={`${analysisResult.riskFlags.some(f => f.severity === 'critical') ? 'bg-red-700' : 'bg-orange-600'} text-white`}
            >
              {analysisResult.riskFlags.map(flag => {
                const colors = severityColor(flag.severity);
                return (
                  <div key={flag.id} className={`rounded-lg border p-4 ${colors.border}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className={colors.icon} />
                        <span className="text-sm font-600 text-foreground">{flag.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full uppercase tracking-wide ${colors.badge}`}>
                          {flag.severity}
                        </span>
                        <span className="text-[10px] font-500 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {flag.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{flag.description}</p>
                    <div className="flex items-start gap-1.5 bg-white/70 rounded-md p-2 border border-white">
                      <CheckCircle size={12} className="text-green-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground font-500">{flag.recommendation}</p>
                    </div>
                  </div>
                );
              })}
            </CollapsibleSection>
          )}

          {/* Valuation Anomalies */}
          {analysisResult.valuationAnomalies.length > 0 && (
            <CollapsibleSection
              title="Valuation Anomalies"
              icon={<TrendingDown size={16} className="text-amber-500" />}
              count={analysisResult.valuationAnomalies.length}
              badgeColor="bg-amber-500 text-white"
            >
              {analysisResult.valuationAnomalies.map(anomaly => (
                <div key={anomaly.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} className="text-amber-600" />
                      <span className="text-sm font-600 text-foreground">{anomaly.type}</span>
                    </div>
                    <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full border ${confidenceColor(anomaly.confidence)}`}>
                      {anomaly.confidence} confidence
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5">{anomaly.description}</p>
                  <p className="text-xs font-500 text-amber-800">
                    <span className="font-700">Impact:</span> {anomaly.impact}
                  </p>
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Legal Exposure Summary */}
          {analysisResult.legalExposures.length > 0 && (
            <CollapsibleSection
              title="Legal Exposure Summary"
              icon={<Scale size={16} className="text-blue-500" />}
              count={analysisResult.legalExposures.length}
              badgeColor={`${analysisResult.legalExposures.some(l => l.severity === 'critical') ? 'bg-red-700' : 'bg-blue-600'} text-white`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs" role="table" aria-label="Legal exposure summary table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-600 text-muted-foreground uppercase tracking-wide">Area</th>
                      <th className="text-left py-2 px-3 font-600 text-muted-foreground uppercase tracking-wide">Risk</th>
                      <th className="text-left py-2 px-3 font-600 text-muted-foreground uppercase tracking-wide">Severity</th>
                      <th className="text-left py-2 px-3 font-600 text-muted-foreground uppercase tracking-wide">Required Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisResult.legalExposures.map((exp, i) => {
                      const colors = severityColor(exp.severity);
                      return (
                        <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-white' : 'bg-surface/30'}`}>
                          <td className="py-2.5 px-3 font-600 text-foreground whitespace-nowrap">{exp.area}</td>
                          <td className="py-2.5 px-3 text-muted-foreground max-w-xs">{exp.risk}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full uppercase tracking-wide ${colors.badge}`}>
                              {exp.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-foreground">{exp.action}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Re-run button */}
          <div className="flex justify-end">
            <button
              onClick={runAnalysis}
              disabled={isAnalysing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} />
              Re-run Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
