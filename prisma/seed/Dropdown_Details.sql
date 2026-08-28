-- Seed: fixed.dropdown_details -- the configured lookup popups and their SQL (46 rows).
--
-- dropdown_sql is user-configurable SQL run through the read-only pool, same contract
-- as grid_sql; dollar-quoted below so quotes and newlines survive verbatim.
-- dropdown_sql_regional is the localized variant where one exists.
--
-- Ids are explicit: fixed.dropdown_columns references dropdown_id and screens request
-- a dropdown by id. The setval at the bottom keeps the sequence ahead of them.
--
-- Idempotent: ON CONFLICT (dropdown_id) DO NOTHING.
-- Regenerate with: npm run seed:export:ui-config
-- Run: psql "$DATABASE_URL" -f prisma/seed/Dropdown_Details.sql
--      or: npm run seed:run -- --only=Dropdown_Details.sql

BEGIN;

INSERT INTO fixed.dropdown_details
    (dropdown_id, dropdown_name, dropdown_description, dropdown_sort_column, dropdown_sort_order, dropdown_max_visible_items, dropdown_show_header, dropdown_width, dropdown_device_type, dropdown_completion, dropdown_created_by, dropdown_sql, dropdown_sql_regional)
VALUES
     (2::integer, 'state dropdown'::varchar, 'state dropdown'::text, 'state id'::varchar, 'ASC'::varchar, 2::integer, true::boolean, 20::integer, NULL::text, NULL::text, 'system'::text, $seed$SELECT stm_id, stm_name FROM sales.state_master$seed$::text, $seed$SELECT stm_id, stm_name, 
	FROM sales.state_master;$seed$::text)
    ,(3 , 'customerGroups'          , 'customer group', 'cgr_name'            , 'ASC', 2 , true , 20  , NULL     , NULL                , 'system', $seed$SELECT cgr_id, cgr_name, cgr_alias FROM sales.cust_groups WHERE cgr_is_deleted = false AND cgr_is_active = true$seed$, $seed$SELECT cgr_id, cgr_name, cgr_alias FROM sales.cust_groups WHERE cgr_is_deleted = false AND cgr_is_active = true$seed$)
    ,(4 , 'city master'             , 'city master', 'City id'             , 'ASC', 2 , true , 20  , NULL     , 'city master'       , 'system', $seed$SELECT ctm_id, ctm_name, ctm_alias FROM sales.city_master$seed$, $seed$SELECT ctm_id, ctm_name, ctm_alias,FROM sales.city_master;$seed$)
    ,(5 , 'branch'                  , 'branch master', 'Branch id'           , 'ASC', 2 , false, 10  , NULL     , NULL                , 'system', $seed$SELECT br_id, br_name FROM public.branch_master WHERE br_is_deleted = false$seed$, $seed$SELECT br_id, br_name,
	FROM accounts.branch_master;$seed$)
    ,(6 , 'items'                   , 'items', 'Item id'             , 'ASC', 2 , true , 10  , NULL     , 'items'             , 'system', $seed$SELECT item_id, item_branch_id, item_code, item_sku, item_name_en, item_name_ta, item_alias FROM inventory.item_master$seed$, $seed$SELECT item_id, item_branch_id, item_code, item_sku, item_name_en, item_name_ta, item_alias, 
	FROM inventory.item_master;$seed$)
    ,(7 , 'companyGroups'           , 'Master lookup for active company groups', 'cog_group_name'      , 'ASC', 20, true , NULL, NULL     , NULL                , 'system', $seed$SELECT cog_group_id, cog_group_name FROM public.company_group_master WHERE cog_is_deleted = false AND cog_is_active = true$seed$, NULL)
    ,(8 , 'company'                 , 'company master', 'company id'          , 'ASC', 10, true , 20  , NULL     , NULL                , 'system', $seed$SELECT comp_name, comp_id FROM public.companys$seed$, $seed$SELECT  comp_name,comp_id, 
	FROM accounts.companys;$seed$)
    ,(9 , 'state code'              , 'state code', 'state name'          , 'ASC', 11, true , 20  , NULL     , NULL                , 'system', $seed$SELECT state_code, state_name FROM fixed.state_codes$seed$, $seed$SELECT state_code, state_name, 
	FROM fixed.state_codes;$seed$)
    ,(10, 'Area'                    , 'area master', 'Area short'          , 'ASC', 10, true , 32  , NULL     , NULL                , 'system', $seed$SELECT arm_id, arm_name, arm_alias, arm_short
	FROM sales.area_master;$seed$, $seed$SELECT arm_id, arm_name, arm_alias, arm_short
	FROM sales.area_master;$seed$)
    ,(11, 'suppliergroups'          , 'supplier groups', 'supplier group short', 'ASC', 10, true , 20  , NULL     , 'logic'             , 'system', $seed$SELECT spg_id, spg_name, spg_alias, spg_short FROM purchase.supplier_groups$seed$, $seed$SELECT "spgId", "spgName", "spgAlias", "spgShort", 
	FROM purchase.supplier_groups;$seed$)
    ,(13, 'AREA LIST'               , NULL, 'arm_id'              , 'asc', 10, false, 0   , 'Desktop', 'arm_name'          , 'system', $seed$SELECT
	arm_id,
	arm_name,
	arm_short
FROM sales.area_master
WHERE arm_is_deleted = false AND arm_is_active = true
ORDER BY arm_name;$seed$, NULL)
    ,(14, 'GST UNIT CODES'          , NULL, 'item_gst_unit_code'  , 'asc', 10, false, 0   , 'Desktop', 'item_gst_unit_name', 'system', $seed$SELECT
	item_gst_unit_code,
	item_gst_unit_name
FROM
	inventory.item_gst_units
ORDER BY
	item_gst_unit_id;$seed$, NULL)
    ,(15, 'ITEM UNITS'              , NULL, NULL                  , 'asc', 10, false, 0   , 'Desktop', NULL                , 'system', $seed$SELECT
	unit_id,
	unit_name
FROM
	inventory.item_unit_master
WHERE
	unit_is_active = true AND unit_is_deleted = false
ORDER BY
	unit_name;$seed$, NULL)
    ,(16, 'MENUS'                   , NULL, 'menu_id'             , 'asc', 10, false, 0   , 'Desktop', 'menu_name'         , 'system', $seed$SELECT
	menu_id,
	menu_name
FROM
	fixed.menu_master
ORDER BY
	menu_name;$seed$, NULL)
    ,(17, 'ITEM GROUPS'             , NULL, 'itg_name'            , 'asc', 10, false, 0   , 'Desktop', 'itg_name'          , 'system', $seed$SELECT
	itg_id,
	itg_name,
	itg_short
FROM inventory.item_group_master
WHERE itg_is_active = true AND itg_is_deleted = false
ORDER BY itg_name;$seed$, NULL)
    ,(18, 'ITEM BRANDS'             , NULL, 'brand_name'          , 'asc', 10, false, 0   , 'Desktop', 'brand_name'        , 'system', $seed$SELECT
	brand_id,
	brand_name,
	brand_short
FROM inventory.item_brand_master
WHERE brand_is_active = true AND brand_is_deleted = false
ORDER BY brand_name;$seed$, NULL)
    ,(19, 'ITEM SECTIONS'           , NULL, 'sec_name'            , 'asc', 10, false, 0   , 'Desktop', 'sec_name'          , 'system', $seed$SELECT
	sec_id,
	sec_short,
	sec_name,
	sec_alias	
FROM inventory.item_section_master
WHERE sec_is_active = true AND sec_is_deleted = false
ORDER BY sec_name;$seed$, NULL)
    ,(20, 'ITEM CATEGORIES'         , NULL, 'category_name'       , 'asc', 10, false, 0   , 'Desktop', 'category_name'     , 'system', $seed$SELECT
	category_id,
	category_short,
	category_name,
	category_alias	
FROM inventory.item_category_master
WHERE category_is_active = true AND category_is_deleted = false
ORDER BY category_name;$seed$, NULL)
    ,(21, 'GST - STATE CODES'       , NULL, 'state_name'          , 'asc', 10, false, 0   , 'Desktop', 'state_name'        , 'system', $seed$SELECT
	state_code,
	state_name
FROM fixed.state_codes
ORDER BY state_code ASC ;$seed$, NULL)
    ,(22, 'COMPANYS'                , NULL, 'comp_name'           , 'asc', 10, false, 0   , 'Desktop', 'comp_name'         , 'system', $seed$SELECT
	comp_id,
	comp_code,
	comp_short,
	comp_name	
FROM public.companys
WHERE comp_is_active = true AND comp_is_deleted = false
ORDER BY comp_name;$seed$, NULL)
    ,(23, 'ACCOUNT GROUPS'          , NULL, 'acc_group_name'      , 'asc', 10, false, 0   , 'Desktop', 'acc_group_name'    , 'system', $seed$SELECT
	acc_group_id,
	acc_group_short,
	acc_group_name
FROM accounts.acc_group_master
WHERE acc_group_is_active = true AND acc_group_is_deleted = false
ORDER BY acc_group_name;$seed$, NULL)
    ,(24, 'BRANCH - ACTIVE LIST'    , NULL, 'br_name'             , 'asc', 10, false, 0   , 'Desktop', 'br_name'           , 'system', $seed$SELECT
	br_id,
	br_code,
	br_name
FROM public.branch_master
WHERE br_is_deleted = false AND br_is_active = true
ORDER BY br_id;$seed$, NULL)
    ,(25, 'BANK LEDGERS'            , NULL, 'led_name'            , 'asc', 10, false, 0   , 'Desktop', 'led_name'          , 'system', $seed$SELECT
	led_id,
	led_name
FROM accounts.acc_ledger_master
WHERE led_group_id = '019eee86-f34b-7e27-8aee-2b5930314c8a'
	AND led_is_active = true
	AND led_is_deleted = false
ORDER BY led_name;$seed$, NULL)
    ,(26, 'GODOWNS'                 , NULL, 'gdl_name'            , 'asc', 10, false, 0   , 'Desktop', 'gdl_name'          , 'system', $seed$SELECT gdl_id, gdl_name, gdl_short FROM inventory.godown_locations WHERE gdl_is_active = true AND gdl_is_deleted = false ORDER BY gdl_name$seed$, NULL)
    ,(27, 'APP THEMES'              , NULL, 'thm_name'            , 'asc', 10, false, 0   , 'Desktop', 'thm_name'          , 'system', $seed$SELECT
	thm_id::text AS thm_id,
	thm_name
FROM public.app_theme_master
WHERE thm_is_active = true AND thm_is_deleted = false
ORDER BY thm_id ASC;$seed$, NULL)
    ,(28, 'customer group'          , NULL, 'Id'                  , 'ASC', 10, true , NULL, NULL     , NULL                , 'system', $seed$SELECT cgr_id, cgr_branch_id, cgr_name
	FROM sales.cust_groups$seed$, $seed$SELECT cgr_id, cgr_branch_id, cgr_name
	FROM sales.cust_groups$seed$)
    ,(29, 'CUSTOMER STATES'         , NULL, 'stm_name'            , 'asc', 10, false, 0   , 'Desktop', 'stm_name'          , 'system', $seed$SELECT
	stm_id,
	stm_name,
	stm_alias,
	stm_short
FROM sales.state_master
WHERE stm_is_active = true AND stm_is_deleted = false
ORDER BY stm_name;$seed$, NULL)
    ,(30, 'CUSTOMER CITIES'         , NULL, 'ctm_name'            , 'asc', 10, false, 0   , 'Desktop', 'ctm_name'          , 'system', $seed$SELECT
	ctm_id,
	ctm_name,
	ctm_alias,
	ctm_short
FROM sales.city_master
WHERE ctm_is_active = true AND ctm_is_deleted = false
ORDER BY ctm_name;$seed$, NULL)
    ,(31, 'SUPPLIER GROUP'          , NULL, 'spg_name'            , 'asc', 10, false, 0   , 'Desktop', 'spg_name'          , 'system', $seed$SELECT
	spg_id,
	spg_name,
	spg_short
FROM purchase.supplier_groups
WHERE spg_is_deleted = false AND spg_is_active = true
ORDER BY spg_name;$seed$, NULL)
    ,(32, 'BRANCHES'                , NULL, 'br_name'             , 'asc', 10, false, 0   , 'Desktop', 'br_name'           , 'system', $seed$SELECT
	br_id,
	br_name,
	br_code,
	br_short
FROM public.branch_master
WHERE br_is_deleted = false AND br_is_active = true
ORDER BY br_name;$seed$, NULL)
    ,(33, 'CUSTOMER GROUPS'         , NULL, 'cgr_name'            , 'asc', 10, false, 0   , 'Desktop', 'cgr_name'          , 'system', $seed$SELECT
	cgr_id,
	cgr_name,
	cgr_alias,
	cgr_short
FROM sales.cust_groups
WHERE cgr_is_active = true AND cgr_is_deleted = false
ORDER BY cgr_name;$seed$, NULL)
    ,(34, 'PRICE LEVELS'            , NULL, 'ipl_name'            , 'asc', 10, false, 0   , 'Desktop', 'ipl_name'          , 'system', $seed$SELECT
	ipl_id,
	ipl_name
FROM inventory.item_price_levels
WHERE ipl_status = true
ORDER BY ipl_id;$seed$, NULL)
    ,(35, 'SUPPLIERS'               , NULL, 'sup_name'            , 'asc', 10, false, 0   , 'Desktop', 'sup_name'          , 'system', $seed$SELECT
	sup_id,
	sup_short,
	sup_name,
	sup_region_name
FROM purchase.suppliers
WHERE sup_is_active = true AND sup_is_deleted = false
ORDER BY sup_name;$seed$, NULL)
    ,(36, 'TAXES'                   , NULL, 'tax_name'            , 'asc', 10, false, 0   , 'Desktop', 'tax_name'          , 'system', $seed$SELECT
	tax_id,
	tax_name
FROM inventory.item_tax_master
WHERE tax_is_active = true AND tax_is_deleted = false
ORDER BY tax_name;$seed$, NULL)
    ,(37, 'HSN/SAC CODES'           , NULL, 'hsn_code'            , 'asc', 10, false, 0   , 'Desktop', 'hsn_code'          , 'system', $seed$SELECT
	hsn_id,
	hsn_code,
	hsn_name
FROM fixed.hsn_master
WHERE hsn_is_active = true
ORDER BY hsn_code;$seed$, NULL)
    ,(38, 'EMPLOYEES'               , NULL, 'emp_name'            , 'asc', 10, false, 0   , 'Desktop', 'emp_name'          , 'system', $seed$SELECT
    emp_id,
    emp_code,
    emp_name,
    emp_alias,
    emp_branch_id
FROM public.employee_master
WHERE emp_is_active = true
    AND emp_is_deleted = false
    AND (
        emp_branch_id IS NULL
        OR emp_branch_id = iemp_branch_id::uuid
    )
ORDER BY emp_name;$seed$, NULL)
    ,(39, 'CUSTOMERS'               , NULL, 'cus_name'            , 'asc', 10, false, 0   , 'Desktop', 'cus_name'          , 'system', $seed$SELECT
	cus_id,
	cus_name
FROM sales.customers
WHERE cus_is_active = true AND cus_is_deleted = false
ORDER BY cus_name;$seed$, NULL)
    ,(40, 'EMP DESIGNATIONS'        , NULL, 'ed_name'             , 'asc', 10, false, 0   , 'Desktop', 'ed_name'           , 'system', $seed$SELECT
	ed_id,
	ed_name
FROM public.employee_designations
WHERE ed_is_active = true AND ed_is_deleted = false
ORDER BY ed_name;$seed$, NULL)
    ,(41, 'EMP DEPARTMENTS'         , NULL, 'edpt_name'           , 'asc', 10, false, 0   , 'Desktop', 'edpt_name'         , 'system', $seed$SELECT
	edpt_id,
	edpt_name
FROM public.employee_departments
WHERE edpt_is_active = true AND edpt_is_deleted = false
ORDER BY edpt_name;$seed$, NULL)
    ,(42, 'ITEMS'                   , NULL, 'item_name_en'        , 'asc', 10, false, 0   , 'Desktop', 'item_name_en'      , 'system', $seed$SELECT
	item_id,
	item_code,
	item_name_en	
FROM inventory.item_master
WHERE item_is_active = true AND item_is_deleted = false
ORDER BY item_name_en;$seed$, NULL)
    ,(43, 'LEDGERS - ALL'           , NULL, 'led_name'            , 'asc', 10, false, 0   , 'Desktop', 'led_name'          , 'system', $seed$SELECT
	led_id,
	led_short,
	led_name
FROM accounts.acc_ledger_master
WHERE led_is_active = true AND led_is_deleted = false
ORDER BY led_name;$seed$, NULL)
    ,(44, 'TENDER TYPES'            , NULL, 'ttm_display_name'    , 'asc', 10, false, 0   , 'Desktop', 'ttm_display_name'  , 'system', $seed$SELECT
	ttm_type_id,
	ttm_display_name	
FROM accounts.acc_tender_types
WHERE ttm_is_active = true AND ttm_is_deleted = false
ORDER BY ttm_type_id;$seed$, NULL)
    ,(45, 'SALES AGENTS'            , NULL, 'sa_name'             , 'asc', 10, false, 0   , 'Desktop', 'sa_name'           , 'system', $seed$SELECT
	sa_id,
	sa_code,
	sa_name
FROM sales.sale_agents
WHERE sa_is_active = true
	AND sa_is_deleted = false
	AND sa_branch_id IN (NULL, isa_branch_id);$seed$, NULL)
    ,(46, 'INDIAN BANKS LIST'       , NULL, 'bnk_name'            , 'asc', 10, false, 0   , 'Desktop', 'bnk_name'          , 'system', $seed$SELECT
	bnk_name,
	bnk_name
FROM fixed.bank_master
ORDER BY bnk_name;$seed$, NULL)
    ,(47, 'PRINT PURPOSES'          , 'What can be printed. Shipped purposes (no company) plus the caller''s own.', 'ppo_sort_order'      , 'asc', 12, true , NULL, 'Web'    , 'ppo_code'          , 'system', $seed$SELECT
	ppo_id,
	ppo_code,
	ppo_name,
	ppo_src_module
FROM public.print_purpose
WHERE ppo_is_deleted = false
  AND ppo_is_active = true
ORDER BY ppo_sort_order$seed$, NULL)
    ,(48, 'PRINT PURPOSES - DESKTOP', 'What a design prints. print_purpose is a TABLE, not a client constant — a shop may add its own (a kitchen order ticket, a loading sheet). Used by the Print Designer, menu 62.', 'ppo_code'            , 'asc', 12, false, 0   , 'Desktop', 'ppo_code'          , 'system', $seed$SELECT
	ppo_id,
	ppo_code
FROM public.print_purpose
WHERE ppo_is_active = true AND ppo_is_deleted = false
ORDER BY ppo_code;$seed$, NULL)
ON CONFLICT (dropdown_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
    (SELECT GREATEST(COALESCE(MAX(dropdown_id), 0), 1) FROM fixed.dropdown_details),
    true
);

COMMIT;
