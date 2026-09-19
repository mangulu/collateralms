-- The trg_document_approval_to_task trigger (20260828080000) never set
-- instance_id on the user_tasks row it auto-creates for a newly uploaded
-- document. documentApprovalService.approveDocument()/rejectDocument()
-- mark that task complete by matching `instance_id = documentId`, so the
-- auto-created task (instance_id NULL) could never be found and stayed
-- stuck "pending" forever, even after the document was approved/rejected.
--
-- Fix: set instance_id = NEW.id (the collateral_documents row's own id),
-- which is exactly the `documentId` the JS layer already matches on.

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
    instance_id,
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
    NEW.id,
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
