'use client';
import React from 'react';
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// Backend integration point: GET /api/collateral/overdue-actions
const overdueItems = [
  {
    id: 'col-0041',
    obligor: 'Karibu Enterprises Ltd',
    type: 'Debenture',
    registry: 'BRELA',
    daysOverdue: 12,
    dueDate: '13 Apr 2026',
    assignedTo: 'J. Kamau',
    facility: 'TZ-FAC-2024-0892',
    value: 'TSh 4.2B',
  },
  {
    id: 'col-0078',
    obligor: 'Mwanza Fishing Co.',
    type: 'Mortgage',
    registry: 'Lands Registry',
    daysOverdue: 7,
    dueDate: '18 Apr 2026',
    assignedTo: 'P. Ochieng',
    facility: 'TZ-FAC-2024-1104',
    value: 'TSh 1.8B',
  },
  {
    id: 'col-0091',
    obligor: 'Dar Transport Holdings',
    type: 'Motor Vehicle',
    registry: 'TRA',
    daysOverdue: 5,
    dueDate: '20 Apr 2026',
    assignedTo: 'J. Kamau',
    facility: 'TZ-FAC-2025-0034',
    value: 'TSh 320M',
  },
  {
    id: 'col-0103',
    obligor: 'Zanzibar Spice Exports',
    type: 'Ship/Vessel',
    registry: 'TASAC',
    daysOverdue: 3,
    dueDate: '22 Apr 2026',
    assignedTo: 'S. Ndege',
    facility: 'TZ-FAC-2025-0211',
    value: 'TSh 6.7B',
  },
  {
    id: 'col-0117',
    obligor: 'Tanga Steel Mills',
    type: 'Shares',
    registry: 'DSE',
    daysOverdue: 1,
    dueDate: '24 Apr 2026',
    assignedTo: 'A. Mwangi',
    facility: 'TZ-FAC-2025-0388',
    value: 'TSh 2.1B',
  },
];

const registryBadgeColors: Record<string, string> = {
  BRELA: 'bg-blue-100 text-blue-700',
  'Lands Registry': 'bg-teal-100 text-teal-700',
  TRA: 'bg-purple-100 text-purple-700',
  DSE: 'bg-orange-100 text-orange-700',
  TASAC: 'bg-pink-100 text-pink-700',
};

export default function OverdueAlertsPanel() {
  return (
    <div className="bg-white rounded-xl shadow-card border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-600 text-foreground">Overdue Perfection Actions</h3>
            <p className="text-xs text-muted-foreground">
              {overdueItems.length} items past their registry submission deadline
            </p>
          </div>
        </div>
        <Link
          href="/collateral-management"
          className="flex items-center gap-1 text-xs text-primary font-500 hover:underline"
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Collateral ID
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Obligor
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Type
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Registry
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Days Overdue
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Value
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Assigned
              </th>
            </tr>
          </thead>
          <tbody>
            {overdueItems.map((item, i) => (
              <tr
                key={`overdue-${item.id}`}
                className={`border-b border-border last:border-0 hover:bg-red-50/50 transition-colors cursor-pointer ${
                  i % 2 === 0 ? '' : 'bg-muted/20'
                }`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-primary font-500">{item.id}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-500 text-foreground">{item.obligor}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.facility}</p>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{item.type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-500 ${
                      registryBadgeColors[item.registry] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.registry}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-600 text-red-700">
                    <Clock size={11} />
                    {item.daysOverdue}d overdue
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-foreground font-500">{item.value}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{item.assignedTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}