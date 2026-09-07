import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardReportRequest {
  reportDate: string;
  reportPeriod: string;
  generatedAt: string;
  nplAging: any;
  provisionReconciliation: any;
  stressTests: any[];
  concentrationBreaches: any[];
  valuationFlagSummary: any[];
  portfolioStats: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNum(v: number): string {
  if (!v || isNaN(v)) return '—';
  if (v >= 1e9) return `TZS ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `TZS ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `TZS ${(v / 1e3).toFixed(0)}K`;
  return `TZS ${v.toLocaleString()}`;
}

function fmtPct(v: number): string {
  if (v == null || isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

const BRAND_NAVY: [number, number, number] = [10, 42, 78];
const BRAND_BLUE: [number, number, number] = [0, 124, 179];
const LIGHT_GRAY: [number, number, number] = [248, 249, 250];
const MID_GRAY: [number, number, number] = [107, 114, 128];
const RED_LIGHT: [number, number, number] = [254, 226, 226];
const AMBER_LIGHT: [number, number, number] = [254, 243, 199];
const GREEN_LIGHT: [number, number, number] = [209, 250, 229];

function addCoverHeader(doc: any, pageWidth: number, pageHeight: number, data: BoardReportRequest): void {
  // Navy header band
  doc.setFillColor(...BRAND_NAVY);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Blue accent stripe
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 28, pageWidth, 3, 'F');

  // Bank name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EXIM BANK TANZANIA', 14, 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Collateral Management System', 14, 18);
  doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString('en-GB')}`, pageWidth - 14, 18, { align: 'right' });

  // Confidential badge
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(pageWidth - 50, 6, 36, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFIDENTIAL', pageWidth - 32, 11.5, { align: 'center' });
}

function addPageHeader(doc: any, pageWidth: number, title: string, section: string): number {
  doc.setFillColor(...BRAND_NAVY);
  doc.rect(0, 0, pageWidth, 18, 'F');
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 18, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EXIM Bank Tanzania — Board Report', 14, 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(section, 14, 14);
  doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - 14, 14, { align: 'right' });

  doc.setTextColor(...BRAND_NAVY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 32);
  return 38;
}

function addFooter(doc: any, pageWidth: number, pageHeight: number, reportPeriod: string) {
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
  doc.setTextColor(...MID_GRAY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`BOT Board Report — ${reportPeriod} | EXIM Bank Tanzania | CollateralMS`, 14, pageHeight - 3.5);
  doc.text(`CONFIDENTIAL — For Board Approval Only`, pageWidth - 14, pageHeight - 3.5, { align: 'right' });
}

function addSectionBadge(doc: any, label: string, y: number): number {
  doc.setFillColor(...BRAND_NAVY);
  doc.rect(14, y, 5, 9, 'F');
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(19, y, 2, 9, 'F');
  doc.setTextColor(...BRAND_NAVY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(label, 25, y + 6.5);
  return y + 14;
}

function addKpiRow(doc: any, kpis: { label: string; value: string; color?: [number, number, number] }[], y: number, pageWidth: number): number {
  const boxW = (pageWidth - 28 - (kpis.length - 1) * 4) / kpis.length;
  kpis.forEach((kpi, i) => {
    const x = 14 + i * (boxW + 4);
    const [r, g, b] = kpi.color ?? LIGHT_GRAY;
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, y, boxW, 20, 2, 2, 'F');
    doc.setTextColor(...MID_GRAY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, x + 5, y + 7);
    doc.setTextColor(...BRAND_NAVY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, x + 5, y + 16);
  });
  return y + 26;
}

const BOT_CONCENTRATION_LIMIT = 25;

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: BoardReportRequest = await request.json();
    const { reportDate, reportPeriod, nplAging, provisionReconciliation, stressTests, concentrationBreaches, valuationFlagSummary, portfolioStats } = body;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const addFtr = () => addFooter(doc, pageWidth, pageHeight, reportPeriod);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — COVER & EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════════════════════════════════
    addCoverHeader(doc, pageWidth, pageHeight, body);

    // Report title block
    let y = 38;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'F');
    doc.setTextColor(...BRAND_NAVY);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Board Collateral Risk Report', 20, y + 9);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MID_GRAY);
    doc.text(`Reporting Period: ${reportPeriod}  ·  As of: ${fmtDate(reportDate)}  ·  BOT Regulatory Format`, 20, y + 16);
    doc.setFontSize(8);
    doc.text('Prepared for: Board of Directors — Credit & Risk Committee', pageWidth - 18, y + 9, { align: 'right' });
    doc.text('Classification: STRICTLY CONFIDENTIAL', pageWidth - 18, y + 16, { align: 'right' });
    y += 28;

    // Portfolio KPIs
    y = addSectionBadge(doc, 'Portfolio Overview', y);
    y = addKpiRow(doc, [
      { label: 'Total Collateral Items', value: String(portfolioStats.totalCollateral) },
      { label: 'Portfolio Value', value: fmtNum(portfolioStats.totalPortfolioValue) },
      { label: 'Total Loan Exposure', value: fmtNum(portfolioStats.totalLoanExposure) },
      { label: 'Portfolio LTV', value: fmtPct(portfolioStats.portfolioLTV), color: portfolioStats.portfolioLTV > 80 ? RED_LIGHT : portfolioStats.portfolioLTV > 70 ? AMBER_LIGHT : GREEN_LIGHT },
      { label: 'Active Loans', value: String(portfolioStats.activeLoans) },
      { label: 'NPL Count', value: String(portfolioStats.nplCount), color: portfolioStats.nplCount > 0 ? RED_LIGHT : GREEN_LIGHT },
    ], y, pageWidth);

    // NPL KPIs
    y = addSectionBadge(doc, 'NPL Summary', y);
    y = addKpiRow(doc, [
      { label: 'Total NPL Balance', value: fmtNum(nplAging.totalNplBalance), color: RED_LIGHT },
      { label: 'NPL Ratio', value: fmtPct(nplAging.nplRatio), color: nplAging.nplRatio > 5 ? RED_LIGHT : AMBER_LIGHT },
      { label: 'Total Provision', value: fmtNum(nplAging.totalProvision), color: AMBER_LIGHT },
      { label: 'Coverage Ratio', value: fmtPct(nplAging.coverageRatio), color: nplAging.coverageRatio >= 100 ? GREEN_LIGHT : RED_LIGHT },
      { label: 'Concentration Breaches', value: String(concentrationBreaches.length), color: concentrationBreaches.length > 0 ? RED_LIGHT : GREEN_LIGHT },
      { label: 'Open Valuation Flags', value: String(valuationFlagSummary.reduce((s: number, f: any) => s + f.count, 0)), color: AMBER_LIGHT },
    ], y, pageWidth);

    // Stress test summary row
    y = addSectionBadge(doc, 'Stress Test Snapshot', y);
    const stressKpis = stressTests.map((s: any) => ({
      label: s.label,
      value: `${fmtPct(s.stressedPortfolioLTV)} LTV`,
      color: s.stressedPortfolioLTV > 85 ? RED_LIGHT : s.stressedPortfolioLTV > 75 ? AMBER_LIGHT : GREEN_LIGHT,
    }));
    if (stressKpis.length > 0) {
      y = addKpiRow(doc, stressKpis, y, pageWidth);
    }

    addFtr();

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — NPL AGING SCHEDULE
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = addPageHeader(doc, 'Section 1 — NPL Aging Schedule', `BOT Loan Classification  |  ${reportPeriod}`, pageWidth);

    y = addSectionBadge(doc, 'Loan Classification by BOT Tier', y);

    autoTable(doc, {
      startY: y,
      head: [['BOT Classification', 'Loan Count', 'Outstanding Balance', 'Provision Rate', 'Required Provision', 'Coverage']],
      body: (nplAging.buckets ?? []).map((b: any) => [
        b.classification,
        b.count,
        fmtNum(b.outstandingBalance),
        fmtPct(b.provisionRate),
        fmtNum(b.provisionAmount),
        b.outstandingBalance > 0 ? fmtPct((b.provisionAmount / b.outstandingBalance) * 100) : '—',
      ]),
      foot: [['TOTAL', nplAging.buckets.reduce((s: number, b: any) => s + b.count, 0), fmtNum(nplAging.buckets.reduce((s: number, b: any) => s + b.outstandingBalance, 0)), '—', fmtNum(nplAging.totalProvision), fmtPct(nplAging.coverageRatio)]],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: BRAND_NAVY, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'center' } },
      margin: { left: 14, right: 14 },
      didDrawPage: addFtr,
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // NPL narrative
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(14, y, pageWidth - 28, 18, 2, 2, 'F');
    doc.setTextColor(120, 53, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('BOT Regulatory Note:', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(92, 45, 10);
    doc.text(
      `NPL Ratio: ${fmtPct(nplAging.nplRatio)}  |  BOT Threshold: 5.0%  |  Provision Coverage: ${fmtPct(nplAging.coverageRatio)}  |  BOT Minimum Coverage: 100%`,
      18, y + 12
    );

    addFtr();

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 3 — PROVISION RECONCILIATION
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = addPageHeader(doc, 'Section 2 — Provision Reconciliation', `Movement Analysis  |  ${reportPeriod}`, pageWidth);

    y = addSectionBadge(doc, 'Provision Movement by Classification Tier', y);

    autoTable(doc, {
      startY: y,
      head: [['Classification', 'Opening Provision', 'New Provision', 'Written Off', 'Recoveries', 'Closing Provision', 'Net Movement']],
      body: (provisionReconciliation.rows ?? []).map((r: any) => [
        r.classification,
        fmtNum(r.openingProvision),
        fmtNum(r.newProvision),
        fmtNum(r.writtenOff),
        fmtNum(r.recoveries),
        fmtNum(r.closingProvision),
        { content: fmtNum(r.movement), styles: { textColor: r.movement >= 0 ? [220, 38, 38] : [5, 150, 105] } },
      ]),
      foot: [['TOTAL', fmtNum(provisionReconciliation.totalOpening), '—', '—', '—', fmtNum(provisionReconciliation.totalClosing), fmtNum(provisionReconciliation.netMovement)]],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: BRAND_NAVY, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      margin: { left: 14, right: 14 },
      didDrawPage: addFtr,
    });

    addFtr();

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 4 — STRESS TEST RESULTS
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = addPageHeader(doc, 'Section 3 — Stress Test Results', `Collateral Value Decline Scenarios  |  ${reportPeriod}`, pageWidth);

    y = addSectionBadge(doc, 'Portfolio Stress Scenarios (10% / 20% / 30% Decline)', y);

    autoTable(doc, {
      startY: y,
      head: [['Scenario', 'Original Portfolio Value', 'Stressed Portfolio Value', 'Value at Risk', 'Stressed Portfolio LTV', 'LTV Breach Count', 'Breach Exposure']],
      body: stressTests.map((s: any) => [
        s.label,
        fmtNum(s.originalPortfolioValue),
        fmtNum(s.stressedPortfolioValue),
        { content: fmtNum(s.valueAtRisk), styles: { textColor: [220, 38, 38] } },
        { content: fmtPct(s.stressedPortfolioLTV), styles: { textColor: s.stressedPortfolioLTV > 80 ? [220, 38, 38] : s.stressedPortfolioLTV > 70 ? [180, 83, 9] : [5, 150, 105] } },
        { content: String(s.breachCount), styles: { textColor: s.breachCount > 0 ? [220, 38, 38] : [5, 150, 105] } },
        fmtNum(s.breachExposure),
      ]),
      styles: { fontSize: 8, cellPadding: 3.5 },
      headStyles: { fillColor: BRAND_NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'right' } },
      margin: { left: 14, right: 14 },
      didDrawPage: addFtr,
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Stress methodology note
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'F');
    doc.setTextColor(...BRAND_NAVY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Stress Test Methodology:', 18, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text('Asset-class specific stress multipliers applied: Real Estate (1.0×), Equities (1.5×), Motor Vehicle (1.1×), Fixed Deposit (0.2×), Debenture (0.8×), Guarantee (0.5×).', 18, y + 13);
    doc.text('LTV breach threshold per BOT-prescribed limits per collateral type. Scenarios represent instantaneous market shock.', 18, y + 19);

    addFtr();

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 5 — CONCENTRATION BREACH LIST
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = addPageHeader(doc, 'Section 4 — Concentration Breach List', `Single-Obligor Concentration  |  BOT Limit: ${BOT_CONCENTRATION_LIMIT}%  |  ${reportPeriod}`, pageWidth);

    y = addSectionBadge(doc, 'Obligors Exceeding BOT Concentration Limit', y);

    if (concentrationBreaches.length === 0) {
      doc.setFillColor(...GREEN_LIGHT);
      doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('✓  No concentration breaches detected. All obligors within BOT single-obligor limit.', 18, y + 10);
      y += 22;
    } else {
      autoTable(doc, {
        startY: y,
        head: [['Obligor Name', 'Code', 'Collateral Type', 'Exposure Amount', 'Portfolio Share', 'BOT Limit', 'Breach Amount', 'Severity']],
        body: concentrationBreaches.map((b: any) => [
          b.obligorName,
          b.obligorCode,
          b.collateralType,
          fmtNum(b.exposureAmount),
          { content: fmtPct(b.portfolioShare), styles: { textColor: [220, 38, 38] } },
          fmtPct(b.botLimit),
          { content: fmtNum(b.breachAmount), styles: { textColor: [220, 38, 38] } },
          { content: b.severity.toUpperCase(), styles: { textColor: b.severity === 'high' ? [220, 38, 38] : b.severity === 'medium' ? [180, 83, 9] : [107, 114, 128] } },
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'center' } },
        margin: { left: 14, right: 14 },
        didDrawPage: addFtr,
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    addFtr();

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 6 — VALUATION FLAG SUMMARY
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = addPageHeader(doc, 'Section 5 — Valuation Flag Summary', `Pricing Integrity & Valuation Alerts  |  ${reportPeriod}`, pageWidth);

    y = addSectionBadge(doc, 'Active Valuation & Pricing Flags by Type', y);

    const totalFlags = valuationFlagSummary.reduce((s: number, f: any) => s + f.count, 0);
    const criticalFlags = valuationFlagSummary.reduce((s: number, f: any) => s + f.critical, 0);

    y = addKpiRow(doc, [
      { label: 'Total Open Flags', value: String(totalFlags), color: totalFlags > 0 ? AMBER_LIGHT : GREEN_LIGHT },
      { label: 'Critical Flags', value: String(criticalFlags), color: criticalFlags > 0 ? RED_LIGHT : GREEN_LIGHT },
      { label: 'High Severity', value: String(valuationFlagSummary.reduce((s: number, f: any) => s + f.high, 0)), color: AMBER_LIGHT },
      { label: 'Flag Types Active', value: String(valuationFlagSummary.length) },
    ], y, pageWidth);

    if (valuationFlagSummary.length === 0) {
      doc.setFillColor(...GREEN_LIGHT);
      doc.roundedRect(14, y, pageWidth - 28, 16, 2, 2, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('✓  No open valuation flags. All collateral valuations are current and market-priced.', 18, y + 10);
      y += 22;
    } else {
      const flagTypeLabels: Record<string, string> = {
        overdue_valuation: 'Overdue Valuation',
        market_unavailable: 'Market Unavailable',
        theoretical_pricing_required: 'Theoretical Pricing Required',
        stale_valuation: 'Stale Valuation',
        no_market_data: 'No Market Data',
      };

      autoTable(doc, {
        startY: y,
        head: [['Flag Type', 'Total Count', 'Critical', 'High', 'Medium', 'Low', 'Avg LTV Impact']],
        body: valuationFlagSummary.map((f: any) => [
          flagTypeLabels[f.flagType] ?? f.flagType.replace(/_/g, ' '),
          f.count,
          { content: String(f.critical), styles: { textColor: f.critical > 0 ? [220, 38, 38] : [107, 114, 128] } },
          { content: String(f.high), styles: { textColor: f.high > 0 ? [180, 83, 9] : [107, 114, 128] } },
          String(f.medium),
          String(f.low),
          f.count > 0 ? fmtPct(f.totalLtvImpact / f.count) : '—',
        ]),
        foot: [['TOTAL', totalFlags, criticalFlags, valuationFlagSummary.reduce((s: number, f: any) => s + f.high, 0), valuationFlagSummary.reduce((s: number, f: any) => s + f.medium, 0), valuationFlagSummary.reduce((s: number, f: any) => s + f.low, 0), '—']],
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [120, 53, 15], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
        margin: { left: 14, right: 14 },
        didDrawPage: addFtr,
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Board approval block
    y = Math.max(y, pageHeight - 55);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(14, y, pageWidth - 28, 36, 2, 2, 'F');
    doc.setTextColor(...BRAND_NAVY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('BOARD APPROVAL RECORD', 18, y + 8);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);

    const approvalCols = ['Chief Risk Officer', 'Chief Credit Officer', 'Managing Director', 'Board Chairman'];
    const colW = (pageWidth - 28 - 15) / approvalCols.length;
    approvalCols.forEach((role, i) => {
      const x = 14 + i * (colW + 5);
      doc.setDrawColor(180, 180, 180);
      doc.line(x, y + 26, x + colW, y + 26);
      doc.setFontSize(7);
      doc.setTextColor(...MID_GRAY);
      doc.text(role, x + colW / 2, y + 32, { align: 'center' });
      doc.text('Signature / Date', x + colW / 2, y + 36, { align: 'center' });
    });

    addFtr();

    // Output PDF
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="BOT-Board-Report-${body.reportPeriod.replace(/\s/g, '-')}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[board-report/pdf]', err);
    return NextResponse.json({ error: err.message ?? 'PDF generation failed' }, { status: 500 });
  }
}
