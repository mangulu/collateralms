'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { BarChart2, FileSpreadsheet, FileText, Loader2, AlertCircle, CheckCircle2, Clock, Info, Send, PieChart,  } from 'lucide-react';
import { loanClassificationService, ProvisioningReport, getCurrentQuarter,  } from '@/lib/supabase/loanClassificationService';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Icon from '@/components/ui/AppIcon';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTsh(val: number): string {
  if (!val) return '0';
  if (val >= 1e9) return `TSh ${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `TSh ${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `TSh ${(val / 1e3).toFixed(0)}K`;
  return `TSh ${val.toFixed(0)}`;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  Draft:     { color: 'text-slate-700', bg: 'bg-slate-100', icon: Clock },
  Finalized: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
  Submitted: { color: 'text-blue-700',  bg: 'bg-blue-100',  icon: Send },
};

const TIER_CHART_COLORS = ['#16a34a', '#d97706', '#ea580c', '#dc2626', '#9f1239'];

interface TierRow {
  tier: string;
  count: number;
  balance: number;
  provision: number;
  rate: number;
  color: string;
  bg: string;
  border: string;
}

function buildTierRows(report: ProvisioningReport): TierRow[] {
  return [
    { tier: 'Current',              count: report.currentCount,       balance: report.currentBalance,       provision: report.currentProvision,       rate: 0.01, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
    { tier: 'Especially Mentioned', count: report.emCount,            balance: report.emBalance,            provision: report.emProvision,            rate: 0.03, color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
    { tier: 'Substandard',          count: report.substandardCount,   balance: report.substandardBalance,   provision: report.substandardProvision,   rate: 0.20, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
    { tier: 'Doubtful',             count: report.doubtfulCount,      balance: report.doubtfulBalance,      provision: report.doubtfulProvision,      rate: 0.50, color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
    { tier: 'Loss',                 count: report.lossCount,          balance: report.lossBalance,          provision: report.lossProvision,          rate: 1.00, color: 'text-rose-800',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  ];
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function exportToPDF(report: ProvisioningReport) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(26, 58, 92);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('CollateralMS — EXIM Bank Tanzania', 14, 9);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pw - 14, 9, { align: 'right' });

  doc.setTextColor(26, 58, 92);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('Quarterly Provisioning Report', 14, 34);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(`Quarter: ${report.quarter}  |  Status: ${report.status}  |  Report Date: ${report.reportDate}`, 14, 42);
  doc.text('BOT Risk Assets Regulations 2014 — Minimum Provisioning Requirements', 14, 49);

  // Summary boxes
  let y = 58;
  const boxes = [
    { label: 'Total Portfolio', value: formatTsh(report.totalPortfolio), color: [243, 244, 246] as [number,number,number] },
    { label: 'Total Provision', value: formatTsh(report.totalProvision), color: [254, 242, 242] as [number,number,number] },
    { label: 'Provision Ratio', value: report.totalPortfolio > 0 ? `${((report.totalProvision / report.totalPortfolio) * 100).toFixed(2)}%` : '0%', color: [255, 251, 235] as [number,number,number] },
    { label: 'Total Loans', value: String(report.currentCount + report.emCount + report.substandardCount + report.doubtfulCount + report.lossCount), color: [239, 246, 255] as [number,number,number] },
  ];
  const bw = (pw - 28 - 12) / 4;
  boxes.forEach((b, i) => {
    const x = 14 + i * (bw + 4);
    doc.setFillColor(...b.color);
    doc.roundedRect(x, y, bw, 18, 2, 2, 'F');
    doc.setTextColor(107, 114, 128); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(b.label, x + 4, y + 6);
    doc.setTextColor(26, 58, 92); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(b.value, x + 4, y + 14);
  });
  y += 26;

  // Classification table
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 58, 92);
  doc.text('Classification Breakdown', 14, y + 6); y += 10;

  const rows = buildTierRows(report);
  autoTable(doc, {
    startY: y,
    head: [['Classification', 'Loans', 'Outstanding Balance', 'Provision Rate', 'Provision Amount', '% of Portfolio']],
    body: rows.map(r => [
      r.tier,
      String(r.count),
      formatTsh(r.balance),
      `${(r.rate * 100).toFixed(0)}%`,
      formatTsh(r.provision),
      report.totalPortfolio > 0 ? `${((r.balance / report.totalPortfolio) * 100).toFixed(1)}%` : '0%',
    ]),
    foot: [['TOTAL', String(rows.reduce((s, r) => s + r.count, 0)), formatTsh(report.totalPortfolio), '—', formatTsh(report.totalProvision), '100%']],
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    footStyles: { fillColor: [243, 244, 246], textColor: [26, 58, 92], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });

  // Footer
  doc.setFillColor(243, 244, 246);
  doc.rect(0, ph - 10, pw, 10, 'F');
  doc.setTextColor(156, 163, 175); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text('Confidential — EXIM Bank Tanzania | CollateralMS | BOT Regulatory Report', 14, ph - 3);
  doc.text(`Page 1`, pw - 14, ph - 3, { align: 'right' });

  doc.save(`provisioning-report-${report.quarter}.pdf`);
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

async function exportToExcel(report: ProvisioningReport) {
  const XLSX = await import('xlsx');
  const rows = buildTierRows(report);

  const wsData = [
    ['EXIM Bank Tanzania — Quarterly Provisioning Report'],
    [`Quarter: ${report.quarter}`, `Status: ${report.status}`, `Report Date: ${report.reportDate}`],
    ['BOT Risk Assets Regulations 2014'],
    [],
    ['Classification', 'Loans', 'Outstanding Balance (TZS)', 'Provision Rate (%)', 'Provision Amount (TZS)', '% of Portfolio'],
    ...rows.map(r => [
      r.tier,
      r.count,
      r.balance,
      (r.rate * 100).toFixed(0) + '%',
      r.provision,
      report.totalPortfolio > 0 ? ((r.balance / report.totalPortfolio) * 100).toFixed(2) + '%' : '0%',
    ]),
    [],
    ['TOTAL', rows.reduce((s, r) => s + r.count, 0), report.totalPortfolio, '—', report.totalProvision, '100%'],
    [],
    ['Summary'],
    ['Total Portfolio', report.totalPortfolio],
    ['Total Provision Required', report.totalProvision],
    ['Provision Ratio', report.totalPortfolio > 0 ? ((report.totalProvision / report.totalPortfolio) * 100).toFixed(4) + '%' : '0%'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Provisioning ${report.quarter}`);
  XLSX.writeFile(wb, `provisioning-report-${report.quarter}.xlsx`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProvisioningCalculatorContent() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ProvisioningReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ProvisioningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quarter, setQuarter] = useState(getCurrentQuarter());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const rs = await loanClassificationService.getReports();
      setReports(rs);
      if (rs.length > 0 && !selectedReport) setSelectedReport(rs[0]);
    } catch { setError('Failed to load provisioning reports.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true); setError(null);
    try {
      const r = await loanClassificationService.generateReport(quarter, user?.id);
      if (r) {
        setSelectedReport(r);
        await load();
      } else {
        setError('Failed to generate report. Ensure loans are classified for this quarter.');
      }
    } catch { setError('Failed to generate report.'); }
    finally { setGenerating(false); }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedReport) return;
    await loanClassificationService.updateReportStatus(selectedReport.id, status);
    const updated = { ...selectedReport, status };
    setSelectedReport(updated);
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const handleExportPDF = async () => {
    if (!selectedReport) return;
    setExporting('pdf');
    try { await exportToPDF(selectedReport); }
    catch { setError('PDF export failed.'); }
    finally { setExporting(null); }
  };

  const handleExportExcel = async () => {
    if (!selectedReport) return;
    setExporting('excel');
    try { await exportToExcel(selectedReport); }
    catch { setError('Excel export failed.'); }
    finally { setExporting(null); }
  };

  const tierRows = selectedReport ? buildTierRows(selectedReport) : [];
  const chartData = tierRows.map((r, i) => ({
    name: r.tier === 'Especially Mentioned' ? 'Esp. Mentioned' : r.tier,
    balance: r.balance / 1e6,
    provision: r.provision / 1e6,
    fill: TIER_CHART_COLORS[i],
  }));

  const StatusIcon = selectedReport ? (STATUS_CONFIG[selectedReport.status]?.icon ?? Clock) : Clock;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Provisioning Calculator</h1>
          <p className="text-sm text-slate-500 mt-0.5">BOT Rate Schedule — Quarterly Reporting Output</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={quarter} onChange={e => setQuarter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: 6 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i * 3);
              const q = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
              return <option key={q} value={q}>{q}</option>;
            })}
          </select>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            Generate Report
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {/* Report List */}
        <div className="col-span-1 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quarterly Reports</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : reports.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">No reports yet.<br />Generate one above.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reports.map(r => {
                const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.Draft;
                const Icon = cfg.icon;
                return (
                  <button key={r.id} onClick={() => setSelectedReport(r)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selectedReport?.id === r.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                    <p className="text-sm font-semibold text-slate-900">{r.quarter}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      <span className={`text-xs font-medium ${cfg.color}`}>{r.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{formatTsh(r.totalProvision)} prov.</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Report Detail */}
        <div className="col-span-3 space-y-4">
          {!selectedReport ? (
            <div className="bg-white border border-slate-200 rounded-xl flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <PieChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Select or generate a report</p>
              </div>
            </div>
          ) : (
            <>
              {/* Report Header */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-900">Quarter {selectedReport.quarter}</h2>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CONFIG[selectedReport.status]?.bg} ${STATUS_CONFIG[selectedReport.status]?.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {selectedReport.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Report Date: {selectedReport.reportDate} · Currency: {selectedReport.currency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status actions */}
                    {selectedReport.status === 'Draft' && (
                      <button onClick={() => handleStatusChange('Finalized')}
                        className="px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100">
                        Finalize
                      </button>
                    )}
                    {selectedReport.status === 'Finalized' && (
                      <button onClick={() => handleStatusChange('Submitted')}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                        Mark Submitted
                      </button>
                    )}
                    <button onClick={handleExportPDF} disabled={exporting === 'pdf'}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                      {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      PDF
                    </button>
                    <button onClick={handleExportExcel} disabled={exporting === 'excel'}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                      {exporting === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                      Excel
                    </button>
                  </div>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Total Portfolio</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{formatTsh(selectedReport.totalPortfolio)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Total Provision</p>
                    <p className="text-lg font-bold text-red-700 mt-0.5">{formatTsh(selectedReport.totalProvision)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Provision Ratio</p>
                    <p className="text-lg font-bold text-amber-700 mt-0.5">
                      {selectedReport.totalPortfolio > 0
                        ? `${((selectedReport.totalProvision / selectedReport.totalPortfolio) * 100).toFixed(2)}%`
                        : '0%'}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Total Loans</p>
                    <p className="text-lg font-bold text-blue-700 mt-0.5">
                      {selectedReport.currentCount + selectedReport.emCount + selectedReport.substandardCount + selectedReport.doubtfulCount + selectedReport.lossCount}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chart + Table */}
              <div className="grid grid-cols-2 gap-4">
                {/* Bar Chart */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Portfolio vs Provision by Tier (TSh M)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`TSh ${v.toFixed(1)}M`, '']} />
                      <Bar dataKey="balance" name="Outstanding" radius={[3, 3, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.7} />)}
                      </Bar>
                      <Bar dataKey="provision" name="Provision" radius={[3, 3, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Provision Distribution */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Provision Distribution</p>
                  <div className="space-y-2">
                    {tierRows.map(r => (
                      <div key={r.tier}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className={`font-medium ${r.color}`}>{r.tier}</span>
                          <span className="text-slate-600">{formatTsh(r.provision)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: selectedReport.totalProvision > 0
                                ? `${(r.provision / selectedReport.totalProvision) * 100}%`
                                : '0%',
                              backgroundColor: TIER_CHART_COLORS[tierRows.indexOf(r)],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Classification Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">BOT Classification Breakdown</p>
                  <p className="text-xs text-slate-500">Minimum Provisioning per Risk Assets Regulations 2014</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Classification</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Loans</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Outstanding Balance</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">BOT Rate</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Provision Required</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">% Portfolio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tierRows.map(r => (
                      <tr key={r.tier} className={`${r.bg}`}>
                        <td className="px-5 py-3">
                          <span className={`font-semibold ${r.color}`}>{r.tier}</span>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-slate-700">{r.count}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-800">{formatTsh(r.balance)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-bold ${r.color}`}>{(r.rate * 100).toFixed(0)}%</span>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-red-700">{formatTsh(r.provision)}</td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {selectedReport.totalPortfolio > 0
                            ? `${((r.balance / selectedReport.totalPortfolio) * 100).toFixed(1)}%`
                            : '0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100">
                    <tr>
                      <td className="px-5 py-3 font-bold text-slate-900">TOTAL</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{tierRows.reduce((s, r) => s + r.count, 0)}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{formatTsh(selectedReport.totalPortfolio)}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">—</td>
                      <td className="px-5 py-3 text-right font-bold text-red-800">{formatTsh(selectedReport.totalProvision)}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* BOT Compliance Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold">BOT Regulatory Note</p>
                  <p className="mt-1 text-blue-700">This report applies the minimum provisioning rates prescribed under the Bank of Tanzania Risk Assets Regulations 2014: Current (1%), Especially Mentioned (3%), Substandard (20%), Doubtful (50%), Loss (100%). Quarterly submission to BOT is required within 30 days of quarter-end.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
