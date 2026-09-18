-- ============================================================
-- Real automation for Scheduled Batch Release Jobs
-- Schedules an hourly pg_cron job that calls
-- /api/cron/run-scheduled-release-jobs. The route itself checks
-- every ACTIVE job's own run_time (interpreted as UTC -- there's no
-- timezone field on the job) and, for weekly jobs, day_of_week, and
-- only actually processes jobs due in the current hour, guarding
-- against a double-run via last_run_at.
--
-- Requires the same pg_cron/pg_net extensions and CRON_SECRET as
-- 20260918080000_scheduled_report_cron.sql -- if that migration's
-- cron job is already scheduled, the extensions are already enabled.
--
-- IMPORTANT: replace 'REPLACE_WITH_CRON_SECRET' below with the exact
-- CRON_SECRET value configured in your deployment before running
-- this against the live database -- don't commit the real value.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('run-scheduled-release-jobs-hourly')
where exists (select 1 from cron.job where jobname = 'run-scheduled-release-jobs-hourly');

select cron.schedule(
  'run-scheduled-release-jobs-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://collateral8511.builtwithrocket.new/api/cron/run-scheduled-release-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
