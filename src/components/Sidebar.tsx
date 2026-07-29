'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from './ui/AppLogo';
import { ChevronLeft, ChevronRight, LayoutGrid, ChevronDown, BookOpen, HelpCircle } from 'lucide-react';

import { usePermissions } from '@/lib/rbac';
import { MODULE_DEFINITIONS, getModuleForPath, ModuleNavItem } from '@/lib/moduleNav';



interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentPath?: string;
}

const badgeVariantClasses: Record<string, string> = {
  default: 'bg-white/20 text-white',
  danger: 'bg-red-500/30 text-red-100',
  warning: 'bg-amber-500/30 text-amber-100',
};

function isChildActive(item: ModuleNavItem, currentPath?: string): boolean {
  if (!item.children || !currentPath) return false;
  return item.children.some((child) => {
    const childPath = child.href.split('?')[0];
    return currentPath === childPath || currentPath.startsWith(childPath + '/');
  });
}

export default function Sidebar({ collapsed, onToggle, currentPath }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    return new Set<string>();
  });
  const [fraudPendingCount, setFraudPendingCount] = useState<number | null>(null);
  const { hasPermission, loading: permsLoading, isSystemAdmin } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function fetchFraudCount() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { count } = await supabase
          .from('fraud_alerts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING_REVIEW');
        if (!cancelled) setFraudPendingCount(count ?? 0);
      } catch { /* silent */ }
    }
    fetchFraudCount();
    const interval = setInterval(fetchFraudCount, 60_000); // refresh every minute
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const getBadgeOverride = (href: string): string | null | undefined => {
    if (href === '/fraud-prevention') {
      if (fraudPendingCount === null) return undefined; // not yet loaded — keep static
      return fraudPendingCount > 0 ? String(fraudPendingCount) : null;
    }
    return undefined; // undefined = use static badge from nav definition
  };

  const activeModuleId = currentPath ? getModuleForPath(currentPath) : null;
  const activeModule = activeModuleId
    ? MODULE_DEFINITIONS.find((m) => m.id === activeModuleId) ?? null
    : null;

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const isExpanded = (item: ModuleNavItem): boolean => {
    if (!item.children) return false;
    if (isChildActive(item, currentPath)) return true;
    return expandedItems.has(item.label);
  };

  const renderNavItem = (item: ModuleNavItem) => {
    const ItemIcon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const childActive = isChildActive(item, currentPath);
    const expanded = isExpanded(item);
    const isActive = !hasChildren && (currentPath === item.href || currentPath?.startsWith(item.href.split('?')[0] + '/'));
    const badgeOverride = getBadgeOverride(item.href ?? '');
    const effectiveBadge = badgeOverride !== undefined ? badgeOverride : item.badge;
    const badgeClass = badgeVariantClasses[item.badgeVariant ?? 'default'];

    if (hasChildren) {
      return (
        <div key={`nav-${item.label}`}>
          <button
            onClick={() => !collapsed && toggleExpanded(item.label)}
            onMouseEnter={() => setHoveredItem(item.label)}
            onMouseLeave={() => setHoveredItem(null)}
            className={`izou-nav-item w-full px-3 py-2.5 text-sm font-medium mb-0.5 ${
              childActive ? 'izou-nav-active' : ''
            }`}
          >
            <ItemIcon size={18} className="izou-nav-icon shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">{item.label}</span>
                <ChevronDown
                  size={14}
                  className="shrink-0 transition-transform duration-200 opacity-70"
                  style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </>
            )}
          </button>
          {/* Submenu */}
          {!collapsed && expanded && (
            <div className="ml-4 pl-3 mb-1" style={{ borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
              {item.children!
                .filter((child) => !child.permission || isSystemAdmin || permsLoading || hasPermission(child.permission))
                .map((child) => {
                  const ChildIcon = child.icon;
                  const childIsActive = currentPath === child.href || currentPath?.startsWith(child.href.split('?')[0] + '/');
                  return (
                    <Link
                      key={`child-${child.label}`}
                      href={child.href}
                      className={`izou-nav-item flex items-center gap-2 px-2.5 py-2 text-xs mb-0.5 ${
                        childIsActive ? 'izou-nav-active' : ''
                      }`}
                    >
                      <ChildIcon size={14} className="izou-nav-icon shrink-0" />
                      <span className="flex-1 truncate">{child.label}</span>
                    </Link>
                  );
                })}
            </div>
          )}
          {/* Collapsed tooltip */}
          {collapsed && hoveredItem === item.label && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
              <div className="text-white text-xs px-2.5 py-1.5 rounded-lg shadow-dropdown whitespace-nowrap" style={{ backgroundColor: 'rgba(0,60,90,0.92)', backdropFilter: 'blur(8px)' }}>
                {item.label}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={`nav-${item.label}`} className="relative">
        <Link
          href={item.href}
          onMouseEnter={() => setHoveredItem(item.label)}
          onMouseLeave={() => setHoveredItem(null)}
          className={`izou-nav-item flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium mb-0.5 ${
            isActive ? 'izou-nav-active' : ''
          }`}
        >
          <ItemIcon size={18} className="izou-nav-icon shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && effectiveBadge && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
              {effectiveBadge}
            </span>
          )}
          {collapsed && effectiveBadge && (
            <span className={`absolute top-1 right-1 text-xs font-semibold px-1 py-0 rounded-full text-[10px] ${badgeClass}`}>
              {effectiveBadge}
            </span>
          )}
        </Link>
        {collapsed && hoveredItem === item.label && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
            <div className="text-white text-xs px-2.5 py-1.5 rounded-lg shadow-dropdown whitespace-nowrap" style={{ backgroundColor: 'rgba(0,60,90,0.92)', backdropFilter: 'blur(8px)' }}>
              {item.label}
              {effectiveBadge && <span className="ml-1 opacity-75">({effectiveBadge})</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="izou-sidebar-gradient relative flex flex-col h-full shrink-0 sidebar-transition z-20"
      style={{ width: collapsed ? '64px' : '240px' }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-16 px-3 shrink-0 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AppLogo size={32} />
          {!collapsed && (
            <div className="min-w-0 fade-in">
              <p className="text-sm font-bold truncate leading-tight text-white">
                CollateralMS
              </p>
              <p className="text-xs truncate leading-tight" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {activeModule ? activeModule.label : 'EXIM Bank Tanzania'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {/* Home / Module Hub button */}
        <div className="mb-3">
          <div
            className="relative"
            onMouseEnter={() => setHoveredItem('__home__')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <button
              onClick={() => router.push('/module-hub')}
              className={`izou-nav-item w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium ${
                currentPath === '/module-hub' ? 'izou-nav-active' : ''
              }`}
            >
              <LayoutGrid size={18} className="izou-nav-icon shrink-0" />
              {!collapsed && <span className="flex-1 truncate text-left">Module Hub</span>}
            </button>
            {collapsed && hoveredItem === '__home__' && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
                <div className="text-white text-xs px-2.5 py-1.5 rounded-lg shadow-dropdown whitespace-nowrap" style={{ backgroundColor: 'rgba(0,60,90,0.92)', backdropFilter: 'blur(8px)' }}>
                  Module Hub
                </div>
              </div>
            )}
          </div>
          {/* Onboarding Guide button */}
          <div
            className="relative mt-0.5"
            onMouseEnter={() => setHoveredItem('__onboarding__')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <button
              onClick={() => router.push('/onboarding-guide')}
              className={`izou-nav-item w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium ${
                currentPath === '/onboarding-guide' ? 'izou-nav-active' : ''
              }`}
            >
              <BookOpen size={18} className="izou-nav-icon shrink-0" />
              {!collapsed && <span className="flex-1 truncate text-left">Onboarding Guide</span>}
            </button>
            {collapsed && hoveredItem === '__onboarding__' && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
                <div className="text-white text-xs px-2.5 py-1.5 rounded-lg shadow-dropdown whitespace-nowrap" style={{ backgroundColor: 'rgba(0,60,90,0.92)', backdropFilter: 'blur(8px)' }}>
                  Onboarding Guide
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="mx-1 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }} />
          )}
        </div>

        {/* Module-contextual nav groups */}
        {activeModule ? (
          <>
            {activeModule.groups.map((group) => {
              const visibleItems = permsLoading
                ? group.items
                : group.items.filter((item) => {
                    if (!item.permission) return true;
                    if (isSystemAdmin) return true;
                    if (item.children) return true;
                    return hasPermission(item.permission);
                  });

              if (visibleItems.length === 0) return null;

              return (
                <div key={`group-${group.label}`} className="mb-4">
                  {!collapsed && (
                    <p className="izou-nav-section-label">
                      {group.label}
                    </p>
                  )}
                  {collapsed && <div className="mx-1 mb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }} />}
                  {visibleItems.map((item) => renderNavItem(item))}
                </div>
              );
            })}

            {/* Module-specific guide link */}
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <div
                className="relative"
                onMouseEnter={() => setHoveredItem('__module_guide__')}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <Link
                  href={`/onboarding-guide?module=${activeModule.id}`}
                  className="izou-nav-item flex items-center gap-2.5 px-3 py-2 text-xs font-medium opacity-80 hover:opacity-100"
                >
                  <HelpCircle size={15} className="izou-nav-icon shrink-0" />
                  {!collapsed && (
                    <span className="flex-1 truncate">{activeModule.label} Guide</span>
                  )}
                </Link>
                {collapsed && hoveredItem === '__module_guide__' && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
                    <div className="text-white text-xs px-2.5 py-1.5 rounded-lg shadow-dropdown whitespace-nowrap" style={{ backgroundColor: 'rgba(0,60,90,0.92)', backdropFilter: 'blur(8px)' }}>
                      {activeModule.label} Guide
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          !collapsed && (
            <div className="px-3 py-3 text-xs text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Select a module from the hub to see its pages here.
            </div>
          )
        )}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="izou-collapse-btn absolute -right-3.5 top-20 w-7 h-7 z-30"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight size={13} className="text-white" />
        ) : (
          <ChevronLeft size={13} className="text-white" />
        )}
      </button>
    </aside>
  );
}