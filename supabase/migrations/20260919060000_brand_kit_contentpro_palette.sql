-- Brand Kit: Contentpro palette as the new default theme
-- Extends brand_kit with secondary/neutral/warning/highlight/danger colors
-- (previously only primary/accent existed) and sets the agreed default
-- palette: brand red primary, dark navy secondary, dark grey neutral,
-- green accent, orange warning, pink highlight, and a muted crimson danger
-- kept distinct from primary red so status/error states never read as
-- the brand color itself.

UPDATE public.system_config
SET config_value = config_value || jsonb_build_object(
  'primary_color', '#EC1E27',
  'secondary_color', '#12213C',
  'neutral_color', '#4B4B4E',
  'accent_color', '#15803D',
  'warning_color', '#B45309',
  'highlight_color', '#DB2777',
  'danger_color', '#B91C1C'
),
    description = 'Brand colors applied globally via CSS variables: primary (actions/links), secondary (sidebar/institutional chrome), neutral (text/borders), accent (success), warning, highlight (sparing accent), and danger (kept distinct from primary so it never reads as the brand color).'
WHERE config_key = 'brand_kit';
