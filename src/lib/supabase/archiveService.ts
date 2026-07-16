import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocationType = 'vault' | 'room' | 'cabinet' | 'shelf' | 'slot';
export type CustodyStatus = 'in_vault' | 'on_loan' | 'overdue' | 'returned' | 'missing';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'checked_out' | 'returned';
export type ArchiveEventType =
  | 'vault_created' | 'vault_updated' | 'placement_assigned' | 'placement_updated' |'request_raised'| 'request_approved' | 'request_rejected' |'checked_out' | 'returned' | 'overdue_flagged' | 'sms_sent'
  | 'document_added' | 'document_removed';

export interface ArchiveLocation {
  id: string;
  name: string;
  code: string;
  locationType: LocationType;
  parentId: string | null;
  description: string | null;
  capacity: number;
  currentOccupancy: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  children?: ArchiveLocation[];
}

export interface ArchivePlacement {
  id: string;
  collateralId: string;
  locationId: string | null;
  physicalRef: string | null;
  electronicRecordUrl: string | null;
  notes: string | null;
  placedBy: string | null;
  placedAt: string;
  updatedAt: string;
  collateral?: { id: string; collateral_type: string; description: string; owner_name: string };
  location?: ArchiveLocation;
  placedByProfile?: { full_name: string };
}

export interface ArchiveRequest {
  id: string;
  collateralId: string;
  requestedBy: string | null;
  approvedBy: string | null;
  requestStatus: RequestStatus;
  purpose: string;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  rejectionReason: string | null;
  checkoutNotes: string | null;
  returnNotes: string | null;
  smsReminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  collateral?: { id: string; collateral_type: string; description: string; owner_name: string };
  requestedByProfile?: { full_name: string; email: string };
  approvedByProfile?: { full_name: string };
}

export interface ArchiveCustody {
  id: string;
  collateralId: string;
  currentStatus: CustodyStatus;
  currentRequestId: string | null;
  lastCheckedOutAt: string | null;
  lastReturnedAt: string | null;
  checkedOutBy: string | null;
  overdueSince: string | null;
  updatedAt: string;
  collateral?: { id: string; collateral_type: string; description: string; owner_name: string };
  checkedOutByProfile?: { full_name: string };
  currentRequest?: ArchiveRequest;
}

export interface ArchiveAuditEntry {
  id: string;
  eventType: ArchiveEventType;
  collateralId: string | null;
  requestId: string | null;
  locationId: string | null;
  performedBy: string | null;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  collateral?: { collateral_type: string; description: string };
  performedByProfile?: { full_name: string };
  location?: { name: string; code: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapLocation(r: Record<string, unknown>): ArchiveLocation {
  return {
    id: r.id as string,
    name: r.name as string,
    code: r.code as string,
    locationType: r.location_type as LocationType,
    parentId: (r.parent_id as string) ?? null,
    description: (r.description as string) ?? null,
    capacity: (r.capacity as number) ?? 100,
    currentOccupancy: (r.current_occupancy as number) ?? 0,
    isActive: (r.is_active as boolean) ?? true,
    createdBy: (r.created_by as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapRequest(r: Record<string, unknown>): ArchiveRequest {
  return {
    id: r.id as string,
    collateralId: r.collateral_id as string,
    requestedBy: (r.requested_by as string) ?? null,
    approvedBy: (r.approved_by as string) ?? null,
    requestStatus: r.request_status as RequestStatus,
    purpose: r.purpose as string,
    expectedReturnDate: (r.expected_return_date as string) ?? null,
    actualReturnDate: (r.actual_return_date as string) ?? null,
    rejectionReason: (r.rejection_reason as string) ?? null,
    checkoutNotes: (r.checkout_notes as string) ?? null,
    returnNotes: (r.return_notes as string) ?? null,
    smsReminderSent: (r.sms_reminder_sent as boolean) ?? false,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    collateral: r.collateral_records as ArchiveRequest['collateral'],
    requestedByProfile: r.requested_by_profile as ArchiveRequest['requestedByProfile'],
    approvedByProfile: r.approved_by_profile as ArchiveRequest['approvedByProfile'],
  };
}

// ─── Vault / Location Service ─────────────────────────────────────────────────

export const archiveLocationService = {
  async getAll(): Promise<ArchiveLocation[]> {
    const { data, error } = await supabase
      .from('archive_locations')
      .select('*')
      .order('location_type')
      .order('name');
    if (error) throw error;
    return (data || []).map(mapLocation);
  },

  async getTree(): Promise<ArchiveLocation[]> {
    const all = await archiveLocationService.getAll();
    const map = new Map<string, ArchiveLocation>();
    all.forEach((l) => { map.set(l.id, { ...l, children: [] }); });
    const roots: ArchiveLocation[] = [];
    all.forEach((l) => {
      if (l.parentId && map.has(l.parentId)) {
        map.get(l.parentId)!.children!.push(map.get(l.id)!);
      } else if (!l.parentId) {
        roots.push(map.get(l.id)!);
      }
    });
    return roots;
  },

  async create(payload: {
    name: string; code: string; locationType: LocationType;
    parentId?: string | null; description?: string; capacity?: number; createdBy: string;
  }): Promise<ArchiveLocation> {
    const { data, error } = await supabase
      .from('archive_locations')
      .insert({
        name: payload.name,
        code: payload.code,
        location_type: payload.locationType,
        parent_id: payload.parentId ?? null,
        description: payload.description ?? null,
        capacity: payload.capacity ?? 100,
        created_by: payload.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return mapLocation(data);
  },

  async update(id: string, payload: Partial<{ name: string; description: string; capacity: number; isActive: boolean }>): Promise<void> {
    const { error } = await supabase
      .from('archive_locations')
      .update({
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.capacity !== undefined && { capacity: payload.capacity }),
        ...(payload.isActive !== undefined && { is_active: payload.isActive }),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('archive_locations').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─── Placement Service ────────────────────────────────────────────────────────

export const archivePlacementService = {
  async getAll(): Promise<ArchivePlacement[]> {
    const { data, error } = await supabase
      .from('archive_placements')
      .select(`
        *,
        collateral_records(id, collateral_type, description, owner_name),
        archive_locations(id, name, code, location_type)
      `)
      .order('placed_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      collateralId: r.collateral_id,
      locationId: r.location_id,
      physicalRef: r.physical_ref,
      electronicRecordUrl: r.electronic_record_url,
      notes: r.notes,
      placedBy: r.placed_by,
      placedAt: r.placed_at,
      updatedAt: r.updated_at,
      collateral: r.collateral_records as ArchivePlacement['collateral'],
      location: r.archive_locations ? mapLocation(r.archive_locations as Record<string, unknown>) : undefined,
      placedByProfile: undefined,
    }));
  },

  async getByLocation(locationId: string): Promise<ArchivePlacement[]> {
    const { data, error } = await supabase
      .from('archive_placements')
      .select(`
        *,
        collateral_records(id, collateral_type, description, owner_name),
        archive_locations(id, name, code, location_type)
      `)
      .eq('location_id', locationId)
      .order('placed_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      collateralId: r.collateral_id,
      locationId: r.location_id,
      physicalRef: r.physical_ref,
      electronicRecordUrl: r.electronic_record_url,
      notes: r.notes,
      placedBy: r.placed_by,
      placedAt: r.placed_at,
      updatedAt: r.updated_at,
      collateral: r.collateral_records as ArchivePlacement['collateral'],
      location: r.archive_locations ? mapLocation(r.archive_locations as Record<string, unknown>) : undefined,
      placedByProfile: undefined,
    }));
  },

  async upsert(payload: {
    collateralId: string; locationId: string; physicalRef?: string;
    electronicRecordUrl?: string; notes?: string; placedBy: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('archive_placements')
      .upsert({
        collateral_id: payload.collateralId,
        location_id: payload.locationId,
        physical_ref: payload.physicalRef ?? null,
        electronic_record_url: payload.electronicRecordUrl ?? null,
        notes: payload.notes ?? null,
        placed_by: payload.placedBy,
      }, { onConflict: 'collateral_id' });
    if (error) throw error;

    // Ensure custody record exists
    await supabase
      .from('archive_custody')
      .upsert({ collateral_id: payload.collateralId, current_status: 'in_vault' }, { onConflict: 'collateral_id' });
  },
};

// ─── Request Service ──────────────────────────────────────────────────────────

export const archiveRequestService = {
  async getAll(): Promise<ArchiveRequest[]> {
    const { data, error } = await supabase
      .from('archive_requests')
      .select(`
        *,
        collateral_records(id, collateral_type, description, owner_name),
        requested_by_profile:user_profiles!archive_requests_requested_by_fkey(full_name, email),
        approved_by_profile:user_profiles!archive_requests_approved_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapRequest);
  },

  async create(payload: {
    collateralId: string; requestedBy: string; purpose: string; expectedReturnDate?: string;
  }): Promise<ArchiveRequest> {
    const { data, error } = await supabase
      .from('archive_requests')
      .insert({
        collateral_id: payload.collateralId,
        requested_by: payload.requestedBy,
        purpose: payload.purpose,
        expected_return_date: payload.expectedReturnDate ?? null,
        request_status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    return mapRequest(data);
  },

  async approve(id: string, approvedBy: string, checkoutNotes?: string): Promise<void> {
    const { data: req, error: fetchErr } = await supabase
      .from('archive_requests')
      .select('collateral_id')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from('archive_requests')
      .update({ request_status: 'approved', approved_by: approvedBy, checkout_notes: checkoutNotes ?? null })
      .eq('id', id);
    if (error) throw error;

    // Update custody
    await supabase
      .from('archive_custody')
      .upsert({
        collateral_id: req.collateral_id,
        current_status: 'on_loan',
        current_request_id: id,
        last_checked_out_at: new Date().toISOString(),
        checked_out_by: approvedBy,
      }, { onConflict: 'collateral_id' });
  },

  async reject(id: string, rejectionReason: string): Promise<void> {
    const { error } = await supabase
      .from('archive_requests')
      .update({ request_status: 'rejected', rejection_reason: rejectionReason })
      .eq('id', id);
    if (error) throw error;
  },

  async markReturned(id: string, returnNotes?: string): Promise<void> {
    const { data: req, error: fetchErr } = await supabase
      .from('archive_requests')
      .select('collateral_id')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from('archive_requests')
      .update({
        request_status: 'returned',
        actual_return_date: new Date().toISOString().split('T')[0],
        return_notes: returnNotes ?? null,
      })
      .eq('id', id);
    if (error) throw error;

    await supabase
      .from('archive_custody')
      .update({
        current_status: 'in_vault',
        current_request_id: null,
        last_returned_at: new Date().toISOString(),
        checked_out_by: null,
        overdue_since: null,
      })
      .eq('collateral_id', req.collateral_id);
  },
};

// ─── Custody Service ──────────────────────────────────────────────────────────

export const archiveCustodyService = {
  async getAll(): Promise<ArchiveCustody[]> {
    const { data, error } = await supabase
      .from('archive_custody')
      .select(`
        *,
        collateral_records(id, collateral_type, description, owner_name),
        checked_out_by_profile:user_profiles!archive_custody_checked_out_by_fkey(full_name)
      `)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      collateralId: r.collateral_id,
      currentStatus: r.current_status as CustodyStatus,
      currentRequestId: r.current_request_id,
      lastCheckedOutAt: r.last_checked_out_at,
      lastReturnedAt: r.last_returned_at,
      checkedOutBy: r.checked_out_by,
      overdueSince: r.overdue_since,
      updatedAt: r.updated_at,
      collateral: r.collateral_records as ArchiveCustody['collateral'],
      checkedOutByProfile: r.checked_out_by_profile as ArchiveCustody['checkedOutByProfile'],
    }));
  },

  async flagOverdue(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const { data: overdueReqs } = await supabase
      .from('archive_requests')
      .select('id, collateral_id')
      .eq('request_status', 'approved')
      .lt('expected_return_date', today);

    if (!overdueReqs || overdueReqs.length === 0) return 0;

    for (const req of overdueReqs) {
      await supabase
        .from('archive_custody')
        .update({ current_status: 'overdue', overdue_since: new Date().toISOString() })
        .eq('collateral_id', req.collateral_id);
    }
    return overdueReqs.length;
  },
};

// ─── Audit Log Service ────────────────────────────────────────────────────────

export const archiveAuditService = {
  async getAll(limit = 100): Promise<ArchiveAuditEntry[]> {
    const { data, error } = await supabase
      .from('archive_audit_log')
      .select(`
        *,
        collateral_records(collateral_type, description),
        performed_by_profile:user_profiles!archive_audit_log_performed_by_fkey(full_name),
        archive_locations(name, code)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      eventType: r.event_type as ArchiveEventType,
      collateralId: r.collateral_id,
      requestId: r.request_id,
      locationId: r.location_id,
      performedBy: r.performed_by,
      description: r.description,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: r.created_at,
      collateral: r.collateral_records as ArchiveAuditEntry['collateral'],
      performedByProfile: r.performed_by_profile as ArchiveAuditEntry['performedByProfile'],
      location: r.archive_locations as ArchiveAuditEntry['location'],
    }));
  },

  async log(entry: {
    eventType: ArchiveEventType;
    collateralId?: string;
    requestId?: string;
    locationId?: string;
    performedBy?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await supabase.from('archive_audit_log').insert({
      event_type: entry.eventType,
      collateral_id: entry.collateralId ?? null,
      request_id: entry.requestId ?? null,
      location_id: entry.locationId ?? null,
      performed_by: entry.performedBy ?? null,
      description: entry.description,
      metadata: entry.metadata ?? {},
    });
  },
};
