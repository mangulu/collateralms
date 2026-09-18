-- ============================================================
-- Real automation for Scheduled Report Delivery
-- Scheduled Report Delivery's own copy claims reports are
-- auto-generated and emailed on the configured schedule, but
-- nothing anywhere ever actually triggered a send except the
-- manual "Send Now" button. This wires up a genuine daily
-- pg_cron job that calls the new /api/cron/send-scheduled-reports
-- route, which checks every enabled config's schedule_cron
-- against today's date and sends whichever are actually due.
--
-- If CREATE EXTENSION below fails with a permissions error, enable
-- pg_cron and pg_net first via the Supabase dashboard:
-- Database -> Extensions -> search "pg_cron" / "pg_net" -> Enable.
-- Then re-run just the `select cron.schedule(...)` statement.
--
-- IMPORTANT: replace 'REPLACE_WITH_CRON_SECRET' below with the
-- exact value you set for the CRON_SECRET environment variable
-- in your deployment (Bearer token this job sends on every call).
-- Never commit the real secret value to source control -- edit it
-- directly on the database (e.g. via the SQL editor) instead of in
-- this file if this repo is public.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Runs daily at 05:00 UTC (08:00 EAT) -- the hour every seeded
-- report schedule uses. The route itself decides which configs are
-- actually due today by matching each one's own schedule_cron.
select cron.unschedule('send-scheduled-reports-daily')
where exists (select 1 from cron.job where jobname = 'send-scheduled-reports-daily');

select cron.schedule(
  'send-scheduled-reports-daily',
  '0 5 * * *',
  $$
  select net.http_post(
    url := 'https://collateral8511.builtwithrocket.new/api/cron/send-scheduled-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACE_WITH_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
