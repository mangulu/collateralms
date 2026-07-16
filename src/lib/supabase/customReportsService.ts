'use client';
import { createClient } from './client';

export type ExportFormat = 'csv' | 'pdf' | 'excel';
export type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

export interface ReportFilters {
  collateralTypes: string[];
  statuses: string[];
  registries: string[];
  officers: string[];
}

export interface CustomReport {
  id: string;
  createdBy: string;
  name: string;
  description: string;
  filters: ReportFilters;
  dateFrom: string | null;
  dateTo: string | null;
  exportFormat: ExportFormat;
  isScheduled: boolean;
  scheduleFrequency: ScheduleFrequency;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toReport(row: any): CustomReport {
  return {
    id: row.id,
    createdBy: row.created_by,
    name: row.name,
    description: row.description ?? '',
    filters: row.filters ?? { collateralTypes: [], statuses: [], registries: [], officers: [] },
    dateFrom: row.date_from ?? null,
    dateTo: row.date_to ?? null,
    exportFormat: row.export_format ?? 'csv',
    isScheduled: row.is_scheduled ?? false,
    scheduleFrequency: row.schedule_frequency ?? 'once',
    nextRunAt: row.next_run_at ?? null,
    lastRunAt: row.last_run_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const customReportsService = {
  async getAll(): Promise<CustomReport[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('custom_reports')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toReport);
  },

  async create(payload: Omit<CustomReport, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'lastRunAt'>): Promise<CustomReport> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('custom_reports')
      .insert({
        created_by: user.id,
        name: payload.name,
        description: payload.description,
        filters: payload.filters,
        date_from: payload.dateFrom || null,
        date_to: payload.dateTo || null,
        export_format: payload.exportFormat,
        is_scheduled: payload.isScheduled,
        schedule_frequency: payload.scheduleFrequency,
        next_run_at: payload.nextRunAt || null,
      })
      .select()
      .single();
    if (error) throw error;
    return toReport(data);
  },

  async update(id: string, payload: Partial<Omit<CustomReport, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>): Promise<CustomReport> {
    const supabase = createClient();
    const updateData: any = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.filters !== undefined) updateData.filters = payload.filters;
    if (payload.dateFrom !== undefined) updateData.date_from = payload.dateFrom || null;
    if (payload.dateTo !== undefined) updateData.date_to = payload.dateTo || null;
    if (payload.exportFormat !== undefined) updateData.export_format = payload.exportFormat;
    if (payload.isScheduled !== undefined) updateData.is_scheduled = payload.isScheduled;
    if (payload.scheduleFrequency !== undefined) updateData.schedule_frequency = payload.scheduleFrequency;
    if (payload.nextRunAt !== undefined) updateData.next_run_at = payload.nextRunAt || null;
    if (payload.lastRunAt !== undefined) updateData.last_run_at = payload.lastRunAt || null;

    const { data, error } = await supabase
      .from('custom_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toReport(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('custom_reports').delete().eq('id', id);
    if (error) throw error;
  },
};
