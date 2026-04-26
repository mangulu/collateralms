'use client';
import React, { useState } from 'react';
import {
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  Wifi,
  WifiOff,
  Building2,
  Globe,
  Key,
  Link2,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'pending';

interface RegistryConfig {
  id: string;
  name: string;
  fullName: string;
  description: string;
  apiEndpoint: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  syncStatus: SyncStatus;
  lastSync: string | null;
  syncFrequency: string;
  recordsSynced: number | null;
  color: string;
  icon: string;
}

// ─── Initial Registry Data ────────────────────────────────────────────────────

const initialRegistries: RegistryConfig[] = [
  {
    id: 'brela',
    name: 'BRELA',
    fullName: 'Business Registrations and Licensing Agency',
    description: 'Company registration, business licenses, and corporate entity verification.',
    apiEndpoint: 'https://api.brela.go.tz/v1',
    apiKey: '',
    clientId: '',
    clientSecret: '',
    syncStatus: 'disconnected',
    lastSync: null,
    syncFrequency: 'daily',
    recordsSynced: null,
    color: 'blue',
    icon: 'B',
  },
  {
    id: 'lands',
    name: 'Lands Registry',
    fullName: 'Ministry of Lands – Property Registry',
    description: 'Land title deeds, property ownership records, and mortgage registrations.',
    apiEndpoint: 'https://api.lands.go.tz/v2',
    apiKey: '',
    clientId: '',
    clientSecret: '',
    syncStatus: 'disconnected',
    lastSync: null,
    syncFrequency: 'daily',
    recordsSynced: null,
    color: 'green',
    icon: 'L',
  },
  {
    id: 'tra',
    name: 'TRA',
    fullName: 'Tanzania Revenue Authority',
    description: 'Tax compliance status, TIN verification, and revenue clearance certificates.',
    apiEndpoint: 'https://api.tra.go.tz/v1',
    apiKey: '',
    clientId: '',
    clientSecret: '',
    syncStatus: 'disconnected',
    lastSync: null,
    syncFrequency: 'weekly',
    recordsSynced: null,
    color: 'amber',
    icon: 'T',
  },
  {
    id: 'dse',
    name: 'DSE',
    fullName: 'Dar es Salaam Stock Exchange',
    description: 'Listed securities, share ownership, and equity collateral verification.',
    apiEndpoint: 'https://api.dse.co.tz/v1',
    apiKey: '',
    clientId: '',
    clientSecret: '',
    syncStatus: 'disconnected',
    lastSync: null,
    syncFrequency: 'realtime',
    recordsSynced: null,
    color: 'purple',
    icon: 'D',
  },
  {
    id: 'tasac',
    name: 'TASAC',
    fullName: 'Tanzania Shipping Agencies Corporation',
    description: 'Vessel registration, maritime assets, and shipping collateral records.',
    apiEndpoint: 'https://api.tasac.go.tz/v1',
    apiKey: '',
    clientId: '',
    clientSecret: '',
    syncStatus: 'disconnected',
    lastSync: null,
    syncFrequency: 'daily',
    recordsSynced: null,
    color: 'cyan',
    icon: 'S',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200',   badge: 'bg-cyan-100 text-cyan-700' },
};

function StatusBadge({ status }: { status: SyncStatus }) {
  const map: Record<SyncStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    connected:    { label: 'Connected',    cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 size={12} /> },
    disconnected: { label: 'Disconnected', cls: 'bg-gray-100 text-gray-500',    icon: <WifiOff size={12} /> },
    syncing:      { label: 'Syncing…',     cls: 'bg-blue-100 text-blue-700',    icon: <RefreshCw size={12} className="animate-spin" /> },
    error:        { label: 'Error',        cls: 'bg-red-100 text-red-700',      icon: <XCircle size={12} /> },
    pending:      { label: 'Pending',      cls: 'bg-amber-100 text-amber-700',  icon: <Clock size={12} /> },
  };
  const { label, cls, icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

function formatLastSync(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Registry Card ────────────────────────────────────────────────────────────

interface RegistryCardProps {
  registry: RegistryConfig;
  onUpdate: (id: string, updates: Partial<RegistryConfig>) => void;
  onTestConnection: (id: string) => void;
  onSync: (id: string) => void;
  isSaving: boolean;
}

function RegistryCard({ registry, onUpdate, onTestConnection, onSync, isSaving }: RegistryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const colors = colorMap[registry.color];

  const hasCredentials = registry.apiKey.trim() !== '' || (registry.clientId.trim() !== '' && registry.clientSecret.trim() !== '');

  return (
    <div className={`bg-card rounded-lg border border-border shadow-card overflow-hidden`}>
      {/* Card Header */}
      <div className="flex items-center gap-4 p-4">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center shrink-0`}>
          <span className={`text-lg font-bold ${colors.text}`}>{registry.icon}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{registry.name}</h3>
            <StatusBadge status={registry.syncStatus} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{registry.fullName}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {registry.syncStatus === 'connected' && (
            <button
              onClick={() => onSync(registry.id)}
              disabled={registry.syncStatus === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} />
              Sync Now
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Collapse' : 'Configure'}
          </button>
        </div>
      </div>

      {/* Sync Stats Row */}
      {registry.syncStatus === 'connected' && (
        <div className="px-4 pb-3 flex items-center gap-6 border-t border-border/50 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity size={12} className="text-success" />
            <span>Last sync: <span className="text-foreground font-medium">{formatLastSync(registry.lastSync)}</span></span>
          </div>
          {registry.recordsSynced !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe size={12} />
              <span><span className="text-foreground font-medium">{registry.recordsSynced.toLocaleString()}</span> records synced</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>Frequency: <span className="text-foreground font-medium capitalize">{registry.syncFrequency}</span></span>
          </div>
        </div>
      )}

      {/* Expanded Config Panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/30 p-4 space-y-4">
          <p className="text-xs text-muted-foreground">{registry.description}</p>

          {/* API Endpoint */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              <span className="flex items-center gap-1.5"><Link2 size={12} /> API Endpoint</span>
            </label>
            <input
              type="url"
              value={registry.apiEndpoint}
              onChange={(e) => onUpdate(registry.id, { apiEndpoint: e.target.value })}
              placeholder="https://api.registry.go.tz/v1"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              <span className="flex items-center gap-1.5"><Key size={12} /> API Key</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={registry.apiKey}
                onChange={(e) => onUpdate(registry.id, { apiKey: e.target.value })}
                placeholder="Enter API key…"
                className="w-full px-3 py-2 pr-9 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Client ID + Secret */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Client ID</label>
              <input
                type="text"
                value={registry.clientId}
                onChange={(e) => onUpdate(registry.id, { clientId: e.target.value })}
                placeholder="client_id"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={registry.clientSecret}
                  onChange={(e) => onUpdate(registry.id, { clientSecret: e.target.value })}
                  placeholder="client_secret"
                  className="w-full px-3 py-2 pr-9 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Sync Frequency */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              <span className="flex items-center gap-1.5"><RefreshCw size={12} /> Sync Frequency</span>
            </label>
            <select
              value={registry.syncFrequency}
              onChange={(e) => onUpdate(registry.id, { syncFrequency: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="realtime">Real-time</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="manual">Manual only</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onTestConnection(registry.id)}
              disabled={!hasCredentials || registry.syncStatus === 'syncing'}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Wifi size={13} />
              Test Connection
            </button>
            <button
              onClick={() => onUpdate(registry.id, { apiKey: '', clientId: '', clientSecret: '', syncStatus: 'disconnected', lastSync: null, recordsSynced: null })}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-destructive border border-destructive/30 rounded-md hover:bg-destructive/5 transition-colors"
            >
              <XCircle size={13} />
              Clear Credentials
            </button>
            <button
              onClick={() => onUpdate(registry.id, {})}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-foreground/70 border border-border rounded-md hover:bg-muted transition-colors ml-auto disabled:opacity-50"
            >
              <Save size={13} />
              Save
            </button>
          </div>

          {!hasCredentials && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle size={12} />
              Enter API credentials to test the connection.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function RegistrySettingsContent() {
  const [registries, setRegistries] = useState<RegistryConfig[]>(initialRegistries);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUpdate = (id: string, updates: Partial<RegistryConfig>) => {
    setRegistries((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const handleTestConnection = (id: string) => {
    const registry = registries.find((r) => r.id === id);
    if (!registry) return;

    handleUpdate(id, { syncStatus: 'syncing' });

    // Simulate async connection test
    setTimeout(() => {
      const success = Math.random() > 0.3; // 70% success for demo
      if (success) {
        handleUpdate(id, {
          syncStatus: 'connected',
          lastSync: new Date().toISOString(),
          recordsSynced: Math.floor(Math.random() * 5000) + 500,
        });
        showToast(`${registry.name} connected successfully.`, 'success');
      } else {
        handleUpdate(id, { syncStatus: 'error' });
        showToast(`${registry.name} connection failed. Check credentials.`, 'error');
      }
    }, 2000);
  };

  const handleSync = (id: string) => {
    const registry = registries.find((r) => r.id === id);
    if (!registry) return;

    handleUpdate(id, { syncStatus: 'syncing' });
    showToast(`Syncing ${registry.name}…`, 'info');

    setTimeout(() => {
      handleUpdate(id, {
        syncStatus: 'connected',
        lastSync: new Date().toISOString(),
        recordsSynced: (registry.recordsSynced ?? 0) + Math.floor(Math.random() * 200),
      });
      showToast(`${registry.name} sync complete.`, 'success');
    }, 2500);
  };

  const handleSaveAll = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('All registry settings saved.', 'success');
    }, 1200);
  };

  // Summary stats
  const connected = registries.filter((r) => r.syncStatus === 'connected').length;
  const errors = registries.filter((r) => r.syncStatus === 'error').length;
  const pending = registries.filter((r) => r.syncStatus === 'pending' || r.syncStatus === 'disconnected').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-modal text-sm font-medium slide-up ${
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'error'? 'bg-red-600 text-white' : 'bg-primary text-white'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 size={15} />}
          {toast.type === 'error'   && <XCircle size={15} />}
          {toast.type === 'info'    && <RefreshCw size={15} className="animate-spin" />}
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="bg-card border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Registry Connections</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage API credentials and sync configuration for external registries
              </p>
            </div>
          </div>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {isSaving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border border-border shadow-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{connected}</p>
              <p className="text-xs text-muted-foreground">Connected</p>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border shadow-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
              <WifiOff size={16} className="text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{pending}</p>
              <p className="text-xs text-muted-foreground">Not Configured</p>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border shadow-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{errors}</p>
              <p className="text-xs text-muted-foreground">Connection Errors</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6">
          <Building2 size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary/80 leading-relaxed">
            Configure API credentials for each external registry. Credentials are stored securely and used for automated collateral verification and sync. Click <strong>Configure</strong> on any registry to expand its settings.
          </p>
        </div>

        {/* Registry Cards */}
        <div className="space-y-3">
          {registries.map((registry) => (
            <RegistryCard
              key={registry.id}
              registry={registry}
              onUpdate={handleUpdate}
              onTestConnection={handleTestConnection}
              onSync={handleSync}
              isSaving={isSaving}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
