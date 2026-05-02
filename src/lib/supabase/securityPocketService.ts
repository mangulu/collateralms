'use client';

import { createClient } from '@/lib/supabase/client';

export type PocketStatus = 'active' | 'inactive' | 'archived';
export type CheckoutStatus = 'checked_out' | 'returned' | 'overdue';

export interface SecurityPocket {
  id: string;
  collateralRecordId: string;
  collateralId: string;
  pocketName: string;
  building: string;
  floor: string;
  room: string;
  cabinet: string;
  drawer: string;
  slot: string;
  locationNotes: string;
  custodianId: string | null;
  custodianName: string;
  custodianAssignedAt: string | null;
  pocketStatus: PocketStatus;
  hasDiscrepancy: boolean;
  discrepancyNotes: string;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PocketCheckoutLog {
  id: string;
  pocketId: string;
  collateralRecordId: string;
  checkedOutById: string | null;
  checkedOutByName: string;
  checkedOutAt: string;
  purpose: string;
  expectedReturnDate: string | null;
  returnedById: string | null;
  returnedByName: string;
  returnedAt: string | null;
  returnNotes: string;
  checkoutStatus: CheckoutStatus;
  createdAt: string;
}

function rowToPocket(row: any): SecurityPocket {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id,
    collateralId: row.collateral_id,
    pocketName: row.pocket_name,
    building: row.building ?? '',
    floor: row.floor ?? '',
    room: row.room ?? '',
    cabinet: row.cabinet ?? '',
    drawer: row.drawer ?? '',
    slot: row.slot ?? '',
    locationNotes: row.location_notes ?? '',
    custodianId: row.custodian_id ?? null,
    custodianName: row.custodian_name ?? '',
    custodianAssignedAt: row.custodian_assigned_at ?? null,
    pocketStatus: row.pocket_status as PocketStatus,
    hasDiscrepancy: row.has_discrepancy ?? false,
    discrepancyNotes: row.discrepancy_notes ?? '',
    createdBy: row.created_by ?? null,
    createdByName: row.created_by_name ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToLog(row: any): PocketCheckoutLog {
  return {
    id: row.id,
    pocketId: row.pocket_id,
    collateralRecordId: row.collateral_record_id,
    checkedOutById: row.checked_out_by ?? null,
    checkedOutByName: row.checked_out_by_name ?? '',
    checkedOutAt: row.checked_out_at,
    purpose: row.purpose ?? '',
    expectedReturnDate: row.expected_return_date ?? null,
    returnedById: row.returned_by ?? null,
    returnedByName: row.returned_by_name ?? '',
    returnedAt: row.returned_at ?? null,
    returnNotes: row.return_notes ?? '',
    checkoutStatus: row.checkout_status as CheckoutStatus,
    createdAt: row.created_at,
  };
}

export const securityPocketService = {
  async getByCollateralId(collateralRecordId: string): Promise<SecurityPocket | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('security_pockets')
        .select('*')
        .eq('collateral_record_id', collateralRecordId)
        .maybeSingle();
      if (error) { console.error('Fetch pocket error:', error.message); return null; }
      return data ? rowToPocket(data) : null;
    } catch (err: any) {
      console.error('Pocket fetch failed:', err.message);
      return null;
    }
  },

  async getAll(): Promise<SecurityPocket[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('security_pockets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error('Fetch all pockets error:', error.message); return []; }
      return (data ?? []).map(rowToPocket);
    } catch (err: any) {
      console.error('Pockets fetch failed:', err.message);
      return [];
    }
  },

  async upsert(
    collateralRecordId: string,
    collateralId: string,
    fields: {
      pocketName: string;
      building: string;
      floor: string;
      room: string;
      cabinet: string;
      drawer: string;
      slot: string;
      locationNotes: string;
      custodianId: string | null;
      custodianName: string;
      hasDiscrepancy: boolean;
      discrepancyNotes: string;
    },
    userId: string,
    userName: string,
    existingId?: string
  ): Promise<SecurityPocket | null> {
    const supabase = createClient();
    try {
      const payload: any = {
        collateral_record_id: collateralRecordId,
        collateral_id: collateralId,
        pocket_name: fields.pocketName,
        building: fields.building,
        floor: fields.floor,
        room: fields.room,
        cabinet: fields.cabinet,
        drawer: fields.drawer,
        slot: fields.slot,
        location_notes: fields.locationNotes,
        custodian_id: fields.custodianId || null,
        custodian_name: fields.custodianName,
        custodian_assigned_at: fields.custodianId ? new Date().toISOString() : null,
        has_discrepancy: fields.hasDiscrepancy,
        discrepancy_notes: fields.discrepancyNotes,
        created_by: userId,
        created_by_name: userName,
      };

      if (existingId) {
        const { data, error } = await supabase
          .from('security_pockets')
          .update(payload)
          .eq('id', existingId)
          .select()
          .single();
        if (error) { console.error('Update pocket error:', error.message); return null; }
        return data ? rowToPocket(data) : null;
      } else {
        const { data, error } = await supabase
          .from('security_pockets')
          .insert(payload)
          .select()
          .single();
        if (error) { console.error('Insert pocket error:', error.message); return null; }
        return data ? rowToPocket(data) : null;
      }
    } catch (err: any) {
      console.error('Pocket upsert failed:', err.message);
      return null;
    }
  },

  async getCheckoutLog(pocketId: string): Promise<PocketCheckoutLog[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('pocket_checkout_log')
        .select('*')
        .eq('pocket_id', pocketId)
        .order('checked_out_at', { ascending: false });
      if (error) { console.error('Fetch checkout log error:', error.message); return []; }
      return (data ?? []).map(rowToLog);
    } catch (err: any) {
      console.error('Checkout log fetch failed:', err.message);
      return [];
    }
  },

  async checkOut(
    pocketId: string,
    collateralRecordId: string,
    userId: string,
    userName: string,
    purpose: string,
    expectedReturnDate: string | null
  ): Promise<PocketCheckoutLog | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('pocket_checkout_log')
        .insert({
          pocket_id: pocketId,
          collateral_record_id: collateralRecordId,
          checked_out_by: userId,
          checked_out_by_name: userName,
          checked_out_at: new Date().toISOString(),
          purpose,
          expected_return_date: expectedReturnDate || null,
          checkout_status: 'checked_out',
        })
        .select()
        .single();
      if (error) { console.error('Check-out error:', error.message); return null; }
      return data ? rowToLog(data) : null;
    } catch (err: any) {
      console.error('Check-out failed:', err.message);
      return null;
    }
  },

  async checkIn(
    logId: string,
    userId: string,
    userName: string,
    returnNotes: string
  ): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('pocket_checkout_log')
        .update({
          returned_by: userId,
          returned_by_name: userName,
          returned_at: new Date().toISOString(),
          return_notes: returnNotes,
          checkout_status: 'returned',
        })
        .eq('id', logId);
      if (error) { console.error('Check-in error:', error.message); return false; }
      return true;
    } catch (err: any) {
      console.error('Check-in failed:', err.message);
      return false;
    }
  },

  formatLocation(pocket: SecurityPocket): string {
    const parts = [
      pocket.building && `Building: ${pocket.building}`,
      pocket.floor && `Floor ${pocket.floor}`,
      pocket.room && `Room ${pocket.room}`,
      pocket.cabinet && `Cabinet ${pocket.cabinet}`,
      pocket.drawer && `Drawer ${pocket.drawer}`,
      pocket.slot && `Slot ${pocket.slot}`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' › ') : 'No location set';
  },
};
