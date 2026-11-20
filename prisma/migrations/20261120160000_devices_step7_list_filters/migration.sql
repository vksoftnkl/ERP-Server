-- Review step 7 (Devices, menu 239), 2026-11-20 — grid 31 honours the list's filters.
--
-- The Devices list sends grid params `status` ("Active Devices" / "Inactive Devices",
-- nothing for All) and `idev_type` ("PC" / "Mobile" / "Web", nothing for All). The
-- grid run binds each sent key in place of its quoted token; a key NOT sent leaves
-- the token as a plain string literal, which the CASE reads as "no filter".
-- PC and Desktop are one type (the Qt app logs in as "PC", the device form saves
-- "Desktop"); matching is case-insensitive (live data also holds "web").
-- No comment markers inside the grid SQL (the grid validator refuses them).
-- Idempotent: only rewrites grid 31 while it still lacks the idev_type token.

UPDATE fixed.grid_details
   SET grid_sql = $sql$SELECT
       d.dev_id,
       d.dev_device_name,
       d.dev_code,
       d.dev_device_type,
       d.dev_platform,
       c.comp_name                      AS dev_company_name,
       b.br_name                        AS dev_branch_name,
       u.usr_display_name               AS dev_user_name,
       d.dev_mac_address,
       d.dev_last_ip,
       d.dev_last_login,
       d.dev_is_active,
       d.dev_is_blocked,
       d.dev_block_reason,
       d.dev_company_id,
       d.dev_branch_id
  FROM fixed.device_master d
LEFT JOIN public.companys      c ON c.comp_id = d.dev_company_id
LEFT JOIN public.branch_master b ON b.br_id   = d.dev_branch_id
LEFT JOIN public.user_master   u ON u.usr_id  = d.dev_user_id
WHERE COALESCE(d.dev_is_deleted, false) = false
  AND (CASE ('status')::text
         WHEN 'Active Devices'   THEN COALESCE(d.dev_is_active, false)
         WHEN 'Inactive Devices' THEN NOT COALESCE(d.dev_is_active, false)
         ELSE true END)
  AND (CASE upper(('idev_type')::text)
         WHEN 'PC'     THEN upper(COALESCE(d.dev_device_type, '')) IN ('PC', 'DESKTOP')
         WHEN 'MOBILE' THEN upper(COALESCE(d.dev_device_type, '')) = 'MOBILE'
         WHEN 'WEB'    THEN upper(COALESCE(d.dev_device_type, '')) = 'WEB'
         ELSE true END)
ORDER BY c.comp_name NULLS FIRST, b.br_name NULLS FIRST, d.dev_device_name$sql$,
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_id = 31
   AND grid_sql ILIKE '%fixed.device_master%'
   AND grid_sql NOT LIKE '%idev_type%';
