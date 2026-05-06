import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';

interface AuditLogPdfRequest {
  search?: string;
  action?: string;
  entityType?: string;
  eventCategory?: string;
  dateFrom?: string;
  dateTo?: string;
  performedBy?: string;
  collateralId?: string;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function addPageHeader(doc: any, title: string, subtitle: string, pageWidth: number): number {
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

function addFooter(doc: any, pageWidth: number, pageHeight: number) {
  doc.setFillColor(243, 244, 246);
  doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Confidential — EXIM Bank Tanzania | CollateralMS Audit Log', 14, pageHeight - 3);
  doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - 14, pageHeight - 3, { align: 'right' });
}

export async function POST(request: NextRequest) {
  try {
    const body: AuditLogPdfRequest = await request.json();
    const supabase = await createClient();

    // Build query with filters
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (body.action && body.action !== 'All') query = query.eq('action', body.action);
    if (body.entityType && body.entityType !== 'All') query = query.eq('entity_type', body.entityType);
    if (body.eventCategory && body.eventCategory !== 'All') query = query.eq('event_category', body.eventCategory);
    if (body.dateFrom) query = query.gte('created_at', body.dateFrom);
    if (body.dateTo) {
      const end = new Date(body.dateTo);
      end.setDate(end.getDate() + 1);
      query = query.lt('created_at', end.toISOString());
    }
    if (body.performedBy && body.performedBy !== 'All') query = query.eq('performed_by_name', body.performedBy);
    if (body.collateralId && body.collateralId !== 'All') query = query.eq('collateral_id', body.collateralId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    let entries = data ?? [];

    // Client-side search filter
    if (body.search) {
      const s = body.search.toLowerCase();
      entries = entries.filter((e: any) =>
        (e.message ?? '').toLowerCase().includes(s) ||
        (e.collateral_id ?? '').toLowerCase().includes(s) ||
        (e.performed_by_name ?? '').toLowerCase().includes(s) ||
        (e.detail ?? '').toLowerCase().includes(s) ||
        (e.ip_address ?? '').toLowerCase().includes(s)
      );
    }

    // Build PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const periodLabel = body.dateFrom || body.dateTo
      ? `Period: ${body.dateFrom || '—'} to ${body.dateTo || '—'}`
      : `All records — exported ${new Date().toLocaleDateString('en-GB')}`;

    let y = addPageHeader(doc, 'Audit Log — Compliance Export', periodLabel, pageWidth);

    // Summary boxes
    const today = new Date().toDateString();
    const todayCount = entries.filter((e: any) => new Date(e.created_at).toDateString() === today).length;
    const uniqueUsers = new Set(entries.map((e: any) => e.performed_by_name)).size;
    const uniqueCollaterals = new Set(entries.map((e: any) => e.collateral_id).filter(Boolean)).size;

    const boxW = (pageWidth - 28 - 3 * 4) / 4;
    const summaryBoxes = [
      { label: 'Total Events', value: String(entries.length) },
      { label: 'Events Today', value: String(todayCount) },
      { label: 'Unique Users', value: String(uniqueUsers) },
      { label: 'Collateral Records', value: String(uniqueCollaterals) },
    ];
    summaryBoxes.forEach((box, i) => {
      const x = 14 + i * (boxW + 4);
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(x, y, boxW, 18, 2, 2, 'F');
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(box.label, x + 4, y + 6);
      doc.setTextColor(26, 58, 92);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(box.value, x + 4, y + 14);
    });
    y += 24;

    // Action breakdown table
    const actionGroups: Record<string, number> = {};
    entries.forEach((e: any) => {
      const a = e.action ?? 'unknown';
      actionGroups[a] = (actionGroups[a] ?? 0) + 1;
    });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text('Action Summary', 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Action', 'Count', '% of Total']],
      body: Object.entries(actionGroups)
        .sort((a, b) => b[1] - a[1])
        .map(([action, count]) => [
          action.replace(/_/g, ' ').toUpperCase(),
          count,
          entries.length > 0 ? `${((count / entries.length) * 100).toFixed(1)}%` : '0%',
        ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      tableWidth: 100,
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Full audit log detail table
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 58, 92);
    doc.text('Detailed Audit Trail', 14, y + 4);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [['Timestamp', 'Action', 'Entity', 'Collateral ID', 'Message', 'Performed By', 'IP Address', 'Category']],
      body: entries.map((e: any) => [
        formatDateTime(e.created_at),
        (e.action ?? '').replace(/_/g, ' ').toUpperCase(),
        e.entity_type ?? '—',
        e.collateral_id ?? '—',
        e.message ?? '—',
        e.performed_by_name ?? 'System',
        e.ip_address ?? '—',
        (e.event_category ?? '—').replace(/_/g, ' '),
      ]),
      styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        3: { cellWidth: 25 },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 30 },
        6: { cellWidth: 22 },
        7: { cellWidth: 25 },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => addFooter(doc, pageWidth, pageHeight),
    });

    addFooter(doc, pageWidth, pageHeight);

    // Log the export
    try {
      await supabase.from('audit_logs').insert({
        action: 'export',
        message: `Audit log PDF exported (${entries.length} events)`,
        detail: `Filters: action=${body.action || 'all'}, user=${body.performedBy || 'all'}, period=${body.dateFrom || '—'} to ${body.dateTo || '—'}`,
        entity_type: 'system',
        event_category: 'export',
        performed_by_name: 'System',
      });
    } catch {
      // Non-critical
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `audit_log_compliance_${dateStr}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err: any) {
    console.error('Audit log PDF error:', err);
    return NextResponse.json({ error: 'PDF generation failed', details: err.message }, { status: 500 });
  }
}
