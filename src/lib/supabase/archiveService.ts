import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocationType = 'vault' | 'room' | 'cabinet' | 'shelf' | 'slot';
export type CustodyStatus = 'in_vault' | 'on_loan' | 'overdue' | 'returned' | 'missing';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'checked_out' | 'returned';
export type ArchiveEventType =
  | 'vault_created' | 'vault_updated' |'placement_assigned'| 'placement_updated' | 'placement_removed' | 'collateral_moved' |'request_raised'| 'request_approved' | 'request_rejected' |'checked_out' | 'returned' | 'overdue_flagged' | 'sms_sent'
  | 'document_added' | 'document_removed'
  | 'custody_handoff' | 'custody_received' | 'officer_assigned';

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
  collateral?: { id: string; collateral_type: string; description: string; obligor: string };
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
  collateral?: { id: string; collateral_type: string; description: string; obligor: string };
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
  collateral?: { id: string; collateral_type: string; description: string; obligor: string };
  checkedOutByProfile?: { full_name: string };
  currentRequest?: ArchiveRequest;
}

export interface ArchiveAuditEntry {
  id: string;
  eventType: ArchiveEventType;
  collateralId: string | null;
  requestId: string | null;
  locationId: string | null;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  performedBy: string | null;
  actorName: string | null;
  reason: string | null;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  collateral?: { collateral_type: string; description: string };
  performedByProfile?: { full_name: string };
  location?: { name: string; code: string };
  sourceLocation?: { name: string; code: string };
  destinationLocation?: { name: string; code: string };
}

export interface CustodyChainEntry {
  id: string;
  collateralId: string;
  eventType: string;
  fromOfficerId: string | null;
  toOfficerId: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  confirmedBy: string | null;
  confirmationStatus: 'pending' | 'confirmed' | 'rejected';
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  collateral?: { id: string; collateral_type: string; description: string; obligor: string };
  fromOfficer?: { full_name: string };
  toOfficer?: { full_name: string };
  confirmedByProfile?: { full_name: string };
  fromLocation?: { name: string; code: string };
  toLocation?: { name: string; code: string };
}

export interface RequestStatusLogEntry {
  id: string;
  requestId: string;
  collateralId: string | null;
  oldStatus: string | null;
  newStatus: string;
  changedBy: string | null;
  notes: string | null;
  createdAt: string;
  changedByProfile?: { full_name: string };
  collateral?: { collateral_type: string; description: string; obligor: string };
  request?: { purpose: string };
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

  subscribeToChanges(callback: () => void) {
    return supabase
      .channel('archive_locations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archive_locations' }, callback)
      .subscribe();
  },
};

// ─── Placement Service ────────────────────────────────────────────────────────

export const archivePlacementService = {
  async getAll(): Promise<ArchivePlacement[]> {
    const { data, error } = await supabase
      .from('archive_placements')
      .select(`
        *,
        collateral_records(id, collateral_type, description, obligor),
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
        collateral_records(id, collateral_type, description, obligor),
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
    sourceLocationId?: string; reason?: string;
  }): Promise<void> {
    // Get current placement to track source location
    const { data: existing } = await supabase
      .from('archive_placements')
      .select('location_id')
      .eq('collateral_id', payload.collateralId)
      .maybeSingle();

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

    // Log movement in audit log
    const sourceLocId = payload.sourceLocationId ?? existing?.location_id ?? null;
    const isMove = sourceLocId && sourceLocId !== payload.locationId;
    await supabase.from('archive_audit_log').insert({
      event_type: isMove ? 'collateral_moved' : 'placement_assigned',
      collateral_id: payload.collateralId,
      location_id: payload.locationId,
      source_location_id: sourceLocId,
      destination_location_id: payload.locationId,
      performed_by: payload.placedBy,
      description: isMove ? 'Collateral moved to new vault slot' : 'Collateral filed into vault slot',
      reason: payload.reason ?? null,
      metadata: { source_location_id: sourceLocId, destination_location_id: payload.locationId },
    });
  },

  async remove(collateralId: string, performedBy?: string, reason?: string): Promise<void> {
    // Get current location before removing
    const { data: existing } = await supabase
      .from('archive_placements')
      .select('location_id')
      .eq('collateral_id', collateralId)
      .maybeSingle();

    const { error } = await supabase
      .from('archive_placements')
      .delete()
      .eq('collateral_id', collateralId);
    if (error) throw error;

    // Log removal
    if (performedBy) {
      await supabase.from('archive_audit_log').insert({
        event_type: 'placement_removed',
        collateral_id: collateralId,
        location_id: existing?.location_id ?? null,
        source_location_id: existing?.location_id ?? null,
        performed_by: performedBy,
        description: 'Collateral removed from vault slot',
        reason: reason ?? null,
        metadata: {},
      });
    }
  },

  subscribeToChanges(callback: () => void) {
    return supabase
      .channel('archive_placements_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archive_placements' }, callback)
      .subscribe();
  },
};

// ─── Request Service ──────────────────────────────────────────────────────────

export const archiveRequestService = {
  async getAll(): Promise<ArchiveRequest[]> {
    const { data, error } = await supabase
      .from('archive_requests')
      .select(`
        *,
        collateral_records(id, collateral_type, description, obligor),
        requested_by_profile:user_profiles!requested_by(full_name, email),
        approved_by_profile:user_profiles!approved_by(full_name)
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

    // Log custody chain
    await supabase.from('archive_custody_chain').insert({
      collateral_id: req.collateral_id,
      event_type: 'custody_handoff',
      to_officer_id: approvedBy,
      confirmation_status: 'confirmed',
      confirmed_by: approvedBy,
      confirmed_at: new Date().toISOString(),
      notes: checkoutNotes ?? 'File checked out via approved request',
    });
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

    // Log custody chain return
    await supabase.from('archive_custody_chain').insert({
      collateral_id: req.collateral_id,
      event_type: 'custody_received',
      confirmation_status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      notes: returnNotes ?? 'File returned to vault',
    });
  },

  subscribeToChanges(callback: () => void) {
    return supabase
      .channel('archive_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archive_requests' }, callback)
      .subscribe();
  },
};

// ─── Custody Service ──────────────────────────────────────────────────────────

export const archiveCustodyService = {
  async getAll(): Promise<ArchiveCustody[]> {
    const { data, error } = await supabase
      .from('archive_custody')
      .select(`
        id,
        collateral_id,
        current_status,
        current_request_id,
        last_checked_out_at,
        last_returned_at,
        checked_out_by,
        overdue_since,
        updated_at,
        collateral_records(id, collateral_type, description, obligor)
      `)
      .order('updated_at', { ascending: false });
    if (error) throw error;

    const rows = data || [];
    const userIds = [...new Set(rows.map((r) => r.checked_out_by).filter(Boolean))] as string[];
    const profileMap: Record<string, { full_name: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds);
      (profiles || []).forEach((p) => { profileMap[p.id] = { full_name: p.full_name }; });
    }

    return rows.map((r) => ({
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
      checkedOutByProfile: r.checked_out_by ? profileMap[r.checked_out_by] : undefined,
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

  subscribeToChanges(callback: () => void) {
    return supabase
      .channel('archive_custody_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archive_custody' }, callback)
      .subscribe();
  },
};

// ─── Custody Chain Service ────────────────────────────────────────────────────

export const archiveCustodyChainService = {
  async getAll(limit = 200): Promise<CustodyChainEntry[]> {
    const { data, error } = await supabase
      .from('archive_custody_chain')
      .select(`
        *,
        collateral_records(id, collateral_type, description, obligor),
        from_officer:user_profiles!from_officer_id(full_name),
        to_officer:user_profiles!to_officer_id(full_name),
        confirmed_by_profile:user_profiles!confirmed_by(full_name),
        from_location:archive_locations!from_location_id(name, code),
        to_location:archive_locations!to_location_id(name, code)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      collateralId: r.collateral_id,
      eventType: r.event_type,
      fromOfficerId: r.from_officer_id,
      toOfficerId: r.to_officer_id,
      fromLocationId: r.from_location_id,
      toLocationId: r.to_location_id,
      confirmedBy: r.confirmed_by,
      confirmationStatus: r.confirmation_status as CustodyChainEntry['confirmationStatus'],
      notes: r.notes,
      confirmedAt: r.confirmed_at,
      createdAt: r.created_at,
      collateral: r.collateral_records as CustodyChainEntry['collateral'],
      fromOfficer: r.from_officer as CustodyChainEntry['fromOfficer'],
      toOfficer: r.to_officer as CustodyChainEntry['toOfficer'],
      confirmedByProfile: r.confirmed_by_profile as CustodyChainEntry['confirmedByProfile'],
      fromLocation: r.from_location as CustodyChainEntry['fromLocation'],
      toLocation: r.to_location as CustodyChainEntry['toLocation'],
    }));
  },

  async getByCollateral(collateralId: string): Promise<CustodyChainEntry[]> {
    const { data, error } = await supabase
      .from('archive_custody_chain')
      .select(`
        *,
        collateral_records(id, collateral_type, description, obligor),
        from_officer:user_profiles!from_officer_id(full_name),
        to_officer:user_profiles!to_officer_id(full_name),
        confirmed_by_profile:user_profiles!confirmed_by(full_name),
        from_location:archive_locations!from_location_id(name, code),
        to_location:archive_locations!to_location_id(name, code)
      `)
      .eq('collateral_id', collateralId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      collateralId: r.collateral_id,
      eventType: r.event_type,
      fromOfficerId: r.from_officer_id,
      toOfficerId: r.to_officer_id,
      fromLocationId: r.from_location_id,
      toLocationId: r.to_location_id,
      confirmedBy: r.confirmed_by,
      confirmationStatus: r.confirmation_status as CustodyChainEntry['confirmationStatus'],
      notes: r.notes,
      confirmedAt: r.confirmed_at,
      createdAt: r.created_at,
      collateral: r.collateral_records as CustodyChainEntry['collateral'],
      fromOfficer: r.from_officer as CustodyChainEntry['fromOfficer'],
      toOfficer: r.to_officer as CustodyChainEntry['toOfficer'],
      confirmedByProfile: r.confirmed_by_profile as CustodyChainEntry['confirmedByProfile'],
      fromLocation: r.from_location as CustodyChainEntry['fromLocation'],
      toLocation: r.to_location as CustodyChainEntry['toLocation'],
    }));
  },

  async confirm(id: string, confirmedBy: string): Promise<void> {
    const { error } = await supabase
      .from('archive_custody_chain')
      .update({ confirmation_status: 'confirmed', confirmed_by: confirmedBy, confirmed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async log(entry: {
    collateralId: string;
    eventType: string;
    fromOfficerId?: string;
    toOfficerId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    confirmedBy?: string;
    confirmationStatus?: 'pending' | 'confirmed' | 'rejected';
    notes?: string;
  }): Promise<void> {
    const { error } = await supabase.from('archive_custody_chain').insert({
      collateral_id: entry.collateralId,
      event_type: entry.eventType,
      from_officer_id: entry.fromOfficerId ?? null,
      to_officer_id: entry.toOfficerId ?? null,
      from_location_id: entry.fromLocationId ?? null,
      to_location_id: entry.toLocationId ?? null,
      confirmed_by: entry.confirmedBy ?? null,
      confirmation_status: entry.confirmationStatus ?? 'pending',
      notes: entry.notes ?? null,
      confirmed_at: entry.confirmationStatus === 'confirmed' ? new Date().toISOString() : null,
    });
    if (error) throw error;
  },

  subscribeToChanges(callback: () => void) {
    return supabase
      .channel('archive_custody_chain_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archive_custody_chain' }, callback)
      .subscribe();
  },
};

// ─── Request Status Log Service ───────────────────────────────────────────────

export const archiveRequestStatusLogService = {
  async getAll(limit = 200): Promise<RequestStatusLogEntry[]> {
    const { data, error } = await supabase
      .from('archive_request_status_log')
      .select(`
        *,
        changed_by_profile:user_profiles!changed_by(full_name),
        collateral_records(collateral_type, description, obligor),
        archive_requests!request_id(purpose)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      requestId: r.request_id,
      collateralId: r.collateral_id,
      oldStatus: r.old_status,
      newStatus: r.new_status,
      changedBy: r.changed_by,
      notes: r.notes,
      createdAt: r.created_at,
      changedByProfile: r.changed_by_profile as RequestStatusLogEntry['changedByProfile'],
      collateral: r.collateral_records as RequestStatusLogEntry['collateral'],
      request: r.archive_requests as RequestStatusLogEntry['request'],
    }));
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
        performed_by_profile:user_profiles!performed_by(full_name),
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
      sourceLocationId: r.source_location_id ?? null,
      destinationLocationId: r.destination_location_id ?? null,
      performedBy: r.performed_by,
      actorName: r.actor_name ?? null,
      reason: r.reason ?? null,
      description: r.description,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: r.created_at,
      collateral: r.collateral_records as ArchiveAuditEntry['collateral'],
      performedByProfile: r.performed_by_profile as ArchiveAuditEntry['performedByProfile'],
      location: r.archive_locations as ArchiveAuditEntry['location'],
    }));
  },

  async getByLocation(locationId: string, limit = 100): Promise<ArchiveAuditEntry[]> {
    const { data, error } = await supabase
      .from('archive_audit_log')
      .select(`
        *,
        collateral_records(collateral_type, description),
        performed_by_profile:user_profiles!performed_by(full_name),
        archive_locations(name, code)
      `)
      .or(`location_id.eq.${locationId},source_location_id.eq.${locationId},destination_location_id.eq.${locationId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      eventType: r.event_type as ArchiveEventType,
      collateralId: r.collateral_id,
      requestId: r.request_id,
      locationId: r.location_id,
      sourceLocationId: r.source_location_id ?? null,
      destinationLocationId: r.destination_location_id ?? null,
      performedBy: r.performed_by,
      actorName: r.actor_name ?? null,
      reason: r.reason ?? null,
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
    sourceLocationId?: string;
    destinationLocationId?: string;
    performedBy?: string;
    actorName?: string;
    reason?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await supabase.from('archive_audit_log').insert({
      event_type: entry.eventType,
      collateral_id: entry.collateralId ?? null,
      request_id: entry.requestId ?? null,
      location_id: entry.locationId ?? null,
      source_location_id: entry.sourceLocationId ?? null,
      destination_location_id: entry.destinationLocationId ?? null,
      performed_by: entry.performedBy ?? null,
      actor_name: entry.actorName ?? null,
      reason: entry.reason ?? null,
      description: entry.description,
      metadata: entry.metadata ?? {},
    });
  },

  subscribeToChanges(callback: () => void) {
    return supabase
      .channel('archive_audit_log_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'archive_audit_log' }, callback)
      .subscribe();
  },
};
