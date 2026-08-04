import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTSh(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
  if (isNaN(num)) return String(value);
  return `TSh ${num.toLocaleString('en-US')}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function addPageHeader(doc: any, title: string, subtitle: string, pageWidth: number): number {
  // Header bar
  doc.setFillColor(26, 58, 92);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
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

function addFooter(doc: any, pageWidth: number, pageHeight: number) {
  doc.setFillColor(243, 244, 246);
  doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Confidential — EXIM Bank Tanzania | CollateralMS', 14, pageHeight - 3);
  doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - 14, pageHeight - 3, { align: 'right' });
}

function addSectionTitle(doc: any, title: string, y: number): number {
  doc.setFillColor(240, 245, 255);
  doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 8, 'F');
  doc.setTextColor(26, 58, 92);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 17, y + 5.5);
  return y + 12;
}

function addKpiBoxes(
  doc: any,
  boxes: { label: string; value: string; color?: [number, number, number] }[],
  startY: number,
  pageWidth: number
): number {
  const cols = Math.min(boxes.length, 4);
  const boxW = (pageWidth - 28 - (cols - 1) * 4) / cols;
  let row = 0;
  boxes.forEach((box, i) => {
    if (i > 0 && i % cols === 0) row++;
    const col = i % cols;
    const x = 14 + col * (boxW + 4);
    let y = startY + row * 22;
    const [r, g, b] = box.color ?? [243, 244, 246];
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, y, boxW, 18, 2, 2, 'F');
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(box.label, x + 4, y + 6);
    doc.setTextColor(26, 58, 92);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(String(box.value), x + 4, y + 14);
  });
  const rows = Math.ceil(boxes.length / cols);
  return startY + rows * 22 + 4;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const collateralRecordId = searchParams.get('id');

  if (!collateralRecordId) {
    return NextResponse.json({ error: 'Missing collateral id' }, { status: 400 });
  }

  const supabase = await createClient();

  // ── Fetch collateral record ──────────────────────────────────────────────
  const { data: collateralRow, error: collateralError } = await supabase
    .from('collateral_records')
    .select('*')
    .eq('id', collateralRecordId)
    .single();

  if (collateralError || !collateralRow) {
    return NextResponse.json({ error: 'Collateral not found' }, { status: 404 });
  }

  // ── Fetch documents ──────────────────────────────────────────────────────
  const { data: documents } = await supabase
    .from('collateral_documents')
    .select('*')
    .eq('collateral_record_id', collateralRecordId)
    .order('created_at', { ascending: false });

  // ── Fetch perfection requests ────────────────────────────────────────────
  const { data: perfectionRows } = await supabase
    .from('perfection_requests')
    .select('*')
    .eq('collateral_id', collateralRow.collateral_id)
    .order('created_at', { ascending: false });

  // ── Fetch valuations ─────────────────────────────────────────────────────
  const { data: valuationRows } = await supabase
    .from('collateral_valuations')
    .select('*')
    .eq('collateral_id', collateralRow.collateral_id)
    .order('scheduled_date', { ascending: false });

  // ── Fetch workflow instances ──────────────────────────────────────────────
  const { data: workflowRows } = await supabase
    .from('workflow_instances')
    .select('*, workflow_templates(name, workflow_type)')
    .eq('reference_id', collateralRecordId)
    .order('created_at', { ascending: false });

  // ── Fetch audit logs (last 20) ────────────────────────────────────────────
  const { data: auditRows } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('collateral_record_id', collateralRecordId)
    .order('created_at', { ascending: false })
    .limit(20);

  // ─── Build PDF ─────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const collateralId = collateralRow.collateral_id ?? collateralRow.id;
  const obligor = collateralRow.obligor ?? '—';

  let y = addPageHeader(
    doc,
    `Collateral Summary Report`,
    `${collateralId} · ${obligor} · ${collateralRow.collateral_type ?? '—'}`,
    pageWidth
  );

  // ── SECTION 1: Core Details ────────────────────────────────────────────────
  y = addSectionTitle(doc, '1. Collateral Details', y);

  const detailRows = [
    ['Collateral ID', collateralId, 'Obligor', obligor],
    ['Type', collateralRow.collateral_type ?? '—', 'Registry', collateralRow.registry ?? '—'],
    ['Status', collateralRow.status ?? '—', 'Assigned Officer', collateralRow.assigned_officer ?? '—'],
    ['Facility ID', collateralRow.facility_id ?? '—', 'Registration Date', formatDate(collateralRow.registration_date)],
    ['Perfection Deadline', formatDate(collateralRow.perfection_deadline), 'Days to Deadline', collateralRow.days_to_deadline ?? '—'],
    ['Physical Address', collateralRow.location_address ?? collateralRow.physical_address ?? '—', 'Created At', formatDate(collateralRow.created_at)],
  ];

  autoTable(doc, {
    startY: y,
    body: detailRows.map(([k1, v1, k2, v2]) => [k1, v1, k2, v2]),
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      1: { textColor: [15, 23, 42], cellWidth: 52 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 38 },
      3: { textColor: [15, 23, 42], cellWidth: 52 },
    },
    margin: { left: 14, right: 14 },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── SECTION 2: KPIs ────────────────────────────────────────────────────────
  y = addSectionTitle(doc, '2. Key Performance Indicators', y);

  const valuationAmount = collateralRow.valuation_amount != null ? parseFloat(collateralRow.valuation_amount) : null;
  const ltvRatio = collateralRow.ltv_ratio != null ? parseFloat(collateralRow.ltv_ratio) : null;
  const maxSecurable = collateralRow.max_securable_amount != null ? parseFloat(collateralRow.max_securable_amount) : null;
  const availableEquity = collateralRow.available_equity != null ? parseFloat(collateralRow.available_equity) : null;

  const kpiBoxes = [
    {
      label: 'Declared Value',
      value: formatTSh(collateralRow.value_tsh),
      color: [243, 244, 246] as [number, number, number],
    },
    {
      label: 'Valuation Amount',
      value: valuationAmount != null ? formatTSh(valuationAmount) : '—',
      color: [240, 253, 244] as [number, number, number],
    },
    {
      label: 'LTV Ratio',
      value: ltvRatio != null ? `${ltvRatio.toFixed(1)}%` : '—',
      color: ltvRatio != null && ltvRatio > 80
        ? [254, 226, 226] as [number, number, number]
        : [240, 253, 244] as [number, number, number],
    },
    {
      label: 'Available Equity',
      value: availableEquity != null ? formatTSh(availableEquity) : '—',
      color: [243, 244, 246] as [number, number, number],
    },
  ];

  y = addKpiBoxes(doc, kpiBoxes, y, pageWidth);

  // KPI table
  autoTable(doc, {
    startY: y,
    head: [['KPI', 'Value', 'Notes']],
    body: [
      ['Declared Value (TSh)', formatTSh(collateralRow.value_tsh), 'As registered in the system'],
      ['Valuation Amount (TSh)', valuationAmount != null ? formatTSh(valuationAmount) : '—', 'Latest approved valuation'],
      ['Max Securable Amount (TSh)', maxSecurable != null ? formatTSh(maxSecurable) : '—', 'Based on valuation'],
      ['Available Equity (TSh)', availableEquity != null ? formatTSh(availableEquity) : '—', 'Equity after facility utilisation'],
      ['LTV Ratio', ltvRatio != null ? `${ltvRatio.toFixed(2)}%` : '—', ltvRatio != null && ltvRatio > 80 ? '⚠ Exceeds 80% threshold' : 'Within acceptable range'],
      ['Requires Perfection', collateralRow.requires_perfection ? 'Yes' : 'No', ''],
      ['Days to Deadline', collateralRow.days_to_deadline ?? '—', collateralRow.days_to_deadline != null && collateralRow.days_to_deadline < 0 ? '⚠ Overdue' : ''],
      ['Total Documents', String((documents ?? []).length), 'Attached to this collateral'],
      ['Workflow Instances', String((workflowRows ?? []).length), 'All workflow types'],
    ],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 55 },
      2: { textColor: [107, 114, 128] },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── SECTION 3: Workflow Instances ──────────────────────────────────────────
  y = addSectionTitle(doc, '3. Workflow Instances', y);

  if ((workflowRows ?? []).length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('No workflow instances found for this collateral.', 14, y + 4);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Workflow', 'Type', 'Status', 'Started By', 'Started At', 'Completed At']],
      body: (workflowRows ?? []).map((w: any) => [
        w.workflow_templates?.name ?? w.reference_label ?? '—',
        w.workflow_templates?.workflow_type ?? w.reference_type ?? '—',
        w.status ?? '—',
        w.started_by_name ?? w.started_by ?? '—',
        formatDate(w.created_at),
        w.completed_at ? formatDate(w.completed_at) : '—',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── SECTION 4: Perfection Requests ────────────────────────────────────────
  y = addSectionTitle(doc, '4. Perfection Requests', y);

  if ((perfectionRows ?? []).length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('No perfection requests found.', 14, y + 4);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Request Status', 'Submitted By', 'Submitted At', 'Reviewed By', 'Reviewed At', 'Priority']],
      body: (perfectionRows ?? []).map((p: any) => [
        p.request_status ?? '—',
        p.submitted_by_name ?? '—',
        formatDate(p.submitted_at),
        p.reviewed_by_name ?? '—',
        formatDate(p.reviewed_at),
        p.priority ?? 'Normal',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── SECTION 5: Valuations ─────────────────────────────────────────────────
  y = addSectionTitle(doc, '5. Valuation History', y);

  if ((valuationRows ?? []).length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('No valuation records found.', 14, y + 4);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Status', 'Scheduled', 'Completed', 'Amount (TSh)', 'Valuer', 'Method']],
      body: (valuationRows ?? []).map((v: any) => [
        v.valuation_type ?? '—',
        v.valuation_status ?? '—',
        formatDate(v.scheduled_date),
        formatDate(v.completed_date),
        v.valuation_amount != null ? formatTSh(parseFloat(v.valuation_amount)) : '—',
        v.valuer_name ?? '—',
        v.valuation_method ?? '—',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── SECTION 6: Attached Documents ─────────────────────────────────────────
  y = addSectionTitle(doc, '6. Attached Documents', y);

  if ((documents ?? []).length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('No documents attached to this collateral.', 14, y + 4);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Document Type', 'File Name', 'Version', 'Uploaded By', 'Uploaded At', 'Stage', 'Size (KB)']],
      body: (documents ?? []).map((d: any) => [
        d.document_type ?? '—',
        d.file_name ?? '—',
        `v${d.version ?? 1}`,
        d.uploaded_by_name ?? '—',
        formatDate(d.created_at),
        d.workflow_stage ?? 'General',
        d.file_size ? `${Math.round(d.file_size / 1024)} KB` : '—',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── SECTION 7: Recent Audit Trail ─────────────────────────────────────────
  y = addSectionTitle(doc, '7. Recent Audit Trail (Last 20 Events)', y);

  if ((auditRows ?? []).length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('No audit events found.', 14, y + 4);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Action', 'Message', 'Performed By']],
      body: (auditRows ?? []).map((a: any) => [
        formatDate(a.created_at),
        a.action ?? a.event_category ?? '—',
        (a.message ?? '').slice(0, 80),
        a.performed_by_name ?? a.performed_by ?? '—',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        2: { cellWidth: 80 },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });
  }

  // Final footer on last page
  addFooter(doc, pageWidth, pageHeight);

  // ── Compliance footer note ─────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, pageWidth, pageHeight);
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const fileName = `collateral-summary-${collateralId}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
}
