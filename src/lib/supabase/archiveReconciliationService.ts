import { createClient } from '@/lib/supabase/client';
import { archiveLocationService, archivePlacementService, archiveAuditService, ArchiveLocation, ArchivePlacement } from '@/lib/supabase/archiveService';

const supabase = createClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReconciliationSessionStatus = 'in_progress' | 'completed' | 'cancelled';
export type ReconciliationResult = 'pending' | 'confirmed' | 'discrepancy';

export interface ReconciliationSession {
  id: string;
  locationId: string;
  status: ReconciliationSessionStatus;
  startedBy: string | null;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  location?: { name: string; code: string; locationType: string };
  startedByProfile?: { full_name: string };
  totalItems: number;
  reviewedItems: number;
}

export interface ReconciliationItem {
  id: string;
  sessionId: string;
  locationId: string;
  expectedCount: number;
  result: ReconciliationResult;
  discrepancyNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  location?: ArchiveLocation;
  expectedPlacements: ArchivePlacement[];
}

function mapSession(r: Record<string, any>, totalItems: number, reviewedItems: number): ReconciliationSession {
  return {
    id: r.id,
    locationId: r.location_id,
    status: r.status,
    startedBy: r.started_by,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    notes: r.notes,
    location: r.archive_locations ? { name: r.archive_locations.name, code: r.archive_locations.code, locationType: r.archive_locations.location_type } : undefined,
    startedByProfile: r.started_by_profile,
    totalItems,
    reviewedItems,
  };
}

export const archiveReconciliationService = {
  /** Starts a new session, snapshotting every slot under the chosen location as a pending item. */
  async startSession(locationId: string, userId: string): Promise<ReconciliationSession> {
    const tree = await archiveLocationService.getTreeWithCounts();
    const flatten = (nodes: ArchiveLocation[]): ArchiveLocation[] => nodes.reduce<ArchiveLocation[]>((acc, n) => [...acc, n, ...flatten(n.children ?? [])], []);
    const all = flatten(tree);
    const root = all.find((l) => l.id === locationId);
    if (!root) throw new Error('Location not found');

    const slots = root.locationType === 'slot' ? [root] : flatten(root.children ?? []).filter((l) => l.locationType === 'slot');
    if (slots.length === 0) throw new Error('This location has no slots to reconcile');

    const { data: session, error } = await supabase
      .from('archive_reconciliation_sessions')
      .insert({ location_id: locationId, started_by: userId })
      .select()
      .single();
    if (error) throw error;

    const { error: itemsErr } = await supabase
      .from('archive_reconciliation_items')
      .insert(slots.map((s) => ({ session_id: session.id, location_id: s.id, expected_count: s.currentOccupancy })));
    if (itemsErr) throw itemsErr;

    await archiveAuditService.log({
      eventType: 'reconciliation_started',
      locationId,
      performedBy: userId,
      description: `Reconciliation started for ${root.name} (${slots.length} slot${slots.length !== 1 ? 's' : ''})`,
    });

    return mapSession({ ...session, archive_locations: root }, slots.length, 0);
  },

  async getActiveSessions(): Promise<ReconciliationSession[]> {
    return archiveReconciliationService.getSessions('in_progress');
  },

  async getSessionHistory(): Promise<ReconciliationSession[]> {
    return archiveReconciliationService.getSessions();
  },

  async getSessions(status?: ReconciliationSessionStatus): Promise<ReconciliationSession[]> {
    let query = supabase
      .from('archive_reconciliation_sessions')
      .select(`
        *,
        archive_locations(name, code, location_type),
        started_by_profile:user_profiles!started_by(full_name)
      `)
      .order('started_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;

    const sessionIds = (data || []).map((s) => s.id);
    const progressBySession: Record<string, { total: number; reviewed: number }> = {};
    if (sessionIds.length > 0) {
      const { data: items } = await supabase
        .from('archive_reconciliation_items')
        .select('session_id, result')
        .in('session_id', sessionIds);
      (items || []).forEach((it) => {
        const p = progressBySession[it.session_id] ?? { total: 0, reviewed: 0 };
        p.total += 1;
        if (it.result !== 'pending') p.reviewed += 1;
        progressBySession[it.session_id] = p;
      });
    }

    return (data || []).map((r) => {
      const p = progressBySession[r.id] ?? { total: 0, reviewed: 0 };
      return mapSession(r, p.total, p.reviewed);
    });
  },

  async getSession(sessionId: string): Promise<ReconciliationSession | null> {
    const { data, error } = await supabase
      .from('archive_reconciliation_sessions')
      .select(`
        *,
        archive_locations(name, code, location_type),
        started_by_profile:user_profiles!started_by(full_name)
      `)
      .eq('id', sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: items } = await supabase
      .from('archive_reconciliation_items')
      .select('result')
      .eq('session_id', sessionId);
    const total = items?.length ?? 0;
    const reviewed = (items ?? []).filter((it) => it.result !== 'pending').length;
    return mapSession(data, total, reviewed);
  },

  /** Items for a session, each with the collaterals expected in that slot at session start. */
  async getSessionItems(sessionId: string): Promise<ReconciliationItem[]> {
    const { data, error } = await supabase
      .from('archive_reconciliation_items')
      .select(`
        *,
        archive_locations(*)
      `)
      .eq('session_id', sessionId)
      .order('location_id');
    if (error) throw error;

    const items = data || [];
    const placementsByLocation = new Map<string, ArchivePlacement[]>();
    await Promise.all(
      items.map(async (it) => {
        const placements = await archivePlacementService.getByLocation(it.location_id);
        placementsByLocation.set(it.location_id, placements);
      })
    );

    return items.map((it) => ({
      id: it.id,
      sessionId: it.session_id,
      locationId: it.location_id,
      expectedCount: it.expected_count,
      result: it.result,
      discrepancyNotes: it.discrepancy_notes,
      reviewedBy: it.reviewed_by,
      reviewedAt: it.reviewed_at,
      location: it.archive_locations ? {
        id: it.archive_locations.id,
        name: it.archive_locations.name,
        code: it.archive_locations.code,
        locationType: it.archive_locations.location_type,
        parentId: it.archive_locations.parent_id,
        description: it.archive_locations.description,
        capacity: it.archive_locations.capacity,
        currentOccupancy: it.archive_locations.current_occupancy,
        isActive: it.archive_locations.is_active,
        createdBy: it.archive_locations.created_by,
        createdAt: it.archive_locations.created_at,
        updatedAt: it.archive_locations.updated_at,
      } : undefined,
      expectedPlacements: placementsByLocation.get(it.location_id) ?? [],
    }));
  },

  async confirmItem(itemId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('archive_reconciliation_items')
      .update({ result: 'confirmed', reviewed_by: userId, reviewed_at: new Date().toISOString(), discrepancy_notes: null })
      .eq('id', itemId);
    if (error) throw error;
  },

  /** Flags a slot as a discrepancy — any collateral confirmed missing has its custody status set accordingly. */
  async reportDiscrepancy(itemId: string, userId: string, missingCollateralIds: string[], notes: string): Promise<void> {
    const { data: item, error: fetchErr } = await supabase
      .from('archive_reconciliation_items')
      .select('location_id')
      .eq('id', itemId)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from('archive_reconciliation_items')
      .update({ result: 'discrepancy', reviewed_by: userId, reviewed_at: new Date().toISOString(), discrepancy_notes: notes })
      .eq('id', itemId);
    if (error) throw error;

    for (const collateralId of missingCollateralIds) {
      await supabase
        .from('archive_custody')
        .upsert({ collateral_id: collateralId, current_status: 'missing' }, { onConflict: 'collateral_id' });
      await archiveAuditService.log({
        eventType: 'reconciliation_discrepancy',
        collateralId,
        locationId: item.location_id,
        performedBy: userId,
        reason: notes || undefined,
        description: 'Not found during vault reconciliation — marked missing',
      });
    }
    if (missingCollateralIds.length === 0) {
      // Discrepancy reported without naming a specific missing collateral (e.g. unexpected item found).
      await archiveAuditService.log({
        eventType: 'reconciliation_discrepancy',
        locationId: item.location_id,
        performedBy: userId,
        reason: notes || undefined,
        description: 'Discrepancy found during vault reconciliation',
      });
    }
  },

  /** Only allowed once every item in the session has been reviewed. */
  async completeSession(sessionId: string, userId: string): Promise<void> {
    const { data: items, error: itemsErr } = await supabase
      .from('archive_reconciliation_items')
      .select('result')
      .eq('session_id', sessionId);
    if (itemsErr) throw itemsErr;
    if ((items || []).some((it) => it.result === 'pending')) {
      throw new Error('Every slot must be reviewed before completing the session.');
    }

    const { data: session, error } = await supabase
      .from('archive_reconciliation_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select('location_id')
      .single();
    if (error) throw error;

    await archiveAuditService.log({
      eventType: 'reconciliation_completed',
      locationId: session.location_id,
      performedBy: userId,
      description: 'Vault reconciliation completed',
    });
  },

  async cancelSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('archive_reconciliation_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId);
    if (error) throw error;
  },

  /** Most recent completed session for a given location, for a "last reconciled" note. */
  async getLastCompletedForLocation(locationId: string): Promise<ReconciliationSession | null> {
    const { data, error } = await supabase
      .from('archive_reconciliation_sessions')
      .select(`
        *,
        archive_locations(name, code, location_type),
        started_by_profile:user_profiles!started_by(full_name)
      `)
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return mapSession(data, 0, 0);
  },
};
