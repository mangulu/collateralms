-- Brand Kit Configuration
-- Adds brand_kit entry to system_config for white-label theming

DO $$
BEGIN
  INSERT INTO public.system_config (config_key, config_value, category, label, description)
  VALUES (
    'brand_kit',
    jsonb_build_object(
      'bank_name', 'EXIM Bank Tanzania',
      'logo_url', '',
      'primary_color', '#2563EB',
      'accent_color', '#22C55E',
      'tagline', 'Collateral Lifecycle Management Platform'
    ),
    'brand',
    'Brand Kit',
    'White-label branding configuration: bank name, logo, and color scheme applied globally via CSS variables'
  ) ON CONFLICT (config_key) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Brand kit seed failed: %', SQLERRM;
END $$;
