-- The "grid" schema has been empty since grid_details / grid_columns moved to
-- "fixed" (20260318132503). 20260216125254 still creates it, so a fresh replay
-- would bring it back; drop it here. RESTRICT (the default) refuses if
-- anything was ever put back inside it.
DROP SCHEMA IF EXISTS "grid";
