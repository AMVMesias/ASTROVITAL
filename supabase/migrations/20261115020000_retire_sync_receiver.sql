-- Retire the original one-way synchronization receiver, now replaced by app.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.synced_measurements LIMIT 1) THEN
    RAISE EXCEPTION 'Legacy measurements must be migrated before retiring the sync schema';
  END IF;
END $$;
DROP TABLE public.synced_measurements;
DROP TABLE public.sync_environment_profiles;
DROP TABLE public.sync_catalog_revisions;
