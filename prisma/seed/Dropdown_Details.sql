-- Seed: fixed.dropdown_details -- the configured lookup popups and their SQL (61 rows).
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
    ,(3 , 'customerGroups'           , 'customer group', 'cgr_name'            , 'ASC'      , 2 , true , 20  , NULL     , NULL                , 'system', $seed$SELECT cgr_id, cgr_name, cgr_alias FROM sales.cust_groups WHERE cgr_is_deleted = false AND cgr_is_active = true$seed$, $seed$SELECT cgr_id, cgr_name, cgr_alias FROM sales.cust_groups WHERE cgr_is_deleted = false AND cgr_is_active = true$seed$)
    ,(4 , 'city master'              , 'city master', 'City id'             , 'ASC'      , 2 , true , 20  , NULL     , 'city master'       , 'system', $seed$SELECT ctm_id, ctm_name, ctm_alias FROM sales.city_master$seed$, $seed$SELECT ctm_id, ctm_name, ctm_alias,FROM sales.city_master;$seed$)
    ,(5 , 'branch'                   , 'branch master', 'Branch id'           , 'ASC'      , 2 , false, 10  , NULL     , NULL                , 'system', $seed$SELECT br_id, br_name FROM public.branch_master WHERE br_is_deleted = false$seed$, $seed$SELECT br_id, br_name,
	FROM accounts.branch_master;$seed$)
    ,(6 , 'items'                    , 'items', 'Item id'             , 'ASC'      , 2 , true , 10  , NULL     , 'items'             , 'system', $seed$SELECT item_id, item_branch_id, item_code, item_sku, item_name_en, item_name_ta, item_alias FROM inventory.item_master$seed$, $seed$SELECT item_id, item_branch_id, item_code, item_sku, item_name_en, item_name_ta, item_alias, 
	FROM inventory.item_master;$seed$)
    ,(7 , 'companyGroups'            , 'Master lookup for active company groups', 'cog_group_name'      , 'ASC'      , 20, true , NULL, NULL     , NULL                , 'system', $seed$SELECT cog_group_id, cog_group_name FROM public.company_group_master WHERE cog_is_deleted = false AND cog_is_active = true$seed$, NULL)
    ,(8 , 'company'                  , 'company master', 'company id'          , 'ASC'      , 10, true , 20  , NULL     , NULL                , 'system', $seed$SELECT comp_name, comp_id FROM public.companys$seed$, $seed$SELECT  comp_name,comp_id, 
	FROM accounts.companys;$seed$)
    ,(9 , 'state code'               , 'state code', 'state name'          , 'ASC'      , 11, true , 20  , NULL     , NULL                , 'system', $seed$SELECT state_code, state_name FROM fixed.state_codes$seed$, $seed$SELECT state_code, state_name, 
	FROM fixed.state_codes;$seed$)
    ,(10, 'Area'                     , 'area master', 'Area short'          , 'ASC'      , 10, true , 32  , NULL     , NULL                , 'system', $seed$SELECT arm_id, arm_name, arm_alias, arm_short
	FROM sales.area_master;$seed$, $seed$SELECT arm_id, arm_name, arm_alias, arm_short
	FROM sales.area_master;$seed$)
    ,(11, 'suppliergroups'           , 'supplier groups', 'supplier group short', 'ASC'      , 10, true , 20  , NULL     , 'logic'             , 'system', $seed$SELECT spg_id, spg_name, spg_alias, spg_short FROM purchase.supplier_groups$seed$, $seed$SELECT "spgId", "spgName", "spgAlias", "spgShort", 
	FROM purchase.supplier_groups;$seed$)
    ,(13, 'AREA LIST'                , NULL, 'arm_id'              , 'asc'      , 10, false, 0   , 'Desktop', 'arm_name'          , 'system', $seed$SELECT
	arm_id,
	arm_name,
	arm_short
FROM sales.area_master
WHERE arm_is_deleted = false AND arm_is_active = true
ORDER BY arm_name;$seed$, NULL)
    ,(14, 'GST UNIT CODES'           , NULL, 'item_gst_unit_code'  , 'asc'      , 10, false, 0   , 'Desktop', 'item_gst_unit_name', 'system', $seed$SELECT
	item_gst_unit_code,
	item_gst_unit_name
FROM
	inventory.item_gst_units
ORDER BY
	item_gst_unit_id;$seed$, NULL)
    ,(15, 'ITEM UNITS'               , NULL, NULL                  , 'asc'      , 10, false, 0   , 'Desktop', NULL                , 'system', $seed$SELECT
	unit_id,
	unit_name
FROM
	inventory.item_unit_master
WHERE
	unit_is_active = true AND unit_is_deleted = false
ORDER BY
	unit_name;$seed$, NULL)
    ,(16, 'MENUS'                    , NULL, 'menu_id'             , 'asc'      , 10, false, 0   , 'Desktop', 'menu_name'         , 'system', $seed$SELECT
	menu_id,
	menu_name
FROM
	fixed.menu_master
ORDER BY
	menu_name;$seed$, NULL)
    ,(17, 'ITEM GROUPS'              , NULL, 'itg_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'itg_name'          , 'system', $seed$SELECT
	g.itg_id,
	g.itg_name,
	g.itg_short
FROM inventory.item_group_master g
WHERE g.itg_is_active = true AND g.itg_is_deleted = false
	AND g.itg_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.itg_id FROM inventory.item_group_master s
			 WHERE s.itg_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.itg_id FROM inventory.item_group_master c JOIN sub ON c.itg_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY g.itg_name$seed$, NULL)
    ,(18, 'ITEM BRANDS'              , NULL, 'brand_name'          , 'asc'      , 10, false, 0   , 'Desktop', 'brand_name'        , 'system', $seed$SELECT
	b.brand_id,
	b.brand_name,
	b.brand_short
FROM inventory.item_brand_master b
WHERE b.brand_is_active = true AND b.brand_is_deleted = false
	AND b.brand_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.brand_id FROM inventory.item_brand_master s
			 WHERE s.brand_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.brand_id FROM inventory.item_brand_master c JOIN sub ON c.brand_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY b.brand_name$seed$, NULL)
    ,(19, 'ITEM SECTIONS'            , NULL, 'sec_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'sec_name'          , 'system', $seed$SELECT
	s0.sec_id,
	s0.sec_short,
	s0.sec_name,
	s0.sec_alias
FROM inventory.item_section_master s0
WHERE s0.sec_is_active = true AND s0.sec_is_deleted = false
	AND s0.sec_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.sec_id FROM inventory.item_section_master s
			 WHERE s.sec_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.sec_id FROM inventory.item_section_master c JOIN sub ON c.sec_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY s0.sec_sort NULLS LAST, s0.sec_name$seed$, NULL)
    ,(20, 'ITEM CATEGORIES'          , NULL, 'category_name'       , 'asc'      , 10, false, 0   , 'Desktop', 'category_name'     , 'system', $seed$SELECT
	g.category_id,
	g.category_short,
	g.category_name,
	g.category_alias
FROM inventory.item_category_master g
WHERE g.category_is_active = true AND g.category_is_deleted = false
	AND g.category_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.category_id FROM inventory.item_category_master s
			 WHERE s.category_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.category_id FROM inventory.item_category_master c JOIN sub ON c.category_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY g.category_name$seed$, NULL)
    ,(21, 'GST - STATE CODES'        , NULL, 'state_name'          , 'asc'      , 10, false, 0   , 'Desktop', 'state_name'        , 'system', $seed$SELECT
	state_code,
	state_name
FROM fixed.state_codes
ORDER BY state_code ASC ;$seed$, NULL)
    ,(22, 'COMPANYS'                 , NULL, 'comp_name'           , 'asc'      , 10, false, 0   , 'Desktop', 'comp_name'         , 'system', $seed$SELECT
	comp_id,
	comp_code,
	comp_short,
	comp_name	
FROM public.companys
WHERE comp_is_active = true AND comp_is_deleted = false
ORDER BY comp_name;$seed$, NULL)
    ,(23, 'ACCOUNT GROUPS'           , NULL, 'acc_group_name'      , 'asc'      , 10, false, 0   , 'Desktop', 'acc_group_name'    , 'system', $seed$SELECT
	acc_group_id,
	acc_group_short,
	acc_group_name
FROM accounts.acc_group_master
WHERE acc_group_is_active = true AND acc_group_is_deleted = false
ORDER BY acc_group_name;$seed$, NULL)
    ,(24, 'BRANCH - ACTIVE LIST'     , NULL, 'br_name'             , 'asc'      , 10, false, 0   , 'Desktop', 'br_name'           , 'system', $seed$SELECT
	br_id,
	br_code,
	br_name
FROM public.branch_master
WHERE br_is_deleted = false AND br_is_active = true
ORDER BY br_id;$seed$, NULL)
    ,(25, 'BANK LEDGERS'             , NULL, 'led_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'led_name'          , 'system', $seed$SELECT
	led_id,
	led_name
FROM accounts.acc_ledger_master
WHERE led_group_id = '019eee86-f34b-7e27-8aee-2b5930314c8a'
	AND led_is_active = true
	AND led_is_deleted = false
ORDER BY led_name;$seed$, NULL)
    ,(26, 'GODOWNS'                  , NULL, 'gdl_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'gdl_name'          , 'system', $seed$SELECT
	g.gdl_id,
	g.gdl_name,
	g.gdl_short
FROM inventory.godown_locations g
WHERE g.gdl_is_active = true AND g.gdl_is_deleted = false
	AND (NULLIF(NULLIF('ibranch_id', ''), 'ibranch' || '_id') IS NULL
	     OR g.gdl_branch_id::text = NULLIF(NULLIF('ibranch_id', ''), 'ibranch' || '_id'))
	AND g.gdl_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.gdl_id FROM inventory.godown_locations s
			 WHERE s.gdl_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.gdl_id FROM inventory.godown_locations c JOIN sub ON c.gdl_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY g.gdl_name$seed$, NULL)
    ,(27, 'APP THEMES'               , NULL, 'thm_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'thm_name'          , 'system', $seed$SELECT
	thm_id::text AS thm_id,
	thm_name
FROM public.app_theme_master
WHERE thm_is_active = true AND thm_is_deleted = false
ORDER BY thm_id ASC;$seed$, NULL)
    ,(28, 'customer group'           , NULL, 'Id'                  , 'ASC'      , 10, true , NULL, NULL     , NULL                , 'system', $seed$SELECT cgr_id, cgr_branch_id, cgr_name
	FROM sales.cust_groups$seed$, $seed$SELECT cgr_id, cgr_branch_id, cgr_name
	FROM sales.cust_groups$seed$)
    ,(29, 'CUSTOMER STATES'          , NULL, 'stm_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'stm_name'          , 'system', $seed$SELECT
	stm_id,
	stm_name,
	stm_alias,
	stm_short
FROM sales.state_master
WHERE stm_is_active = true AND stm_is_deleted = false
ORDER BY stm_name;$seed$, NULL)
    ,(30, 'CUSTOMER CITIES'          , NULL, 'ctm_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'ctm_name'          , 'system', $seed$SELECT
	ctm_id,
	ctm_name,
	ctm_alias,
	ctm_short
FROM sales.city_master
WHERE ctm_is_active = true AND ctm_is_deleted = false
ORDER BY ctm_name;$seed$, NULL)
    ,(31, 'SUPPLIER GROUP'           , NULL, 'spg_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'spg_name'          , 'system', $seed$SELECT
	spg_id,
	spg_name,
	spg_short
FROM purchase.supplier_groups
WHERE spg_is_deleted = false AND spg_is_active = true
ORDER BY spg_name;$seed$, NULL)
    ,(32, 'BRANCHES'                 , NULL, 'br_name'             , 'asc'      , 10, false, 0   , 'Desktop', 'br_name'           , 'system', $seed$SELECT
	br_id,
	br_name,
	br_code,
	br_short
FROM public.branch_master
WHERE br_is_deleted = false AND br_is_active = true
ORDER BY br_name;$seed$, NULL)
    ,(33, 'CUSTOMER GROUPS'          , NULL, 'cgr_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'cgr_name'          , 'system', $seed$SELECT
	cgr_id,
	cgr_name,
	cgr_alias,
	cgr_short
FROM sales.cust_groups
WHERE cgr_is_active = true AND cgr_is_deleted = false
ORDER BY cgr_name;$seed$, NULL)
    ,(34, 'PRICE LEVELS'             , NULL, 'ipl_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'ipl_name'          , 'system', $seed$SELECT
	ipl_id,
	ipl_name
FROM inventory.item_price_levels
WHERE ipl_status = true
ORDER BY ipl_id;$seed$, NULL)
    ,(35, 'SUPPLIERS'                , NULL, 'sup_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'sup_name'          , 'system', $seed$SELECT
	sup_id,
	sup_short,
	sup_name,
	sup_region_name
FROM purchase.suppliers
WHERE sup_is_active = true AND sup_is_deleted = false
ORDER BY sup_name;$seed$, NULL)
    ,(36, 'TAXES'                    , NULL, 'tax_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'tax_name'          , 'system', $seed$SELECT
	tax_id,
	tax_name
FROM inventory.tax_rate_master
WHERE tax_is_active = true AND tax_is_deleted = false
ORDER BY tax_name;$seed$, NULL)
    ,(37, 'HSN/SAC CODES'            , NULL, 'hsn_code'            , 'asc'      , 10, false, 0   , 'Desktop', 'hsn_code'          , 'system', $seed$SELECT
	hsn_id,
	hsn_code,
	hsn_name
FROM fixed.hsn_master
WHERE hsn_is_active = true
ORDER BY hsn_code;$seed$, NULL)
    ,(38, 'EMPLOYEES'                , NULL, 'emp_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'emp_name'          , 'system', $seed$SELECT
    emp_id,
    emp_code,
    emp_name,
    emp_alias
FROM public.employee_master
WHERE emp_is_active = true
    AND emp_is_deleted = false
    AND (
        emp_branch_id IS NULL
        OR emp_branch_id = iemp_branch_id::uuid
    )
ORDER BY emp_name;$seed$, NULL)
    ,(39, 'CUSTOMERS'                , NULL, 'cus_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'cus_name'          , 'system', $seed$SELECT
	cus_id,
	cus_name
FROM sales.customers
WHERE cus_is_active = true AND cus_is_deleted = false
ORDER BY cus_name;$seed$, NULL)
    ,(40, 'EMP DESIGNATIONS'         , NULL, 'ed_name'             , 'asc'      , 10, false, 0   , 'Desktop', 'ed_name'           , 'system', $seed$SELECT
	ed_id,
	ed_name
FROM public.employee_designations
WHERE ed_is_active = true AND ed_is_deleted = false
ORDER BY ed_name;$seed$, NULL)
    ,(41, 'EMP DEPARTMENTS'          , NULL, 'edpt_name'           , 'asc'      , 10, false, 0   , 'Desktop', 'edpt_name'         , 'system', $seed$SELECT
	edpt_id,
	edpt_name
FROM public.employee_departments
WHERE edpt_is_active = true AND edpt_is_deleted = false
ORDER BY edpt_name;$seed$, NULL)
    ,(42, 'ITEMS'                    , NULL, 'item_name_en'        , 'asc'      , 10, false, 0   , 'Desktop', 'item_name_en'      , 'system', $seed$SELECT
	item_id,
	item_code,
	item_name_en	
FROM inventory.item_master
WHERE item_is_active = true AND item_is_deleted = false
ORDER BY item_name_en;$seed$, NULL)
    ,(43, 'LEDGERS - ALL'            , NULL, 'led_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'led_name'          , 'system', $seed$SELECT
	led_id,
	led_short,
	led_name
FROM accounts.acc_ledger_master
WHERE led_is_active = true AND led_is_deleted = false
ORDER BY led_name;$seed$, NULL)
    ,(44, 'TENDER TYPES'             , NULL, 'ttm_display_name'    , 'asc'      , 10, false, 0   , 'Desktop', 'ttm_display_name'  , 'system', $seed$SELECT
	ttm_type_id,
	ttm_display_name	
FROM accounts.acc_tender_types
WHERE ttm_is_active = true AND ttm_is_deleted = false
ORDER BY ttm_type_id;$seed$, NULL)
    ,(45, 'SALES AGENTS'             , NULL, 'sa_name'             , 'asc'      , 10, false, 0   , 'Desktop', 'sa_name'           , 'system', $seed$SELECT
      sa_id,
      sa_code,
      sa_name
FROM sales.sale_agents
WHERE sa_is_active = true
      AND sa_is_deleted = false
      AND sa_branch_id IN (NULL, isa_branch_id);$seed$, NULL)
    ,(46, 'INDIAN BANKS LIST'        , NULL, 'bnk_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'bnk_name'          , 'system', $seed$SELECT
	bnk_name,
	bnk_name
FROM fixed.bank_master
ORDER BY bnk_name;$seed$, NULL)
    ,(47, 'PRINT PURPOSES'           , 'What can be printed. Shipped purposes (no company) plus the caller''s own.', 'ppo_sort_order'      , 'asc'      , 12, true , NULL, 'Web'    , 'ppo_code'          , 'system', $seed$SELECT
	ppo_id,
	ppo_code,
	ppo_name,
	ppo_src_module
FROM public.print_purpose
WHERE ppo_is_deleted = false
  AND ppo_is_active = true
ORDER BY ppo_sort_order$seed$, NULL)
    ,(48, 'PRINT PURPOSES - DESKTOP' , 'What a design prints. print_purpose is a TABLE, not a client constant — a shop may add its own (a kitchen order ticket, a loading sheet). Used by the Print Designer, menu 62.', 'ppo_code'            , 'asc'      , 12, false, 0   , 'Desktop', 'ppo_code'          , 'system', $seed$SELECT
	ppo_id,
	ppo_code
FROM public.print_purpose
WHERE ppo_is_active = true AND ppo_is_deleted = false
ORDER BY ppo_code;$seed$, NULL)
    ,(49, 'STOCK TRACK PRESETS'      , NULL, 'spt_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'spt_name'          , 'system', $seed$SELECT
	spt_id,
	spt_code,
	spt_name
FROM stock.stock_track_preset
WHERE spt_is_active = true AND spt_is_deleted = false
ORDER BY spt_id;$seed$, NULL)
    ,(50, 'STOCK REASONS'            , 'Reasons a physical-count variance is accepted under.', 'srm_name'            , 'desc'     , 10, true , 0   , 'Desktop', 'srm_name'          , 'system', $seed$SELECT srm_id, srm_name, srm_code
FROM stock.stock_reason_master
WHERE srm_is_active = true AND srm_is_deleted = false
  AND (srm_allowed_txn_types = '{}'
       OR srm_allowed_txn_types && ARRAY['PHYSICAL_PLUS','PHYSICAL_MINUS'])
ORDER BY srm_sort_order, srm_name$seed$, NULL)
    ,(51, 'LEDGERS FOR POSTING ROLE' , 'Ledgers accounts.acc_ledger_role permits for the role passed as itrl_role.', 'led_name'            , 'asc'      , 12, false, NULL, 'Desktop', 'led_name'          , 'system', $seed$SELECT l.led_id, l.led_short, l.led_name FROM accounts.acc_ledger_master l LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id JOIN accounts.acc_ledger_role r ON r.alr_role = itrl_role WHERE l.led_is_active AND NOT l.led_is_deleted AND l.led_company_id IS NULL AND (r.alr_want_type IS NULL OR l.led_ledger_type = r.alr_want_type) AND (r.alr_want_duty IS NULL OR l.led_gst_duty_head = r.alr_want_duty) AND (r.alr_want_nature IS NULL OR g.acc_group_nature = r.alr_want_nature) ORDER BY l.led_name$seed$, NULL)
    ,(52, 'POSTING ROLES - RATE WISE', 'Roles a GST rate may override (alr_by_rate). Carries alr_by_supply so the grid knows which rows take a supply nature.', 'alr_sort_order'      , 'asc'      , 12, false, NULL, 'Desktop', 'alr_label'         , 'system', $seed$SELECT alr_role, alr_label, alr_group, alr_by_supply FROM accounts.acc_ledger_role WHERE alr_is_active AND alr_by_rate ORDER BY alr_sort_order$seed$, NULL)
    ,(53, 'GST RATES'                , 'Every GST rate, active or not, for tax_supersedes_id.', 'tax_sort_order'      , 'asc'      , 12, true , NULL, 'Desktop', 'tax_name'          , 'system', $seed$SELECT tax_id, tax_name, tax_rate_perc, tax_taxability FROM inventory.tax_rate_master WHERE NOT tax_is_deleted ORDER BY tax_sort_order, tax_name$seed$, NULL)
    ,(54, 'CUSTOMERS BY AREA'        , 'Customers, narrowed to one area / beat when iarea_id is supplied. Dropdown 39 unchanged.', 'cus_name'            , 'desc'     , 15, false, 0   , 'Desktop', 'cus_name'          , 'system', $seed$SELECT
    cus_id,
    cus_name
  FROM sales.customers
 WHERE cus_is_active = true
   AND cus_is_deleted = false
   AND (NULLIF('iarea_id', '') IS NULL OR cus_area_id = NULLIF('iarea_id', '')::uuid)
 ORDER BY cus_name;$seed$, NULL)
    ,(55, 'TRANSPORTERS'             , 'public.transporter_master for the shared transport band (plan-qt-sales 1.6). Shared rows (NULL company) plus the company''s own. Param itrn_company_id.', 'trn_name'            , 'Ascending', 10, true , 0   , 'Desktop', 'trn_name'          , 'system', $seed$SELECT trn_id, trn_name, trn_gstin, trn_mode, trn_phone
FROM public.transporter_master
WHERE trn_is_active = true AND trn_is_deleted = false
  AND (trn_company_id IS NULL OR trn_company_id = itrn_company_id::uuid)
ORDER BY trn_name$seed$, NULL)
    ,(56, 'VEHICLES'                 , 'public.vehicle_master for the shared transport band (plan-qt-sales 1.6). Shared rows (NULL company) plus the company''s own. Param iveh_company_id. The pick writes the document''s HEADER vehicle (sbVehicleId / sbVehicleNo).', 'veh_vehicle_no'      , 'Ascending', 10, true , 0   , 'Desktop', 'veh_vehicle_no'    , 'system', $seed$SELECT v.veh_id, v.veh_vehicle_no, v.veh_type, t.trn_name, v.veh_capacity_kg
FROM public.vehicle_master v
LEFT JOIN public.transporter_master t ON t.trn_id = v.veh_transporter_id
WHERE v.veh_is_active = true AND v.veh_is_deleted = false
  AND (v.veh_company_id IS NULL OR v.veh_company_id = iveh_company_id::uuid)
ORDER BY v.veh_vehicle_no$seed$, NULL)
    ,(57, 'DC PURPOSES'              , 'Delivery challan purposes enabled for the company (public.companys.comp_dc_purposes, plan-qt-sales 4). Param icomp_id.', 'purpose_name'        , 'Ascending', 10, false, 0   , 'Desktop', 'purpose_name'      , 'system', $seed$SELECT p AS purpose, initcap(replace(p, '_', ' ')) AS purpose_name
FROM public.companys c, unnest(c.comp_dc_purposes) AS p
WHERE c.comp_id = icomp_id::uuid
ORDER BY purpose_name$seed$, NULL)
    ,(58, 'CUSTOMERS BY BEAT'        , 'Dropdown 39 with an optional beat filter for the sale bill: picking a Beat narrows the Customer list to that area. Param icus_area_id - ALWAYS sent, '''' = every beat. Compared as text, never cast (the runner binds the token, an unsent or empty token cast to uuid would 400).', 'cus_name'            , 'asc'      , 10, false, 0   , 'Desktop', 'cus_name'          , 'system', $seed$SELECT
	cus_id,
	cus_name
FROM sales.customers
WHERE cus_is_active = true AND cus_is_deleted = false
  AND ('icus_area_id' = '' OR cus_area_id::text = 'icus_area_id')
ORDER BY cus_name$seed$, NULL)
    ,(59, 'VOUCHER PARTIES'          , 'Voucher Register party field: party ledgers (Sundry Debtors/Creditors) legal on the type''s party side. Same rule as grid 119 POPUP - VOUCHER LEDGERS (share/grids/voucher_ledger_picker.sql). Params ALWAYS sent: icompany_id, itype_code, iside.', 'led_name'            , 'asc'      , 10, true , 0   , 'Desktop', 'led_name'          , 'system', $seed$SELECT l.led_id,
       l.led_name,
       g.acc_group_name AS group_name
  FROM accounts.acc_ledger_master l
  JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
 WHERE (l.led_company_id IS NULL OR l.led_company_id::text = 'icompany_id')
   AND l.led_is_deleted = false
   AND l.led_is_active = true
   AND EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                WHERE t.vchr_type_code = 'itype_code' AND t.vchr_in_register = true)
   AND l.led_group_id IN (
        WITH RECURSIVE vt AS (
            SELECT CASE WHEN 'iside' = 'CR' THEN t.vchr_cr_groups ELSE t.vchr_dr_groups END AS grp
              FROM accounts.acc_voucher_types t
             WHERE t.vchr_type_code = 'itype_code' AND t.vchr_in_register = true),
        allowed AS (
            SELECT x.acc_group_id FROM accounts.acc_group_master x, vt
             WHERE cardinality(vt.grp) = 0 OR x.acc_group_id = ANY (vt.grp)
            UNION
            SELECT x.acc_group_id FROM accounts.acc_group_master x
              JOIN allowed a ON x.acc_group_parent_id = a.acc_group_id)
        SELECT acc_group_id FROM allowed)
   AND l.led_id NOT IN (
        WITH RECURSIVE tl AS (
            SELECT t.tnd_ledger_id AS led_id
              FROM accounts.acc_tender_master t
              JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
             WHERE t.tnd_company_id::text = 'icompany_id' AND t.tnd_is_deleted = false
               AND y.ttm_is_cash = false AND t.tnd_ledger_id IS NOT NULL
            UNION
            SELECT t.tnd_settlement_ledger_id
              FROM accounts.acc_tender_master t
              JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
             WHERE t.tnd_company_id::text = 'icompany_id' AND t.tnd_is_deleted = false
               AND y.ttm_is_cash = false AND t.tnd_settlement_ledger_id IS NOT NULL),
        anc AS (
            SELECT tl.led_id, x.acc_group_parent_id, lower(x.acc_group_name) AS n, 0 AS d
              FROM tl
              JOIN accounts.acc_ledger_master m ON m.led_id = tl.led_id
              JOIN accounts.acc_group_master x ON x.acc_group_id = m.led_group_id
            UNION ALL
            SELECT anc.led_id, p.acc_group_parent_id, lower(p.acc_group_name), anc.d + 1
              FROM anc JOIN accounts.acc_group_master p ON p.acc_group_id = anc.acc_group_parent_id
             WHERE anc.d < 24)
        SELECT led_id FROM tl
         WHERE led_id NOT IN (SELECT led_id FROM anc
                               WHERE n IN ('cash-in-hand', 'bank accounts', 'bank od a/c'))
        UNION
        SELECT m.led_id FROM accounts.acc_ledger_master m
         WHERE (m.led_company_id IS NULL OR m.led_company_id::text = 'icompany_id')
           AND m.led_is_deleted = false
           AND accounts.fn_is_cheques_in_hand_ledger(m.led_id))
   AND EXISTS (
                WITH RECURSIVE up AS (
                    SELECT x.acc_group_id, x.acc_group_parent_id, lower(x.acc_group_name) AS n, 0 AS d
                      FROM accounts.acc_group_master x WHERE x.acc_group_id = l.led_group_id
                    UNION ALL
                    SELECT p.acc_group_id, p.acc_group_parent_id, lower(p.acc_group_name), up.d + 1
                      FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
                     WHERE up.d < 24)
                SELECT 1 FROM up WHERE up.n IN ('sundry debtors', 'sundry creditors'))
 ORDER BY l.led_name$seed$, NULL)
    ,(60, 'PAYMENT PAYEES'           , 'Party ledgers only (group profile Party, or led_ledger_type PARTY) for the Payment payee, menu 100. Shared (NULL company) plus this company. Param icompany_id, always sent.', 'led_name'            , 'Ascending', 12, true , 0   , 'Desktop', 'led_name'          , 'system', $seed$SELECT l.led_id,
       l.led_name,
       g.acc_group_name AS group_name,
       l.led_short
  FROM accounts.acc_ledger_master l
  JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
 WHERE (l.led_company_id IS NULL OR l.led_company_id::text = 'icompany_id')
   AND l.led_is_deleted = false
   AND l.led_is_active = true
   AND (g.acc_ledger_profile = 'Party' OR l.led_ledger_type = 'PARTY')
 ORDER BY l.led_name$seed$, NULL)
    ,(61, 'BRANCHES BY COMPANY'      , 'Branches of one company (GST Credentials, menu 270). Param ibr_comp_id - ALWAYS sent, '''' = every company. Compared as text, never cast.', 'br_name'             , 'asc'      , 10, false, 0   , 'Desktop', 'br_name'           , 'system', $seed$SELECT
	br_id,
	br_name,
	br_gstin_no
FROM public.branch_master
WHERE br_is_deleted = false AND br_is_active = true
  AND ('ibr_comp_id' = '' OR br_comp_id::text = 'ibr_comp_id')
ORDER BY br_name$seed$, NULL)
    ,(62, 'GST PROVIDERS'            , 'GST providers (GST Credentials, menu 270). Not deleted; inactive ones listed too, a credential may be set up before the provider goes live.', 'gpv_code'            , 'asc'      , 10, false, 0   , 'Desktop', 'gpv_name'          , 'system', $seed$SELECT
	gpv_id,
	gpv_code,
	gpv_name
FROM public.gst_provider
WHERE gpv_is_deleted = false
ORDER BY gpv_is_active DESC, gpv_code$seed$, NULL)
    ,(63, 'STAFF ADVANCE LEDGERS'    , 'Staff advance ledgers for the Employee master (notes 95): live ledgers in Loans & Advances (Asset) or any sub-group of it - the rule /employee-masters/create applies to empLoanLedgerId. Shared (NULL company) plus this company. Param icompany_id, always sent.', 'led_name'            , 'Ascending', 12, true , 0   , 'Desktop', 'led_name'          , 'system', $seed$SELECT l.led_id,
       l.led_name,
       g.acc_group_name AS group_name,
       l.led_short
  FROM accounts.acc_ledger_master l
  JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
 WHERE (l.led_company_id IS NULL OR l.led_company_id::text = 'icompany_id')
   AND l.led_is_deleted = false
   AND l.led_is_active = true
   AND EXISTS (WITH RECURSIVE up(id, parent_id, d) AS (
                    SELECT x.acc_group_id, x.acc_group_parent_id, 0
                      FROM accounts.acc_group_master x WHERE x.acc_group_id = l.led_group_id
                    UNION ALL
                    SELECT p.acc_group_id, p.acc_group_parent_id, up.d + 1
                      FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.parent_id
                     WHERE up.d < 24)
                SELECT 1
                  FROM up JOIN accounts.acc_group_master r ON r.acc_group_id = up.id
                 WHERE r.acc_group_name = 'Loans & Advances (Asset)'
                   AND r.acc_group_company_id IS NULL)
 ORDER BY l.led_name$seed$, NULL)
ON CONFLICT (dropdown_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
    (SELECT GREATEST(COALESCE(MAX(dropdown_id), 0), 1) FROM fixed.dropdown_details),
    true
);

COMMIT;
