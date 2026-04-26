import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PdfRequestBody {
  reportType: string;
  dateFrom: string;
  dateTo: string;
  registries: string[];
  statuses: string[];
  collateralTypes: string[];
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetails: boolean;
  stakeholderMode: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTSh(value: string | number): string {
  const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString('en-US');
}

function addPageHeader(doc: any, title: string, subtitle: string, pageWidth: number) {
  // Header bar
  doc.setFillColor(26, 58, 92);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CollateralMS — EXIM Bank Tanzania', 14, 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pageWidth - 14, 9, { align: 'right' });

  // Report title
  doc.setTextColor(26, 58, 92);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 34);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(subtitle, 14, 41);

  return 50; // y cursor after header
}

function addSummaryBoxes(doc: any, boxes: { label: string; value: string; color?: [number, number, number] }[], startY: number, pageWidth: number): number {
  const boxW = (pageWidth - 28 - (boxes.length - 1) * 4) / boxes.length;
  boxes.forEach((box, i) => {
    const x = 14 + i * (boxW + 4);
    const [r, g, b] = box.color ?? [243, 244, 246];
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, startY, boxW, 18, 2, 2, 'F');
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(box.label, x + 4, startY + 6);
    doc.setTextColor(26, 58, 92);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(box.value, x + 4, startY + 14);
  });
  return startY + 24;
}

function addFooter(doc: any, pageWidth: number, pageHeight: number) {
  doc.setFillColor(243, 244, 246);
  doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Confidential — EXIM Bank Tanzania | CollateralMS', 14, pageHeight - 3);
  doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - 14, pageHeight - 3, { align: 'right' });
}

// ─── Report Generators ────────────────────────────────────────────────────────

async function generateCollateralAgingPDF(records: any[], config: PdfRequestBody): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = addPageHeader(doc, 'Collateral Aging Analysis', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);

  // Aging buckets
  const buckets = [
    { label: '> 90 days overdue', filter: (r: any) => r.days_to_deadline !== null && r.days_to_deadline < -90 },
    { label: '31–90 days overdue', filter: (r: any) => r.days_to_deadline !== null && r.days_to_deadline >= -90 && r.days_to_deadline < -30 },
    { label: '1–30 days overdue', filter: (r: any) => r.days_to_deadline !== null && r.days_to_deadline >= -30 && r.days_to_deadline < 0 },
    { label: 'Due in 1–30 days', filter: (r: any) => r.days_to_deadline !== null && r.days_to_deadline >= 0 && r.days_to_deadline <= 30 },
    { label: 'Due in 31–90 days', filter: (r: any) => r.days_to_deadline !== null && r.days_to_deadline > 30 && r.days_to_deadline <= 90 },
    { label: '> 90 days remaining', filter: (r: any) => r.days_to_deadline !== null && r.days_to_deadline > 90 },
  ];

  const bucketCounts = buckets.map((b) => records.filter(b.filter).length);
  const totalValue = records.reduce((s: number, r: any) => {
    const v = parseInt((r.value_tsh ?? '0').replace(/,/g, ''), 10);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  if (config.includeSummary) {
    y = addSummaryBoxes(doc, [
      { label: 'Total Records', value: String(records.length) },
      { label: 'Total Value (TSh)', value: formatTSh(totalValue) },
      { label: 'Overdue', value: String(records.filter((r) => r.status === 'Overdue').length), color: [254, 226, 226] },
      { label: 'Due ≤ 30 Days', value: String(records.filter((r) => r.days_to_deadline !== null && r.days_to_deadline >= 0 && r.days_to_deadline <= 30).length), color: [254, 243, 199] },
      { label: 'Perfected', value: String(records.filter((r) => r.status === 'Perfected').length), color: [209, 250, 229] },
    ], y, pageWidth);
  }

  // Aging bucket summary table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text('Aging Bucket Summary', 14, y + 4);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Aging Bucket', 'Count', '% of Total']],
    body: buckets.map((b, i) => [
      b.label,
      bucketCounts[i],
      records.length > 0 ? `${((bucketCounts[i] / records.length) * 100).toFixed(1)}%` : '0%',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  if (config.includeDetails) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text('Collateral Detail Records', 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Deadline', 'Days Left', 'Officer']],
      body: records.map((r) => [
        r.collateral_id ?? r.id,
        r.obligor,
        r.collateral_type,
        r.registry,
        r.status,
        formatTSh(r.value_tsh ?? '0'),
        r.perfection_deadline ?? '—',
        r.days_to_deadline ?? '—',
        r.assigned_officer ?? '—',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
  }

  addFooter(doc, pageWidth, pageHeight);
  return Buffer.from(doc.output('arraybuffer'));
}

async function generatePerfectionTrendsPDF(records: any[], config: PdfRequestBody): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = addPageHeader(doc, 'Perfection Rate Trends', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);

  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const underReview = records.filter((r) => r.status === 'Under Review').length;
  const submitted = records.filter((r) => r.status === 'Submitted').length;
  const perfectionRate = total > 0 ? ((perfected / total) * 100).toFixed(1) : '0.0';
  const TARGET = 80;
  const rateNum = parseFloat(perfectionRate);
  const vsTarget = rateNum >= TARGET ? `+${(rateNum - TARGET).toFixed(1)}% above target` : `${(rateNum - TARGET).toFixed(1)}% below target`;

  if (config.includeSummary) {
    y = addSummaryBoxes(doc, [
      { label: 'Total Collateral', value: String(total) },
      { label: 'Perfection Rate', value: `${perfectionRate}%`, color: rateNum >= TARGET ? [209, 250, 229] : [254, 226, 226] },
      { label: 'vs 80% Target', value: vsTarget, color: rateNum >= TARGET ? [209, 250, 229] : [254, 243, 199] },
      { label: 'Perfected', value: String(perfected), color: [209, 250, 229] },
      { label: 'Overdue', value: String(overdue), color: [254, 226, 226] },
    ], y, pageWidth);
  }

  // Status breakdown table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text('Status Breakdown', 14, y + 4);
  y += 8;

  const statusGroups: Record<string, number> = {};
  records.forEach((r) => {
    statusGroups[r.status] = (statusGroups[r.status] ?? 0) + 1;
  });

  autoTable(doc, {
    startY: y,
    head: [['Status', 'Count', '% of Total', 'Benchmark']],
    body: Object.entries(statusGroups).map(([status, count]) => [
      status,
      count,
      total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%',
      status === 'Perfected' ? '≥ 80% target' : '—',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Registry-level perfection breakdown
  const registryGroups: Record<string, { total: number; perfected: number }> = {};
  records.forEach((r) => {
    if (!registryGroups[r.registry]) registryGroups[r.registry] = { total: 0, perfected: 0 };
    registryGroups[r.registry].total++;
    if (r.status === 'Perfected') registryGroups[r.registry].perfected++;
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text('Perfection Rate by Registry', 14, y + 4);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Registry', 'Total', 'Perfected', 'Perfection Rate', 'vs Target']],
    body: Object.entries(registryGroups).map(([registry, data]) => {
      const rate = data.total > 0 ? ((data.perfected / data.total) * 100).toFixed(1) : '0.0';
      const rateVal = parseFloat(rate);
      return [
        registry,
        data.total,
        data.perfected,
        `${rate}%`,
        rateVal >= TARGET ? `✓ +${(rateVal - TARGET).toFixed(1)}%` : `✗ ${(rateVal - TARGET).toFixed(1)}%`,
      ];
    }),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
  });

  if (config.includeDetails) {
    doc.addPage();
    y = addPageHeader(doc, 'Perfection Rate Trends — Detail Records', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);

    autoTable(doc, {
      startY: y,
      head: [['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Deadline', 'Days Left', 'Officer']],
      body: records.map((r) => [
        r.collateral_id ?? r.id,
        r.obligor,
        r.collateral_type,
        r.registry,
        r.status,
        formatTSh(r.value_tsh ?? '0'),
        r.perfection_deadline ?? '—',
        r.days_to_deadline ?? '—',
        r.assigned_officer ?? '—',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
  }

  addFooter(doc, pageWidth, pageHeight);
  return Buffer.from(doc.output('arraybuffer'));
}

async function generateComplianceScorecardPDF(records: any[], auditLogs: any[], config: PdfRequestBody): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = addPageHeader(doc, 'Regulatory Compliance Scorecard', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);

  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const perfectionRate = total > 0 ? ((perfected / total) * 100) : 0;

  // Overall compliance grade
  let grade = 'F';
  let gradeColor: [number, number, number] = [254, 226, 226];
  if (perfectionRate >= 90) { grade = 'A'; gradeColor = [209, 250, 229]; }
  else if (perfectionRate >= 80) { grade = 'B'; gradeColor = [209, 250, 229]; }
  else if (perfectionRate >= 70) { grade = 'C'; gradeColor = [254, 243, 199]; }
  else if (perfectionRate >= 60) { grade = 'D'; gradeColor = [254, 243, 199]; }

  if (config.includeSummary) {
    y = addSummaryBoxes(doc, [
      { label: 'Overall Grade', value: grade, color: gradeColor },
      { label: 'Perfection Rate', value: `${perfectionRate.toFixed(1)}%`, color: gradeColor },
      { label: 'Total Collateral', value: String(total) },
      { label: 'Overdue Items', value: String(overdue), color: overdue > 0 ? [254, 226, 226] : [209, 250, 229] },
      { label: 'Audit Events', value: String(auditLogs.length) },
    ], y, pageWidth);
  }

  // Per-registry scorecard
  const registryGroups: Record<string, { total: number; perfected: number; overdue: number }> = {};
  records.forEach((r) => {
    if (!registryGroups[r.registry]) registryGroups[r.registry] = { total: 0, perfected: 0, overdue: 0 };
    registryGroups[r.registry].total++;
    if (r.status === 'Perfected') registryGroups[r.registry].perfected++;
    if (r.status === 'Overdue') registryGroups[r.registry].overdue++;
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text('Registry Compliance Scorecard', 14, y + 4);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Registry', 'Total', 'Perfected', 'Overdue', 'Perfection Rate', 'Grade', 'Status']],
    body: Object.entries(registryGroups).map(([registry, data]) => {
      const rate = data.total > 0 ? (data.perfected / data.total) * 100 : 0;
      let g = 'F';
      if (rate >= 90) g = 'A';
      else if (rate >= 80) g = 'B';
      else if (rate >= 70) g = 'C';
      else if (rate >= 60) g = 'D';
      const status = rate >= 80 ? '✓ Compliant' : '✗ Non-Compliant';
      return [registry, data.total, data.perfected, data.overdue, `${rate.toFixed(1)}%`, g, status];
    }),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Collateral type compliance
  const typeGroups: Record<string, { total: number; perfected: number; overdue: number }> = {};
  records.forEach((r) => {
    if (!typeGroups[r.collateral_type]) typeGroups[r.collateral_type] = { total: 0, perfected: 0, overdue: 0 };
    typeGroups[r.collateral_type].total++;
    if (r.status === 'Perfected') typeGroups[r.collateral_type].perfected++;
    if (r.status === 'Overdue') typeGroups[r.collateral_type].overdue++;
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text('Compliance by Collateral Type', 14, y + 4);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Collateral Type', 'Total', 'Perfected', 'Overdue', 'Perfection Rate', 'Grade']],
    body: Object.entries(typeGroups).map(([type, data]) => {
      const rate = data.total > 0 ? (data.perfected / data.total) * 100 : 0;
      let g = 'F';
      if (rate >= 90) g = 'A';
      else if (rate >= 80) g = 'B';
      else if (rate >= 70) g = 'C';
      else if (rate >= 60) g = 'D';
      return [type, data.total, data.perfected, data.overdue, `${rate.toFixed(1)}%`, g];
    }),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
  });

  if (config.includeDetails && records.length > 0) {
    doc.addPage();
    y = addPageHeader(doc, 'Compliance Scorecard — Non-Compliant Records', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);

    const nonCompliant = records.filter((r) => r.status === 'Overdue' || r.status === 'Rejected');

    autoTable(doc, {
      startY: y,
      head: [['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Deadline', 'Days Overdue', 'Officer']],
      body: nonCompliant.map((r) => [
        r.collateral_id ?? r.id,
        r.obligor,
        r.collateral_type,
        r.registry,
        r.status,
        formatTSh(r.value_tsh ?? '0'),
        r.perfection_deadline ?? '—',
        r.days_to_deadline !== null ? Math.abs(r.days_to_deadline) : '—',
        r.assigned_officer ?? '—',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
  }

  addFooter(doc, pageWidth, pageHeight);
  return Buffer.from(doc.output('arraybuffer'));
}

async function generateGenericPDF(records: any[], config: PdfRequestBody, reportLabel: string): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = addPageHeader(doc, reportLabel, `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);

  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const totalValue = records.reduce((s: number, r: any) => {
    const v = parseInt((r.value_tsh ?? '0').replace(/,/g, ''), 10);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  if (config.includeSummary) {
    y = addSummaryBoxes(doc, [
      { label: 'Total Records', value: String(total) },
      { label: 'Total Value (TSh)', value: formatTSh(totalValue) },
      { label: 'Perfected', value: String(perfected), color: [209, 250, 229] },
      { label: 'Overdue', value: String(overdue), color: [254, 226, 226] },
      { label: 'Perfection Rate', value: total > 0 ? `${((perfected / total) * 100).toFixed(1)}%` : '0%' },
    ], y, pageWidth);
  }

  if (config.includeDetails) {
    autoTable(doc, {
      startY: y,
      head: [['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Deadline', 'Days Left', 'Officer']],
      body: records.map((r) => [
        r.collateral_id ?? r.id,
        r.obligor,
        r.collateral_type,
        r.registry,
        r.status,
        formatTSh(r.value_tsh ?? '0'),
        r.perfection_deadline ?? '—',
        r.days_to_deadline ?? '—',
        r.assigned_officer ?? '—',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
  }

  addFooter(doc, pageWidth, pageHeight);
  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: PdfRequestBody = await request.json();
    const supabase = await createClient();

    // ── Build Supabase query with filters ──────────────────────────────────
    let query = supabase
      .from('collateral_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (body.registries && body.registries.length > 0) {
      query = query.in('registry', body.registries);
    }
    if (body.statuses && body.statuses.length > 0) {
      query = query.in('status', body.statuses);
    }
    if (body.collateralTypes && body.collateralTypes.length > 0) {
      query = query.in('collateral_type', body.collateralTypes);
    }
    if (body.dateFrom) {
      query = query.gte('created_at', body.dateFrom);
    }
    if (body.dateTo) {
      const endDate = new Date(body.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString());
    }

    const { data: records, error: recordsError } = await query;

    if (recordsError) {
      console.error('Supabase query error:', recordsError.message);
      return NextResponse.json({ error: 'Failed to fetch collateral data' }, { status: 500 });
    }

    const filteredRecords = records ?? [];

    // ── Fetch audit logs for compliance scorecard ──────────────────────────
    let auditLogs: any[] = [];
    if (body.reportType === 'compliance_scorecard' || body.reportType === 'audit_summary') {
      let auditQuery = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (body.dateFrom) auditQuery = auditQuery.gte('created_at', body.dateFrom);
      if (body.dateTo) {
        const endDate = new Date(body.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        auditQuery = auditQuery.lt('created_at', endDate.toISOString());
      }

      const { data: logs } = await auditQuery;
      auditLogs = logs ?? [];
    }

    // ── Generate PDF based on report type ─────────────────────────────────
    let pdfBuffer: Buffer;
    const reportLabels: Record<string, string> = {
      collateral_aging: 'Collateral Aging Analysis',
      perfection_rate: 'Perfection Rate Trends',
      deadline_adherence: 'Deadline Adherence Metrics',
      compliance_scorecard: 'Regulatory Compliance Scorecard',
      collateral_registry: 'Collateral Registry Export',
      audit_summary: 'Audit Trail Summary',
    };

    switch (body.reportType) {
      case 'collateral_aging':
        pdfBuffer = await generateCollateralAgingPDF(filteredRecords, body);
        break;
      case 'perfection_rate':
        pdfBuffer = await generatePerfectionTrendsPDF(filteredRecords, body);
        break;
      case 'compliance_scorecard':
        pdfBuffer = await generateComplianceScorecardPDF(filteredRecords, auditLogs, body);
        break;
      default:
        pdfBuffer = await generateGenericPDF(filteredRecords, body, reportLabels[body.reportType] ?? body.reportType);
        break;
    }

    // ── Log the export action ──────────────────────────────────────────────
    try {
      await supabase.from('audit_logs').insert({
        action: 'EXPORT',
        message: `PDF export: ${reportLabels[body.reportType] ?? body.reportType}`,
        detail: `Filters: registries=${body.registries.join(',') || 'all'}, statuses=${body.statuses.join(',') || 'all'}, types=${body.collateralTypes.join(',') || 'all'}, period=${body.dateFrom} to ${body.dateTo}`,
        entity_type: 'export',
        event_category: 'export',
        performed_by_name: 'System',
      });
    } catch {
      // Non-critical — don't fail the export
    }

    const reportSlug = (reportLabels[body.reportType] ?? body.reportType).toLowerCase().replace(/\s+/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `${reportSlug}_${dateStr}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err: any) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'PDF generation failed', details: err.message }, { status: 500 });
  }
}
