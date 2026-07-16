import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExcelExportRequest {
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

function formatTSh(value: string | number): number {
  const num = typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
  return isNaN(num) ? 0 : num;
}

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── XLSX Builder (native XML — no external dependency) ───────────────────────
// Builds a valid .xlsx file using the Open XML format (ZIP of XML files).
// This avoids needing the `xlsx` npm package while producing a real Excel workbook.

function buildXlsx(sheets: { name: string; rows: (string | number | null)[][] }[]): Buffer {
  // We'll use a minimal ZIP implementation inline
  // Each sheet becomes a worksheet XML

  const sharedStrings: string[] = [];
  const sharedStringMap = new Map<string, number>();

  function getSharedStringIndex(s: string): number {
    const key = String(s);
    if (sharedStringMap.has(key)) return sharedStringMap.get(key)!;
    const idx = sharedStrings.length;
    sharedStrings.push(key);
    sharedStringMap.set(key, idx);
    return idx;
  }

  function colLetter(n: number): string {
    let s = '';
    n++;
    while (n > 0) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  function buildWorksheetXml(rows: (string | number | null)[][]): string {
    const rowsXml = rows
      .map((row, ri) => {
        const cellsXml = row
          .map((cell, ci) => {
            const ref = `${colLetter(ci)}${ri + 1}`;
            if (cell === null || cell === undefined) return `<c r="${ref}"/>`;
            if (typeof cell === 'number') {
              return `<c r="${ref}" t="n"><v>${cell}</v></c>`;
            }
            const idx = getSharedStringIndex(String(cell));
            return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
          })
          .join('');
        return `<row r="${ri + 1}">${cellsXml}</row>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
  }

  function buildSharedStringsXml(): string {
    const items = sharedStrings
      .map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
      .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${items}</sst>`;
  }

  function buildWorkbookXml(): string {
    const sheetsXml = sheets
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetsXml}</sheets>
</workbook>`;
  }

  function buildWorkbookRels(): string {
    const rels = sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('');
    const sharedStringsRel = `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
  ${sharedStringsRel}
</Relationships>`;
  }

  function buildContentTypes(): string {
    const sheetOverrides = sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetOverrides}
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
  }

  // Build worksheet XMLs first (populates sharedStrings)
  const worksheetXmls = sheets.map((s) => buildWorksheetXml(s.rows));

  // Now build remaining XMLs (sharedStrings must be populated first)
  const sharedStringsXml = buildSharedStringsXml();
  const workbookXml = buildWorkbookXml();
  const workbookRels = buildWorkbookRels();
  const contentTypes = buildContentTypes();

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // Minimal ZIP builder
  function crc32(buf: Buffer): number {
    const table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
      }
      return t;
    })();
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeUint16LE(n: number): Buffer {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n, 0);
    return b;
  }
  function writeUint32LE(n: number): Buffer {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n, 0);
    return b;
  }

  interface ZipEntry {
    name: string;
    data: Buffer;
    crc: number;
    offset: number;
  }

  const entries: ZipEntry[] = [];
  const parts: Buffer[] = [];
  let offset = 0;

  function addFile(name: string, content: string) {
    const data = Buffer.from(content, 'utf8');
    let crc = crc32(data);
    const nameBytes = Buffer.from(name, 'utf8');

    // Local file header
    const localHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      writeUint16LE(20), // version needed
      writeUint16LE(0), // flags
      writeUint16LE(0), // compression (stored)
      writeUint16LE(0), // mod time
      writeUint16LE(0), // mod date
      writeUint32LE(crc),
      writeUint32LE(data.length),
      writeUint32LE(data.length),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0), // extra field length
      nameBytes,
    ]);

    entries.push({ name, data, crc, offset });
    parts.push(localHeader, data);
    offset += localHeader.length + data.length;
  }

  addFile('[Content_Types].xml', contentTypes);
  addFile('_rels/.rels', rootRels);
  addFile('xl/workbook.xml', workbookXml);
  addFile('xl/_rels/workbook.xml.rels', workbookRels);
  worksheetXmls.forEach((xml, i) => addFile(`xl/worksheets/sheet${i + 1}.xml`, xml));
  addFile('xl/sharedStrings.xml', sharedStringsXml);

  // Central directory
  const cdParts: Buffer[] = [];
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const cdEntry = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      writeUint16LE(20), // version made by
      writeUint16LE(20), // version needed
      writeUint16LE(0), // flags
      writeUint16LE(0), // compression
      writeUint16LE(0), // mod time
      writeUint16LE(0), // mod date
      writeUint32LE(entry.crc),
      writeUint32LE(entry.data.length),
      writeUint32LE(entry.data.length),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0), // extra
      writeUint16LE(0), // comment
      writeUint16LE(0), // disk start
      writeUint16LE(0), // internal attr
      writeUint32LE(0), // external attr
      writeUint32LE(entry.offset),
      nameBytes,
    ]);
    cdParts.push(cdEntry);
  }

  const cdBuffer = Buffer.concat(cdParts);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // signature
    writeUint16LE(0), // disk number
    writeUint16LE(0), // disk with cd
    writeUint16LE(entries.length),
    writeUint16LE(entries.length),
    writeUint32LE(cdBuffer.length),
    writeUint32LE(offset),
    writeUint16LE(0), // comment length
  ]);

  return Buffer.concat([...parts, cdBuffer, eocd]);
}

// ─── Sheet Builders ───────────────────────────────────────────────────────────

function buildPerformanceSummarySheets(
  records: CollateralRecord[],
  config: ExcelExportRequest,
): { name: string; rows: (string | number | null)[][] }[] {
  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const pending = records.filter((r) => ['Draft', 'Submitted', 'Under Review'].includes(r.status)).length;
  const perfectionRate = total > 0 ? parseFloat(((perfected / total) * 100).toFixed(2)) : 0;
  const totalValue = records.reduce((s, r) => s + formatTSh(r.value_tsh), 0);

  const summaryRows: (string | number | null)[][] = [
    ['Collateral Performance Summary'],
    [`Period: ${config.dateFrom} to ${config.dateTo}`],
    [`Generated: ${new Date().toISOString()}`],
    [],
    ['KPI', 'Value'],
    ['Total Collateral', total],
    ['Perfected', perfected],
    ['Overdue', overdue],
    ['Pending Review', pending],
    ['Perfection Rate (%)', perfectionRate],
    ['Portfolio Value (TSh)', totalValue],
    [],
    ['Status Breakdown'],
    ['Status', 'Count', '% of Total'],
  ];

  const statusGroups: Record<string, number> = {};
  records.forEach((r) => { statusGroups[r.status] = (statusGroups[r.status] ?? 0) + 1; });
  Object.entries(statusGroups).forEach(([status, count]) => {
    summaryRows.push([status, count, total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0]);
  });

  summaryRows.push([], ['Registry Breakdown'], ['Registry', 'Total', 'Perfected', 'Overdue', 'Perfection Rate (%)']);
  const registryGroups: Record<string, { total: number; perfected: number; overdue: number }> = {};
  records.forEach((r) => {
    if (!registryGroups[r.registry]) registryGroups[r.registry] = { total: 0, perfected: 0, overdue: 0 };
    registryGroups[r.registry].total++;
    if (r.status === 'Perfected') registryGroups[r.registry].perfected++;
    if (r.status === 'Overdue') registryGroups[r.registry].overdue++;
  });
  Object.entries(registryGroups).forEach(([registry, data]) => {
    summaryRows.push([registry, data.total, data.perfected, data.overdue, data.total > 0 ? parseFloat(((data.perfected / data.total) * 100).toFixed(2)) : 0]);
  });

  let sheets: { name: string; rows: (string | number | null)[][] }[] = [
    { name: 'Summary', rows: summaryRows },
  ];

  if (config.includeBreakdown) {
    // Officer breakdown sheet
    const officerGroups: Record<string, { total: number; perfected: number; overdue: number; value: number }> = {};
    records.forEach((r) => {
      const officer = r.assigned_officer ?? 'Unassigned';
      if (!officerGroups[officer]) officerGroups[officer] = { total: 0, perfected: 0, overdue: 0, value: 0 };
      officerGroups[officer].total++;
      if (r.status === 'Perfected') officerGroups[officer].perfected++;
      if (r.status === 'Overdue') officerGroups[officer].overdue++;
      officerGroups[officer].value += formatTSh(r.value_tsh);
    });

    const officerRows: (string | number | null)[][] = [
      ['Officer', 'Total Assigned', 'Perfected', 'Overdue', 'Perfection Rate (%)', 'Portfolio Value (TSh)'],
      ...Object.entries(officerGroups)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([officer, data]) => [
          officer,
          data.total,
          data.perfected,
          data.overdue,
          data.total > 0 ? parseFloat(((data.perfected / data.total) * 100).toFixed(2)) : 0,
          data.value,
        ]),
    ];
    sheets.push({ name: 'Officer Breakdown', rows: officerRows });

    // Collateral type breakdown
    const typeGroups: Record<string, { total: number; perfected: number; value: number }> = {};
    records.forEach((r) => {
      if (!typeGroups[r.collateral_type]) typeGroups[r.collateral_type] = { total: 0, perfected: 0, value: 0 };
      typeGroups[r.collateral_type].total++;
      if (r.status === 'Perfected') typeGroups[r.collateral_type].perfected++;
      typeGroups[r.collateral_type].value += formatTSh(r.value_tsh);
    });

    const typeRows: (string | number | null)[][] = [
      ['Collateral Type', 'Count', 'Perfected', 'Perfection Rate (%)', 'Total Value (TSh)'],
      ...Object.entries(typeGroups)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([type, data]) => [
          type,
          data.total,
          data.perfected,
          data.total > 0 ? parseFloat(((data.perfected / data.total) * 100).toFixed(2)) : 0,
          data.value,
        ]),
    ];
    sheets.push({ name: 'Type Breakdown', rows: typeRows });
  }

  // Raw data sheet
  const dataRows: (string | number | null)[][] = [
    ['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Deadline', 'Days Left', 'Officer', 'Created At'],
    ...records.map((r) => [
      r.collateral_id ?? r.id,
      r.obligor,
      r.collateral_type,
      r.registry,
      r.status,
      formatTSh(r.value_tsh),
      r.perfection_deadline ?? null,
      r.days_to_deadline ?? null,
      r.assigned_officer ?? null,
      r.created_at ? r.created_at.slice(0, 10) : null,
    ]),
  ];
  sheets.push({ name: 'Raw Data', rows: dataRows });

  return sheets;
}

function buildTrendAnalysisSheets(
  records: CollateralRecord[],
  config: ExcelExportRequest,
): { name: string; rows: (string | number | null)[][] }[] {
  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const perfectionRate = total > 0 ? parseFloat(((perfected / total) * 100).toFixed(2)) : 0;

  // Monthly trend
  const monthlyData: Record<string, { total: number; perfected: number; overdue: number }> = {};
  records.forEach((r) => {
    const month = r.created_at ? r.created_at.slice(0, 7) : 'Unknown';
    if (!monthlyData[month]) monthlyData[month] = { total: 0, perfected: 0, overdue: 0 };
    monthlyData[month].total++;
    if (r.status === 'Perfected') monthlyData[month].perfected++;
    if (r.status === 'Overdue') monthlyData[month].overdue++;
  });

  const sortedMonths = Object.keys(monthlyData).sort();

  const trendRows: (string | number | null)[][] = [
    ['Trend Analysis Report'],
    [`Period: ${config.dateFrom} to ${config.dateTo}`],
    [`Generated: ${new Date().toISOString()}`],
    [],
    ['Overall KPIs'],
    ['Total Collateral', total],
    ['Perfected', perfected],
    ['Overdue', overdue],
    ['Perfection Rate (%)', perfectionRate],
    ['Target (%)', 80],
    [],
    ['Monthly Trend Data'],
    ['Month', 'Total Collateral', 'Perfected', 'Overdue', 'Perfection Rate (%)', 'vs Target (%)'],
    ...sortedMonths.map((month) => {
      const d = monthlyData[month];
      const rate = d.total > 0 ? parseFloat(((d.perfected / d.total) * 100).toFixed(2)) : 0;
      return [month, d.total, d.perfected, d.overdue, rate, parseFloat((rate - 80).toFixed(2))];
    }),
  ];

  let sheets: { name: string; rows: (string | number | null)[][] }[] = [
    { name: 'Monthly Trend', rows: trendRows },
  ];

  if (config.includeBreakdown) {
    // Registry trend
    const registryTrend: Record<string, { total: number; perfected: number; overdue: number }> = {};
    records.forEach((r) => {
      if (!registryTrend[r.registry]) registryTrend[r.registry] = { total: 0, perfected: 0, overdue: 0 };
      registryTrend[r.registry].total++;
      if (r.status === 'Perfected') registryTrend[r.registry].perfected++;
      if (r.status === 'Overdue') registryTrend[r.registry].overdue++;
    });

    const registryRows: (string | number | null)[][] = [
      ['Registry', 'Total', 'Perfected', 'Overdue', 'Perfection Rate (%)', 'Status'],
      ...Object.entries(registryTrend).map(([registry, data]) => {
        const rate = data.total > 0 ? parseFloat(((data.perfected / data.total) * 100).toFixed(2)) : 0;
        return [registry, data.total, data.perfected, data.overdue, rate, rate >= 80 ? 'On Track' : 'Below Target'];
      }),
    ];
    sheets.push({ name: 'Registry Trend', rows: registryRows });
  }

  return sheets;
}

function buildComplianceMetricsSheets(
  records: CollateralRecord[],
  auditLogs: any[],
  config: ExcelExportRequest,
): { name: string; rows: (string | number | null)[][] }[] {
  const total = records.length;
  const perfected = records.filter((r) => r.status === 'Perfected').length;
  const overdue = records.filter((r) => r.status === 'Overdue').length;
  const perfectionRate = total > 0 ? parseFloat(((perfected / total) * 100).toFixed(2)) : 0;

  let grade = 'F';
  if (perfectionRate >= 90) grade = 'A';
  else if (perfectionRate >= 80) grade = 'B';
  else if (perfectionRate >= 70) grade = 'C';
  else if (perfectionRate >= 60) grade = 'D';

  const summaryRows: (string | number | null)[][] = [
    ['Compliance Metrics Report'],
    [`Period: ${config.dateFrom} to ${config.dateTo}`],
    [`Generated: ${new Date().toISOString()}`],
    [],
    ['Overall Compliance'],
    ['Overall Grade', grade],
    ['Perfection Rate (%)', perfectionRate],
    ['Total Collateral', total],
    ['Overdue Items', overdue],
    ['Audit Events', auditLogs.length],
    [],
    ['Registry Compliance Scorecard'],
    ['Registry', 'Total', 'Perfected', 'Overdue', 'Perfection Rate (%)', 'Grade', 'Compliance Status'],
  ];

  const registryGroups: Record<string, { total: number; perfected: number; overdue: number }> = {};
  records.forEach((r) => {
    if (!registryGroups[r.registry]) registryGroups[r.registry] = { total: 0, perfected: 0, overdue: 0 };
    registryGroups[r.registry].total++;
    if (r.status === 'Perfected') registryGroups[r.registry].perfected++;
    if (r.status === 'Overdue') registryGroups[r.registry].overdue++;
  });

  Object.entries(registryGroups).forEach(([registry, data]) => {
    const rate = data.total > 0 ? parseFloat(((data.perfected / data.total) * 100).toFixed(2)) : 0;
    let g = 'F';
    if (rate >= 90) g = 'A';
    else if (rate >= 80) g = 'B';
    else if (rate >= 70) g = 'C';
    else if (rate >= 60) g = 'D';
    summaryRows.push([registry, data.total, data.perfected, data.overdue, rate, g, rate >= 80 ? 'Compliant' : 'Non-Compliant']);
  });

  let sheets: { name: string; rows: (string | number | null)[][] }[] = [
    { name: 'Compliance Summary', rows: summaryRows },
  ];

  if (config.includeBreakdown) {
    // Non-compliant records
    const nonCompliant = records.filter((r) => r.status === 'Overdue' || r.status === 'Rejected');
    const nonCompliantRows: (string | number | null)[][] = [
      ['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Deadline', 'Days Overdue', 'Officer'],
      ...nonCompliant.map((r) => [
        r.collateral_id ?? r.id,
        r.obligor,
        r.collateral_type,
        r.registry,
        r.status,
        formatTSh(r.value_tsh),
        r.perfection_deadline ?? null,
        r.days_to_deadline !== null && r.days_to_deadline !== undefined ? Math.abs(r.days_to_deadline) : null,
        r.assigned_officer ?? null,
      ]),
    ];
    sheets.push({ name: 'Non-Compliant Records', rows: nonCompliantRows });

    // All records
    const allRows: (string | number | null)[][] = [
      ['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Deadline', 'Days Left', 'Officer', 'Created At'],
      ...records.map((r) => [
        r.collateral_id ?? r.id,
        r.obligor,
        r.collateral_type,
        r.registry,
        r.status,
        formatTSh(r.value_tsh),
        r.perfection_deadline ?? null,
        r.days_to_deadline ?? null,
        r.assigned_officer ?? null,
        r.created_at ? r.created_at.slice(0, 10) : null,
      ]),
    ];
    sheets.push({ name: 'All Records', rows: allRows });
  }

  return sheets;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: ExcelExportRequest = await request.json();

    if (!body.reportType || !body.dateFrom || !body.dateTo) {
      return NextResponse.json({ error: 'Missing required fields: reportType, dateFrom, dateTo' }, { status: 400 });
    }

    const supabase = await createClient();

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

    let sheets: { name: string; rows: (string | number | null)[][] }[];

    switch (body.reportType) {
      case 'performance_summary':
        sheets = buildPerformanceSummarySheets(filteredRecords, body);
        break;
      case 'trend_analysis':
        sheets = buildTrendAnalysisSheets(filteredRecords, body);
        break;
      case 'compliance_metrics':
        sheets = buildComplianceMetricsSheets(filteredRecords, auditLogs, body);
        break;
      default:
        return NextResponse.json({ error: 'Invalid reportType' }, { status: 400 });
    }

    const xlsxBuffer = buildXlsx(sheets);

    // Log the export action
    try {
      const reportLabels: Record<string, string> = {
        performance_summary: 'Collateral Performance Summary',
        trend_analysis: 'Trend Analysis Report',
        compliance_metrics: 'Compliance Metrics Report',
      };
      await supabase.from('audit_logs').insert({
        action: 'EXPORT',
        message: `Excel export: ${reportLabels[body.reportType]}`,
        detail: `Date range: ${body.dateFrom} to ${body.dateTo}, Registries: ${body.registries.join(',') || 'all'}, Records: ${filteredRecords.length}`,
        entity_type: 'export',
        event_category: 'export',
        performed_by_name: 'System',
      });
    } catch {
      // Non-critical
    }

    const reportSlugMap: Record<string, string> = {
      performance_summary: 'performance_summary',
      trend_analysis: 'trend_analysis',
      compliance_metrics: 'compliance_metrics',
    };
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `${reportSlugMap[body.reportType]}_${dateStr}.xlsx`;

    return new NextResponse(xlsxBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(xlsxBuffer.length),
      },
    });
  } catch (err: any) {
    console.error('Excel generation error:', err);
    return NextResponse.json({ error: 'Excel generation failed', details: err.message }, { status: 500 });
  }
}
