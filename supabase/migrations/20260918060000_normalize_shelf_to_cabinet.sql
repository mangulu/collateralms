-- The Cabinet/Shelf location-type collapse (see archiveService.ts LocationType)
-- dropped 'shelf' from every color/icon/label map in the app, on the assumption
-- that no location row actually used it. The original archive_module seed data
-- did create two 'shelf' rows, so any slot nested under one crashes location-type
-- lookups (e.g. LOCATION_TYPE_COLORS[loc.locationType] is undefined) when its
-- breadcrumb is rendered. Normalize existing data to match the app's model,
-- where Cabinet and Shelf are the same concept.
UPDATE public.archive_locations
SET location_type = 'cabinet'
WHERE location_type = 'shelf';
