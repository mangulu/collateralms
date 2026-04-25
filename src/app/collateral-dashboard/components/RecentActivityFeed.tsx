import React from 'react';
import { FileCheck, FilePlus, AlertCircle, CheckCircle2, ArrowUpRight,  } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


// Backend integration point: GET /api/audit/recent-activity?limit=8
const activities = [
  {
    id: 'act-001',
    type: 'perfected',
    message: 'Collateral col-0289 perfected at BRELA',
    detail: 'Karibu Textiles Ltd · Debenture',
    time: '14 min ago',
    user: 'A. Mwangi',
  },
  {
    id: 'act-002',
    type: 'created',
    message: 'New collateral registered: col-0312',
    detail: 'Coastal Traders Co. · Mortgage · TSh 780M',
    time: '47 min ago',
    user: 'J. Kamau',
  },
  {
    id: 'act-003',
    type: 'overdue',
    message: 'BRELA deadline missed — col-0041',
    detail: 'Karibu Enterprises Ltd · 12 days overdue',
    time: '2 hr ago',
    user: 'System',
  },
  {
    id: 'act-004',
    type: 'submitted',
    message: 'Lands Registry submission filed',
    detail: 'col-0298 · Mwanza Holdings · Mortgage',
    time: '3 hr ago',
    user: 'P. Ochieng',
  },
  {
    id: 'act-005',
    type: 'perfected',
    message: 'TRA registration confirmed: col-0271',
    detail: 'Dar Transport Holdings · Motor Vehicle',
    time: '5 hr ago',
    user: 'A. Mwangi',
  },
  {
    id: 'act-006',
    type: 'created',
    message: 'New collateral registered: col-0311',
    detail: 'Arusha Coffee Growers · FDR · TSh 420M',
    time: '8 hr ago',
    user: 'S. Ndege',
  },
  {
    id: 'act-007',
    type: 'submitted',
    message: 'DSE share pledge registered',
    detail: 'col-0305 · Tanga Steel Mills · Shares',
    time: '1 day ago',
    user: 'J. Kamau',
  },
  {
    id: 'act-008',
    type: 'released',
    message: 'Collateral released: col-0244',
    detail: 'Kilimanjaro Farms Ltd · Mortgage · Facility settled',
    time: '1 day ago',
    user: 'A. Mwangi',
  },
];

const activityConfig: Record<
  string,
  { icon: React.ElementType; iconClass: string; dotClass: string }
> = {
  perfected: {
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    dotClass: 'bg-green-500',
  },
  created: {
    icon: FilePlus,
    iconClass: 'text-blue-600',
    dotClass: 'bg-blue-500',
  },
  overdue: {
    icon: AlertCircle,
    iconClass: 'text-red-600',
    dotClass: 'bg-red-500',
  },
  submitted: {
    icon: FileCheck,
    iconClass: 'text-indigo-600',
    dotClass: 'bg-indigo-500',
  },
  released: {
    icon: ArrowUpRight,
    iconClass: 'text-teal-600',
    dotClass: 'bg-teal-500',
  },
};

export default function RecentActivityFeed() {
  return (
    <div className="bg-white rounded-xl shadow-card border border-border h-full">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-base font-600 text-foreground">Recent Activity</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Audit trail — last 24 hours
        </p>
      </div>
      <div className="divide-y divide-border">
        {activities.map((activity) => {
          const config = activityConfig[activity.type] ?? activityConfig.created;
          const Icon = config.icon;
          return (
            <div
              key={`activity-${activity.id}`}
              className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
            >
              <div
                className={`w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5`}
              >
                <Icon size={14} className={config.iconClass} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-500 text-foreground leading-snug truncate">
                  {activity.message}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {activity.detail}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{activity.user}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}