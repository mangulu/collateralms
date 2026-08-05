'use client';
import React from 'react';
import { 
  X, 
  Edit, 
  Calendar, 
  User, 
  FolderOpen, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Building, 
  CalendarDays, 
  DollarSign,
  Hash,
  Tag
} from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';

interface QuickViewModalProps {
  open: boolean;
  item: CollateralRecord | null;
  onClose: () => void;
  onEdit: () => void;
  docUploadedCounts: Record<string, number>;
  docRequiredCounts: Record<string, number>;
}

export default function QuickViewModal({ 
  open, 
  item, 
  onClose, 
  onEdit, 
  docUploadedCounts, 
  docRequiredCounts 
}: QuickViewModalProps) {
  if (!open || !item) return null;

  const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
    Perfected: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle, label: 'Perfected' },
    'Under Review': { color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock, label: 'Under Review' },
    Overdue: { color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle, label: 'Overdue' },
    Submitted: { color: 'text-blue-700', bg: 'bg-blue-100', icon: FileText, label: 'Submitted' },
    Active: { color: 'text-gray-700', bg: 'bg-gray-100', icon: CheckCircle, label: 'Active' },
    Released: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle, label: 'Released' },
    Rejected: { color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle, label: 'Rejected' },
  };

  const Config = statusConfig[item.status] || statusConfig.Active;
  const StatusIcon = Config.icon;
  const uploaded = docUploadedCounts[item.id] || 0;
  const required = docRequiredCounts[item.type] || 0;
  const isDocComplete = required > 0 && uploaded >= required;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${Config.bg}`}>
              <StatusIcon size={20} className={Config.color} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{item.collateralId}</h2>
              <p className="text-sm text-muted-foreground">{item.obligor}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${Config.bg} ${Config.color}`}>
            <StatusIcon size={14} />
            {Config.label}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Hash size={12} />
                Collateral ID
              </p>
              <p className="text-sm font-medium text-foreground">{item.collateralId}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Tag size={12} />
                Type
              </p>
              <p className="text-sm font-medium">{item.type}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} />
                Value (TSh)
              </p>
              <p className="text-sm font-medium">TSh {item.valueTSh.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <MapPin size={12} />
                Registry
              </p>
              <p className="text-sm">{item.registry}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <User size={12} />
                Assigned Officer
              </p>
              <p className="text-sm">{item.assignedOfficer || 'Unassigned'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Building size={12} />
                Facility ID
              </p>
              <p className="text-sm">{item.facilityId}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} />
                Registration Date
              </p>
              <p className="text-sm">{new Date(item.registrationDate).toLocaleDateString('en-GB')}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <CalendarDays size={12} />
                Perfection Deadline
              </p>
              <p className={`text-sm ${item.daysToDeadline && item.daysToDeadline < 0 ? 'text-red-600' : ''}`}>
                {item.perfectionDeadline ? new Date(item.perfectionDeadline).toLocaleDateString('en-GB') : 'Not set'}
                {item.daysToDeadline !== null && item.daysToDeadline !== undefined && (
                  <span className={`ml-2 text-xs ${item.daysToDeadline < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    ({item.daysToDeadline < 0 ? `${Math.abs(item.daysToDeadline)} days overdue` : `${item.daysToDeadline} days remaining`})
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <User size={12} />
                Obligor ID
              </p>
              <p className="text-sm">{item.obligorId}</p>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</p>
              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                {item.description}
              </p>
            </div>
          )}

          {/* Documents */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documents</p>
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <FileText size={16} className="text-muted-foreground" />
                <span className="font-medium">
                  {uploaded}
                  <span className="text-muted-foreground">/{required}</span>
                </span>
                <span className="text-xs text-muted-foreground">uploaded</span>
              </div>
              {required > 0 && (
                <div className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                  isDocComplete 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {isDocComplete ? (
                    <>
                      <CheckCircle size={12} />
                      Complete
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={12} />
                      {required - uploaded} missing
                    </>
                  )}
                </div>
              )}
              {required === 0 && (
                <span className="text-xs text-muted-foreground">No document requirements</span>
              )}
            </div>
          </div>

          {/* Quick Stats Footer */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="text-center p-2 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={`text-sm font-semibold ${Config.color}`}>{item.status}</p>
            </div>
            <div className="text-center p-2 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground">Value</p>
              <p className="text-sm font-semibold text-foreground">TSh {item.valueTSh.toLocaleString()}</p>
            </div>
            <div className="text-center p-2 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground">Documents</p>
              <p className={`text-sm font-semibold ${isDocComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                {uploaded}/{required}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-border bg-muted/30 rounded-b-2xl sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
          >
            <Edit size={14} />
            Edit Record
          </button>
        </div>
      </div>
    </div>
  );
}