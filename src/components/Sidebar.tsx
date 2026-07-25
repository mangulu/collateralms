'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from './ui/AppLogo';
import { ChevronLeft, ChevronRight, LogOut, LayoutGrid, ChevronDown, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/lib/rbac';
import { MODULE_DEFINITIONS, getModuleForPath, ModuleNavItem } from '@/lib/moduleNav';



interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentPath?: string;
}

const badgeVariantClasses: Record<string, string> = {
  default: 'bg-blue-500/20 text-blue-300',
  danger: 'bg-red-500/20 text-red-300',
  warning: 'bg-amber-500/20 text-amber-300',
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
    // Auto-expand parent if a child is active
    return new Set<string>();
  });
  const { userProfile, signOut } = useAuth();
  const { hasPermission, loading: permsLoading, isSystemAdmin } = usePermissions();
  const router = useRouter();

  const initials = userProfile?.initials ||
    (userProfile?.full_name
      ? userProfile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      : 'U');

  const displayName = userProfile?.full_name || userProfile?.email || 'User';
  const displayRole = userProfile?.role
    ? userProfile.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : '';

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
    // Auto-expand if a child is active
    if (isChildActive(item, currentPath)) return true;
    return expandedItems.has(item.label);
  };

  const renderNavItem = (item: ModuleNavItem) => {
    const ItemIcon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const childActive = isChildActive(item, currentPath);
    const expanded = isExpanded(item);
    const isActive = !hasChildren && (currentPath === item.href || currentPath?.startsWith(item.href.split('?')[0] + '/'));
    const badgeClass = badgeVariantClasses[item.badgeVariant ?? 'default'];

    if (hasChildren) {
      return (
        <div key={`nav-${item.label}`}>
          <button
            onClick={() => !collapsed && toggleExpanded(item.label)}
            onMouseEnter={() => setHoveredItem(item.label)}
            onMouseLeave={() => setHoveredItem(null)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-all duration-150 mb-0.5"
            style={
              childActive
                ? { backgroundColor: 'rgba(37,99,235,0.15)', color: '#1E3A8A' }
                : { color: '#1E3A8A' }
            }
            onMouseOver={(e) => {
              if (!childActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.12)';
              }
            }}
            onMouseOut={(e) => {
              if (!childActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor = childActive ? 'rgba(37,99,235,0.15)' : 'transparent';
              }
            }}
          >
            <ItemIcon size={18} className="shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">{item.label}</span>
                <ChevronDown
                  size={14}
                  className="shrink-0 transition-transform duration-200"
                  style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </>
            )}
          </button>
          {/* Submenu */}
          {!collapsed && expanded && (
            <div className="ml-4 pl-3 border-l border-blue-200 mb-1">
              {item.children!
                .filter((child) => !child.permission || isSystemAdmin || permsLoading || hasPermission(child.permission))
                .map((child) => {
                  const ChildIcon = child.icon;
                  const childIsActive = currentPath === child.href || currentPath?.startsWith(child.href.split('?')[0] + '/');
                  return (
                    <Link
                      key={`child-${child.label}`}
                      href={child.href}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150 mb-0.5"
                      style={
                        childIsActive
                          ? { backgroundColor: '#2563EB', color: '#FFFFFF' }
                          : { color: '#1E3A8A' }
                      }
                      onMouseOver={(e) => {
                        if (!childIsActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.12)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!childIsActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <ChildIcon size={15} className="shrink-0" />
                      <span className="flex-1 truncate text-xs">{child.label}</span>
                    </Link>
                  );
                })}
            </div>
          )}
          {/* Collapsed tooltip */}
          {collapsed && hoveredItem === item.label && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
              <div className="text-white text-xs px-2 py-1 rounded shadow-dropdown whitespace-nowrap" style={{ backgroundColor: '#1E293B' }}>
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
          className="flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-all duration-150 group mb-0.5"
          style={
            isActive
              ? { backgroundColor: '#2563EB', color: '#FFFFFF' }
              : { color: '#1E3A8A' }
          }
          onMouseOver={(e) => {
            if (!isActive) {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.12)';
              (e.currentTarget as HTMLElement).style.color = '#1E3A8A';
            }
          }}
          onMouseOut={(e) => {
            if (!isActive) {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#1E3A8A';
            }
          }}
        >
          <ItemIcon size={18} className="shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && item.badge && (
            <span className={`text-xs font-600 px-1.5 py-0.5 rounded-full ${badgeClass}`}>
              {item.badge}
            </span>
          )}
          {collapsed && item.badge && (
            <span className={`absolute top-1 right-1 text-xs font-600 px-1 py-0 rounded-full text-[10px] ${badgeClass}`}>
              {item.badge}
            </span>
          )}
        </Link>
        {collapsed && hoveredItem === item.label && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
            <div className="text-white text-xs px-2 py-1 rounded shadow-dropdown whitespace-nowrap" style={{ backgroundColor: '#1E293B' }}>
              {item.label}
              {item.badge && <span className="ml-1 opacity-75">({item.badge})</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="relative flex flex-col h-full shrink-0 sidebar-transition z-20"
      style={{ width: collapsed ? '64px' : '240px', backgroundColor: '#DBEAFE', borderRight: '1px solid rgba(0,0,0,0.08)' }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-3 shrink-0 overflow-hidden" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <AppLogo size={32} />
          {!collapsed && (
            <div className="min-w-0 fade-in">
              <p className="text-sm font-semibold truncate leading-tight" style={{ color: '#1E40AF' }}>
                CollateralMS
              </p>
              <p className="text-xs truncate leading-tight" style={{ color: '#3B82F6' }}>
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
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-all duration-150"
              style={
                currentPath === '/module-hub'
                  ? { backgroundColor: '#2563EB', color: '#FFFFFF' }
                  : { color: '#1E3A8A' }
              }
              onMouseOver={(e) => {
                if (currentPath !== '/module-hub') {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.12)';
                }
              }}
              onMouseOut={(e) => {
                if (currentPath !== '/module-hub') {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <LayoutGrid size={18} className="shrink-0" />
              {!collapsed && <span className="flex-1 truncate text-left">Module Hub</span>}
            </button>
            {collapsed && hoveredItem === '__home__' && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
                <div className="text-white text-xs px-2 py-1 rounded shadow-dropdown whitespace-nowrap" style={{ backgroundColor: '#1E293B' }}>
                  Module Hub
                </div>
              </div>
            )}
          </div>
          {/* Onboarding Guide button */}
          <div
            className="relative mt-1"
            onMouseEnter={() => setHoveredItem('__onboarding__')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <button
              onClick={() => router.push('/onboarding-guide')}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-all duration-150"
              style={
                currentPath === '/onboarding-guide'
                  ? { backgroundColor: '#2563EB', color: '#FFFFFF' }
                  : { color: '#1E3A8A' }
              }
              onMouseOver={(e) => {
                if (currentPath !== '/onboarding-guide') {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.12)';
                }
              }}
              onMouseOut={(e) => {
                if (currentPath !== '/onboarding-guide') {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <BookOpen size={18} className="shrink-0" />
              {!collapsed && <span className="flex-1 truncate text-left">Onboarding Guide</span>}
            </button>
            {collapsed && hoveredItem === '__onboarding__' && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
                <div className="text-white text-xs px-2 py-1 rounded shadow-dropdown whitespace-nowrap" style={{ backgroundColor: '#1E293B' }}>
                  Onboarding Guide
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="mx-1 mt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} />
          )}
        </div>

        {/* Module-contextual nav groups */}
        {activeModule ? (
          activeModule.groups.map((group) => {
            const visibleItems = permsLoading
              ? group.items
              : group.items.filter((item) => {
                  if (!item.permission) return true;
                  if (isSystemAdmin) return true;
                  if (item.children) return true; // always show parent with children
                  return hasPermission(item.permission);
                });

            if (visibleItems.length === 0) return null;

            return (
              <div key={`group-${group.label}`} className="mb-4">
                {!collapsed && (
                  <p className="text-xs font-600 tracking-wider uppercase px-2 mb-1" style={{ color: '#1D4ED8' }}>
                    {group.label}
                  </p>
                )}
                {collapsed && <div className="mx-1 mb-2" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} />}
                {visibleItems.map((item) => renderNavItem(item))}
              </div>
            );
          })
        ) : (
          !collapsed && (
            <div className="px-2 py-3 text-xs text-center" style={{ color: '#3B82F6' }}>
              Select a module from the hub to see its pages here.
            </div>
          )
        )}
      </nav>

      {/* User Profile */}
      <div className="p-2 shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        {!collapsed ? (
          <div
            className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors group"
            onClick={() => signOut?.()}
            title="Sign out"
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.12)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#2563EB' }}>
              <span className="text-white text-xs font-600">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-500 truncate" style={{ color: '#1E3A8A' }}>{displayName}</p>
              <p className="text-xs truncate" style={{ color: '#3B82F6' }}>{displayRole}</p>
            </div>
            <LogOut size={15} className="shrink-0 transition-colors group-hover:text-red-500" style={{ color: '#1D4ED8' }} />
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              style={{ backgroundColor: '#2563EB' }}
              onClick={() => signOut?.()}
              title="Sign out"
            >
              <span className="text-white text-xs font-600">{initials}</span>
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center shadow-card transition-colors z-30"
        style={{ backgroundColor: '#BFDBFE', border: '1px solid rgba(37,99,235,0.3)' }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight size={12} style={{ color: '#1E40AF' }} />
        ) : (
          <ChevronLeft size={12} style={{ color: '#1E40AF' }} />
        )}
      </button>
    </aside>
  );
}