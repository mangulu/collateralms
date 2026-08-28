-- ─── Approval Workflow → user_tasks Integration ──────────────────────────────
-- Creates DB-level trigger functions that insert user_tasks rows whenever a new
-- approval item is created (Document Approval, Substitution, Release Request,
-- Registry Submission).  This ensures approvers see all pending decisions in
-- the unified Staff Workspace task view even when records are created outside
-- the application layer.

-- ─── Helper: resolve approver UUID by role ───────────────────────────────────
-- Returns the first active user matching the given role, or NULL if none found.
CREATE OR REPLACE FUNCTION public.resolve_approver_by_role(p_role TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id
  FROM public.user_profiles
  WHERE role::TEXT = p_role
    AND is_active = true
  ORDER BY created_at
  LIMIT 1;
$$;

-- ─── 1. Document Approval trigger ────────────────────────────────────────────
-- Fires when a collateral_document is inserted with approval_status = 'pending'
-- or updated to 'pending'/'under_review'.  Assigns a task to the legal_officer.

CREATE OR REPLACE FUNCTION public.trg_document_approval_to_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_approver_id UUID;
  v_collateral_id TEXT;
  v_doc_type TEXT;
BEGIN
  -- Only act on pending or under_review status
  IF NEW.approval_status NOT IN ('pending', 'under_review') THEN
    RETURN NEW;
  END IF;

  -- Skip if a task already exists for this document
  IF EXISTS (
    SELECT 1 FROM public.user_tasks
    WHERE workflow_name = 'Document Approval'
      AND task_name = 'Document Review'
      AND deep_link LIKE '%/document-approval%'
      AND collateral_id = COALESCE(NEW.collateral_id, '')
      AND task_status IN ('pending', 'in_progress')
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  v_approver_id := public.resolve_approver_by_role('legal_officer');
  IF v_approver_id IS NULL THEN
    v_approver_id := public.resolve_approver_by_role('system_admin');
  END IF;
  IF v_approver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_collateral_id := COALESCE(NEW.collateral_id, '');
  v_doc_type := COALESCE(NEW.document_type, 'Document');

  INSERT INTO public.user_tasks (
    assigned_to,
    collateral_record_id,
    collateral_id,
    task_type,
    title,
    description,
    action_url,
    action_label,
    priority,
    task_status,
    workflow_name,
    task_name,
    assigned_date,
    deep_link
  ) VALUES (
    v_approver_id,
    NEW.collateral_record_id,
    v_collateral_id,
    'approval',
    'Document approval required — ' || v_doc_type || CASE WHEN v_collateral_id <> '' THEN ' for ' || v_collateral_id ELSE '' END,
    'A document of type "' || v_doc_type || '" has been submitted and requires your approval.',
    '/document-approval',
    'Review Document',
    'normal',
    'pending',
    'Document Approval',
    'Document Review',
    NOW(),
    '/document-approval'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Non-blocking: never fail the parent transaction
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_doc_approval_task ON public.collateral_documents;
CREATE TRIGGER trg_doc_approval_task
AFTER INSERT ON public.collateral_documents
FOR EACH ROW
EXECUTE FUNCTION public.trg_document_approval_to_task();

-- ─── 2. Collateral Substitution trigger ──────────────────────────────────────
-- Fires when a new substitution is inserted with status 'Pending'.

CREATE OR REPLACE FUNCTION public.trg_substitution_to_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_approver_id UUID;
BEGIN
  IF NEW.substitution_status <> 'Pending' THEN
    RETURN NEW;
  END IF;

  v_approver_id := public.resolve_approver_by_role('credit_officer');
  IF v_approver_id IS NULL THEN
    v_approver_id := public.resolve_approver_by_role('system_admin');
  END IF;
  IF v_approver_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_tasks (
    assigned_to,
    collateral_id,
    task_type,
    title,
    description,
    action_url,
    action_label,
    priority,
    task_status,
    workflow_name,
    task_name,
    instance_id,
    assigned_date,
    deep_link
  ) VALUES (
    v_approver_id,
    COALESCE(NEW.facility_id, ''),
    'approval',
    'Substitution request review for facility ' || COALESCE(NEW.facility_id, NEW.id::TEXT),
    'A collateral substitution request has been submitted and requires your review.',
    '/collateral-substitution',
    'Review Substitution',
    'normal',
    'pending',
    'Collateral Substitution',
    'Substitution Review',
    NEW.id,
    '/collateral-substitution'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_substitution_task ON public.collateral_substitutions;
CREATE TRIGGER trg_substitution_task
AFTER INSERT ON public.collateral_substitutions
FOR EACH ROW
EXECUTE FUNCTION public.trg_substitution_to_task();

-- ─── 3. Release Request trigger ───────────────────────────────────────────────
-- Fires when a new release_request is inserted with status 'Pending'.

CREATE OR REPLACE FUNCTION public.trg_release_request_to_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_approver_id UUID;
  v_priority    TEXT;
BEGIN
  IF NEW.request_status <> 'Pending' THEN
    RETURN NEW;
  END IF;

  v_approver_id := public.resolve_approver_by_role('credit_officer');
  IF v_approver_id IS NULL THEN
    v_approver_id := public.resolve_approver_by_role('system_admin');
  END IF;
  IF v_approver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_priority := CASE
    WHEN NEW.priority = 'High' THEN 'high'
    WHEN NEW.priority = 'Low'  THEN 'low'
    ELSE 'normal'
  END;

  INSERT INTO public.user_tasks (
    assigned_to,
    collateral_id,
    task_type,
    title,
    description,
    action_url,
    action_label,
    priority,
    task_status,
    workflow_name,
    task_name,
    instance_id,
    assigned_date,
    deep_link
  ) VALUES (
    v_approver_id,
    COALESCE(NEW.collateral_ref, ''),
    'approval',
    'Release approval required for ' || COALESCE(NEW.collateral_ref, 'collateral') || CASE WHEN NEW.client_name IS NOT NULL THEN ' — ' || NEW.client_name ELSE '' END,
    'A release request has been submitted for ' || COALESCE(NEW.collateral_ref, 'collateral') || ' and requires your approval.',
    '/release-approval',
    'Review Release',
    v_priority::public.task_priority,
    'pending',
    'Release Approval',
    'Release Review',
    NEW.id,
    '/release-approval'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_release_request_task ON public.release_requests;
CREATE TRIGGER trg_release_request_task
AFTER INSERT ON public.release_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_release_request_to_task();

-- ─── 4. Registry Submission trigger ──────────────────────────────────────────
-- Fires when a new registry_submission_tracker row is inserted with status 'Pending'.

CREATE OR REPLACE FUNCTION public.trg_registry_submission_to_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_approver_id UUID;
BEGIN
  IF NEW.submission_status <> 'Pending' THEN
    RETURN NEW;
  END IF;

  v_approver_id := public.resolve_approver_by_role('legal_officer');
  IF v_approver_id IS NULL THEN
    v_approver_id := public.resolve_approver_by_role('system_admin');
  END IF;
  IF v_approver_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_tasks (
    assigned_to,
    collateral_record_id,
    collateral_id,
    task_type,
    title,
    description,
    action_url,
    action_label,
    priority,
    task_status,
    workflow_name,
    task_name,
    instance_id,
    assigned_date,
    deep_link
  ) VALUES (
    v_approver_id,
    NEW.collateral_record_id,
    '',
    'approval',
    'Registry submission required — ' || COALESCE(NEW.registry_name, 'Registry'),
    'A new registry submission to ' || COALESCE(NEW.registry_name, 'the registry') || ' has been created and requires processing.',
    '/workflows/registry-submissions',
    'Process Submission',
    'normal',
    'pending',
    'Registry Submission',
    'Registry Filing',
    NEW.id,
    '/workflows/registry-submissions'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_registry_submission_task ON public.registry_submission_tracker;
CREATE TRIGGER trg_registry_submission_task
AFTER INSERT ON public.registry_submission_tracker
FOR EACH ROW
EXECUTE FUNCTION public.trg_registry_submission_to_task();

-- ─── 5. Auto-complete tasks when approvals are resolved ──────────────────────
-- When a release_request or substitution is approved/rejected, mark the
-- corresponding pending user_task as completed so the approver's queue is clean.

CREATE OR REPLACE FUNCTION public.trg_release_request_task_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  IF NEW.request_status IN ('Approved', 'Rejected') AND OLD.request_status NOT IN ('Approved', 'Rejected') THEN
    UPDATE public.user_tasks
    SET task_status = 'completed',
        completed_at = NOW(),
        date_attended = NOW()
    WHERE instance_id = NEW.id
      AND workflow_name = 'Release Approval'
      AND task_status IN ('pending', 'in_progress');
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_release_task_complete ON public.release_requests;
CREATE TRIGGER trg_release_task_complete
AFTER UPDATE ON public.release_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_release_request_task_complete();

CREATE OR REPLACE FUNCTION public.trg_substitution_task_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  IF NEW.substitution_status IN ('Approved', 'Rejected') AND OLD.substitution_status NOT IN ('Approved', 'Rejected') THEN
    UPDATE public.user_tasks
    SET task_status = 'completed',
        completed_at = NOW(),
        date_attended = NOW()
    WHERE instance_id = NEW.id
      AND workflow_name = 'Collateral Substitution'
      AND task_status IN ('pending', 'in_progress');
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_substitution_task_complete ON public.collateral_substitutions;
CREATE TRIGGER trg_substitution_task_complete
AFTER UPDATE ON public.collateral_substitutions
FOR EACH ROW
EXECUTE FUNCTION public.trg_substitution_task_complete();

CREATE OR REPLACE FUNCTION public.trg_registry_submission_task_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  IF NEW.submission_status IN ('Registered', 'Rejected') AND OLD.submission_status NOT IN ('Registered', 'Rejected') THEN
    UPDATE public.user_tasks
    SET task_status = 'completed',
        completed_at = NOW(),
        date_attended = NOW()
    WHERE instance_id = NEW.id
      AND workflow_name = 'Registry Submission'
      AND task_status IN ('pending', 'in_progress');
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_registry_submission_task_complete ON public.registry_submission_tracker;
CREATE TRIGGER trg_registry_submission_task_complete
AFTER UPDATE ON public.registry_submission_tracker
FOR EACH ROW
EXECUTE FUNCTION public.trg_registry_submission_task_complete();
