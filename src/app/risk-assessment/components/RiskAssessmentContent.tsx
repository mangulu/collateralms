'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, Clock, Fingerprint, RefreshCw, ChevronDown, ChevronUp, Brain, CheckCircle2, Loader2, Search, FileText, TrendingUp, Calendar, Building2, BadgeAlert, Info,  } from 'lucide-react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';


// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR';

interface RiskDimension {
  id: string;
  label: string;
  icon: React.ElementType;
  score: number | null;
  level: RiskLevel | null;
  summary: string;
  findings: string[];
  recommendations: string[];
}

interface AssessmentInput {
  collateralId: string;
  collateralType: string;
  obligor: string;
  valueTSh: string;
  registry: string;
  registrationDate: string;
  perfectionDeadline: string;
  status: string;
  titleDeedNumber: string;
  valuationSource: string;
  additionalNotes: string;
}

interface ParsedAssessment {
  overallScore: number;
  overallLevel: RiskLevel;
  executiveSummary: string;
  perfectionRisk: {
    score: number;
    level: RiskLevel;
    summary: string;
    findings: string[];
    recommendations: string[];
  };
  brelaDeadlineRisk: {
    score: number;
    level: RiskLevel;
    summary: string;
    findings: string[];
    recommendations: string[];
  };
  fraudIndicators: {
    score: number;
    level: RiskLevel;
    summary: string;
    findings: string[];
    recommendations: string[];
  };
}

interface LiveCollateralOption {
  collateralId: string;
  collateralType: string;
  obligor: string;
  valueTSh: string;
  registry: string;
  registrationDate: string;
  perfectionDeadline: string;
  status: string;
  titleDeedNumber: string;
  valuationSource: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const riskLevelConfig: Record<RiskLevel, { label: string; color: string; bg: string; border: string; dot: string; barColor: string }> = {
  HIGH:   { label: 'High Risk',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   dot: 'bg-red-500',    barColor: 'bg-red-500' },
  MEDIUM: { label: 'Medium Risk', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-500',  barColor: 'bg-amber-500' },
  LOW:    { label: 'Low Risk',    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  dot: 'bg-blue-400',   barColor: 'bg-blue-400' },
  CLEAR:  { label: 'Clear',       color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-500',  barColor: 'bg-green-500' },
};

function scoreToLevel(score: number): RiskLevel {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 15) return 'LOW';
  return 'CLEAR';
}

function RiskScoreGauge({ score, level }: { score: number; level: RiskLevel }) {
  const cfg = riskLevelConfig[level];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="40" cy="40" r="32" fill="none"
            stroke={level === 'HIGH' ? '#ef4444' : level === 'MEDIUM' ? '#f59e0b' : level === 'LOW' ? '#60a5fa' : '#22c55e'}
            strokeWidth="8"
            strokeDasharray={`${(score / 100) * 201} 201`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-700 tabular-nums ${cfg.color}`}>{score}</span>
        </div>
      </div>
      <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
    </div>
  );
}

function RiskDimensionCard({ dim, expanded, onToggle }: {
  dim: RiskDimension;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (dim.score === null || dim.level === null) {
    return (
      <div className="rounded-xl border border-border bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <dim.icon size={20} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-600 text-foreground">{dim.label}</p>
            <p className="text-xs text-muted-foreground">Awaiting analysis</p>
          </div>
        </div>
      </div>
    );
  }

  const cfg = riskLevelConfig[dim.level];

  return (
    <div className={`rounded-xl border shadow-card bg-white overflow-hidden ${cfg.border}`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-5 flex items-start gap-4 hover:bg-muted/30 transition-colors"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
          <dim.icon size={20} className={cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-600 text-foreground">{dim.label}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                {cfg.label}
              </span>
              <span className={`text-sm font-700 tabular-nums ${cfg.color}`}>{dim.score}/100</span>
              {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full ${cfg.barColor} transition-all duration-500`} style={{ width: `${dim.score}%` }} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{dim.summary}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border bg-muted/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div>
              <p className="text-xs font-700 text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500" /> Findings
              </p>
              <ul className="space-y-1.5">
                {dim.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-700 text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-green-500" /> Recommendations
              </p>
              <ul className="space-y-1.5">
                {dim.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-green-400" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a senior collateral risk analyst at EXIM Bank Tanzania. Your role is to assess collateral records for three specific risk dimensions:

1. PERFECTION RISK — Has the collateral been properly perfected (legally registered and enforceable)? Consider: status, registry type, registration completeness, missing steps.
2. BRELA DEADLINE RISK — For BRELA-registered collateral (debentures, charges), is the perfection deadline at risk? Consider: days remaining, current status, registration date vs deadline.
3. FRAUD INDICATORS — Are there signs of potential fraud or misrepresentation? Consider: valuation source, title deed patterns, obligor profile, collateral type anomalies.

Respond ONLY with a valid JSON object in this exact structure (no markdown, no explanation):
{
  "overallScore": <0-100>,
  "overallLevel": "<HIGH|MEDIUM|LOW|CLEAR>",
  "executiveSummary": "<2-3 sentence summary>",
  "perfectionRisk": {
    "score": <0-100>,
    "level": "<HIGH|MEDIUM|LOW|CLEAR>",
    "summary": "<1-2 sentence summary>",
    "findings": ["<finding 1>", "<finding 2>", "<finding 3>"],
    "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"]
  },
  "brelaDeadlineRisk": {
    "score": <0-100>,
    "level": "<HIGH|MEDIUM|LOW|CLEAR>",
    "summary": "<1-2 sentence summary>",
    "findings": ["<finding 1>", "<finding 2>", "<finding 3>"],
    "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"]
  },
  "fraudIndicators": {
    "score": <0-100>,
    "level": "<HIGH|MEDIUM|LOW|CLEAR>",
    "summary": "<1-2 sentence summary>",
    "findings": ["<finding 1>", "<finding 2>", "<finding 3>"],
    "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"]
  }
}

Score guide: 0-14 = CLEAR, 15-39 = LOW, 40-69 = MEDIUM, 70-100 = HIGH.
Be specific and reference the actual collateral data provided. Today's date is ${new Date().toISOString().split('T')[0]}.`;
}

function buildUserPrompt(input: AssessmentInput): string {
  const today = new Date();
  const deadline = new Date(input.perfectionDeadline);
  const daysToDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return `Assess the following collateral record:

Collateral ID: ${input.collateralId}
Type: ${input.collateralType}
Obligor: ${input.obligor}
Value (TSh): ${input.valueTSh}
Registry: ${input.registry}
Registration Date: ${input.registrationDate}
Perfection Deadline: ${input.perfectionDeadline} (${daysToDeadline > 0 ? `${daysToDeadline} days remaining` : `${Math.abs(daysToDeadline)} days OVERDUE`})
Current Status: ${input.status}
Title/Reference Number: ${input.titleDeedNumber}
Valuation Source: ${input.valuationSource}
Additional Notes: ${input.additionalNotes || 'None'}

Provide a comprehensive risk assessment covering all three dimensions.`;
}

function parseAssessment(raw: string): ParsedAssessment | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as ParsedAssessment;
  } catch {
    return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RiskAssessmentContent() {
  const { hasPermission, loading: permsLoading } = usePermissions();

  const [selectedCollateralId, setSelectedCollateralId] = useState('');
  const [customInput, setCustomInput] = useState<AssessmentInput>({
    collateralId: '',
    collateralType: '',
    obligor: '',
    valueTSh: '',
    registry: '',
    registrationDate: '',
    perfectionDeadline: '',
    status: '',
    titleDeedNumber: '',
    valuationSource: '',
    additionalNotes: '',
  });
  const [useCustom, setUseCustom] = useState(false);
  const [assessment, setAssessment] = useState<ParsedAssessment | null>(null);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<Array<{ id: string; collateralId: string; level: RiskLevel; score: number; timestamp: string }>>([]);

  // Live collateral options from Supabase
  const [liveCollaterals, setLiveCollaterals] = useState<LiveCollateralOption[]>([]);
  const [collateralsLoading, setCollateralsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('collateral_records')
      .select('collateral_id, collateral_type, obligor, value_tsh, registry, registration_date, perfection_deadline, status, facility_id')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setLiveCollaterals(data.map((row: any) => ({
            collateralId: row.collateral_id,
            collateralType: row.collateral_type ?? '',
            obligor: row.obligor ?? '',
            valueTSh: row.value_tsh ?? '0',
            registry: row.registry ?? '',
            registrationDate: row.registration_date ?? '',
            perfectionDeadline: row.perfection_deadline ?? '',
            status: row.status ?? '',
            titleDeedNumber: row.collateral_id,
            valuationSource: 'Internal Valuation',
          })));
        }
        setCollateralsLoading(false);
      })
      .catch(() => setCollateralsLoading(false));
  }, []);

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-5', false);

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  useEffect(() => {
    if (response && !isLoading) {
      const parsed = parseAssessment(response);
      if (parsed) {
        setAssessment(parsed);
        const input = getActiveInput();
        setAssessmentHistory(prev => [
          { id: `ASS-${Date.now()}`, collateralId: input.collateralId, level: parsed.overallLevel, score: parsed.overallScore, timestamp: new Date().toISOString() },
          ...prev.slice(0, 4),
        ]);
        toast.success('Risk assessment complete');
      } else {
        toast.error('Could not parse AI response. Please try again.');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, isLoading]);

  const getActiveInput = useCallback((): AssessmentInput => {
    if (useCustom) return customInput;
    const found = liveCollaterals.find(c => c.collateralId === selectedCollateralId);
    if (!found) return customInput;
    return {
      collateralId: found.collateralId,
      collateralType: found.collateralType,
      obligor: found.obligor,
      valueTSh: found.valueTSh,
      registry: found.registry,
      registrationDate: found.registrationDate,
      perfectionDeadline: found.perfectionDeadline,
      status: found.status,
      titleDeedNumber: found.titleDeedNumber,
      valuationSource: found.valuationSource,
      additionalNotes: '',
    };
  }, [useCustom, customInput, selectedCollateralId, liveCollaterals]);

  const handleCollateralSelect = (id: string) => {
    setSelectedCollateralId(id);
    setAssessment(null);
    setExpandedDim(null);
  };

  const handleRunAssessment = () => {
    const input = getActiveInput();
    if (!input.collateralId) {
      toast.error('Please select or enter a collateral record first.');
      return;
    }
    setAssessment(null);
    setExpandedDim(null);
    sendMessage([
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(input) },
    ], { max_completion_tokens: 1500 });
  };

  const dimensions: RiskDimension[] = [
    {
      id: 'perfection',
      label: 'Perfection Risk',
      icon: ShieldCheck,
      score: assessment?.perfectionRisk?.score ?? null,
      level: assessment?.perfectionRisk?.level ?? null,
      summary: assessment?.perfectionRisk?.summary ?? '',
      findings: assessment?.perfectionRisk?.findings ?? [],
      recommendations: assessment?.perfectionRisk?.recommendations ?? [],
    },
    {
      id: 'brela',
      label: 'BRELA Deadline Risk',
      icon: Calendar,
      score: assessment?.brelaDeadlineRisk?.score ?? null,
      level: assessment?.brelaDeadlineRisk?.level ?? null,
      summary: assessment?.brelaDeadlineRisk?.summary ?? '',
      findings: assessment?.brelaDeadlineRisk?.findings ?? [],
      recommendations: assessment?.brelaDeadlineRisk?.recommendations ?? [],
    },
    {
      id: 'fraud',
      label: 'Fraud Indicators',
      icon: Fingerprint,
      score: assessment?.fraudIndicators?.score ?? null,
      level: assessment?.fraudIndicators?.level ?? null,
      summary: assessment?.fraudIndicators?.summary ?? '',
      findings: assessment?.fraudIndicators?.findings ?? [],
      recommendations: assessment?.fraudIndicators?.recommendations ?? [],
    },
  ];

  if (!permsLoading && !hasPermission(PERMISSIONS.COMPLIANCE_VIEW)) {
    return <AccessDenied />;
  }

  const activeInput = getActiveInput();

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-700 text-foreground flex items-center gap-2">
              <Brain size={24} className="text-primary" />
              AI Risk Assessment
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              OpenAI-powered analysis of perfection risk, BRELA deadline risk, and fraud indicators
            </p>
          </div>
          {assessmentHistory.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Last assessed</p>
              <p className="text-xs font-600 text-foreground">{assessmentHistory[0].collateralId}</p>
            </div>
          )}
        </div>

        {/* ── Input Panel ── */}
        <div className="rounded-xl border border-border bg-white shadow-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Collateral Input</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setUseCustom(false); setAssessment(null); }}
                className={`text-xs px-3 py-1.5 rounded-lg font-600 transition-colors ${!useCustom ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                Select Record
              </button>
              <button
                onClick={() => { setUseCustom(true); setAssessment(null); }}
                className={`text-xs px-3 py-1.5 rounded-lg font-600 transition-colors ${useCustom ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                Manual Entry
              </button>
            </div>
          </div>

          {!useCustom ? (
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5">Select Collateral Record</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={selectedCollateralId}
                  onChange={(e) => handleCollateralSelect(e.target.value)}
                  disabled={collateralsLoading}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
                >
                  <option value="">{collateralsLoading ? 'Loading collateral records…' : '— Choose a collateral record —'}</option>
                  {liveCollaterals.map(c => (
                    <option key={c.collateralId} value={c.collateralId}>
                      {c.collateralId} — {c.obligor} ({c.collateralType})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCollateralId && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Type', value: activeInput.collateralType, icon: FileText },
                    { label: 'Obligor', value: activeInput.obligor, icon: Building2 },
                    { label: 'Value (TSh)', value: activeInput.valueTSh, icon: TrendingUp },
                    { label: 'Registry', value: activeInput.registry, icon: BadgeAlert },
                    { label: 'Status', value: activeInput.status, icon: Info },
                    { label: 'Deadline', value: activeInput.perfectionDeadline, icon: Clock },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-muted/40 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={12} className="text-muted-foreground" />
                        <p className="text-xs text-muted-foreground font-600">{label}</p>
                      </div>
                      <p className="text-xs font-600 text-foreground truncate">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'collateralId', label: 'Collateral ID', placeholder: 'COL-2024-XXXX' },
                { key: 'collateralType', label: 'Collateral Type', placeholder: 'e.g. Mortgage, Debenture' },
                { key: 'obligor', label: 'Obligor Name', placeholder: 'Company or individual name' },
                { key: 'valueTSh', label: 'Value (TSh)', placeholder: 'e.g. 500,000,000' },
                { key: 'registry', label: 'Registry', placeholder: 'e.g. BRELA, Lands Registry' },
                { key: 'titleDeedNumber', label: 'Title / Reference No.', placeholder: 'e.g. TD-00123' },
                { key: 'registrationDate', label: 'Registration Date', placeholder: 'YYYY-MM-DD' },
                { key: 'perfectionDeadline', label: 'Perfection Deadline', placeholder: 'YYYY-MM-DD' },
                { key: 'status', label: 'Current Status', placeholder: 'e.g. Draft, Submitted, Perfected' },
                { key: 'valuationSource', label: 'Valuation Source', placeholder: 'e.g. External Valuer — ABC Ltd' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">{label}</label>
                  <input
                    type="text"
                    value={customInput[key as keyof AssessmentInput]}
                    onChange={(e) => setCustomInput(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="block text-xs font-600 text-muted-foreground mb-1.5">Additional Notes (optional)</label>
                <textarea
                  value={customInput.additionalNotes}
                  onChange={(e) => setCustomInput(prev => ({ ...prev, additionalNotes: e.target.value }))}
                  placeholder="Any additional context for the risk assessment..."
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Brain size={12} className="text-primary" />
              Powered by OpenAI GPT-5
            </p>
            <button
              onClick={handleRunAssessment}
              disabled={isLoading || (!selectedCollateralId && !useCustom) || (useCustom && !customInput.collateralId)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Analysing…</>
              ) : (
                <><RefreshCw size={16} /> Run Assessment</>
              )}
            </button>
          </div>
        </div>

        {/* ── Loading State ── */}
        {isLoading && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-600 text-primary">AI is analysing collateral risk…</p>
            <p className="text-xs text-muted-foreground">Evaluating perfection status, BRELA deadlines, and fraud signals</p>
          </div>
        )}

        {/* ── Results ── */}
        {assessment && !isLoading && (
          <div className="space-y-4">

            {/* Overall Score Banner */}
            <div className={`rounded-xl border p-6 ${riskLevelConfig[assessment.overallLevel].bg} ${riskLevelConfig[assessment.overallLevel].border}`}>
              <div className="flex items-start gap-6">
                <RiskScoreGauge score={assessment.overallScore} level={assessment.overallLevel} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-700 text-foreground">Overall Risk Assessment</h3>
                    <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${riskLevelConfig[assessment.overallLevel].bg} ${riskLevelConfig[assessment.overallLevel].color} ${riskLevelConfig[assessment.overallLevel].border}`}>
                      {riskLevelConfig[assessment.overallLevel].label}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{assessment.executiveSummary}</p>
                  <div className="flex items-center gap-4 mt-3">
                    {dimensions.map(d => d.level && (
                      <div key={d.id} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${riskLevelConfig[d.level].dot}`} />
                        <span className="text-xs text-muted-foreground">{d.label.split(' ')[0]}: <span className={`font-600 ${riskLevelConfig[d.level].color}`}>{d.score}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Dimension Cards */}
            <div className="space-y-3">
              <h3 className="text-sm font-700 text-foreground uppercase tracking-wider">Risk Dimensions</h3>
              {dimensions.map(dim => (
                <RiskDimensionCard
                  key={dim.id}
                  dim={dim}
                  expanded={expandedDim === dim.id}
                  onToggle={() => setExpandedDim(prev => prev === dim.id ? null : dim.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {!assessment && !isLoading && (
          <div className="rounded-xl border border-dashed border-border bg-white p-12 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain size={28} className="text-primary" />
            </div>
            <p className="text-sm font-600 text-foreground">No assessment yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Select a collateral record or enter details manually, then click <strong>Run Assessment</strong> to get an AI-powered risk analysis.
            </p>
          </div>
        )}

        {/* ── Assessment History ── */}
        {assessmentHistory.length > 0 && (
          <div className="rounded-xl border border-border bg-white shadow-card p-5">
            <h3 className="text-sm font-700 text-foreground uppercase tracking-wider mb-3">Recent Assessments</h3>
            <div className="space-y-2">
              {assessmentHistory.map(h => {
                const cfg = riskLevelConfig[h.level];
                return (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-sm font-600 text-foreground">{h.collateralId}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{h.score}/100</span>
                      <span className="text-xs text-muted-foreground">{new Date(h.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
