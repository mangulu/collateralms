-- ============================================================
-- CollateralMS — Audit Log Enhancements Migration
-- Adds field_changes (JSONB) and entity_type columns to audit_logs
-- for field-level change history and compliance documentation
-- ============================================================

-- 1. ADD COLUMNS TO audit_logs

ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'collateral';

ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS field_changes JSONB DEFAULT NULL;

-- entity_type: 'collateral' | 'perfection_request' | 'user' | 'document' | 'system'
-- field_changes: [{ field, label, old_value, new_value }]

-- 2. INDEXES

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- 3. MOCK DATA — enrich existing audit_logs with field_changes

DO $$
DECLARE
  log_id UUID;
BEGIN
  -- Enrich a few existing audit log rows with sample field_changes
  FOR log_id IN
    SELECT id FROM public.audit_logs WHERE field_changes IS NULL LIMIT 10
  LOOP
    UPDATE public.audit_logs
    SET
      entity_type = CASE action::TEXT
        WHEN 'created'   THEN 'collateral'
        WHEN 'updated'   THEN 'collateral'
        WHEN 'perfected' THEN 'collateral'
        WHEN 'overdue'   THEN 'collateral'
        WHEN 'submitted' THEN 'perfection_request'
        WHEN 'reviewed'  THEN 'perfection_request'
        WHEN 'approved'  THEN 'perfection_request'
        WHEN 'rejected'  THEN 'perfection_request'
        WHEN 'returned'  THEN 'perfection_request'
        ELSE 'collateral'
      END,
      field_changes = CASE action::TEXT
        WHEN 'created' THEN
          jsonb_build_array(
            jsonb_build_object('field','status','label','Status','old_value','','new_value','Draft'),
            jsonb_build_object('field','assigned_officer','label','Assigned Officer','old_value','','new_value','J. Kamau')
          )
        WHEN 'updated' THEN
          jsonb_build_array(
            jsonb_build_object('field','value_tsh','label','Value (TSh)','old_value','500,000,000','new_value','650,000,000'),
            jsonb_build_object('field','perfection_deadline','label','Perfection Deadline','old_value','01 May 2026','new_value','15 May 2026')
          )
        WHEN 'perfected' THEN
          jsonb_build_array(
            jsonb_build_object('field','status','label','Status','old_value','Under Review','new_value','Perfected'),
            jsonb_build_object('field','registration_date','label','Registration Date','old_value','','new_value','25 Apr 2026')
          )
        WHEN 'overdue' THEN
          jsonb_build_array(
            jsonb_build_object('field','status','label','Status','old_value','Submitted','new_value','Overdue'),
            jsonb_build_object('field','days_to_deadline','label','Days to Deadline','old_value','0','new_value','-12')
          )
        WHEN 'submitted' THEN
          jsonb_build_array(
            jsonb_build_object('field','request_status','label','Request Status','old_value','Draft','new_value','Submitted'),
            jsonb_build_object('field','submitted_at','label','Submitted At','old_value','','new_value',to_char(now(),'DD Mon YYYY HH24:MI'))
          )
        WHEN 'approved' THEN
          jsonb_build_array(
            jsonb_build_object('field','request_status','label','Request Status','old_value','Under Review','new_value','Approved'),
            jsonb_build_object('field','reviewed_by_name','label','Reviewed By','old_value','','new_value','A. Mwangi')
          )
        WHEN 'rejected' THEN
          jsonb_build_array(
            jsonb_build_object('field','request_status','label','Request Status','old_value','Under Review','new_value','Rejected'),
            jsonb_build_object('field','decision_notes','label','Decision Notes','old_value','','new_value','Documentation incomplete')
          )
        ELSE NULL
      END
    WHERE id = log_id;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Audit log enrichment skipped: %', SQLERRM;
END $$;
