'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';

interface DashboardRefreshValue {
  refreshKey: number;
  triggerRefresh: () => void;
}

const DashboardRefreshContext = createContext<DashboardRefreshValue>({
  refreshKey: 0,
  triggerRefresh: () => {},
});

export function DashboardRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return (
    <DashboardRefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </DashboardRefreshContext.Provider>
  );
}

/** Widgets add `refreshKey` to their data-fetch effect's dependency array so the header's Refresh button actually re-fetches them. */
export function useDashboardRefresh() {
  return useContext(DashboardRefreshContext);
}
