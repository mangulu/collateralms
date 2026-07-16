'use client';
import React, { useState, useEffect } from 'react';
import { Unlock, CheckCircle, XCircle, Clock, Search, Eye, AlertCircle, FileText, User, Calendar, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ReleaseRequest {
  id: string;
  collateralRef: string;
  collateralType: string;
  clientName: string;
  loanRef: string;
  estimatedValue: number;
  requestedBy: string;
  requestedDate: string;
  releaseReason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Under Review';
  priority: 'High' | 'Normal' | 'Low';
  notes?: string;
}

const MOCK_REQUESTS: ReleaseRequest[] = [
  {
    id: 'REL-001',
    collateralRef: 'COL-2024-0045',
    collateralType: 'Land Title',
    clientName: 'Karibu Enterprises Ltd',
    loanRef: 'LN-2024-1123',
    estimatedValue: 450000000,
    requestedBy: 'James Mwangi',
    requestedDate: '2026-07-14',
    releaseReason: 'Loan fully repaid — collateral discharge requested',
    status: 'Pending',
    priority: 'High',
  },
  {
    id: 'REL-002',
    collateralRef: 'COL-2024-0078',
    collateralType: 'Motor Vehicle',
    clientName: 'Simba Trading Co.',
    loanRef: 'LN-2024-0987',
    estimatedValue: 85000000,
    requestedBy: 'Grace Odhiambo',
    requestedDate: '2026-07-13',
    releaseReason: 'Partial settlement — releasing secondary collateral',
    status: 'Under Review',
    priority: 'Normal',
  },
  {
    id: 'REL-003',
    collateralRef: 'COL-2023-0312',
    collateralType: 'Commercial Property',
    clientName: 'Nguvu Holdings',
    loanRef: 'LN-2023-0456',
    estimatedValue: 1200000000,
    requestedBy: 'Peter Kamau',
    requestedDate: '2026-07-12',
    releaseReason: 'Collateral substitution approved — releasing original',
    status: 'Approved',
    priority: 'Normal',
  },
  {
    id: 'REL-004',
    collateralRef: 'COL-2024-0091',
    collateralType: 'Equipment',
    clientName: 'Jua Kali Manufacturers',
    loanRef: 'LN-2024-0234',
    estimatedValue: 32000000,
    requestedBy: 'Alice Wanjiku',
    requestedDate: '2026-07-11',
    releaseReason: 'Loan restructured — collateral no longer required',
    status: 'Rejected',
    priority: 'Low',
    notes: 'Outstanding balance remains. Release denied pending full settlement.',
  },
  {
    id: 'REL-005',
    collateralRef: 'COL-2024-0103',
    collateralType: 'Fixed Deposit',
    clientName: 'Amani Savings Group',
    loanRef: 'LN-2024-0567',
    estimatedValue: 15000000,
    requestedBy: 'David Otieno',
    requestedDate: '2026-07-10',
    releaseReason: 'Loan matured and fully settled',
    status: 'Pending',
    priority: 'Normal',
  },
];

const STATUS_CONFIG: Record<ReleaseRequest['status'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  Pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100', icon: <Clock size={12} /> },
  'Under Review': { label: 'Under Review', color: 'text-blue-700', bg: 'bg-blue-100', icon: <Eye size={12} /> },
  Approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle size={12} /> },
  Rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle size={12} /> },
};

const PRIORITY_CONFIG: Record<ReleaseRequest['priority'], { color: string; bg: string }> = {
  High: { color: 'text-red-700', bg: 'bg-red-50 border border-red-200' },
  Normal: { color: 'text-gray-600', bg: 'bg-gray-50 border border-gray-200' },
  Low: { color: 'text-blue-600', bg: 'bg-blue-50 border border-blue-200' },
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `TZS ${(amount / 1000000).toFixed(1)}M`;
  return `TZS ${amount.toLocaleString()}`;
}

export default function ReleaseApprovalContent() {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState<ReleaseRequest[]>(MOCK_REQUESTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedRequest, setSelectedRequest] = useState<ReleaseRequest | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.collateralRef.toLowerCase().includes(search.toLowerCase()) ||
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.loanRef.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: requests.filter((r) => r.status === 'Pending').length,
    underReview: requests.filter((r) => r.status === 'Under Review').length,
    approved: requests.filter((r) => r.status === 'Approved').length,
    rejected: requests.filter((r) => r.status === 'Rejected').length,
  };

  const handleAction = (action: 'Approved' | 'Rejected' | 'Under Review') => {
    if (!selectedRequest) return;
    setProcessing(true);
    setTimeout(() => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? { ...r, status: action, notes: actionNote || r.notes }
            : r
        )
      );
      setSelectedRequest(null);
      setActionNote('');
      setProcessing(false);
    }, 600);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
              <Unlock size={18} style={{ color: '#1D4ED8' }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Release Approval</h1>
              <p className="text-sm text-gray-500">Authorise or reject collateral release and discharge requests</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Pending', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Under Review', value: stats.underReview, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Approved', value: stats.approved, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-lg border px-4 py-3 ${stat.bg}`}>
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* List Panel */}
        <div className={`flex flex-col ${selectedRequest ? 'w-1/2' : 'w-full'} border-r border-gray-200 bg-white min-h-0`}>
          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by collateral ref, client, or loan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Request List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Unlock size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No release requests found</p>
              </div>
            ) : (
              filtered.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status];
                const priorityCfg = PRIORITY_CONFIG[req.priority];
                const isSelected = selectedRequest?.id === req.id;

                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequest(isSelected ? null : req)}
                    className={`px-4 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">{req.collateralRef}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
                          {req.priority}
                        </span>
                      </div>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium mb-1">{req.clientName}</p>
                    <p className="text-xs text-gray-500 mb-2 line-clamp-1">{req.releaseReason}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><FileText size={11} />{req.collateralType}</span>
                      <span className="flex items-center gap-1"><DollarSign size={11} />{formatCurrency(req.estimatedValue)}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} />{req.requestedDate}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedRequest && (
          <div className="w-1/2 flex flex-col bg-white overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{selectedRequest.collateralRef}</h2>
                <p className="text-sm text-gray-500">{selectedRequest.clientName}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 px-6 py-4 space-y-5">
              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Collateral Type', value: selectedRequest.collateralType, icon: <FileText size={14} /> },
                  { label: 'Loan Reference', value: selectedRequest.loanRef, icon: <FileText size={14} /> },
                  { label: 'Estimated Value', value: formatCurrency(selectedRequest.estimatedValue), icon: <DollarSign size={14} /> },
                  { label: 'Requested By', value: selectedRequest.requestedBy, icon: <User size={14} /> },
                  { label: 'Request Date', value: selectedRequest.requestedDate, icon: <Calendar size={14} /> },
                  { label: 'Priority', value: selectedRequest.priority, icon: <AlertCircle size={14} /> },
                ].map((field) => (
                  <div key={field.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      {field.icon}
                      {field.label}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{field.value}</p>
                  </div>
                ))}
              </div>

              {/* Release Reason */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Release Reason</p>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-sm text-gray-800">{selectedRequest.releaseReason}</p>
                </div>
              </div>

              {/* Existing Notes */}
              {selectedRequest.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-sm text-gray-800">{selectedRequest.notes}</p>
                  </div>
                </div>
              )}

              {/* Action Note */}
              {(selectedRequest.status === 'Pending' || selectedRequest.status === 'Under Review') && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Decision Note (optional)</p>
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Add a note for this decision..."
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {(selectedRequest.status === 'Pending' || selectedRequest.status === 'Under Review') && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleAction('Under Review')}
                  disabled={processing || selectedRequest.status === 'Under Review'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  <Eye size={15} />
                  Mark Under Review
                </button>
                <button
                  onClick={() => handleAction('Rejected')}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={15} />
                  Reject
                </button>
                <button
                  onClick={() => handleAction('Approved')}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg text-white font-semibold disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#1D4ED8' }}
                >
                  <CheckCircle size={15} />
                  Approve Release
                </button>
              </div>
            )}

            {(selectedRequest.status === 'Approved' || selectedRequest.status === 'Rejected') && (
              <div className="px-6 py-4 border-t border-gray-200 shrink-0">
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                  selectedRequest.status === 'Approved' ?'bg-green-50 border border-green-200 text-green-700' :'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {selectedRequest.status === 'Approved' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  This request has been {selectedRequest.status.toLowerCase()}.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
