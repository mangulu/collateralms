'use client';
import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import { Menu, LogOut, CheckSquare, ChevronDown, AlertCircle, LayoutGrid, BookOpen, Library } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { userTaskService, UserTask } from '@/lib/supabase/userTaskService';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

const priorityColor: Record<string, string> = {
  urgent: 'text-red-600',
  high: 'text-orange-500',
  normal: 'text-blue-600',
  low: 'text-gray-400',
};

export default function AppLayout({ children, currentPath }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, signOut } = useAuth();
  const tasksRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const activePath = pathname || currentPath;

  const initials = userProfile?.initials ||
    (userProfile?.full_name
      ? userProfile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      : 'U');
  const displayName = userProfile?.full_name || userProfile?.email || 'User';
  const displayRole = userProfile?.role
    ? userProfile.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : '';

  // Fetch tasks for current user
  useEffect(() => {
    if (!userProfile?.id) return;
    let cancelled = false;
    async function load() {
      try {
        const [myTasks, count] = await Promise.all([
          userTaskService.getMyTasks(userProfile!.id),
          userTaskService.getPendingCount(userProfile!.id),
        ]);
        if (!cancelled) {
          setTasks(myTasks.filter(t => t.taskStatus === 'pending' || t.taskStatus === 'in_progress'));
          setTaskCount(count);
        }
      } catch { /* silent */ }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userProfile?.id]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tasksRef.current && !tasksRef.current.contains(e.target as Node)) {
        setTasksOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const TopBarRight = () => (
    <div className="flex items-center gap-2 shrink-0">
      {/* Module Hub icon */}
      <div className="relative group">
        <Link
          href="/module-hub"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ color: 'var(--izou-text-muted)', border: '1px solid var(--izou-border)' }}
          onMouseOver={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)';
            (e.currentTarget as HTMLElement).style.color = 'var(--izou-primary)';
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--izou-text-muted)';
          }}
        >
          <LayoutGrid size={16} />
        </Link>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-white text-xs px-2 py-1 rounded-md whitespace-nowrap" style={{ backgroundColor: 'rgba(0,60,90,0.92)', backdropFilter: 'blur(8px)' }}>
            Module Hub
          </div>
        </div>
      </div>

      {/* Onboarding Guide icon */}
      <div className="relative group">
        <Link
          href="/onboarding-guide"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ color: 'var(--izou-text-muted)', border: '1px solid var(--izou-border)' }}
          onMouseOver={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)';
            (e.currentTarget as HTMLElement).style.color = 'var(--izou-primary)';
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--izou-text-muted)';
          }}
        >
          <BookOpen size={16} />
        </Link>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-white text-xs px-2 py-1 rounded-md whitespace-nowrap" style={{ backgroundColor: 'rgba(0,60,90,0.92)', backdropFilter: 'blur(8px)' }}>
            Onboarding Guide
          </div>
        </div>
      </div>

      {/* Glossary icon */}
      <div className="relative group">
        <Link
          href="/glossary"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ color: 'var(--izou-text-muted)', border: '1px solid var(--izou-border)' }}
          onMouseOver={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)';
            (e.currentTarget as HTMLElement).style.color = 'var(--izou-primary)';
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--izou-text-muted)';
          }}
        >
          <Library size={16} />
        </Link>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-white text-xs px-2 py-1 rounded-md whitespace-nowrap" style={{ backgroundColor: 'rgba(0,60,90,0.92)', backdropFilter: 'blur(8px)' }}>
            Glossary
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'var(--izou-border)' }} />

      {/* Tasks Pill */}
      <div className="relative" ref={tasksRef}>
        <button
          onClick={() => { setTasksOpen(o => !o); setUserMenuOpen(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{
            backgroundColor: taskCount > 0 ? 'var(--izou-primary)' : 'var(--izou-border)',
            color: taskCount > 0 ? '#fff' : 'var(--izou-text-muted)',
            border: '1px solid transparent',
          }}
          title="My assigned tasks"
        >
          <CheckSquare size={13} />
          <span>{taskCount} Task{taskCount !== 1 ? 's' : ''}</span>
          <ChevronDown size={11} className={`transition-transform ${tasksOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Tasks Dropdown */}
        {tasksOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-lg z-50 overflow-hidden"
            style={{
              backgroundColor: 'var(--izou-card)',
              border: '1px solid var(--izou-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
          >
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--izou-border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--izou-text)' }}>
                My Tasks
              </span>
              <Link
                href="/workflows/tasks"
                onClick={() => setTasksOpen(false)}
                className="text-xs font-medium"
                style={{ color: 'var(--izou-primary)' }}
              >
                View all
              </Link>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <CheckSquare size={24} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--izou-text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--izou-text-muted)' }}>No active tasks assigned to you</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div
                    key={task.id}
                    className="px-4 py-3 hover:bg-opacity-50 transition-colors"
                    style={{ borderBottom: '1px solid var(--izou-border)' }}
                    onMouseOver={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'}
                    onMouseOut={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        size={13}
                        className={`mt-0.5 shrink-0 ${priorityColor[task.priority] ?? 'text-gray-400'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--izou-text)' }}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--izou-text-muted)' }}>
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full font-medium capitalize"
                            style={{
                              backgroundColor: 'var(--izou-primary-light)',
                              color: 'var(--izou-primary)',
                            }}
                          >
                            {task.taskStatus.replace('_', ' ')}
                          </span>
                          {task.dueDate && (
                            <span className="text-xs" style={{ color: 'var(--izou-text-muted)' }}>
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {task.actionUrl && (
                        <Link
                          href={task.actionUrl}
                          onClick={() => setTasksOpen(false)}
                          className="shrink-0 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                          style={{
                            color: 'var(--izou-primary)',
                            border: '1px solid var(--izou-primary)',
                          }}
                          onMouseOver={e => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary)';
                            (e.currentTarget as HTMLElement).style.color = '#fff';
                          }}
                          onMouseOut={e => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--izou-primary)';
                          }}
                        >
                          Open
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--izou-border)' }}>
              <Link
                href="/workflows/tasks"
                onClick={() => setTasksOpen(false)}
                className="block w-full text-center text-xs font-medium py-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--izou-primary)', backgroundColor: 'var(--izou-primary-light)' }}
              >
                Go to Task List
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* User Avatar + Menu */}
      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => { setUserMenuOpen(o => !o); setTasksOpen(false); }}
          className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors"
          style={{ border: '1px solid var(--izou-border)' }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'}
          onMouseOut={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          title={displayName}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
            style={{ background: 'var(--izou-primary)' }}
          >
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold leading-tight truncate max-w-[100px]" style={{ color: 'var(--izou-text)' }}>
              {displayName}
            </p>
            <p className="text-xs leading-tight truncate max-w-[100px]" style={{ color: 'var(--izou-text-muted)' }}>
              {displayRole}
            </p>
          </div>
          <ChevronDown size={12} className={`shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--izou-text-muted)' }} />
        </button>

        {userMenuOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-lg z-50 overflow-hidden"
            style={{
              backgroundColor: 'var(--izou-card)',
              border: '1px solid var(--izou-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--izou-border)' }}>
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--izou-text)' }}>{displayName}</p>
              <p className="text-xs truncate" style={{ color: 'var(--izou-text-muted)' }}>{displayRole}</p>
            </div>
            <Link
              href="/user-profile"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors"
              style={{ color: 'var(--izou-text)' }}
              onMouseOver={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'}
              onMouseOut={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              My Profile
            </Link>
            <button
              onClick={() => { setUserMenuOpen(false); signOut?.(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs transition-colors"
              style={{ color: 'var(--izou-text)', borderTop: '1px solid var(--izou-border)' }}
              onMouseOver={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'}
              onMouseOut={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--izou-bg)' }}>
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        transform transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentPath={activePath}
        />
      </div>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 shrink-0"
          style={{
            backgroundColor: 'var(--izou-card)',
            borderBottom: '1px solid var(--izou-border)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}
        >
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--izou-text)' }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1">
            <GlobalSearch />
          </div>
          <TopBarRight />
        </div>

        {/* Desktop top bar */}
        <div
          className="hidden lg:flex items-center gap-3 px-6 py-2.5 shrink-0"
          style={{
            backgroundColor: 'var(--izou-card)',
            borderBottom: '1px solid var(--izou-border)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}
        >
          <div className="flex-1 max-w-sm">
            <GlobalSearch />
          </div>
          <div className="ml-auto">
            <TopBarRight />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}