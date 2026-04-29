'use client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleFrequency = 'DAILY' | 'WEEKLY';
export type JobStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED';
export type RunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  eligibleCount: number;
  totalCandidates: number;
  estimatedEquityRelease: number;
  warnings: string[];
}

export interface ValidationCheck {
  id: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
}

export interface JobRunSummary {
  id: string;
  jobId: string;
  runAt: string;
  status: RunStatus;
  totalProcessed: number;
  released: number;
  failed: number;
  skipped: number;
  equityReleased: number;
  durationSeconds: number;
  errors: string[];
  releasedItems: ReleasedItem[];
}

export interface ReleasedItem {
  loanAccountId: string;
  beneficiaryName: string;
  collateralId: string;
  allocatedAmount: number;
  registry: string;
  status: 'RELEASED' | 'FAILED' | 'SKIPPED';
  reason?: string;
}

export interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  frequency: ScheduleFrequency;
  runTime: string; // HH:MM
  dayOfWeek?: DayOfWeek; // only for WEEKLY
  status: JobStatus;
  registryFilter: string[]; // ['BRELA','LANDS','TRA','ALL']
  minDaysSinceClosure: number;
  requireDischargeNumber: boolean;
  createdAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  successRuns: number;
  lastSummary?: JobRunSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextRunDate(freq: ScheduleFrequency, runTime: string, dayOfWeek?: DayOfWeek): string {
  const now = new Date();
  const [h, m] = runTime.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);

  if (freq === 'DAILY') {
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate.toISOString();
  }

  // WEEKLY
  const dayMap: Record<DayOfWeek, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const targetDay = dayMap[dayOfWeek ?? 'MON'];
  const currentDay = now.getDay();
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0 && candidate <= now) daysUntil = 7;
  candidate.setDate(candidate.getDate() + daysUntil);
  return candidate.toISOString();
}

// ─── Mock persistent store (in-memory for client-side) ───────────────────────

const STORAGE_KEY = 'cms_scheduled_jobs';

function loadJobs(): ScheduledJob[] {
  if (typeof window === 'undefined') return getDefaultJobs();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ScheduledJob[];
  } catch {
    // ignore
  }
  const defaults = getDefaultJobs();
  saveJobs(defaults);
  return defaults;
}

function saveJobs(jobs: ScheduledJob[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // ignore
  }
}

function getDefaultJobs(): ScheduledJob[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return [
    {
      id: 'job-001',
      name: 'Daily BRELA Batch Release',
      description: 'Automatically releases BRELA-registered collateral for loans closed at least 3 days ago',
      frequency: 'DAILY',
      runTime: '06:00',
      status: 'ACTIVE',
      registryFilter: ['BRELA'],
      minDaysSinceClosure: 3,
      requireDischargeNumber: true,
      createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
      lastRunAt: yesterday.toISOString(),
      nextRunAt: nextRunDate('DAILY', '06:00'),
      totalRuns: 7,
      successRuns: 6,
      lastSummary: {
        id: 'run-001-7',
        jobId: 'job-001',
        runAt: yesterday.toISOString(),
        status: 'SUCCESS',
        totalProcessed: 4,
        released: 4,
        failed: 0,
        skipped: 0,
        equityReleased: 320000000,
        durationSeconds: 12,
        errors: [],
        releasedItems: [
          { loanAccountId: 'LN-2024-0041', beneficiaryName: 'Tanzanian Steel Industries Ltd', collateralId: 'COL-BRE-001', allocatedAmount: 120000000, registry: 'BRELA', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0055', beneficiaryName: 'Kilimanjaro Coffee Exporters', collateralId: 'COL-BRE-002', allocatedAmount: 85000000, registry: 'BRELA', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0062', beneficiaryName: 'Dar es Salaam Logistics Co.', collateralId: 'COL-BRE-003', allocatedAmount: 65000000, registry: 'BRELA', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0071', beneficiaryName: 'Mwanza Fisheries Ltd', collateralId: 'COL-BRE-004', allocatedAmount: 50000000, registry: 'BRELA', status: 'RELEASED' },
        ],
      },
    },
    {
      id: 'job-002',
      name: 'Weekly Full Registry Sweep',
      description: 'Weekly sweep across all registries — releases all eligible closed-loan collateral',
      frequency: 'WEEKLY',
      runTime: '02:00',
      dayOfWeek: 'MON',
      status: 'ACTIVE',
      registryFilter: ['BRELA', 'LANDS', 'TRA'],
      minDaysSinceClosure: 7,
      requireDischargeNumber: false,
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
      lastRunAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
      nextRunAt: nextRunDate('WEEKLY', '02:00', 'MON'),
      totalRuns: 4,
      successRuns: 3,
      lastSummary: {
        id: 'run-002-4',
        jobId: 'job-002',
        runAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
        status: 'PARTIAL',
        totalProcessed: 11,
        released: 9,
        failed: 2,
        skipped: 0,
        equityReleased: 875000000,
        durationSeconds: 38,
        errors: ['LN-2024-0033: Discharge number missing', 'LN-2024-0047: Registry API timeout'],
        releasedItems: [
          { loanAccountId: 'LN-2024-0033', beneficiaryName: 'Arusha Agro Processors', collateralId: 'COL-LND-001', allocatedAmount: 200000000, registry: 'LANDS', status: 'FAILED', reason: 'Discharge number missing' },
          { loanAccountId: 'LN-2024-0047', beneficiaryName: 'Tanga Port Services', collateralId: 'COL-TRA-001', allocatedAmount: 95000000, registry: 'TRA', status: 'FAILED', reason: 'Registry API timeout' },
          { loanAccountId: 'LN-2024-0051', beneficiaryName: 'Morogoro Textile Mills', collateralId: 'COL-BRE-005', allocatedAmount: 110000000, registry: 'BRELA', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0058', beneficiaryName: 'Dodoma Grain Traders', collateralId: 'COL-LND-002', allocatedAmount: 180000000, registry: 'LANDS', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0063', beneficiaryName: 'Zanzibar Spice Exports', collateralId: 'COL-BRE-006', allocatedAmount: 75000000, registry: 'BRELA', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0068', beneficiaryName: 'Iringa Timber Co.', collateralId: 'COL-LND-003', allocatedAmount: 90000000, registry: 'LANDS', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0072', beneficiaryName: 'Mbeya Mining Supplies', collateralId: 'COL-TRA-002', allocatedAmount: 45000000, registry: 'TRA', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0075', beneficiaryName: 'Lindi Cashew Processors', collateralId: 'COL-BRE-007', allocatedAmount: 60000000, registry: 'BRELA', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0079', beneficiaryName: 'Tabora Tobacco Growers', collateralId: 'COL-LND-004', allocatedAmount: 55000000, registry: 'LANDS', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0082', beneficiaryName: 'Kigoma Lake Fisheries', collateralId: 'COL-TRA-003', allocatedAmount: 35000000, registry: 'TRA', status: 'RELEASED' },
          { loanAccountId: 'LN-2024-0085', beneficiaryName: 'Singida Solar Energy Ltd', collateralId: 'COL-BRE-008', allocatedAmount: 25000000, registry: 'BRELA', status: 'RELEASED' },
        ],
      },
    },
    {
      id: 'job-003',
      name: 'Lands Registry Weekly Release',
      description: 'Weekly release of Lands Registry mortgages for closed loans',
      frequency: 'WEEKLY',
      runTime: '08:00',
      dayOfWeek: 'WED',
      status: 'PAUSED',
      registryFilter: ['LANDS'],
      minDaysSinceClosure: 5,
      requireDischargeNumber: true,
      createdAt: new Date(now.getTime() - 14 * 86400000).toISOString(),
      lastRunAt: null,
      nextRunAt: null,
      totalRuns: 0,
      successRuns: 0,
    },
  ];
}

// ─── Validation logic ─────────────────────────────────────────────────────────

export function runPreExecutionValidation(job: ScheduledJob): ValidationResult {
  const checks: ValidationCheck[] = [];
  const warnings: string[] = [];

  // Check 1: Schedule configuration
  checks.push({
    id: 'schedule-config',
    label: 'Schedule Configuration',
    status: 'PASS',
    detail: `${job.frequency} at ${job.runTime}${job.frequency === 'WEEKLY' ? ` on ${job.dayOfWeek}` : ''}`,
  });

  // Check 2: Registry filter
  const registryOk = job.registryFilter.length > 0;
  checks.push({
    id: 'registry-filter',
    label: 'Registry Filter',
    status: registryOk ? 'PASS' : 'FAIL',
    detail: registryOk ? `Targeting: ${job.registryFilter.join(', ')}` : 'No registries selected',
  });

  // Check 3: Closure window
  const closureOk = job.minDaysSinceClosure >= 1;
  checks.push({
    id: 'closure-window',
    label: 'Minimum Closure Window',
    status: closureOk ? 'PASS' : 'WARN',
    detail: closureOk ? `${job.minDaysSinceClosure} day(s) minimum since loan closure` : 'Closure window too short — risk of premature release',
  });
  if (job.minDaysSinceClosure < 3) warnings.push('Closure window under 3 days — verify compliance policy');

  // Check 4: Discharge number requirement
  checks.push({
    id: 'discharge-req',
    label: 'Discharge Number Requirement',
    status: job.requireDischargeNumber ? 'PASS' : 'WARN',
    detail: job.requireDischargeNumber ? 'Discharge number required before release' : 'Discharge number not required — items may release without registry confirmation',
  });
  if (!job.requireDischargeNumber) warnings.push('Discharge number not enforced — ensure manual review is in place');

  // Check 5: Simulate eligible items
  const simulatedEligible = Math.floor(Math.random() * 8) + 2;
  const simulatedTotal = simulatedEligible + Math.floor(Math.random() * 4);
  const simulatedEquity = simulatedEligible * (Math.floor(Math.random() * 80) + 20) * 1000000;

  checks.push({
    id: 'eligible-items',
    label: 'Eligible Items Found',
    status: simulatedEligible > 0 ? 'PASS' : 'WARN',
    detail: `${simulatedEligible} of ${simulatedTotal} candidates meet all release criteria`,
  });

  const allPassed = checks.every((c) => c.status !== 'FAIL');

  return {
    passed: allPassed,
    checks,
    eligibleCount: simulatedEligible,
    totalCandidates: simulatedTotal,
    estimatedEquityRelease: simulatedEquity,
    warnings,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const scheduledJobService = {
  getAll(): ScheduledJob[] {
    return loadJobs();
  },

  getById(id: string): ScheduledJob | undefined {
    return loadJobs().find((j) => j.id === id);
  },

  create(payload: Omit<ScheduledJob, 'id' | 'createdAt' | 'lastRunAt' | 'nextRunAt' | 'totalRuns' | 'successRuns'>): ScheduledJob {
    const jobs = loadJobs();
    const newJob: ScheduledJob = {
      ...payload,
      id: `job-${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      nextRunAt: payload.status === 'ACTIVE' ? nextRunDate(payload.frequency, payload.runTime, payload.dayOfWeek) : null,
      totalRuns: 0,
      successRuns: 0,
    };
    jobs.push(newJob);
    saveJobs(jobs);
    return newJob;
  },

  update(id: string, updates: Partial<ScheduledJob>): ScheduledJob | null {
    const jobs = loadJobs();
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) return null;
    const updated = { ...jobs[idx], ...updates };
    if (updates.status === 'ACTIVE' && jobs[idx].status !== 'ACTIVE') {
      updated.nextRunAt = nextRunDate(updated.frequency, updated.runTime, updated.dayOfWeek);
    }
    if (updates.status === 'PAUSED') updated.nextRunAt = null;
    jobs[idx] = updated;
    saveJobs(jobs);
    return updated;
  },

  delete(id: string): boolean {
    const jobs = loadJobs();
    const filtered = jobs.filter((j) => j.id !== id);
    if (filtered.length === jobs.length) return false;
    saveJobs(filtered);
    return true;
  },

  async simulateRun(job: ScheduledJob): Promise<JobRunSummary> {
    // Simulate async execution with a short delay
    await new Promise((r) => setTimeout(r, 1800));

    const validation = runPreExecutionValidation(job);
    const eligible = validation.eligibleCount;
    const failed = Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0;
    const released = eligible - failed;
    const equityReleased = released * (Math.floor(Math.random() * 60) + 30) * 1000000;

    const registries = job.registryFilter.includes('ALL') ? ['BRELA', 'LANDS', 'TRA'] : job.registryFilter;

    const items: ReleasedItem[] = Array.from({ length: eligible }, (_, i) => {
      const reg = registries[i % registries.length];
      const isFailed = i < failed;
      return {
        loanAccountId: `LN-2024-${String(Math.floor(Math.random() * 900) + 100).padStart(4, '0')}`,
        beneficiaryName: ['Tanzanian Steel Industries Ltd', 'Kilimanjaro Coffee Exporters', 'Dar es Salaam Logistics Co.', 'Arusha Agro Processors', 'Mwanza Fisheries Ltd'][i % 5],
        collateralId: `COL-${reg}-${String(i + 1).padStart(3, '0')}`,
        allocatedAmount: (Math.floor(Math.random() * 150) + 20) * 1000000,
        registry: reg,
        status: isFailed ? 'FAILED' : 'RELEASED',
        reason: isFailed ? ['Discharge number missing', 'Registry API timeout', 'Duplicate release attempt'][i % 3] : undefined,
      };
    });

    const summary: JobRunSummary = {
      id: `run-${job.id}-${Date.now()}`,
      jobId: job.id,
      runAt: new Date().toISOString(),
      status: failed === 0 ? 'SUCCESS' : failed === eligible ? 'FAILED' : 'PARTIAL',
      totalProcessed: eligible,
      released,
      failed,
      skipped: 0,
      equityReleased,
      durationSeconds: Math.floor(Math.random() * 40) + 8,
      errors: items.filter((i) => i.status === 'FAILED').map((i) => `${i.loanAccountId}: ${i.reason}`),
      releasedItems: items,
    };

    // Persist updated job
    const jobs = loadJobs();
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx !== -1) {
      jobs[idx].lastRunAt = summary.runAt;
      jobs[idx].totalRuns += 1;
      if (summary.status === 'SUCCESS') jobs[idx].successRuns += 1;
      jobs[idx].nextRunAt = nextRunDate(job.frequency, job.runTime, job.dayOfWeek);
      jobs[idx].lastSummary = summary;
      saveJobs(jobs);
    }

    return summary;
  },
};
