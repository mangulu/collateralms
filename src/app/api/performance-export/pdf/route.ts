import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerformanceExportRequest {
  reportType: 'performance_summary' | 'trend_analysis' | 'compliance_metrics';
  dateFrom: string;
  dateTo: string;
  registries: string[];
  includeSummary: boolean;
  includeCharts: boolean;
  includeBreakdown: boolean;
}

interface CollateralRecord {
  id: string;
  collateral_id?: string;
  obligor: string;
  collateral_type: string;
  registry: string;
  status: string;
  value_tsh: string;
  perfection_deadline?: string;
  days_to_deadline?: number | null;
  assigned_officer?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTSh(value: string | number): string {
  const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString('en-US');
}

function addPageHeader(
  doc: any,
  title: string,
  subtitle: string,
  pageWidth: number,
): number {
  doc.setFillColor(26, 58, 92);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CollateralMS — EXIM Bank Tanzania', 14, 9);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pageWidth - 14, 9, { align: 'right' });
  doc.setTextColor(26, 58, 92);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 34);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(subtitle, 14, 41);
  return 50;
}

function addSummaryBoxes(
  doc: any,
  boxes: { label: string; value: string; color?: [number, number, number] }[],
  startY: number,
  pageWidth: number,
): number {
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
  doc.text(
    `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
    pageWidth - 14,
    pageHeight - 3,
    { align: 'right' },
  );
}

function drawBarChart(
  doc: any,
  data: { label: string; value: number; maxValue: number; color?: [number, number, number] }[],
  startX: number,
  startY: number,
  chartWidth: number,
  chartHeight: number,
  title: string,
) {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text(title, startX, startY - 2);

  const barAreaHeight = chartHeight - 14;
  const barWidth = Math.min(18, (chartWidth - 10) / data.length - 4);
  const spacing = (chartWidth - 10) / data.length;

  // Draw baseline
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(startX, startY + barAreaHeight, startX + chartWidth, startY + barAreaHeight);

  data.forEach((item, i) => {
    const barHeight = item.maxValue > 0 ? (item.value / item.maxValue) * barAreaHeight : 0;
    const x = startX + 5 + i * spacing + (spacing - barWidth) / 2;
    let y = startY + barAreaHeight - barHeight;
    const [r, g, b] = item.color ?? [26, 58, 92];
    doc.setFillColor(r, g, b);
    if (barHeight > 0) doc.rect(x, y, barWidth, barHeight, 'F');

    // Value label
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text(String(item.value), x + barWidth / 2, y - 1, { align: 'center' });

    // X-axis label
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    const labelLines = item.label.length > 10 ? [item.label.slice(0, 10), item.label.slice(10)] : [item.label];
    labelLines.forEach((line, li) => {
      doc.text(line, x + barWidth / 2, startY + barAreaHeight + 4 + li * 3.5, { align: 'center' });
    });
  });
}

// ─── Performance Summary PDF ──────────────────────────────────────────────────

async function generatePerformanceSummaryPDF(
  records: CollateralRecord[],
  config: PerformanceExportRequest,
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = addPageHeader(
    doc,
    'Collateral Performance Summary',
    `Period: ${config.dateFrom} to ${config.dateTo}${config.registries.length > 0 ? ' | Registries: ' + config.registries.join(', ') : ''}`,
    pageWidth,
  );

  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const pending = records.filter((r) => ['Draft', 'Submitted', 'Under Review'].includes(r.status)).length;
  const perfectionRate = total > 0 ? (perfected / total) * 100 : 0;
  const totalValue = records.reduce((s, r) => {
    const v = parseInt((r.value_tsh ?? '0').replace(/,/g, ''), 10);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  if (config.includeSummary) {
    y = addSummaryBoxes(
      doc,
      [
        { label: 'Total Collateral', value: String(total) },
        {
          label: 'Perfection Rate',
          value: `${perfectionRate.toFixed(1)}%`,
          color: perfectionRate >= 80 ? [209, 250, 229] : perfectionRate >= 60 ? [254, 243, 199] : [254, 226, 226],
        },
        { label: 'Perfected', value: String(perfected), color: [209, 250, 229] },
        { label: 'Overdue', value: String(overdue), color: overdue > 0 ? [254, 226, 226] : [243, 244, 246] },
        { label: 'Pending Review', value: String(pending) },
        { label: 'Portfolio Value (TSh)', value: formatTSh(totalValue) },
      ],
      y,
      pageWidth,
    );
  }

  // Status breakdown table
  const statusGroups: Record<string, number> = {};
  records.forEach((r) => {
    statusGroups[r.status] = (statusGroups[r.status] ?? 0) + 1;
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text('Status Breakdown', 14, y + 4);
  y += 8;

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
    tableWidth: (pageWidth - 28) * 0.45,
  });

  const tableEndY = (doc as any).lastAutoTable.finalY;

  // Registry breakdown table (right side)
  const registryGroups: Record<string, { total: number; perfected: number; overdue: number }> = {};
  records.forEach((r) => {
    if (!registryGroups[r.registry]) registryGroups[r.registry] = { total: 0, perfected: 0, overdue: 0 };
    registryGroups[r.registry].total++;
    if (r.status === 'Perfected') registryGroups[r.registry].perfected++;
    if (r.status === 'Overdue') registryGroups[r.registry].overdue++;
  });

  const rightX = 14 + (pageWidth - 28) * 0.5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text('Registry Breakdown', rightX, y + 4);

  autoTable(doc, {
    startY: y + 8,
    head: [['Registry', 'Total', 'Perfected', 'Overdue', 'Rate']],
    body: Object.entries(registryGroups).map(([registry, data]) => [
      registry,
      data.total,
      data.perfected,
      data.overdue,
      data.total > 0 ? `${((data.perfected / data.total) * 100).toFixed(1)}%` : '0%',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: rightX, right: 14 },
  });

  y = Math.max(tableEndY, (doc as any).lastAutoTable.finalY) + 8;

  // Officer-level breakdown
  if (config.includeBreakdown) {
    const officerGroups: Record<string, { total: number; perfected: number; overdue: number; value: number }> = {};
    records.forEach((r) => {
      const officer = r.assigned_officer ?? 'Unassigned';
      if (!officerGroups[officer]) officerGroups[officer] = { total: 0, perfected: 0, overdue: 0, value: 0 };
      officerGroups[officer].total++;
      if (r.status === 'Perfected') officerGroups[officer].perfected++;
      if (r.status === 'Overdue') officerGroups[officer].overdue++;
      const v = parseInt((r.value_tsh ?? '0').replace(/,/g, ''), 10);
      if (!isNaN(v)) officerGroups[officer].value += v;
    });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text('Officer-Level Performance Breakdown', 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Officer', 'Total Assigned', 'Perfected', 'Overdue', 'Perfection Rate', 'Portfolio Value (TSh)']],
      body: Object.entries(officerGroups)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([officer, data]) => [
          officer,
          data.total,
          data.perfected,
          data.overdue,
          data.total > 0 ? `${((data.perfected / data.total) * 100).toFixed(1)}%` : '0%',
          formatTSh(data.value),
        ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Collateral type breakdown
  if (config.includeBreakdown) {
    const typeGroups: Record<string, { total: number; perfected: number; value: number }> = {};
    records.forEach((r) => {
      if (!typeGroups[r.collateral_type]) typeGroups[r.collateral_type] = { total: 0, perfected: 0, value: 0 };
      typeGroups[r.collateral_type].total++;
      if (r.status === 'Perfected') typeGroups[r.collateral_type].perfected++;
      const v = parseInt((r.value_tsh ?? '0').replace(/,/g, ''), 10);
      if (!isNaN(v)) typeGroups[r.collateral_type].value += v;
    });

    if (y > pageHeight - 60) {
      doc.addPage();
      y = addPageHeader(doc, 'Collateral Performance Summary (cont.)', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text('Collateral Type Breakdown', 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Collateral Type', 'Count', 'Perfected', 'Perfection Rate', 'Total Value (TSh)']],
      body: Object.entries(typeGroups)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([type, data]) => [
          type,
          data.total,
          data.perfected,
          data.total > 0 ? `${((data.perfected / data.total) * 100).toFixed(1)}%` : '0%',
          formatTSh(data.value),
        ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
  }

  addFooter(doc, pageWidth, pageHeight);
  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Trend Analysis PDF ───────────────────────────────────────────────────────

async function generateTrendAnalysisPDF(
  records: CollateralRecord[],
  config: PerformanceExportRequest,
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = addPageHeader(
    doc,
    'Trend Analysis Report',
    `Period: ${config.dateFrom} to ${config.dateTo}${config.registries.length > 0 ? ' | Registries: ' + config.registries.join(', ') : ''}`,
    pageWidth,
  );

  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const perfectionRate = total > 0 ? (perfected / total) * 100 : 0;
  const TARGET = 80;
  const vsTarget = perfectionRate >= TARGET
    ? `+${(perfectionRate - TARGET).toFixed(1)}% above target`
    : `${(perfectionRate - TARGET).toFixed(1)}% below target`;

  if (config.includeSummary) {
    y = addSummaryBoxes(
      doc,
      [
        { label: 'Total Collateral', value: String(total) },
        {
          label: 'Perfection Rate',
          value: `${perfectionRate.toFixed(1)}%`,
          color: perfectionRate >= TARGET ? [209, 250, 229] : [254, 226, 226],
        },
        {
          label: 'vs 80% Target',
          value: vsTarget,
          color: perfectionRate >= TARGET ? [209, 250, 229] : [254, 243, 199],
        },
        { label: 'Perfected', value: String(perfected), color: [209, 250, 229] },
        { label: 'Overdue', value: String(overdue), color: overdue > 0 ? [254, 226, 226] : [243, 244, 246] },
      ],
      y,
      pageWidth,
    );
  }

  // Monthly trend data — group records by month of created_at
  const monthlyData: Record<string, { total: number; perfected: number; overdue: number }> = {};
  records.forEach((r) => {
    const month = r.created_at ? r.created_at.slice(0, 7) : 'Unknown';
    if (!monthlyData[month]) monthlyData[month] = { total: 0, perfected: 0, overdue: 0 };
    monthlyData[month].total++;
    if (r.status === 'Perfected') monthlyData[month].perfected++;
    if (r.status === 'Overdue') monthlyData[month].overdue++;
  });

  const sortedMonths = Object.keys(monthlyData).sort();

  // Draw bar chart for monthly perfection rate trend
  if (config.includeCharts && sortedMonths.length > 0) {
    const chartData = sortedMonths.map((month) => {
      const d = monthlyData[month];
      const rate = d.total > 0 ? Math.round((d.perfected / d.total) * 100) : 0;
      return {
        label: month.slice(5) + '/' + month.slice(2, 4),
        value: rate,
        maxValue: 100,
        color: rate >= TARGET ? [16, 185, 129] as [number, number, number] : [239, 68, 68] as [number, number, number],
      };
    });

    const chartWidth = Math.min(pageWidth - 28, sortedMonths.length * 22 + 20);
    drawBarChart(doc, chartData, 14, y + 4, chartWidth, 45, 'Monthly Perfection Rate (%) — Target: 80%');

    // Draw target line
    const barAreaHeight = 45 - 14;
    const targetY = y + 4 + barAreaHeight - (TARGET / 100) * barAreaHeight;
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(14, targetY, 14 + chartWidth, targetY);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(6);
    doc.setTextColor(239, 68, 68);
    doc.text('80% target', 14 + chartWidth + 1, targetY + 1);

    y += 55;
  }

  // Monthly trend table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 58, 92);
  doc.text('Monthly Trend Data', 14, y + 4);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Month', 'Total Collateral', 'Perfected', 'Overdue', 'Perfection Rate', 'vs Target']],
    body: sortedMonths.map((month) => {
      const d = monthlyData[month];
      const rate = d.total > 0 ? (d.perfected / d.total) * 100 : 0;
      return [
        month,
        d.total,
        d.perfected,
        d.overdue,
        `${rate.toFixed(1)}%`,
        rate >= TARGET ? `✓ +${(rate - TARGET).toFixed(1)}%` : `✗ ${(rate - TARGET).toFixed(1)}%`,
      ];
    }),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Registry trend breakdown
  if (config.includeBreakdown) {
    const registryTrend: Record<string, { total: number; perfected: number; overdue: number }> = {};
    records.forEach((r) => {
      if (!registryTrend[r.registry]) registryTrend[r.registry] = { total: 0, perfected: 0, overdue: 0 };
      registryTrend[r.registry].total++;
      if (r.status === 'Perfected') registryTrend[r.registry].perfected++;
      if (r.status === 'Overdue') registryTrend[r.registry].overdue++;
    });

    if (y > pageHeight - 60) {
      doc.addPage();
      y = addPageHeader(doc, 'Trend Analysis (cont.)', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text('Perfection Rate by Registry', 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Registry', 'Total', 'Perfected', 'Overdue', 'Perfection Rate', 'Status']],
      body: Object.entries(registryTrend).map(([registry, data]) => {
        const rate = data.total > 0 ? (data.perfected / data.total) * 100 : 0;
        return [
          registry,
          data.total,
          data.perfected,
          data.overdue,
          `${rate.toFixed(1)}%`,
          rate >= TARGET ? '✓ On Track' : '✗ Below Target',
        ];
      }),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
  }

  addFooter(doc, pageWidth, pageHeight);
  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Compliance Metrics PDF ───────────────────────────────────────────────────

async function generateComplianceMetricsPDF(
  records: CollateralRecord[],
  auditLogs: any[],
  config: PerformanceExportRequest,
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = addPageHeader(
    doc,
    'Compliance Metrics Report',
    `Period: ${config.dateFrom} to ${config.dateTo}${config.registries.length > 0 ? ' | Registries: ' + config.registries.join(', ') : ''}`,
    pageWidth,
  );

  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const perfectionRate = total > 0 ? (perfected / total) * 100 : 0;

  let grade = 'F';
  let gradeColor: [number, number, number] = [254, 226, 226];
  if (perfectionRate >= 90) { grade = 'A'; gradeColor = [209, 250, 229]; }
  else if (perfectionRate >= 80) { grade = 'B'; gradeColor = [209, 250, 229]; }
  else if (perfectionRate >= 70) { grade = 'C'; gradeColor = [254, 243, 199]; }
  else if (perfectionRate >= 60) { grade = 'D'; gradeColor = [254, 243, 199]; }

  if (config.includeSummary) {
    y = addSummaryBoxes(
      doc,
      [
        { label: 'Overall Grade', value: grade, color: gradeColor },
        { label: 'Perfection Rate', value: `${perfectionRate.toFixed(1)}%`, color: gradeColor },
        { label: 'Total Collateral', value: String(total) },
        { label: 'Overdue Items', value: String(overdue), color: overdue > 0 ? [254, 226, 226] : [209, 250, 229] },
        { label: 'Audit Events', value: String(auditLogs.length) },
      ],
      y,
      pageWidth,
    );
  }

  // Per-registry compliance scorecard
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
    head: [['Registry', 'Total', 'Perfected', 'Overdue', 'Perfection Rate', 'Grade', 'Compliance Status']],
    body: Object.entries(registryGroups).map(([registry, data]) => {
      const rate = data.total > 0 ? (data.perfected / data.total) * 100 : 0;
      let g = 'F';
      if (rate >= 90) g = 'A';
      else if (rate >= 80) g = 'B';
      else if (rate >= 70) g = 'C';
      else if (rate >= 60) g = 'D';
      return [registry, data.total, data.perfected, data.overdue, `${rate.toFixed(1)}%`, g, rate >= 80 ? '✓ Compliant' : '✗ Non-Compliant'];
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

  if (y > pageHeight - 60) {
    doc.addPage();
    y = addPageHeader(doc, 'Compliance Metrics (cont.)', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);
  }

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

  y = (doc as any).lastAutoTable.finalY + 8;

  // BRELA-specific compliance section
  const brelaRecords = records.filter((r) => r.registry === 'BRELA');
  if (brelaRecords.length > 0 && config.includeBreakdown) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = addPageHeader(doc, 'Compliance Metrics — BRELA Detail', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);
    }

    const brelaPerfected = brelaRecords.filter((r) => r.status === 'Perfected').length;
    const brelaOverdue = brelaRecords.filter((r) => r.status === 'Overdue').length;
    const brelaRate = brelaRecords.length > 0 ? (brelaPerfected / brelaRecords.length) * 100 : 0;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text(`BRELA Registry — Compliance Detail (${brelaRecords.length} records, ${brelaRate.toFixed(1)}% perfection rate)`, 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Collateral ID', 'Obligor', 'Type', 'Status', 'Value (TSh)', 'Deadline', 'Days Left', 'Officer']],
      body: brelaRecords.slice(0, 50).map((r) => [
        r.collateral_id ?? r.id,
        r.obligor,
        r.collateral_type,
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

  // Non-compliant records
  if (config.includeBreakdown) {
    const nonCompliant = records.filter((r) => r.status === 'Overdue' || r.status === 'Rejected');
    if (nonCompliant.length > 0) {
      doc.addPage();
      y = addPageHeader(doc, 'Compliance Metrics — Non-Compliant Records', `Period: ${config.dateFrom} to ${config.dateTo}`, pageWidth);

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
          r.days_to_deadline !== null && r.days_to_deadline !== undefined ? Math.abs(r.days_to_deadline) : '—',
          r.assigned_officer ?? '—',
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: 14, right: 14 },
        didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
      });
    }
  }

  addFooter(doc, pageWidth, pageHeight);
  return Buffer.from(doc.output('arraybuffer'));
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: PerformanceExportRequest = await request.json();

    if (!body.reportType || !body.dateFrom || !body.dateTo) {
      return NextResponse.json({ error: 'Missing required fields: reportType, dateFrom, dateTo' }, { status: 400 });
    }

    const supabase = await createClient();

    // Build query with date-range and registry filters
    let query = supabase
      .from('collateral_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (body.registries && body.registries.length > 0) {
      query = query.in('registry', body.registries);
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

    const filteredRecords: CollateralRecord[] = records ?? [];

    // Fetch audit logs for compliance metrics
    let auditLogs: any[] = [];
    if (body.reportType === 'compliance_metrics') {
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

    // Generate PDF
    let pdfBuffer: Buffer;
    const reportLabels: Record<string, string> = {
      performance_summary: 'Collateral Performance Summary',
      trend_analysis: 'Trend Analysis Report',
      compliance_metrics: 'Compliance Metrics Report',
    };

    switch (body.reportType) {
      case 'performance_summary':
        pdfBuffer = await generatePerformanceSummaryPDF(filteredRecords, body);
        break;
      case 'trend_analysis':
        pdfBuffer = await generateTrendAnalysisPDF(filteredRecords, body);
        break;
      case 'compliance_metrics':
        pdfBuffer = await generateComplianceMetricsPDF(filteredRecords, auditLogs, body);
        break;
      default:
        return NextResponse.json({ error: 'Invalid reportType' }, { status: 400 });
    }

    // Log the export action
    try {
      await supabase.from('audit_logs').insert({
        action: 'EXPORT',
        message: `Performance PDF export: ${reportLabels[body.reportType]}`,
        detail: `Date range: ${body.dateFrom} to ${body.dateTo}, Registries: ${body.registries.join(',') || 'all'}, Records: ${filteredRecords.length}`,
        entity_type: 'export',
        event_category: 'export',
        performed_by_name: 'System',
      });
    } catch {
      // Non-critical
    }

    const reportSlug = reportLabels[body.reportType].toLowerCase().replace(/\s+/g, '_');
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
    console.error('Performance PDF generation error:', err);
    return NextResponse.json({ error: 'PDF generation failed', details: err.message }, { status: 500 });
  }
}
