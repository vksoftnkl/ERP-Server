-- Seed: fixed.grid_details -- the configured list/report grids and the SQL behind them (125 rows).
--
-- grid_sql is user-configurable SQL executed by the grid "run" endpoint through the
-- read-only pool, with p_* named tokens bound as parameters (bindGridParams). It is
-- dollar-quoted below ($seed$...$seed$) so quotes and newlines survive verbatim --
-- nothing in the data contains that tag.
--
-- Ids are explicit: fixed.grid_columns references grid_id, and the client requests a
-- grid by id. The setval at the bottom keeps the sequence ahead of them.
--
-- Idempotent: ON CONFLICT (grid_id) DO NOTHING -- an existing grid keeps its locally
-- edited SQL, sort column and description.
-- Regenerate with: npm run seed:export:ui-config
-- Run: psql "$DATABASE_URL" -f prisma/seed/Grid_Details.sql
--      or: npm run seed:run -- --only=Grid_Details.sql

BEGIN;

INSERT INTO fixed.grid_details
    (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type, grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
     (1::bigint, 'item master'::text, 'item master'::text, '#'::text, 'Ascending'::text, 'web'::text, true::boolean, false::boolean, 'system'::text, $seed$SELECT
	item_id,
	item_code,
	item_name_en,
	item_name_ta
FROM inventory.item_master
where   item_is_deleted=wantdelete$seed$::text)
    ,(2  , 'state master', 'state master', 'State Name'      , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
	stm_id,
	stm_name,
	stm_alias,
	stm_short,
	stm_order
FROM
	sales.state_master
WHERE
	stm_is_deleted = wantdelete
ORDER BY
	stm_name$seed$)
    ,(3  , 'Area master', 'area master', 'Area name'       , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
	arm.arm_id,
	arm.arm_name,
	arm.arm_alias,
	arm.arm_short,
	arm.arm_city_id,
	ctm.ctm_name AS arm_city_name,
	arm.arm_sort,
	arm.arm_distance_km,
	arm.arm_collection_days
FROM
	sales.area_master arm
	LEFT JOIN sales.city_master ctm
		ON ctm.ctm_id = arm.arm_city_id
		AND ctm.ctm_is_deleted = false
WHERE
	arm.arm_is_deleted = false
ORDER BY
	arm.arm_name$seed$)
    ,(4  , 'unit master', 'unit master', 'Unit name'       , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT unit_name, unit_alias, unit_code, unit_description, unit_decimal_count, unit_weight, unit_loading, unit_unloading, unit_attach_charge, unit_is_pack_unit, unit_conversion, unit_is_active,  unit_id, unit_base_unit_id
	FROM inventory.item_unit_master
where unit_is_deleted=wantdelete$seed$)
    ,(6  , 'item group master', 'item group master', 'Group Name'      , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
    itg.itg_id,
    itg.itg_name,
    itg.itg_short,
    itg.itg_alias,
    itg.itg_description,
    parent.itg_name AS itg_parent_name,    
    itg.itg_sort,
    itg.itg_is_active
FROM inventory.item_group_master AS itg
LEFT JOIN inventory.item_group_master AS parent
    ON parent.itg_id = itg.itg_parent_id
   AND parent.itg_is_deleted = FALSE
WHERE itg.itg_is_deleted = wantdelete
ORDER BY itg.itg_name$seed$)
    ,(7  , 'brand master', 'brand master', 'Brand name'      , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT brand_id, brand_name, brand_alias, brand_short, brand_description, brand_photo, brand_photo_url, brand_parent_id, brand_sort, brand_level, brand_path_ids
	FROM inventory.item_brand_master
where brand_is_deleted=wantdelete$seed$)
    ,(8  , 'Customers', NULL, 'Customer name'   , 'Ascending' , 'desktop', true , false, 'system', $seed$SELECT cus_id, cus_title, cus_short, cus_code, cus_name
	FROM sales.customers where cus_is_deleted=false$seed$)
    ,(9  , 'godown master', 'godown master', '#'               , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
    g.gdl_id,                        
    g.gdl_code,
    g.gdl_name,
    g.gdl_short,
    g.gdl_type,                      
    g.gdl_level,                     
    p.gdl_name AS parent_name,       
    g.gdl_is_active                  
FROM inventory.godown_locations g
LEFT JOIN inventory.godown_locations p
       ON p.gdl_id = g.gdl_parent_id
WHERE g.gdl_is_deleted = wantdelete$seed$)
    ,(10 , 'section master', NULL, 'Section name'    , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT sec_id, sec_name, sec_alias, sec_short, sec_description, sec_parent_id, sec_sort, sec_level, sec_path_ids, sec_position, sec_color_code,sec_is_active
	FROM inventory.item_section_master where sec_is_deleted=wantdelete$seed$)
    ,(11 , 'item category master', NULL, 'category name'   , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT category_id, category_name, category_alias, category_short, category_description, category_parent_id, category_sort, category_level, category_path_ids_cache, category_photo, category_photo_url, category_is_active FROM inventory.item_category_master where  category_is_deleted=wantdelete$seed$)
    ,(12 , 'company master', NULL, '#'               , 'Ascending' , 'desktop', true , false, 'system', $seed$SELECT
	comp_id,
	comp_code,
	comp_short,
	comp_name,
	comp_legal_name,
	comp_gstin_no,
	comp_gst_reg_type,
	comp_state,
	comp_is_active
FROM public.companys
where   comp_is_deleted = wantdelete
ORDER BY comp_id$seed$)
    ,(13 , 'Branch master', NULL, '#'               , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
    BR.br_id,               
    CMP.comp_name,
    BR.br_code,             
    BR.br_name,             
    BR.br_short,            
    BR.br_type,             
    BR.br_city,             
    BR.br_state,
    BR.br_contact_person,
    BR.br_phone,
    BR.br_is_default,       
    BR.br_is_active         
FROM public.branch_master BR
	INNER JOIN public.companys CMP ON CMP.comp_id = BR.br_comp_id
WHERE
	BR.br_is_deleted = wantdelete
ORDER BY CMP.comp_id, BR.br_is_default DESC, BR.br_name ASC$seed$)
    ,(14 , 'Employee Master', NULL, 'Employee name'   , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT emp_id,emp_name,  emp_code, emp_alias, emp_mobile1
	FROM public.employee_master
where emp_is_deleted=false$seed$)
    ,(15 , 'Godown master', NULL, 'Name'            , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT gdl_id,gdl_name, gdl_short, gdl_code, gdl_type, gdl_parent_id, gdl_sort, gdl_level
	FROM inventory.godown_locations
where gdl_is_deleted=false$seed$)
    ,(16 , 'opening stock list', NULL, 'Ref No'          , 'Ascending' , 'web'    , true , false, 'system', NULL)
    ,(17 , 'suppliers', 'suppliers', 'supplier address', 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT sup_id, sup_addr1, sup_addr2, sup_addr3, sup_billed_date, sup_branch_id, sup_cash_disc_perc
	FROM purchase.suppliers$seed$)
    ,(18 , 'supplier groups', 'supplier groups', 'Name'            , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT spg_id, spg_name, spg_alias, spg_short, spg_desc, spg_is_active
	FROM purchase.supplier_groups where spg_is_deleted=wantdelete$seed$)
    ,(19 , 'customer group', 'customer group', 'group name'      , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT cgr_id, cgr_branch_id, cgr_name, cgr_alias, cgr_short, cgr_narration, cgr_order, cgr_disc_perc, cgr_collection_days, cgr_debit_allowed, cgr_debit_days, cgr_debit_limit, cgr_bills_limit, cgr_overdue_billing, cgr_company_id
	FROM sales.cust_groups$seed$)
    ,(20 , 'City', 'city', 'Name'            , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
	ctm.ctm_id,
	ctm.ctm_name,
	ctm.ctm_alias,
	ctm.ctm_short,
	ctm.ctm_state_id,
	stm.stm_name AS ctm_state_name,
	ctm.ctm_order,
	ctm.ctm_is_active
FROM
	sales.city_master ctm
	LEFT JOIN sales.state_master stm
		ON stm.stm_id = ctm.ctm_state_id
		AND stm.stm_is_deleted = false
WHERE
	ctm.ctm_is_deleted = wantdelete
ORDER BY
	ctm.ctm_name$seed$)
    ,(21 , 'Category master', NULL, 'Names'           , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT category_id, category_name, category_alias, category_short, category_description, category_parent_id, category_sort, category_level
	FROM inventory.item_category_master
where category_is_deleted=false$seed$)
    ,(22 , 'Employee Master', NULL, 'Name'            , 'Ascending' , 'web'    , false, true , 'system', $seed$SELECT emp_id,  emp_name, emp_alias, emp_code,emp_branch_id
	FROM sales.emp_master
where emp_is_deleted=false$seed$)
    ,(23 , 'Employee department master', NULL, 'Name'            , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT edpt_id, edpt_name, edpt_code, edpt_alias
	FROM public.employee_departments
where edpt_is_deleted=false$seed$)
    ,(24 , 'Employee designation master', NULL, 'Name'            , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT ed_id, ed_name, ed_code, ed_is_default
	FROM public.employee_designations
where ed_is_deleted=wantdelete$seed$)
    ,(25 , 'Account groups', NULL, '#'               , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
	GRP.acc_group_id,
	GRP.acc_group_short,
	GRP.acc_group_name,
	GRP.acc_group_alias,	
	PRN.acc_group_name AS parent_group_name,
	GRP.acc_group_description,
	GRP.acc_group_sort,
	GRP.acc_group_type,
	GRP.acc_group_is_reserved
FROM
	accounts.acc_group_master GRP
	LEFT JOIN accounts.acc_group_master PRN ON PRN.acc_group_id = GRP.acc_group_id
WHERE
	GRP.acc_group_is_deleted = wantdelete
ORDER BY
	GRP.acc_group_name$seed$)
    ,(26 , 'Account ledger master', NULL, '#'               , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
    LM.led_id,                               
    LM.led_short,
    LM.led_name,
    AG.acc_group_name,
    LM.led_ledger_type,
    LM.led_gstin_no,
    LM.led_phone1,
    LM.led_tel,
    LM.led_city,
    LM.led_is_active
FROM accounts.acc_ledger_master LM
    INNER JOIN accounts.acc_group_master AG ON AG.acc_group_id = LM.led_group_id
WHERE
	LM.led_is_deleted = wantdelete
ORDER BY
	LM.led_name$seed$)
    ,(28 , 'device list master', NULL, 'Device UID'      , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT dev_id, dev_company_id, dev_branch_id, dev_user_id, dev_device_uid, dev_device_name, dev_device_type, dev_platform, dev_mac_address, dev_is_blocked, dev_block_reason, dev_last_ip, dev_last_login
	FROM fixed.device_master
where dev_is_deleted=false$seed$)
    ,(29 , 'User administration', NULL, 'ID'              , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT usr_id, usr_company_id, usr_branch_id, usr_employee_id, usr_login_name, usr_display_name, usr_full_name, usr_mobile_no, usr_email, usr_last_login_on
	FROM public.user_master
WHERE usr_is_deleted = iisdeleted$seed$)
    ,(30 , 'loyalty points', NULL, 'ID'              , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT lspt_id, lspt_ls_id, lspt_slno, lspt_item_id, lspt_unit_id, lspt_exceeds, lspt_each, lspt_factor, lspt_points, lspt_notes
	FROM sales.loyalty_sch_points
where lspt_is_deleted=false$seed$)
    ,(31 , 'DESKTOP - DEVICE MASTER LIST', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
       d.dev_id,
       d.dev_device_name,
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
ORDER BY c.comp_name NULLS FIRST, b.br_name NULLS FIRST, d.dev_device_name$seed$)
    ,(33 , 'Grid -master', NULL, 'Grid name'       , 'Ascending' , 'web'    , true , false, 'system', $seed$Select Grid_Id, Grid_Name, Grid_Device_Type, Grid_Sort_Column, Grid_Sort_Order, Grid_Description, Grid_Status
    From Fixed.Grid_Details
    Where Grid_Device_Type = 'Desktop' And Grid_Is_Deleted='false'
    Order By Grid_Id$seed$)
    ,(34 , 'GRID MASTER LIST', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	grid_id,
	grid_name,
	grid_device_type,
	grid_sort_column,
	grid_sort_order,
	grid_description,
	grid_status
FROM fixed.grid_details
WHERE grid_device_type = 'Desktop'
ORDER BY grid_id$seed$)
    ,(35 , 'ui-table master', NULL, 'UI id'           , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_is_active,ui_tbl_device_type
	FROM fixed.ui_tables
WHERE ui_tbl_device_type='Desktop'
ORDER BY ui_tbl_id$seed$)
    ,(38 , 'MAIN LIST - UI TABLES', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	ui_tbl_id,
	ui_tbl_name,
	ui_tbl_device_type,
	ui_tbl_editable,
	ui_tbl_is_active
FROM fixed.ui_tables
WHERE ui_tbl_device_type = 'Desktop'
ORDER BY ui_tbl_id$seed$)
    ,(39 , 'cv', NULL, NULL              , 'Ascending' , 'web'    , false, true , 'system', NULL)
    ,(40 , 'Loyalty Scheme List', 'Promotion loyalty scheme list grid', 'Scheme'          , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT lsc.lsc_id, lsc.lsc_code, lsc.lsc_name, lsc.lsc_type, lsc.lsc_status, lsc.lsc_branch_id, lsc.lsc_start_date, lsc.lsc_end_date, lsc.lsc_is_active, (SELECT COUNT(*) FROM sales.loyalty_scheme_slab lss WHERE lss.lss_lsc_id = lsc.lsc_id AND lss.lss_is_deleted = false AND lss.lss_is_active = true) AS slabs_count, (SELECT COUNT(*) FROM sales.loyalty_scheme_gift lsg WHERE lsg.lsg_lsc_id = lsc.lsc_id AND lsg.lsg_is_deleted = false AND lsg.lsg_is_active = true) AS gifts_count, (SELECT COUNT(*) FROM sales.loyalty_scheme_party lsp WHERE lsp.lsp_lsc_id = lsc.lsc_id AND lsp.lsp_is_deleted = false AND lsp.lsp_is_active = true) AS parties_count, (SELECT COUNT(*) FROM sales.loyalty_scheme_item lsi WHERE lsi.lsi_lsc_id = lsc.lsc_id AND lsi.lsi_is_deleted = false AND lsi.lsi_is_active = true) AS items_count, (SELECT COUNT(*) FROM sales.loyalty_scheme_branch lsb WHERE lsb.lsb_lsc_id = lsc.lsc_id AND lsb.lsb_is_deleted = false AND lsb.lsb_is_active = true) AS branches_count FROM sales.loyalty_scheme lsc WHERE lsc.lsc_is_deleted = false AND lsc.lsc_comp_id = p_comp_id::uuid AND (NULLIF(p_branch_id, '') IS NULL OR lsc.lsc_branch_id = NULLIF(p_branch_id, '')::uuid) AND (NULLIF(p_status, '') IS NULL OR lsc.lsc_status = NULLIF(p_status, '')) AND (NULLIF(p_type, '') IS NULL OR lsc.lsc_type = NULLIF(p_type, '')) ORDER BY lsc.lsc_name, lsc.lsc_id$seed$)
    ,(41 , 'dropdown master', NULL, 'Id'              , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT dropdown_id, dropdown_name, dropdown_description, dropdown_sql, dropdown_sort_order, dropdown_sort_column, dropdown_completion, dropdown_sql_regional, dropdown_max_visible_items, dropdown_show_header, dropdown_width
	FROM fixed.dropdown_details$seed$)
    ,(42 , 'test', NULL, NULL              , 'Ascending' , 'web'    , false, true , 'system', NULL)
    ,(43 , 'MAIN LIST - DROPDOWN', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	dropdown_id,
	dropdown_name,
	dropdown_device_type, 
	dropdown_description,
	dropdown_max_visible_items
	
FROM
	fixed.dropdown_details
WHERE 
	dropdown_device_type = 'Desktop'
ORDER BY
	dropdown_id$seed$)
    ,(44 , 'tender master', NULL, 'tnd_name'        , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT
	TND.tnd_id,
	TND.tnd_name,
	TND.tnd_short_name,
	TTM.ttm_display_name AS tnd_type_name,
	TND.tnd_ledger_id,
	TND.tnd_min_amount,
	TND.tnd_max_amount,
	TND.tnd_surcharge_perc,
	TND.tnd_display_position,
	TND.tnd_is_active
FROM
	accounts.acc_tender_master TND
	LEFT JOIN accounts.acc_tender_types TTM ON TTM.ttm_type_id = TND.tnd_type_id
WHERE
	TND.tnd_is_deleted = wantdelete
ORDER BY
	TND.tnd_display_position, TND.tnd_name$seed$)
    ,(45 , 'MAIN LIST - ITEM UNIT', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	unit_id,
	unit_name,
	unit_code,
	unit_decimal_count,
	unit_weight,
	unit_is_active
FROM
	inventory.item_unit_master
WHERE
	unit_is_deleted = iunit_is_deleted
ORDER BY
	unit_name$seed$)
    ,(46 , 'widget master', NULL, 'Id'              , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT section_id,section_menu_id,section_name,section_position,section_platform
FROM fixed.form_section where section_platform=platform and section_menu_id=menuid$seed$)
    ,(47 , 'MENU SECTIONS MAIN LIST', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	section_id,
	section_menu_id,
	section_gui_name,
	section_position,
	section_visibility
FROM
	fixed.form_section
WHERE
	section_platform = 'Desktop'
	AND section_menu_id = COALESCE(NULLIF(isection_menu_id, '')::int, 0)
ORDER BY
	section_position$seed$)
    ,(48 , 'MAIN LIST - ITEM GROUPS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	itg_id,
	itg_name,
	itg_short,
	itg_description,
	itg_parent_id,
	itg_sort,
	itg_is_active
FROM inventory.item_group_master
WHERE itg_is_deleted = iitg_is_deleted
ORDER BY itg_name$seed$)
    ,(49 , 'MAIN LIST - ITEM BRAND', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	brand_id,
	brand_name,
	brand_short,
	brand_description,
	brand_sort,
	brand_is_active
FROM inventory.item_brand_master
WHERE brand_is_deleted = ibrand_is_deleted
ORDER BY brand_name$seed$)
    ,(50 , 'MAIN LIST - ITEM SECTION', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	sec_id,
	sec_short,
	sec_name,
	sec_description,
	sec_sort,
	sec_is_active
FROM inventory.item_section_master
WHERE sec_is_deleted = isec_is_deleted
ORDER BY sec_sort NULLS LAST, sec_name$seed$)
    ,(51 , 'MAIN LIST - ITEM CATEGORY', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	category_id,
	category_short,
	category_name,
	category_description,
	category_sort,
	category_is_active
FROM inventory.item_category_master
WHERE category_is_deleted = icategory_is_deleted
ORDER BY category_name$seed$)
    ,(52 , 'MAIN LIST - COMPANYS', NULL, NULL              , 'Ascending' , 'desktop', true , false, 'system', $seed$SELECT
        c.comp_id,
        c.comp_code,
        c.comp_name,
        c.comp_gstin_no,
        c.comp_state,
        (SELECT b.br_name FROM public.branch_master b
          WHERE b.br_comp_id = c.comp_id AND b.br_is_default
            AND NOT b.br_is_deleted LIMIT 1) AS main_branch,
        (SELECT count(*) FROM public.branch_master b
          WHERE b.br_comp_id = c.comp_id
            AND NOT b.br_is_deleted) AS branch_count,
        c.comp_is_active
FROM public.companys c
WHERE c.comp_is_deleted = icomp_is_deleted
ORDER BY c.comp_default DESC, c.comp_name ASC$seed$)
    ,(53 , 'MAIN LIST - ACCOUNT GROUP', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	GRP.acc_group_id,
	GRP.acc_group_short,
	GRP.acc_group_name,
	PRN.acc_group_name AS parent_group_name,
	GRP.acc_group_description,
	GRP.acc_group_sort,
	GRP.acc_group_type,
	GRP.acc_group_is_reserved
FROM
	accounts.acc_group_master GRP
	LEFT JOIN accounts.acc_group_master PRN ON PRN.acc_group_id = GRP.acc_group_parent_id
WHERE
	GRP.acc_group_is_deleted = false
ORDER BY
	GRP.acc_group_name$seed$)
    ,(54 , 'MAIN LIST - LEDGERS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    LM.led_id,
    LM.led_short,
    LM.led_name,
    AG.acc_group_name,
    LM.led_ledger_type,
    LM.led_gstin_no,
    LM.led_phone1,
    LM.led_city,
    LM.led_is_active
FROM accounts.acc_ledger_master LM
    INNER JOIN accounts.acc_group_master AG ON AG.acc_group_id = LM.led_group_id
WHERE
	LM.led_is_deleted = iled_is_deleted
ORDER BY
	LM.led_name$seed$)
    ,(55 , 'MAIN LIST - GODOWNS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    g.gdl_id,                        
    g.gdl_code,
    g.gdl_name,
    g.gdl_short,
    g.gdl_type,                      
    g.gdl_level,                     
    p.gdl_name AS parent_name,       
    g.gdl_is_active                  
FROM inventory.godown_locations g
LEFT JOIN inventory.godown_locations p
       ON p.gdl_id = g.gdl_parent_id
WHERE g.gdl_is_deleted = igdl_is_deleted
ORDER BY g.gdl_level ASC, g.gdl_sort ASC, g.gdl_name ASC$seed$)
    ,(56 , 'MAIN LIST - BRANCHES', NULL, NULL              , 'Ascending' , 'desktop', true , false, 'system', $seed$SELECT
    BR.br_id,
    CMP.comp_name,
    BR.br_code,
    BR.br_name,
    BR.br_short,
    BR.br_type,
    BR.br_city,
    BR.br_state,
    BR.br_phone,
    BR.br_is_default,
    BR.br_is_active
FROM public.branch_master BR
	INNER JOIN public.companys CMP ON CMP.comp_id = BR.br_comp_id
WHERE
	BR.br_is_deleted = ibr_is_deleted
ORDER BY CMP.comp_name, BR.br_is_default DESC, BR.br_name ASC$seed$)
    ,(57 , 'MAIN LIST - CUSTOMER STATES', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	stm_id,
	stm_name,
	stm_short,
	stm_order,
	stm_is_active
FROM sales.state_master
WHERE stm_is_deleted = istm_is_deleted
ORDER BY stm_name$seed$)
    ,(58 , 'MAIN LIST - CUSTOMER CITES', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	CM.ctm_id,
	CM.ctm_name,
	CM.ctm_short,
	SM.stm_name,
	CM.ctm_order,
	CM.ctm_is_active
FROM sales.city_master CM
	 INNER JOIN sales.state_master SM ON SM.stm_id = CM.ctm_state_id
WHERE CM.ctm_is_deleted = ictm_is_deleted
ORDER BY CM.ctm_name$seed$)
    ,(59 , 'MAIN LIST - CUSTOMER AREAS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	AM.arm_id,
	AM.arm_name,
	AM.arm_short,
	CM.ctm_name,
	AM.arm_sort,
	AM.arm_distance_km,
	AM.arm_is_active
FROM sales.area_master AM
	 INNER JOIN sales.city_master CM ON CM.ctm_id = AM.arm_city_id
WHERE AM.arm_is_deleted = iarm_is_deleted
ORDER BY AM.arm_name$seed$)
    ,(60 , 'Ledger shipping address', NULL, 'Name'            , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT saa_id, saa_ledger_id, saa_addr_type, saa_is_default, saa_sort, saa_trade_name
	FROM accounts.acc_ship_addrs where saa_is_deleted=wantdelete$seed$)
    ,(61 , 'MAIN LIST - SUPPLIER GROUPS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	spg_id,
	spg_name,
	spg_short,
	spg_desc,
	spg_is_active
FROM purchase.supplier_groups
WHERE spg_is_deleted = ispg_is_deleted
ORDER BY spg_name$seed$)
    ,(62 , 'MAIN LIST - COMPUTER USERS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    usr_id,
    usr_login_name,
    usr_full_name,
    usr_mobile_no,
    usr_type,
    usr_is_active,
    usr_is_locked,
    usr_last_login_on
FROM public.user_master
WHERE usr_is_deleted = false
ORDER BY usr_display_name$seed$)
    ,(63 , 'MAIN LIST - SUPPLIERS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    sup_id,
    sup_name,
    sup_gst_no,
    sup_gst_type,
    sup_city,
    sup_state_name,
    sup_phone,
    sup_credit_days,
    sup_is_active
FROM purchase.suppliers
WHERE sup_is_deleted = isup_is_deleted
ORDER BY sup_sort_order, sup_name$seed$)
    ,(65 , 'MAIN LIST - CUSTOMERS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	cus_id,
	cus_short,
	cus_name,
	cus_city,
	cus_phone1,
	cus_gst_no,
	cus_is_active
FROM sales.customers
WHERE cus_is_deleted = icus_is_deleted
ORDER BY cus_name$seed$)
    ,(66 , 'MAIN LIST - CUSTOMER GROUPS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	cgr_id,
	cgr_short,
	cgr_name,
	cgr_narration,
	cgr_order,
	cgr_is_active
FROM sales.cust_groups
WHERE cgr_is_deleted = icgr_is_deleted
ORDER BY cgr_name$seed$)
    ,(67 , 'MAIN LIST - ITEMS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	i.item_id,
	i.item_code,
	i.item_name_en,
	i.item_name_ta,
	i.item_default_barcode,
	g.itg_name AS group_name,
	b.brand_name,
	u.unit_name,
	i.item_hsn_code,
	t.tax_name AS gst_rate,
	i.item_is_active
FROM inventory.item_master i
	LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
	LEFT JOIN inventory.item_brand_master b ON b.brand_id = i.item_brand_id
	LEFT JOIN inventory.item_unit_master u ON u.unit_id = i.item_base_unit_id
	LEFT JOIN inventory.tax_rate_master t ON t.tax_id = i.item_default_tax_id
WHERE i.item_is_deleted = iitem_is_deleted
ORDER BY i.item_name_en$seed$)
    ,(68 , 'POPUP - UNITS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	unit_id,
	unit_name,
	unit_weight
FROM inventory.item_unit_master
WHERE unit_is_active = true AND unit_is_deleted = false
ORDER BY unit_name$seed$)
    ,(69 , 'POPUP - GODOWNS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	gdl_id,
	gdl_name
FROM inventory.godown_locations
WHERE gdl_is_active = true AND gdl_is_deleted = false
ORDER BY gdl_name$seed$)
    ,(70 , 'POPUP - BRANCH', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	br_id,
	br_name
FROM public.branch_master
WHERE br_is_active = true AND br_is_deleted = false
ORDER BY br_name$seed$)
    ,(71 , 'POPUP - ITEMS', 'Item picker for every voucher line grid. Scoped by the OPTIONAL iitem_company_id (strict) and iitem_branch_id (this branch or none, since an item with no branch belongs to the whole company). Callers MUST send both keys - the runner substitutes only what it is given, so a parameter absent from grid_param fails the query.', NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	IM.item_id,
	CM.iuc_id AS item_uom_id,
	IM.item_name_en,
	UM.unit_name
FROM inventory.item_master IM
	 INNER JOIN inventory.item_unit_conversion CM ON CM.iuc_item_id = IM.item_id
	        AND COALESCE(CM.iuc_is_deleted, false) = false
	 INNER JOIN inventory.item_unit_master UM ON UM.unit_id = CM.iuc_unit_id
	        AND UM.unit_is_deleted = false
WHERE IM.item_is_active = true AND IM.item_is_deleted = false
	AND (NULLIF(NULLIF('iitem_company_id', ''), 'iitem_company' || '_id') IS NULL
	     OR IM.item_company_id IS NULL
	     OR IM.item_company_id::text = lower(NULLIF(NULLIF('iitem_company_id', ''), 'iitem_company' || '_id')))
	AND (NULLIF(NULLIF('iitem_branch_id', ''), 'iitem_branch' || '_id') IS NULL
	     OR IM.item_branch_id IS NULL
	     OR IM.item_branch_id::text = lower(NULLIF(NULLIF('iitem_branch_id', ''), 'iitem_branch' || '_id')))
ORDER BY IM.item_name_en$seed$)
    ,(72 , 'POPUP - COMPANYS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	comp_id, 
	comp_name
FROM public.companys
WHERE comp_is_active = true AND comp_is_deleted = false
ORDER BY comp_id$seed$)
    ,(73 , 'MAIN LIST - EMP DEPARTMENTS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	edpt_id,
	edpt_code,
	edpt_name,
	edpt_remarks
FROM public.employee_departments
WHERE edpt_is_deleted = iedpt_is_deleted
ORDER BY edpt_name$seed$)
    ,(74 , 'MAIN LIST - FREIGHT CHARGES', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	FM.fr_id,
	BM.br_name,
	CM.comp_name,
	FM.fr_from_km,
	FM.fr_to_km,
	FM.fr_from_weight,
	FM.fr_to_weight,
	FM.fr_freight_chrg,
	FM.fr_is_active
FROM sales.sale_freight_charges FM
	 LEFT JOIN public.branch_master BM ON BM.br_id = FM.fr_branch_id
	 LEFT JOIN public.companys CM ON CM.comp_id = FM.fr_company_id
WHERE FM.fr_is_deleted = ifr_is_deleted
  AND (NULLIF('ifr_branch_id', '') IS NULL OR FM.fr_branch_id::text = 'ifr_branch_id')
ORDER BY FM.fr_company_id, FM.fr_branch_id, FM.fr_from_km, FM.fr_from_weight$seed$)
    ,(75 , 'MAIN LIST - EMP DESIGNATIONS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	ed_id,
	ed_code,
	ed_name,
	ed_remarks,
	ed_is_active
FROM public.employee_designations
WHERE ed_is_deleted = ied_is_deleted
ORDER BY ed_name$seed$)
    ,(76 , 'MAIN LIST - LOADING CHARGES', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	LC.ilc_id,
	CM.comp_name,
	BM.br_name,
	LC.ilc_from_weight,
	LC.ilc_to_weight,
	LC.ilc_load_chrg,
	LC.ilc_unload_chrg,
	LC.ilc_is_active
FROM sales.sale_loading_charges LC
	 LEFT JOIN public.companys CM ON CM.comp_id = LC.ilc_comp_id
	 LEFT JOIN public.branch_master BM ON BM.br_id = LC.ilc_branch_id
WHERE LC.ilc_is_deleted = iilc_is_deleted
ORDER BY LC.ilc_comp_id, LC.ilc_branch_id, LC.ilc_from_weight$seed$)
    ,(77 , 'MAIN LIST - EMPLOYEES', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    e.emp_id,
    e.emp_code,
    e.emp_name,
    e.emp_mobile1,
    d.edpt_name              AS department,
    g.ed_name                AS designation,
    e.emp_status
FROM public.employee_master e
INNER JOIN public.employee_departments  d ON d.edpt_id = e.emp_department_id
LEFT JOIN public.employee_designations g ON g.ed_id   = e.emp_designation_id
WHERE e.emp_is_deleted = iemp_is_deleted
ORDER BY e.emp_name$seed$)
    ,(78 , 'POPUP - PRICE LEVELS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	ipl_id,
	ipl_name
FROM inventory.item_price_levels
WHERE ipl_status = true
ORDER BY ipl_id$seed$)
    ,(79 , 'POPUP - CUSTOMERS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	cus_id,
	cus_name,
	cus_short
FROM sales.customers
WHERE cus_is_active = true AND cus_is_deleted = false
ORDER BY cus_name$seed$)
    ,(80 , 'charge master', NULL, '#'               , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT chg_id, chg_name, chg_code, chg_module, chg_role, chg_method, chg_type, chg_apply_on, chg_default_rate, chg_landing_cost, chg_cost_alloc, chg_ledger_code, chg_tax_apl, chg_before_tax, chg_sep_post, chg_man_party, chg_disp_order, chg_auto_apply
	FROM public.charge_master$seed$)
    ,(81 , 'CHARGES MAIN LIST', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    c.chg_id,                                    
    CASE c.chg_module
        WHEN 'P' THEN 'Purchase'
        WHEN 'S' THEN 'Sales'
        WHEN 'B' THEN 'Both'
        ELSE c.chg_module
    END AS chg_module,	
    c.chg_code,
    c.chg_name,
    c.chg_role,
    c.chg_method,
    c.chg_type,
    c.chg_default_rate,
    l.led_name,
    c.chg_auto_apply,
    c.chg_disp_order,
    c.chg_is_active
FROM public.charge_master c
INNER JOIN accounts.acc_ledger_master l
       ON l.led_id = c.chg_ledger_code
 
ORDER BY c.chg_module, c.chg_disp_order, c.chg_name$seed$)
    ,(82 , 'POPUP - CHARGE MASTER', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	chg_id,
	chg_name
FROM public.charge_master
WHERE chg_is_active = true
	AND chg_is_deleted = false
	AND chg_module IN ('B', 'imodule_name')
ORDER BY chg_name$seed$)
    ,(83 , 'TXN MAIN LIST - QUOTATION', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
       q.sq_id,
       q.sq_company_id,
       q.sq_branch_id,
       q.sq_acc_year,
       q.sq_quote_date,
       q.sq_quote_refno,
       q.sq_usr_refno,
       q.sq_cust_name,
       q.sq_cust_phone,
       q.sq_valid_until,
       q.sq_tot_items,
       q.sq_quote_amt,
       q.sq_status,
       q.sq_created_by,
       q.sq_is_deleted,
       q.sq_converted_doc_id
  FROM sales.sale_quotation q

 WHERE q.sq_company_id = 'icompany_id'::uuid
  AND q.sq_branch_id  = 'ibranch_id'::uuid
  AND q.sq_acc_year   = 'iacc_year'

   
   
  AND (NULLIF('ifrom_date', '') IS NULL OR q.sq_quote_date >= 'ifrom_date'::date)
  AND (NULLIF('ito_date',   '') IS NULL OR q.sq_quote_date <= 'ito_date'::date)

ORDER BY q.sq_quote_date DESC, q.sq_quote_slno DESC$seed$)
    ,(84 , 'Quotation', NULL, '#'               , 'Ascending' , 'web'    , true , false, 'system', $seed$SELECT     
    q.sq_id,
    q.sq_company_id,
    q.sq_branch_id,
    q.sq_acc_year,    
    q.sq_quote_date,
    q.sq_quote_refno,
    q.sq_usr_refno,
    q.sq_cust_name,
    q.sq_cust_place,
    q.sq_cust_gstin,
    q.sq_cust_phone,
    q.sq_valid_until,
    q.sq_tot_items,
    q.sq_tot_bags,
    q.sq_quote_amt,
    q.sq_status,
    q.sq_created_by,       
    q.sq_is_deleted,
    q.sq_converted_doc_id
FROM sales.sale_quotation q
 WHERE q.sq_company_id = 'icompany_id'::uuid
  AND q.sq_branch_id  = 'ibranch_id'::uuid
  AND q.sq_acc_year   = 'iacc_year' 
   AND (NULLIF('ifrom_date', '') IS NULL OR q.sq_quote_date >= 'ifrom_date'::date)
  AND (NULLIF('ito_date',   '') IS NULL OR q.sq_quote_date <= 'ito_date'::date)
ORDER BY q.sq_quote_date DESC, q.sq_quote_slno DESC$seed$)
    ,(85 , 'MAIN LIST - TENDERS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
     
    tm.tnd_id,

     
    tm.tnd_display_position,
    tm.tnd_name,
    tm.tnd_short_name,
    tt.ttm_display_name              AS tnd_type_name,

    tm.tnd_min_amount,
    tm.tnd_max_amount,
    tm.tnd_daily_limit,
	
    tm.tnd_open_cash_drawer,
    c.comp_name                      AS tnd_company_name,
    b.br_name                        AS tnd_branch_name,
    tm.tnd_is_active

FROM accounts.acc_tender_master tm
JOIN accounts.acc_tender_types  tt ON tt.ttm_type_id = tm.tnd_type_id
JOIN accounts.acc_ledger_master l  ON l.led_id       = tm.tnd_ledger_id

 
 
LEFT JOIN public.companys            c  ON c.comp_id  = tm.tnd_company_id
LEFT JOIN public.branch_master       b  ON b.br_id    = tm.tnd_branch_id

WHERE tm.tnd_is_deleted = itnd_is_deleted::boolean
ORDER BY tm.tnd_display_position, tm.tnd_name$seed$)
    ,(86 , 'TXN MAIN LIST - BILLS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
       b.sb_id,
       b.sb_company_id,
       b.sb_branch_id,
       b.sb_acc_year,
       b.sb_bill_date,
       b.sb_bill_refno,
       b.sb_bill_type,
       c.cus_name,
       b.sb_tot_items,
       b.sb_bill_amt,
       b.sb_status,
       b.sb_print_count,
       b.sb_created_by
  FROM
	sales.sale_bill b
	INNER JOIN sales.customers c on c.cus_id = b.sb_cust_id
 WHERE
 	b.sb_company_id = 'icompany_id'::uuid
  	AND b.sb_branch_id  = 'ibranch_id'::uuid
  	AND b.sb_acc_year   = 'iacc_year'
  	AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date >= 'ifrom_date'::date)
  	AND (NULLIF('ito_date',   '') IS NULL OR b.sb_bill_date <= 'ito_date'::date)
ORDER BY
	b.sb_bill_date DESC, b.sb_bill_slno DESC$seed$)
    ,(87 , 'TXN MAIN LIST - SALES ORDER', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	b.so_id,
	b.so_company_id,
	b.so_branch_id,
	b.so_acc_year,
	b.so_order_date,
	b.so_order_refno,
	b.so_order_type,
	c.cus_name,
	c.cus_addr3,
	b.so_tot_items,
	b.so_order_amt,
	b.so_status,
	b.so_print_count,
	b.so_created_by
FROM
	sales.sale_order b
	INNER JOIN sales.customers c on c.cus_id = b.so_cust_id
 WHERE
 	b.so_company_id = 'icompany_id'::uuid
  	AND b.so_branch_id  = 'ibranch_id'::uuid
  	 
  	AND (NULLIF('ifrom_date', '') IS NULL OR b.so_order_date >= 'ifrom_date'::date)
  	AND (NULLIF('ito_date',   '') IS NULL OR b.so_order_date <= 'ito_date'::date)
ORDER BY
	b.so_order_date DESC, b.so_order_slno DESC$seed$)
    ,(88 , 'POPUP - CUST AREAS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	arm_id,
	arm_short,
	arm_name,
	arm_alias
FROM sales.area_master
WHERE arm_is_active = true AND arm_is_deleted = false
ORDER BY arm_name$seed$)
    ,(89 , 'POPUP - CUST CITIES', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	ctm_id,
	ctm_short,
	ctm_name,
	ctm_alias
FROM sales.city_master
WHERE ctm_is_active = true AND ctm_is_deleted = false
ORDER BY ctm_name$seed$)
    ,(90 , 'POPUP - ITEM GROUPS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	itg_id,
	itg_short,
	itg_name,
	itg_alias
FROM inventory.item_group_master
WHERE itg_is_active = true AND itg_is_deleted = false
ORDER BY itg_name$seed$)
    ,(91 , 'POPUP - ITEM BRANDS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	brand_id,
	brand_short,
	brand_name,
	brand_alias
FROM inventory.item_brand_master
WHERE brand_is_active = true AND brand_is_deleted = false
ORDER BY brand_name$seed$)
    ,(92 , 'POPUP - ITEM CATEGORY', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	category_id,
	category_short,
	category_name,
	category_alias
FROM inventory.item_category_master
WHERE category_is_active = true AND category_is_deleted = false
ORDER BY category_name$seed$)
    ,(93 , 'POPUP - ITEM SECTIONS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	sec_id,
	sec_short,
	sec_name,
	sec_alias
FROM inventory.item_section_master
WHERE sec_is_active = true AND sec_is_deleted = false
ORDER BY sec_name$seed$)
    ,(94 , 'POPUP - CUST GROUPS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	cgr_id, 
	cgr_short,
	cgr_name, 
	cgr_alias
FROM sales.cust_groups
WHERE cgr_is_active = true AND cgr_is_deleted = false
ORDER BY cgr_name$seed$)
    ,(95 , 'MAIN LIST - PROMOTION SCHEMES', 'Promotion scheme master list (menu 247). Filter param: iprm_state = RUNNING|INACTIVE|EXPIRED|DELETED.', NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    pm.prm_id,
    pm.prm_code,
    pm.prm_name,
    CASE
        WHEN pm.prm_status = 'DRAFT'                  THEN 'Draft'
        WHEN pm.prm_status = 'SUSPENDED'              THEN 'Suspended'
        WHEN pm.prm_status = 'CLOSED'                 THEN 'Closed'
        WHEN pm.prm_is_active = false                 THEN 'Inactive'
        WHEN pm.prm_start_date > CURRENT_DATE         THEN 'Scheduled'
        WHEN pm.prm_end_date   < CURRENT_DATE         THEN 'Expired'
        ELSE 'Running'
    END                                        AS prm_state,
	
    pm.prm_status,
    pm.prm_apply_on || ' × ' || pm.prm_benefit AS prm_offer,
    pm.prm_priority,
    pm.prm_stack_mode,
    pm.prm_start_date,
    pm.prm_end_date,
	
    CASE WHEN pm.prm_valid_from_time IS NULL THEN NULL
         ELSE substring(pm.prm_valid_from_time::text, 1, 5)
              || ' - ' || substring(pm.prm_valid_to_time::text, 1, 5)
    END                                        AS prm_time_window,
    pm.prm_valid_weekdays,

     
    CASE WHEN pm.prm_branch_scope = 'ALL' THEN 'All'
         ELSE (SELECT count(*)::text FROM sales.promotion_scheme_branch b
                WHERE b.prb_prm_id = pm.prm_id AND b.prb_is_deleted = false)
    END                                        AS prm_branch_count,
    CASE WHEN pm.prm_cust_scope = 'ALL' THEN 'All'
         ELSE (SELECT count(*)::text FROM sales.promotion_scheme_party p
                WHERE p.prp_prm_id = pm.prm_id AND p.prp_is_deleted = false)
    END                                        AS prm_cust_count,
    CASE WHEN pm.prm_item_scope = 'ALL' THEN 'All'
         ELSE (SELECT count(*)::text FROM sales.promotion_scheme_item i
                WHERE i.pri_prm_id = pm.prm_id AND i.pri_is_deleted = false)
    END                                        AS prm_item_count,
     
     
    (SELECT count(*) FROM sales.promotion_scheme_slab s
      WHERE s.prs_prm_id = pm.prm_id AND s.prs_is_deleted = false)
                                               AS prm_band_count,

     
    NULLIF(pm.prm_budget_amount,        0)     AS prm_budget_amount,
    NULLIF(pm.prm_max_benefit_per_bill, 0)     AS prm_max_benefit_per_bill,
    NULLIF(pm.prm_max_uses_total,       0)     AS prm_max_uses_total,
    NULLIF(pm.prm_max_uses_per_cust,    0)     AS prm_max_uses_per_cust,

     
    c.comp_name                                AS prm_company_name,
     
    COALESCE(b.br_name, 'All branches')        AS prm_branch_name,

    pm.prm_remarks,
    pm.prm_is_active

FROM sales.promotion_scheme pm

LEFT JOIN public.companys      c ON c.comp_id = pm.prm_comp_id
LEFT JOIN public.branch_master b ON b.br_id   = pm.prm_branch_id

WHERE (
        (iprm_state = 'DELETED' AND pm.prm_is_deleted = true)
     OR (iprm_state <> 'DELETED' AND pm.prm_is_deleted = false
         AND (
                (iprm_state = 'RUNNING'
                     AND pm.prm_is_active = true
                     AND pm.prm_end_date >= CURRENT_DATE)
             OR (iprm_state = 'EXPIRED'  AND pm.prm_end_date < CURRENT_DATE)
             OR (iprm_state = 'INACTIVE' AND pm.prm_is_active = false)
         ))
      )
ORDER BY pm.prm_start_date DESC, pm.prm_name$seed$)
    ,(96 , 'HELD DOCUMENTS PICKER', 'Parked documents from public.txn_hold, for the Hold/Pick Held picker on the transaction entry screens.', 'txh_hold_on'     , 'desc'      , 'Desktop', true , false, 'system', $seed$SELECT
    h.txh_id,
    h.txh_company_id,
    h.txh_branch_id,
    h.txh_acc_year,

    h.txh_hold_on,
    h.txh_hold_no,
    h.txh_party_name,
    h.txh_party_mobile,
    h.txh_ref_label,
    h.txh_item_count,
    h.txh_total_qty,
    h.txh_net_amount,
    h.txh_status,
    h.txh_hold_reason,
    h.txh_remarks,
    h.txh_resume_count,
    h.txh_expires_on,

    u.usr_display_name AS txh_held_by_name,

    h.txh_locked_by,
    h.txh_lock_expires_on,
    h.txh_device_id

FROM public.txn_hold h
LEFT JOIN public.user_master u ON u.usr_id = h.txh_held_by

WHERE h.txh_is_deleted = false
  AND h.txh_kind       = 'HOLD'
  AND h.txh_status     IN ('HELD', 'LOCKED')
  AND h.txh_company_id = 'icompany_id'::uuid
  AND h.txh_branch_id  = 'ibranch_id'::uuid
  AND h.txh_acc_year   = 'iacc_year'
  AND h.txh_doc_type   = 'idoc_type'
  AND (h.txh_expires_on IS NULL OR h.txh_expires_on > now())
  AND (NULLIF('ifrom_date', '') IS NULL OR h.txh_hold_on::date >= 'ifrom_date'::date)
  AND (NULLIF('ito_date',   '') IS NULL OR h.txh_hold_on::date <= 'ito_date'::date)

ORDER BY h.txh_hold_on DESC$seed$)
    ,(97 , 'MAIN LIST - LOYALTY SCHEMES', 'Loyalty point schemes, their scope, earn bands and gifts.', 'lsc_start_date'  , 'desc'      , 'Desktop', true , false, 'system', $seed$SELECT
    ls.lsc_id,
    ls.lsc_code,
    ls.lsc_name,
    CASE
        WHEN ls.lsc_status = 'DRAFT'          THEN 'Draft'
        WHEN ls.lsc_status = 'SUSPENDED'      THEN 'Suspended'
        WHEN ls.lsc_status = 'CLOSED'         THEN 'Closed'
        WHEN ls.lsc_is_active = false         THEN 'Inactive'
        WHEN ls.lsc_start_date > CURRENT_DATE THEN 'Scheduled'
        WHEN ls.lsc_end_date   < CURRENT_DATE THEN 'Expired'
        ELSE 'Running'
    END                                        AS lsc_state,

    ls.lsc_status,
    ls.lsc_type,
    ls.lsc_apply_on || ' / ' || ls.lsc_calc_on_amount_type AS lsc_earn_on,
    ls.lsc_priority,
    ls.lsc_start_date,
    ls.lsc_end_date,

    CASE WHEN ls.lsc_valid_from_time IS NULL THEN NULL
         ELSE substring(ls.lsc_valid_from_time::text, 1, 5)
              || ' - ' || substring(ls.lsc_valid_to_time::text, 1, 5)
    END                                        AS lsc_time_window,
    ls.lsc_valid_weekdays,

    CASE WHEN ls.lsc_branch_scope = 'ALL' THEN 'All'
         ELSE (SELECT count(*)::text FROM sales.loyalty_scheme_branch b
                WHERE b.lsb_lsc_id = ls.lsc_id AND b.lsb_is_deleted = false)
    END                                        AS lsc_branch_count,
    CASE WHEN ls.lsc_cust_scope = 'ALL' THEN 'All'
         ELSE (SELECT count(*)::text FROM sales.loyalty_scheme_party p
                WHERE p.lsp_lsc_id = ls.lsc_id AND p.lsp_is_deleted = false)
    END                                        AS lsc_cust_count,
    CASE WHEN ls.lsc_item_scope = 'ALL' THEN 'All'
         ELSE (SELECT count(*)::text FROM sales.loyalty_scheme_item i
                WHERE i.lsi_lsc_id = ls.lsc_id AND i.lsi_is_deleted = false)
    END                                        AS lsc_item_count,

    (SELECT count(*) FROM sales.loyalty_scheme_slab s
      WHERE s.lss_lsc_id = ls.lsc_id AND s.lss_is_deleted = false)
                                               AS lsc_slab_count,
    (SELECT count(*) FROM sales.loyalty_scheme_gift g
      WHERE g.lsg_lsc_id = ls.lsc_id AND g.lsg_is_deleted = false)
                                               AS lsc_gift_count,

    ls.lsc_allow_point_redeem,
    ls.lsc_allow_gift_redeem,
    NULLIF(ls.lsc_redeem_value_per_point, 0)   AS lsc_redeem_value_per_point,
    NULLIF(ls.lsc_max_earn_points,        0)   AS lsc_max_earn_points,
    ls.lsc_expiry_basis,
    NULLIF(ls.lsc_points_valid_days,      0)   AS lsc_points_valid_days,

    c.comp_name                                AS lsc_company_name,
    COALESCE(b.br_name, 'All branches')        AS lsc_branch_name,

    ls.lsc_remarks,
    ls.lsc_is_active

FROM sales.loyalty_scheme ls

LEFT JOIN public.companys      c ON c.comp_id = ls.lsc_comp_id
LEFT JOIN public.branch_master b ON b.br_id   = ls.lsc_branch_id

WHERE (
        (ilsc_state = 'DELETED' AND ls.lsc_is_deleted = true)
     OR (ilsc_state <> 'DELETED' AND ls.lsc_is_deleted = false
         AND (
                (ilsc_state = 'RUNNING'
                     AND ls.lsc_is_active = true
                     AND ls.lsc_end_date >= CURRENT_DATE)
             OR (ilsc_state = 'EXPIRED'  AND ls.lsc_end_date < CURRENT_DATE)
             OR (ilsc_state = 'INACTIVE' AND ls.lsc_is_active = false)
         ))
      )
ORDER BY ls.lsc_start_date DESC, ls.lsc_name$seed$)
    ,(98 , 'MAIN LIST - TRACKING PRESETS', 'Stock tracking presets (stock.stock_track_preset) - shared and company rows merged, a company code hiding the shared one', 'spt_sort_order'  , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
       s.spt_id,
       s.spt_code,
       s.spt_name,
       s.spt_description,
       CASE WHEN s.spt_company_id IS NULL THEN 'Shared' ELSE 'Own' END
                                               AS spt_scope,
       s.spt_track_signature,
       CASE WHEN s.spt_track_signature = 'N' THEN 'Nothing (one holding)'
         ELSE concat_ws(', ',
                CASE WHEN s.spt_track_batch      THEN 'Batch'    END,
                CASE WHEN s.spt_track_mrp        THEN 'MRP'      END,
                CASE WHEN s.spt_track_sale_price THEN 'Sale Price' END,
                CASE WHEN s.spt_track_expiry     THEN 'Expiry'   END,
                CASE WHEN s.spt_track_serial     THEN 'Serial'   END,
                CASE WHEN s.spt_track_supplier   THEN 'Supplier' END)
    END                                        AS spt_tracked_by,
       s.spt_valuation_method,
       s.spt_issue_strategy,
       s.spt_near_expiry_days,
       s.spt_block_expired_sale,
       (SELECT count(*)
       FROM stock.stock_track_policy p
      WHERE p.stp_track_signature = s.spt_track_signature
        AND p.stp_is_deleted = false
        AND (q.company_id IS NULL OR p.stp_company_id = q.company_id))
                                               AS spt_policy_count,
       s.spt_remarks,
       s.spt_is_active
  FROM stock.stock_track_preset s
CROSS JOIN (SELECT NULLIF(ispt_company_id, '')::uuid AS company_id) q
LEFT JOIN public.companys c ON c.comp_id = s.spt_company_id
WHERE s.spt_is_deleted = ispt_is_deleted::boolean
  AND (
        s.spt_company_id = q.company_id
     OR (s.spt_company_id IS NULL
         AND (
               ispt_is_deleted::boolean = true
            OR NOT EXISTS (SELECT 1
                             FROM stock.stock_track_preset o
                            WHERE o.spt_company_id = q.company_id
                              AND o.spt_code       = s.spt_code
                              AND o.spt_is_deleted = false)
         ))
      )
ORDER BY s.spt_sort_order, s.spt_name$seed$)
    ,(99 , 'MAIN LIST - OPENING STOCK', 'Opening stock documents (stock.stock_voucher WHERE svh_voucher_type = ''OPENING'') for one company/branch/acc-year. Totals are read from the header, which fn_svi_refresh_header maintains - the lines are never aggregated here. A CANCELLED voucher stays in the list; only a soft-deleted DRAFT disappears.', NULL              , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT
       v.svh_id,
       v.svh_company_id,
       v.svh_branch_id,
       v.svh_acc_year,
       v.svh_refno,
       v.svh_usr_refno,
       v.svh_doc_date,
       g.gdl_name                         AS godown_name,
       v.svh_line_count,
       v.svh_total_qty,
       v.svh_total_value,
       v.svh_status
  FROM stock.stock_voucher v
  LEFT JOIN inventory.godown_locations g ON g.gdl_id = v.svh_to_godown_id
 WHERE v.svh_company_id   = isvh_company_id::uuid
   AND v.svh_branch_id    = isvh_branch_id::uuid
   AND v.svh_acc_year     = isvh_acc_year::bpchar
   AND v.svh_voucher_type = 'OPENING'
   AND v.svh_is_deleted   = false
   AND (NULLIF(isvh_status, '') IS NULL OR v.svh_status = isvh_status)
   AND (v.svh_doc_date >= NULLIF(isvh_from_date, '')::date OR NULLIF(isvh_from_date, '') IS NULL)
   AND (v.svh_doc_date <= NULLIF(isvh_to_date,   '')::date OR NULLIF(isvh_to_date,   '') IS NULL)
 ORDER BY v.svh_doc_date DESC, v.svh_slno DESC$seed$)
    ,(100, 'POPUP - SUPPLIERS', NULL, NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT sup_id, sup_name, sup_short
FROM purchase.suppliers
WHERE sup_is_active = true AND sup_is_deleted = false
ORDER BY sup_name$seed$)
    ,(101, 'MAIN LIST - PHYSICAL STOCK', 'Physical stock count sheets (svh_voucher_type = ''PHYSICAL'').', 'svh_doc_date'    , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT
       v.svh_id,
       v.svh_company_id,
       v.svh_branch_id,
       v.svh_acc_year,
       v.svh_refno,
       v.svh_doc_date,
       g.gdl_name                         AS godown_name,
       (SELECT count(*)
          FROM stock.stock_voucher_item i
         WHERE i.svi_voucher_id = v.svh_id
           AND i.svi_acc_year   = v.svh_acc_year
           AND i.svi_is_deleted = false)  AS svh_line_count,
       (SELECT count(*)
          FROM stock.stock_voucher_item i
         WHERE i.svi_voucher_id = v.svh_id
           AND i.svi_acc_year   = v.svh_acc_year
           AND i.svi_is_deleted = false
           AND COALESCE(i.svi_diff_qty, 0) <> 0) AS variance_lines,
       (SELECT COALESCE(sum(i.svi_diff_qty), 0)
          FROM stock.stock_voucher_item i
         WHERE i.svi_voucher_id = v.svh_id
           AND i.svi_acc_year   = v.svh_acc_year
           AND i.svi_is_deleted = false)  AS net_variance_qty,
       (SELECT COALESCE(sum(l.sml_signed_base_qty * l.sml_cost_rate), 0)
          FROM stock.stock_ledger l
         WHERE l.sml_src_doc_id  = v.svh_id
           AND l.sml_acc_year    = v.svh_acc_year
           AND l.sml_is_deleted  = false
           AND l.sml_is_reversal = false) AS net_variance_value,
       v.svh_status,
       v.svh_freeze_stock,
       r.srm_name                         AS reason_name
  FROM stock.stock_voucher v
  LEFT JOIN inventory.godown_locations g ON g.gdl_id = v.svh_to_godown_id
  LEFT JOIN stock.stock_reason_master  r ON r.srm_id = v.svh_reason_id
 WHERE v.svh_company_id   = isvh_company_id::uuid
   AND v.svh_branch_id    = isvh_branch_id::uuid
   AND v.svh_acc_year     = isvh_acc_year::bpchar
   AND v.svh_voucher_type = 'PHYSICAL'
   AND v.svh_is_deleted   = false
   AND (NULLIF(isvh_status, '') IS NULL OR v.svh_status = isvh_status)
   AND (v.svh_doc_date >= NULLIF(isvh_from_date, '')::date OR NULLIF(isvh_from_date, '') IS NULL)
   AND (v.svh_doc_date <= NULLIF(isvh_to_date,   '')::date OR NULLIF(isvh_to_date,   '') IS NULL)
 ORDER BY v.svh_doc_date DESC, v.svh_slno DESC$seed$)
    ,(102, 'POPUP - STOCK REASONS', 'Reason picker for a physical count line (svi_reason_id).', 'srm_name'        , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT srm_id,
       srm_name,
       srm_code,
       srm_direction
  FROM stock.stock_reason_master
 WHERE srm_is_active = true
   AND srm_is_deleted = false
   AND (srm_allowed_txn_types = '{}'
        OR srm_allowed_txn_types && ARRAY['PHYSICAL_PLUS','PHYSICAL_MINUS'])
 ORDER BY srm_sort_order, srm_name$seed$)
    ,(103, 'MAIN LIST - GST RATES', 'GST rates with their cess and override count', NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
	t.tax_id,
	t.tax_name,
	t.tax_code,
	t.tax_taxability, 
	t.tax_rate_perc,
	t.tax_cgst_perc,
	t.tax_sgst_perc,
	t.tax_igst_perc,
	t.tax_cess_basis,
	t.tax_cess_perc,
	t.tax_acess_basis,
	(SELECT count(*) FROM inventory.tax_rate_ledger x WHERE x.trl_tax_id = t.tax_id AND x.trl_is_active AND NOT x.trl_is_deleted) AS ledger_overrides,
	s.tax_name AS supersedes_name,
	t.tax_is_active
FROM inventory.tax_rate_master t
	 LEFT JOIN inventory.tax_rate_master s ON s.tax_id = t.tax_supersedes_id
WHERE NOT t.tax_is_deleted
	AND (NOT itax_is_active OR t.tax_is_active)
ORDER BY t.tax_sort_order, t.tax_name$seed$)
    ,(104, 'POPUP - POSTING ROLES', 'Role picker for the Ledgers tab of the GST rate master (tax_rate_ledger.trl_role). Only roles whose alr_by_rate is true.', 'alr_sort_order'  , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT alr_role,
       alr_label,
       alr_group,
       alr_by_supply
  FROM accounts.acc_ledger_role
 WHERE alr_is_active
   AND alr_by_rate
 ORDER BY alr_sort_order, alr_label$seed$)
    ,(105, 'POPUP - LEDGERS FOR ROLE', 'Ledger picker for the Ledgers tab of the GST rate master, filtered by the row''s posting role (itrl_role). Same rule as dropdown 51.', 'led_name'        , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT l.led_id,
       l.led_name,
       l.led_short,
       g.acc_group_name,
       l.led_ledger_type
  FROM accounts.acc_ledger_master l
  LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
  JOIN accounts.acc_ledger_role r ON r.alr_role = itrl_role
 WHERE l.led_is_active
   AND NOT l.led_is_deleted
   AND l.led_company_id IS NULL
   AND (r.alr_want_type   IS NULL OR l.led_ledger_type    = r.alr_want_type)
   AND (r.alr_want_duty   IS NULL OR l.led_gst_duty_head  = r.alr_want_duty)
   AND (r.alr_want_nature IS NULL OR g.acc_group_nature   = r.alr_want_nature)
 ORDER BY l.led_name$seed$)
    ,(106, 'SETUP - POSTING LEDGER MAP', 'Every active posting role with its current global mapping, local and interstate. One row per role — the Posting Ledgers screen (accounts.acc_ledger_map) builds itself from this.', 'alr_sort_order'  , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT r.alr_role,
       r.alr_label,
       r.alr_group,
       r.alr_sort_order,
       r.alr_by_supply,
       loc.alm_id         AS local_map_id,
       loc.alm_ledger_id  AS local_ledger_id,
       ll.led_name        AS local_ledger_name,
       intr.alm_id        AS inter_map_id,
       intr.alm_ledger_id AS inter_ledger_id,
       il.led_name        AS inter_ledger_name
  FROM accounts.acc_ledger_role r
  LEFT JOIN LATERAL (
        SELECT m.* FROM accounts.acc_ledger_map m
         WHERE m.alm_role = r.alr_role AND NOT m.alm_is_deleted AND m.alm_is_active
           AND m.alm_company_id IS NULL AND m.alm_branch_id IS NULL
           AND (m.alm_supply_nature IS NULL OR m.alm_supply_nature = 'INTRA')
         ORDER BY m.alm_supply_nature NULLS FIRST LIMIT 1) loc ON true
  LEFT JOIN accounts.acc_ledger_master ll ON ll.led_id = loc.alm_ledger_id
  LEFT JOIN LATERAL (
        SELECT m.* FROM accounts.acc_ledger_map m
         WHERE m.alm_role = r.alr_role AND NOT m.alm_is_deleted AND m.alm_is_active
           AND m.alm_company_id IS NULL AND m.alm_branch_id IS NULL
           AND m.alm_supply_nature = 'INTER' LIMIT 1) intr ON true
  LEFT JOIN accounts.acc_ledger_master il ON il.led_id = intr.alm_ledger_id
 WHERE r.alr_is_active
 ORDER BY r.alr_sort_order, r.alr_label$seed$)
    ,(107, 'POPUP - LEDGERS', 'Balance-sheet ledgers for the Opening Balances picker (menu 55)', 'led_name'        , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT l.led_id,
       l.led_name,
       g.acc_group_name,
       g.acc_group_nature,
       CASE WHEN l.led_is_bill_by_bill THEN 'Bill-wise' ELSE '' END AS bill_wise
  FROM accounts.acc_ledger_master l
  INNER JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
 WHERE l.led_is_active = true
   AND l.led_is_deleted = false
   AND g.acc_group_nature IN ('Assets','Liabilities')
   AND (l.led_company_id IS NULL
        OR l.led_company_id = NULLIF('iled_company_id','')::uuid)
 ORDER BY l.led_name$seed$)
    ,(108, 'MAIN LIST - RECEIPTS', 'Receipt vouchers for a company / branch / year. PDC vouchers are excluded — they show under their receipt.', 'Date'            , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT
       h.avh_voucher_id,
       h.avh_company_id,
       h.avh_branch_id,
       h.avh_acc_year,
       h.avh_voucher_refno,
       h.avh_voucher_date,
       p.led_name                       AS party_name,
       h.avh_doc_amount,
       h.avh_adjust_amount,
       (h.avh_doc_amount - h.avh_adjust_amount) AS on_account_amount,
       (SELECT string_agg(DISTINCT t.ttm_display_name, ', ' ORDER BY t.ttm_display_name)
          FROM accounts.acc_tender_detail d
          JOIN accounts.acc_tender_types  t ON t.ttm_type_id = d.td_tender_type_id
         WHERE d.td_src_doc_id = h.avh_voucher_id
           AND d.td_acc_year   = h.avh_acc_year
           AND d.td_is_deleted = false)  AS instruments,
       (SELECT count(*)
          FROM accounts.acc_pdc_register r
         WHERE r.apd_voucher_acc_year = h.avh_acc_year
           AND r.apd_is_deleted = false
           AND r.apd_voucher_id IN (
                 SELECT c.avh_voucher_id FROM accounts.acc_voucher_header c
                  WHERE c.avh_acc_year = h.avh_acc_year
                    AND (c.avh_voucher_id = h.avh_voucher_id
                     OR  c.avh_against_voucher_id = h.avh_voucher_id))) AS pdc_count,
       h.avh_voucher_status
  FROM accounts.acc_voucher_header h
  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id
  JOIN accounts.acc_ledger_master  p  ON p.led_id = h.avh_party_id
  LEFT JOIN accounts.acc_voucher_header rv
         ON rv.avh_voucher_id = h.avh_reversal_voucher_id
        AND rv.avh_acc_year   = h.avh_reversal_acc_year
 WHERE h.avh_company_id = iavh_company_id::uuid
   AND h.avh_branch_id  = iavh_branch_id::uuid
   AND h.avh_acc_year   = iavh_acc_year::bpchar
   AND vt.vchr_type_code = 'Rct'
   AND h.avh_is_deleted = false
   AND h.avh_against_voucher_id IS NULL
   AND (NULLIF(iavh_status, '') IS NULL OR h.avh_voucher_status = iavh_status)
   AND (NULLIF(ifrom_date, '') IS NULL OR h.avh_voucher_date::date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR h.avh_voucher_date::date <= NULLIF(ito_date,   '')::date)
 ORDER BY h.avh_voucher_date DESC,
         h.avh_voucher_slno DESC NULLS LAST,
         h.avh_created_on   DESC$seed$)
    ,(109, 'MAIN LIST - RECEIVED CHEQUES', 'Received cheques and mandates for a company / branch / year, with the due bucket computed from the instrument date.', 'Instrument Date' , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
       r.apd_id,
       r.apd_acc_year,
       r.apd_company_id,
       r.apd_branch_id,
       r.apd_instrument_no,
       r.apd_instrument_type,
       r.apd_instrument_date,
       p.led_name                        AS party_name,
       r.apd_amount,
       r.apd_bank_name,
       r.apd_drawer_name,
       r.apd_status,
       CASE
         WHEN r.apd_status <> 'HELD' AND r.apd_status <> 'DEPOSITED' THEN NULL
         WHEN r.apd_instrument_date > CURRENT_DATE                 THEN 'FUTURE'
         WHEN r.apd_instrument_date = CURRENT_DATE                 THEN 'DUE_TODAY'
         WHEN r.apd_instrument_date < CURRENT_DATE - INTERVAL '3 months' THEN 'STALE'
         ELSE 'OVERDUE'
       END                               AS due_bucket,
       r.apd_posting_mode,
       r.apd_deposit_date,
       r.apd_deposit_slip_no,
       b.led_name                        AS deposit_bank_name,
       r.apd_present_count,
       r.apd_clear_date,
       r.apd_bounce_date,
       r.apd_bounce_reason,
       r.apd_bounce_charges,
       rv.avh_voucher_refno              AS receipt_refno,
       cv.avh_voucher_refno              AS clear_refno,
       bv.avh_voucher_refno              AS bounce_refno,
       rep.apd_instrument_no             AS replaced_by_no,
       r.apd_remarks
  FROM accounts.acc_pdc_register    r
  JOIN accounts.acc_ledger_master   p   ON p.led_id = r.apd_party_id
  LEFT JOIN accounts.acc_ledger_master b ON b.led_id = r.apd_bank_ledger_id
  LEFT JOIN accounts.acc_tender_detail t
         ON t.td_id = r.apd_tender_id
        AND t.td_is_deleted = false
  LEFT JOIN accounts.acc_ledger_master cih ON cih.led_id = t.td_tender_ledger_id
  LEFT JOIN accounts.acc_voucher_header rv
         ON rv.avh_voucher_id = r.apd_voucher_id
        AND rv.avh_acc_year   = r.apd_voucher_acc_year
  LEFT JOIN accounts.acc_voucher_header cv
         ON cv.avh_voucher_id = r.apd_clear_voucher_id
        AND cv.avh_acc_year   = r.apd_clear_acc_year
  LEFT JOIN accounts.acc_voucher_header bv
         ON bv.avh_voucher_id = r.apd_bounce_voucher_id
        AND bv.avh_acc_year   = r.apd_bounce_acc_year
  LEFT JOIN accounts.acc_pdc_register rep
         ON rep.apd_id       = r.apd_replaced_by_id
        AND rep.apd_acc_year = r.apd_replaced_by_acc_year
 WHERE r.apd_company_id = iapd_company_id::uuid
   AND r.apd_branch_id  = iapd_branch_id::uuid
   AND r.apd_acc_year   = iapd_acc_year::bpchar
   AND r.apd_tra_type   = 'R'
   AND r.apd_is_deleted = false
   AND (NULLIF(istatus, '') IS NULL
        OR r.apd_status = ANY (string_to_array(istatus, ',')))
   AND (NULLIF(ifrom, '') IS NULL OR r.apd_instrument_date >= NULLIF(ifrom, '')::date)
   AND (NULLIF(ito,   '') IS NULL OR r.apd_instrument_date <= NULLIF(ito,   '')::date)
   AND (NULLIF(ibank_ledger_id, '') IS NULL
        OR r.apd_bank_ledger_id = NULLIF(ibank_ledger_id, '')::uuid)
   AND (NULLIF(iparty_id, '') IS NULL
        OR r.apd_party_id = NULLIF(iparty_id, '')::uuid)
   AND (NULLIF(isearch, '') IS NULL
        OR r.apd_instrument_no ILIKE '%' || isearch || '%'
        OR p.led_name          ILIKE '%' || isearch || '%'
        OR COALESCE(r.apd_drawer_name, '') ILIKE '%' || isearch || '%'
        OR COALESCE(r.apd_bank_name,   '') ILIKE '%' || isearch || '%')
 ORDER BY r.apd_instrument_date ASC, r.apd_created_on ASC$seed$)
    ,(110, 'CUSTOMER - SHIP TO ADDRESSES', 'Ship-to addresses of one customer (accounts.acc_ship_addrs), scoped by isaa_ledger_id.', 'saa_trade_name'  , 'ASC'       , 'Desktop', true , false, 'system', $seed$SELECT
       s.saa_id,
       s.saa_trade_name,
       s.saa_gstin,
       s.saa_addr_type,
       s.saa_contact_name,
       s.saa_addr1,
       s.saa_location,
       s.saa_pin,
       s.saa_state_name,
       s.saa_distance_km,
       s.saa_phone,
       s.saa_is_default,
       s.saa_is_active
  FROM accounts.acc_ship_addrs s
 WHERE s.saa_ledger_id = isaa_ledger_id::uuid
   AND s.saa_is_deleted = false
 ORDER BY s.saa_is_default DESC, s.saa_sort, s.saa_trade_name$seed$)
    ,(111, 'POPUP - BANKS', 'Drawee bank picker for a cheque row (fixed.bank_master). Name is what is stored — td_bank_name is a varchar, not an FK.', 'bnk_name'        , 'ASC'       , 'Desktop', true , false, 'system', $seed$SELECT b.bnk_id,
       b.bnk_name,
       b.bnk_short_name,
       b.bnk_rbi_code
  FROM fixed.bank_master b
 WHERE b.bnk_is_active = true
   AND b.bnk_is_deleted = false
 ORDER BY b.bnk_name$seed$)
    ,(112, 'POPUP - BILL PAYMENT HISTORY', 'Every adjustment that has touched ONE bill — 3.0''s PaymentHistory (grid 699). Scoped by iabj_bill_id + iabj_acc_year.', 'abj_adj_date'    , 'ASC'       , 'Desktop', true , false, 'system', $seed$SELECT a.abj_id,
       a.abj_adj_date,
       COALESCE(h.avh_voucher_refno, a.abj_adj_type)  AS voucher,
       vt.vchr_type_name                              AS voucher_type,
       a.abj_adj_type,
       a.abj_dr_cr,
       a.abj_amount,
       a.abj_settlement_mode,
       t.tnd_name                                     AS tender,
       a.abj_remarks,
       a.abj_created_by,
       a.abj_created_on
  FROM accounts.acc_bill_adjustment a
  LEFT JOIN accounts.acc_voucher_header h
         ON h.avh_voucher_id = a.abj_voucher_id
        AND h.avh_acc_year   = a.abj_voucher_acc_year
  LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
  LEFT JOIN accounts.acc_tender_master  t  ON t.tnd_id = a.abj_tender_id
 WHERE a.abj_bill_id  = iabj_bill_id::uuid
   AND a.abj_acc_year = iabj_acc_year::bpchar
   AND a.abj_is_deleted = false
 ORDER BY a.abj_adj_date, a.abj_created_on$seed$)
    ,(113, 'MAIN LIST - BILL DELIVERY', 'Posted sale bills with a delivery still to move (menu 226, plan-qt-sales 1.11). Default = not NA / DELIVERED; idelivery_status narrows to one step; search on customer / bill no / phone.', 'sb_bill_date'    , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT b.sb_id, b.sb_company_id, b.sb_branch_id, b.sb_acc_year,
       b.sb_bill_date, b.sb_bill_refno, b.sb_cust_name, b.sb_cust_place, b.sb_cust_phone,
       b.sb_bill_amt, b.sb_delivery_status, b.sb_delivered_on, b.sb_vehicle_no,
       e.emp_name AS driver_name, b.sb_status, b.sb_created_by
  FROM sales.sale_bill b
  LEFT JOIN public.employee_master e ON e.emp_id = b.sb_driver_id
 WHERE b.sb_company_id = 'icompany_id'::uuid
   AND b.sb_branch_id = 'ibranch_id'::uuid
   AND b.sb_acc_year = 'iacc_year'
   AND b.sb_is_deleted = false
   AND b.sb_status = 'POSTED'
   AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR b.sb_bill_date::text <= 'ito_date')
   AND (CASE WHEN NULLIF('idelivery_status', '') IS NULL THEN b.sb_delivery_status NOT IN ('NA', 'DELIVERED')
             WHEN 'idelivery_status' = 'ALL' THEN true
             ELSE b.sb_delivery_status = 'idelivery_status' END)
 ORDER BY b.sb_bill_date DESC, b.sb_bill_datetime DESC$seed$)
    ,(114, 'MAIN LIST - TEMP CREDITS', 'accounts.acc_temp_credit — the who-owes list (menu 257, plan-qt-sales 1.12). Default OPEN + PARTIAL; istatus = one status or ALL; ioverdue_only = true; search on name / mobile / bill no. days_overdue is computed, 0 once the balance is 0.', 'atc_due_date'    , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
       t.atc_id,
       t.atc_company_id,
       t.atc_branch_id,
       t.atc_acc_year,
       t.atc_bill_date,
       t.atc_bill_refno,
       t.atc_name,
       t.atc_mobile,
       t.atc_place,
       t.atc_credit_amount,
       t.atc_balance_amount,
       t.atc_due_date,
       CASE WHEN t.atc_balance_amount > 0 AND t.atc_due_date < CURRENT_DATE
            THEN (CURRENT_DATE - t.atc_due_date) ELSE 0 END AS days_overdue,
       t.atc_status,
       t.atc_promise_date,
       COALESCE(cu.usr_login_name, t.atc_created_by) AS atc_created_by,    
       t.atc_src_doc_id,
       t.atc_abl_id,
       b.abl_party_id AS atc_party_id,
       COALESCE(l.led_name, '') AS atc_party_name
  FROM accounts.acc_temp_credit t
   
   
  LEFT JOIN accounts.acc_bill_balance  b ON b.abl_id = t.atc_abl_id AND b.abl_acc_year = t.atc_abl_acc_year
  LEFT JOIN accounts.acc_ledger_master l ON l.led_id = b.abl_party_id
  LEFT JOIN public.user_master        cu ON cu.usr_id::text = t.atc_created_by
 WHERE t.atc_company_id = 'icompany_id'::uuid
   AND (NULLIF('ibranch_id', '') IS NULL OR t.atc_branch_id::text = 'ibranch_id')
   AND t.atc_is_deleted = false
   AND (NULLIF('ifrom_date', '') IS NULL OR t.atc_bill_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR t.atc_bill_date::text <= 'ito_date')
   AND (CASE WHEN NULLIF('istatus', '') IS NULL THEN t.atc_status IN ('OPEN', 'PARTIAL')
             WHEN 'istatus' = 'ALL' THEN true
             ELSE t.atc_status = 'istatus' END)
   AND (NULLIF('ioverdue_only', '') IS NULL OR 'ioverdue_only' <> 'true'
        OR (t.atc_balance_amount > 0 AND t.atc_due_date < CURRENT_DATE))
 ORDER BY t.atc_due_date, t.atc_created_on$seed$)
    ,(115, 'POPUP - RECENT BILLS FOR RE-TENDER', 'Ctrl+F6 picker (plan-qt-sales 1.7b): this device''s bills today, newest first; a typed bill no (search) reaches any bill. Shows how each was tendered (non-voided rows).', 'sb_bill_datetime', 'Descending', 'Desktop', true , false, 'system', $seed$SELECT b.sb_id, b.sb_company_id, b.sb_branch_id, b.sb_acc_year,
       b.sb_bill_refno, b.sb_bill_datetime, b.sb_cust_name, b.sb_bill_amt, b.sb_pay_mode, b.sb_status,
       (SELECT string_agg(coalesce(m.tnd_name, '?') || ' ' || d.td_amount::text, ', ' ORDER BY d.td_row_no)
          FROM accounts.acc_tender_detail d
          LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = d.td_tender_id
         WHERE d.td_src_doc_id = b.sb_id AND d.td_acc_year = b.sb_acc_year
           AND d.td_is_deleted = false AND d.td_is_voided = false) AS tenders
  FROM sales.sale_bill b
 WHERE b.sb_company_id = 'icompany_id'::uuid
   AND b.sb_branch_id = 'ibranch_id'::uuid
   AND b.sb_acc_year = 'iacc_year'
   AND b.sb_is_deleted = false
   AND b.sb_status IN ('POSTED', 'DRAFT')
   AND ((NULLIF('idevice_id', '') IS NULL OR b.sb_device_id::text = 'idevice_id')
            AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date::text >= 'ifrom_date')
            AND (NULLIF('ito_date', '') IS NULL OR b.sb_bill_date::text <= 'ito_date'))
 ORDER BY b.sb_bill_datetime DESC$seed$)
    ,(116, 'MAIN LIST - DELIVERY CHALLANS', 'Delivery challans (menu 182, plan-qt-sales 4). ifulfil narrows by sdc_fulfil_status ('''' = all, OPEN = OPEN+PARTIAL); search on DC no / customer / phone.', 'sdc_dc_date'     , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT
       d.sdc_id,
       d.sdc_company_id,
       d.sdc_branch_id,
       d.sdc_acc_year,
       d.sdc_dc_date,
       d.sdc_dc_refno,
       d.sdc_purpose,
       d.sdc_cust_name,
       d.sdc_cust_place,
       d.sdc_cust_phone,
       d.sdc_tot_items,
       d.sdc_dc_amt,
       d.sdc_status,
       d.sdc_fulfil_status,
       d.sdc_vehicle_no,
       d.sdc_src_doc_refno,
       d.sdc_created_by
  FROM sales.sale_dc d
 WHERE d.sdc_company_id = 'icompany_id'::uuid
   AND d.sdc_branch_id = 'ibranch_id'::uuid
   AND d.sdc_acc_year = 'iacc_year'
   AND d.sdc_is_deleted = false
   AND (NULLIF('ifrom_date', '') IS NULL OR d.sdc_dc_date::text >= 'ifrom_date')
   AND (NULLIF('ito_date', '') IS NULL OR d.sdc_dc_date::text <= 'ito_date')
   AND (CASE WHEN NULLIF('ifulfil', '') IS NULL THEN true
             WHEN 'ifulfil' = 'OPEN' THEN d.sdc_fulfil_status IN ('OPEN', 'PARTIAL')
             ELSE d.sdc_fulfil_status = 'ifulfil' END)
 ORDER BY d.sdc_dc_date DESC, d.sdc_dc_slno DESC$seed$)
    ,(117, 'TXN MAIN LIST - VOUCHER REGISTER', 'Voucher Register vouchers for a company / branch / year, only the types the user may view. itype_code narrows to one type; '''' = every permitted type. Rev mirrors are not listed (they hang off their original); a CANCELLED original stays listed.', 'Date'            , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT
       h.avh_voucher_id,
       h.avh_company_id,
       h.avh_branch_id,
       h.avh_acc_year,
       vt.vchr_type_code,
       vt.vchr_type_name                AS type_name,
       h.avh_voucher_refno,
       h.avh_voucher_date,
       CASE WHEN vt.vchr_party_mode = 'MANY' AND h.avh_party_id IS NULL THEN '— several —'
            ELSE p.led_name END          AS party_name,
       h.avh_doc_refno,
       h.avh_remarks,
       h.avh_total_debit,
       h.avh_total_credit,
       h.avh_voucher_status,
       rv.avh_voucher_refno             AS reversal_refno
  FROM accounts.acc_voucher_header h
  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id
  JOIN public.user_menus           um ON um.um_menu_id = vt.vchr_menu_id
                                    AND um.um_user_id = iuser_id::uuid
                                    AND um.um_is_deleted = false
                                    AND um.um_can_view = true
  LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id
  LEFT JOIN accounts.acc_voucher_header rv
         ON rv.avh_voucher_id = h.avh_reversal_voucher_id
        AND rv.avh_acc_year   = h.avh_reversal_acc_year
 WHERE h.avh_company_id = icompany_id::uuid
   AND h.avh_branch_id  = ibranch_id::uuid
   AND h.avh_acc_year   = iacc_year::bpchar
   AND vt.vchr_in_register = true
   AND h.avh_is_deleted = false
   AND (NULLIF(itype_code, '') IS NULL OR vt.vchr_type_code = itype_code)
   AND (NULLIF(ifrom_date, '') IS NULL OR h.avh_voucher_date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR h.avh_voucher_date <= NULLIF(ito_date,   '')::date)
 ORDER BY h.avh_voucher_date DESC, h.avh_voucher_slno DESC NULLS LAST, h.avh_created_on DESC$seed$)
    ,(118, 'VOUCHER REGISTER - EXCEPTIONS', 'Register vouchers (Journal, Debit Note, Credit Note) whose bill-wise allocations touch a SALES or PURCHASE bill in the period — a hand-journalled settlement, made visible.', 'Date'            , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT h.avh_voucher_id,
       h.avh_company_id,
       h.avh_branch_id,
       h.avh_acc_year,
       vt.vchr_type_name                AS type_name,
       h.avh_voucher_refno,
       h.avh_voucher_date,
       p.led_name                       AS party_name,
       b.abl_bill_type,
       b.abl_doc_refno                  AS bill_refno,
       j.abj_adj_type,
       j.abj_amount,
       h.avh_voucher_status,
       h.avh_remarks
  FROM accounts.acc_bill_adjustment j
  JOIN accounts.acc_voucher_header h ON h.avh_voucher_id = j.abj_voucher_id AND h.avh_acc_year = j.abj_voucher_acc_year
  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id
  JOIN accounts.acc_bill_balance   b  ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
  JOIN accounts.acc_ledger_master  p  ON p.led_id = j.abj_party_id
 WHERE h.avh_company_id = icompany_id::uuid
   AND h.avh_branch_id  = ibranch_id::uuid
   AND h.avh_acc_year   = iacc_year::bpchar
   AND vt.vchr_type_code IN ('Jrl', 'DrN', 'CrN')
   AND b.abl_bill_type IN ('SALES', 'PURCHASE')
   AND j.abj_is_deleted = false
   AND j.abj_reversal_of_id IS NULL
   AND h.avh_is_deleted = false
   AND (NULLIF(ifrom_date, '') IS NULL OR h.avh_voucher_date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR h.avh_voucher_date <= NULLIF(ito_date,   '')::date)
 ORDER BY h.avh_voucher_date DESC, h.avh_voucher_refno DESC, j.abj_row_no$seed$)
    ,(119, 'POPUP - VOUCHER LEDGERS', 'Voucher Register ledger cell (menus 101-104,163,259-262): ledgers legal on one side of one type. Mirrors GET /vouchers/ledger-pick (share/grids/voucher_ledger_picker.sql). Params ALWAYS sent: icompany_id, itype_code, iside (DR|CR).', 'led_name'        , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT l.led_id,
       l.led_name,
       g.acc_group_name                                              AS group_name,
       CASE WHEN EXISTS (
                WITH RECURSIVE up AS (
                    SELECT x.acc_group_id, x.acc_group_parent_id, lower(x.acc_group_name) AS n, 0 AS d
                      FROM accounts.acc_group_master x WHERE x.acc_group_id = l.led_group_id
                    UNION ALL
                    SELECT p.acc_group_id, p.acc_group_parent_id, lower(p.acc_group_name), up.d + 1
                      FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
                     WHERE up.d < 24)
                SELECT 1 FROM up WHERE up.n IN ('sundry debtors', 'sundry creditors'))
            THEN 'Yes' ELSE '' END                                   AS is_party,
       CASE WHEN l.led_is_bill_by_bill THEN 'Yes' ELSE '' END        AS is_bill_by_bill,
       l.led_tax_id::text                                            AS led_tax_id,
       CASE WHEN l.led_is_tds_applicable THEN 'Yes' ELSE '' END      AS is_tds,
       COALESCE(l.led_tds_nature_of_payment, '')                     AS tds_section,
       COALESCE(l.led_alias, '')                                     AS led_alias
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
   AND (NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                     WHERE t.vchr_type_code = 'itype_code' AND t.vchr_nature IN ('RECEIPT', 'PAYMENT'))
        OR EXISTS (
                WITH RECURSIVE up AS (
                    SELECT x.acc_group_parent_id, lower(x.acc_group_name) AS n, 0 AS d
                      FROM accounts.acc_group_master x WHERE x.acc_group_id = l.led_group_id
                    UNION ALL
                    SELECT p.acc_group_parent_id, lower(p.acc_group_name), up.d + 1
                      FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
                     WHERE up.d < 24)
                SELECT 1 FROM up WHERE up.n IN ('cash-in-hand', 'bank accounts', 'bank od a/c'))
           = EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                      WHERE t.vchr_type_code = 'itype_code'
                        AND ((t.vchr_nature = 'RECEIPT' AND 'iside' = 'DR')
                          OR (t.vchr_nature = 'PAYMENT' AND 'iside' = 'CR'))))
 ORDER BY l.led_name$seed$)
    ,(120, 'MAIN LIST - CHEQUE BOOKS', 'notes (55): our cheque books for a company. ibank_ledger_id narrows to one bank, istatus to ACTIVE / FINISHED / CLOSED; '''' = all.', 'Bank'            , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
       b.acb_id,
       l.led_name AS bank_name,
       b.acb_book_no,
       lpad(b.acb_leaf_from::text, b.acb_leaf_width, '0') AS leaf_from,
       lpad(b.acb_leaf_to::text,   b.acb_leaf_width, '0') AS leaf_to,
       CASE WHEN b.acb_next_leaf > b.acb_leaf_to THEN NULL
            ELSE lpad(b.acb_next_leaf::text, b.acb_leaf_width, '0') END AS next_leaf,
       (b.acb_leaf_to - b.acb_next_leaf + 1)::int AS leaves_left,
       b.acb_status,
       b.acb_remarks
  FROM accounts.acc_cheque_book b
  JOIN accounts.acc_ledger_master l ON l.led_id = b.acb_bank_ledger_id
 WHERE b.acb_company_id = icompany_id::uuid
   AND b.acb_is_deleted = false
   AND (NULLIF(ibank_ledger_id, '') IS NULL OR b.acb_bank_ledger_id = NULLIF(ibank_ledger_id, '')::uuid)
   AND (NULLIF(istatus, '') IS NULL OR b.acb_status = istatus)
 ORDER BY l.led_name, b.acb_leaf_from$seed$)
    ,(121, 'MAIN LIST - ISSUED CHEQUES', 'notes (55): our cheques handed to suppliers (apd_tra_type P) for a company / branch / year. istatus is a CSV of HELD, CLEARED, BOUNCED, CANCELLED, REPLACED; every other token '''' = no bound.', 'Cheque Date'     , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT p.apd_id,
       p.apd_acc_year,
       p.apd_company_id,
       p.apd_branch_id,
       p.apd_instrument_no,
       p.apd_instrument_date,
       p.apd_received_on AS issued_on,
       p.apd_party_id,
       s.led_name AS party_name,
       p.apd_favouring,
       p.apd_amount,
       p.apd_bank_ledger_id,
       bk.led_name AS bank_name,
       b.acb_book_no,
       p.apd_ac_payee,
       p.apd_status,
       p.apd_clear_date,
       p.apd_bounce_date,
       p.apd_cancel_reason,
       h.avh_voucher_refno,
       vt.vchr_type_code,
       p.apd_print_count,
       CASE WHEN p.apd_status = 'HELD' AND p.apd_instrument_date > CURRENT_DATE THEN 'POST-DATED'
            WHEN p.apd_status = 'HELD' THEN 'OUTSTANDING'
            ELSE p.apd_status END AS state
  FROM accounts.acc_pdc_register p
  JOIN accounts.acc_ledger_master s ON s.led_id = p.apd_party_id
  LEFT JOIN accounts.acc_ledger_master bk ON bk.led_id = p.apd_bank_ledger_id
  LEFT JOIN accounts.acc_cheque_book b ON b.acb_id = p.apd_cheque_book_id
  LEFT JOIN accounts.acc_voucher_header h
         ON h.avh_voucher_id = p.apd_voucher_id AND h.avh_acc_year = p.apd_voucher_acc_year
  LEFT JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
 WHERE p.apd_company_id = icompany_id::uuid
   AND (NULLIF(ibranch_id, '') IS NULL OR p.apd_branch_id = NULLIF(ibranch_id, '')::uuid)
   AND (NULLIF(iacc_year, '') IS NULL OR p.apd_acc_year = NULLIF(iacc_year, '')::bpchar)
   AND p.apd_tra_type = 'P'
   AND p.apd_is_deleted = false
   AND (NULLIF(istatus, '') IS NULL OR p.apd_status = ANY (string_to_array(istatus, ',')))
   AND (NULLIF(ifrom, '') IS NULL OR p.apd_instrument_date >= NULLIF(ifrom, '')::date)
   AND (NULLIF(ito,   '') IS NULL OR p.apd_instrument_date <= NULLIF(ito,   '')::date)
   AND (NULLIF(ibank_ledger_id, '') IS NULL OR p.apd_bank_ledger_id = NULLIF(ibank_ledger_id, '')::uuid)
   AND (NULLIF(iparty_id, '') IS NULL OR p.apd_party_id = NULLIF(iparty_id, '')::uuid)
   AND (NULLIF(isearch, '') IS NULL OR p.apd_instrument_no ILIKE '%' || isearch || '%'
        OR s.led_name ILIKE '%' || isearch || '%' OR p.apd_favouring ILIKE '%' || isearch || '%')
 ORDER BY p.apd_instrument_date DESC, bk.led_name, p.apd_instrument_no DESC$seed$)
    ,(122, 'TXN MAIN LIST - STOCK ADJUSTMENT', 'Stock adjustments, issues, damage and expiry write-offs, re-lots and bucket moves for a company / branch / year (menu 264). ikind narrows to one kind code (ADJUSTMENT, RELOT, BUCKET_MOVE, ISSUE, DAMAGE, EXPIRY_WRITEOFF); istatus to one status; '''' = all.', 'Date'            , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT
       h.svh_id,
       h.svh_company_id,
       h.svh_branch_id,
       h.svh_acc_year,
       CASE k.kind_code
         WHEN 'ADJUSTMENT'      THEN 'Stock adjustment'
         WHEN 'RELOT'           THEN 'Re-lot'
         WHEN 'BUCKET_MOVE'     THEN 'Move stock'
         WHEN 'ISSUE'           THEN 'Stock issue'
         WHEN 'DAMAGE'          THEN 'Damage write-off'
         WHEN 'EXPIRY_WRITEOFF' THEN 'Expiry write-off'
         ELSE k.kind_code END          AS kind_name,
       h.svh_refno,
       h.svh_usr_refno,
       h.svh_doc_date,
       g.gdl_name                      AS godown_name,
       r.srm_name                      AS reason_name,
       h.svh_line_count,
       h.svh_total_qty,
       h.svh_total_value,
       h.svh_status,
       h.svh_remarks
  FROM stock.stock_voucher h
  CROSS JOIN LATERAL (
    SELECT CASE
             WHEN EXISTS (SELECT 1
                            FROM stock.stock_voucher_item i
                           WHERE i.svi_voucher_id = h.svh_id
                             AND i.svi_acc_year   = h.svh_acc_year
                             AND i.svi_is_deleted = false
                             AND i.svi_to_bucket IS NOT NULL)                       THEN 'BUCKET_MOVE'
             WHEN h.svh_voucher_type = 'ADJUSTMENT'
              AND EXISTS (SELECT 1
                            FROM stock.stock_voucher_item i
                            JOIN stock.stock_reason_master rm
                              ON rm.srm_id = COALESCE(i.svi_reason_id, h.svh_reason_id)
                           WHERE i.svi_voucher_id = h.svh_id
                             AND i.svi_acc_year   = h.svh_acc_year
                             AND i.svi_is_deleted = false
                             AND rm.srm_code IN ('RELOT_OUT', 'RELOT_IN'))           THEN 'RELOT'
             ELSE h.svh_voucher_type END AS kind_code
  ) k
  LEFT JOIN inventory.godown_locations g ON g.gdl_id = COALESCE(h.svh_from_godown_id, h.svh_to_godown_id)
  LEFT JOIN stock.stock_reason_master  r ON r.srm_id = h.svh_reason_id
 WHERE h.svh_company_id = icompany_id::uuid
   AND h.svh_branch_id  = ibranch_id::uuid
   AND h.svh_acc_year   = iacc_year::bpchar
   AND h.svh_voucher_type IN ('ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF')
   AND COALESCE(h.svh_link_src_module, 'STOCK') = 'STOCK'
   AND h.svh_is_deleted = false
   AND (NULLIF(ikind,   '') IS NULL OR k.kind_code  = ikind)
   AND (NULLIF(istatus, '') IS NULL OR h.svh_status = istatus)
   AND (NULLIF(ifrom_date, '') IS NULL OR h.svh_doc_date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR h.svh_doc_date <= NULLIF(ito_date,   '')::date)
 ORDER BY h.svh_doc_date DESC, h.svh_slno DESC NULLS LAST, h.svh_created_on DESC$seed$)
    ,(123, 'MAIN LIST - PAYMENTS', 'Payment vouchers (menu 100) for a company / branch / year. PDC vouchers are excluded — they show under their payment.', 'Date'            , 'Descending', 'Desktop', true , false, 'system', $seed$SELECT
       h.avh_voucher_id,
       h.avh_company_id,
       h.avh_branch_id,
       h.avh_acc_year,
       h.avh_voucher_refno,
       h.avh_voucher_date,
       p.led_name                       AS party_name,
       h.avh_doc_amount,
       h.avh_adjust_amount,
       (h.avh_doc_amount - h.avh_adjust_amount) AS on_account_amount,
       (SELECT string_agg(DISTINCT t.ttm_display_name, ', ' ORDER BY t.ttm_display_name)
          FROM accounts.acc_tender_detail d
          JOIN accounts.acc_tender_types  t ON t.ttm_type_id = d.td_tender_type_id
         WHERE d.td_src_doc_id = h.avh_voucher_id
           AND d.td_acc_year   = h.avh_acc_year
           AND d.td_is_deleted = false)  AS instruments,
       (SELECT count(*)
          FROM accounts.acc_pdc_register r
         WHERE r.apd_voucher_acc_year = h.avh_acc_year
           AND r.apd_is_deleted = false
           AND r.apd_voucher_id IN (
                 SELECT c.avh_voucher_id FROM accounts.acc_voucher_header c
                  WHERE c.avh_acc_year = h.avh_acc_year
                    AND (c.avh_voucher_id = h.avh_voucher_id
                     OR  c.avh_against_voucher_id = h.avh_voucher_id))) AS pdc_count,
       h.avh_voucher_status
  FROM accounts.acc_voucher_header h
  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id
  JOIN accounts.acc_ledger_master  p  ON p.led_id = h.avh_party_id
  LEFT JOIN accounts.acc_voucher_header rv
         ON rv.avh_voucher_id = h.avh_reversal_voucher_id
        AND rv.avh_acc_year   = h.avh_reversal_acc_year
 WHERE h.avh_company_id = iavh_company_id::uuid
   AND h.avh_branch_id  = iavh_branch_id::uuid
   AND h.avh_acc_year   = iavh_acc_year::bpchar
   AND vt.vchr_type_code = 'Pmt'
   AND h.avh_is_deleted = false
   AND h.avh_against_voucher_id IS NULL
   AND (NULLIF(iavh_status, '') IS NULL OR h.avh_voucher_status = iavh_status)
   AND (NULLIF(ifrom_date, '') IS NULL OR h.avh_voucher_date::date >= NULLIF(ifrom_date, '')::date)
   AND (NULLIF(ito_date,   '') IS NULL OR h.avh_voucher_date::date <= NULLIF(ito_date,   '')::date)
 ORDER BY h.avh_voucher_date DESC,
         h.avh_voucher_slno DESC NULLS LAST,
         h.avh_created_on   DESC$seed$)
    ,(125, 'MAIN LIST - APP THEMES', 'App Themes master list (menu "App Themes" under Configuration). theme/plan-app-theme.md §2.5', 'thm_id'          , 'Ascending' , 'Desktop', true , false, 'system', $seed$
SELECT
    t.thm_id,
    t.thm_name,
    t.thm_base,
    t.thm_is_default,
    t.thm_is_active,
    t.thm_is_deleted,
    (SELECT count(*)
       FROM public.companys c
      WHERE c.comp_stylesheet_id = t.thm_id
        AND COALESCE(c.comp_is_deleted, false) = false)  AS thm_used_by,
    t.thm_remarks,
    t.thm_modified_on
FROM public.app_theme_master t
ORDER BY t.thm_id
$seed$)
    ,(126, 'POPUP - TXN HISTORY', 'public.txn_status_log — one document''s status trail (who, when, from→to, device, remarks), for TxnHistoryDialog. Params idoc_id / iacc_year / icompany_id. notes 80.', 'tsl_seq_no'      , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT l.tsl_id,
       l.tsl_seq_no,
       initcap(replace(lower(l.tsl_event), '_', ' ')) AS tsl_event_text,
       CASE WHEN l.tsl_from_status IS NULL OR l.tsl_from_status = l.tsl_to_status
            THEN l.tsl_to_status
            ELSE l.tsl_from_status || ' → ' || l.tsl_to_status END AS tsl_status_text,
       to_char(l.tsl_changed_on, 'DD-MM-YYYY HH24:MI:SS') AS tsl_changed_at,
       COALESCE(u.usr_login_name, NULLIF(btrim(l.tsl_created_by), ''), '') AS tsl_user_name,
       COALESCE(d.dev_device_name, '') AS tsl_device_name,
       COALESCE(l.tsl_remarks, '') AS tsl_remarks,
       l.tsl_src_doc_refno,
       l.tsl_src_doc_type
FROM public.txn_status_log l
LEFT JOIN public.user_master   u ON u.usr_id = l.tsl_changed_by
                                AND l.tsl_changed_by <> '00000000-0000-0000-0000-000000000000'
LEFT JOIN fixed.device_master  d ON d.dev_id = l.tsl_device_id
WHERE l.tsl_src_doc_id::text = 'idoc_id'
  AND l.tsl_acc_year = 'iacc_year'
  AND l.tsl_company_id::text = 'icompany_id'
  AND NOT l.tsl_is_deleted$seed$)
    ,(127, 'MAIN LIST - GST PROVIDERS', 'GST Providers list (menu 269). notes 79', NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    p.gpv_id,
    p.gpv_code,
    p.gpv_name,
    (SELECT count(*) FROM public.gst_provider_service s
      WHERE s.gps_gpv_id = p.gpv_id AND NOT s.gps_is_deleted) AS service_count,
    (SELECT count(*) FROM public.gst_provider_endpoint e
       JOIN public.gst_provider_service s ON s.gps_id = e.gpe_gps_id
      WHERE s.gps_gpv_id = p.gpv_id AND NOT e.gpe_is_deleted AND NOT s.gps_is_deleted) AS endpoint_count,
    (SELECT count(*) FROM public.gst_provider_error_map m
      WHERE m.gem_gpv_id = p.gpv_id AND NOT m.gem_is_deleted) AS error_map_count,
    (SELECT count(*) FROM public.gst_company_credential c
      WHERE c.gcc_gpv_id = p.gpv_id AND NOT c.gcc_is_deleted) AS credential_count,
    p.gpv_is_active
FROM public.gst_provider p
WHERE p.gpv_is_deleted = igpv_is_deleted
ORDER BY p.gpv_is_active DESC, p.gpv_code$seed$)
    ,(128, 'GST PROVIDER - SERVICES', 'Services of one provider (menu 269 form). notes 79', NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    s.gps_id,
    s.gps_service,
    s.gps_environment,
    s.gps_base_url,
    s.gps_auth_scheme,
    s.gps_token_ttl_minutes,
    s.gps_payload_encryption,
    (SELECT count(*) FROM public.gst_provider_endpoint e
      WHERE e.gpe_gps_id = s.gps_id AND NOT e.gpe_is_deleted) AS endpoint_count,
    s.gps_is_active
FROM public.gst_provider_service s
WHERE s.gps_gpv_id::text = 'igpv_id'
  AND NOT s.gps_is_deleted
ORDER BY s.gps_service, s.gps_environment DESC$seed$)
    ,(129, 'GST PROVIDER - ENDPOINTS', 'Endpoints of one provider service (menu 269 form). notes 79', NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    e.gpe_id,
    e.gpe_action,
    e.gpe_http_method,
    e.gpe_path_template,
    e.gpe_query_template,
    e.gpe_is_idempotent,
    (SELECT count(*) FROM public.gst_provider_field_map f
      WHERE f.gfm_gpe_id = e.gpe_id AND NOT f.gfm_is_deleted) AS field_map_count,
    e.gpe_timeout_ms,
    e.gpe_is_active
FROM public.gst_provider_endpoint e
WHERE e.gpe_gps_id::text = 'igps_id'
  AND NOT e.gpe_is_deleted
ORDER BY e.gpe_action, e.gpe_http_method$seed$)
    ,(130, 'GST PROVIDER - ERROR MAP', 'Error map of one provider (menu 269 form). notes 79', NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    m.gem_id,
    COALESCE(m.gem_service, '(all)') AS gem_service,
    m.gem_their_code,
    m.gem_our_code,
    m.gem_treat_as,
    m.gem_is_retryable,
    m.gem_should_reauth,
    m.gem_recovery_action,
    m.gem_message
FROM public.gst_provider_error_map m
WHERE m.gem_gpv_id::text = 'igpv_id'
  AND NOT m.gem_is_deleted
ORDER BY m.gem_service NULLS FIRST, m.gem_their_code$seed$)
    ,(131, 'MAIN LIST - GST CREDENTIALS', 'GST Credentials list (menu 270). Non-secret columns only (no _enc). notes 79', NULL              , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT
    c.gcc_id,
    co.comp_name,
    COALESCE(b.br_gstin_no, co.comp_gstin_no) AS gstin,
    COALESCE(b.br_name, '(all branches)') AS br_name,
    p.gpv_code,
    COALESCE(c.gcc_service, '(all services)') AS gcc_service,
    c.gcc_environment,
    c.gcc_priority,
    c.gcc_login_id,
    c.gcc_last_verified_on,
    c.gcc_last_error_message,
    c.gcc_is_active
FROM public.gst_company_credential c
JOIN public.companys co ON co.comp_id = c.gcc_company_id
JOIN public.gst_provider p ON p.gpv_id = c.gcc_gpv_id
LEFT JOIN public.branch_master b ON b.br_id = c.gcc_branch_id
WHERE c.gcc_is_deleted = igcc_is_deleted
ORDER BY co.comp_name, c.gcc_environment, c.gcc_service NULLS FIRST, c.gcc_priority$seed$)
    ,(132, 'POPUP - TEMP CREDIT HISTORY', 'One temp credit''s whole story, oldest first: the bill''s status trail (txn_status_log by atc_src_doc_id), credit given (acc_temp_credit), follow-ups (audit_log acc_temp_credit), receipts / write-offs / reversals (acc_bill_adjustment on atc_abl_id). Params iatc_id / iacc_year / icompany_id. Sort th_sort.', 'th_sort'         , 'Ascending' , 'Desktop', true , false, 'system', $seed$SELECT t.atc_id::text || ':given' AS th_key,
       to_char(t.atc_created_on, 'YYYYMMDDHH24MISSUS') || '2' AS th_sort,
       to_char(t.atc_created_on, 'DD-MM-YYYY HH24:MI:SS') AS th_when,
       'Credit given' AS th_event,
       concat_ws(' · ', t.atc_name, t.atc_mobile, NULLIF(t.atc_place, ''),
                 t.atc_days || ' days, due ' || to_char(t.atc_due_date, 'DD-MM-YYYY')) AS th_detail,
       t.atc_credit_amount AS th_amount,
       COALESCE(cu.usr_login_name, t.atc_created_by, '') AS th_user,
       t.atc_bill_refno AS th_ref,
       'CREDIT' AS th_kind
FROM accounts.acc_temp_credit t
LEFT JOIN public.user_master cu ON cu.usr_id::text = t.atc_created_by
WHERE t.atc_id::text = 'iatc_id'
  AND t.atc_acc_year = 'iacc_year'
  AND t.atc_company_id::text = 'icompany_id'
UNION ALL
SELECT l.tsl_id::text,
       to_char(l.tsl_changed_on, 'YYYYMMDDHH24MISSUS') || '1',
       to_char(l.tsl_changed_on, 'DD-MM-YYYY HH24:MI:SS'),
       'Bill ' || lower(replace(l.tsl_event, '_', ' ')),
       concat_ws(' · ',
                 CASE WHEN l.tsl_from_status IS NULL OR l.tsl_from_status = l.tsl_to_status
                      THEN l.tsl_to_status
                      ELSE l.tsl_from_status || ' → ' || l.tsl_to_status END,
                 NULLIF(btrim(l.tsl_remarks), '')),
       NULL::numeric,
       COALESCE(lu.usr_login_name, NULLIF(btrim(l.tsl_created_by), ''), ''),
       l.tsl_src_doc_refno,
       'BILL'
FROM public.txn_status_log l
JOIN accounts.acc_temp_credit t ON t.atc_src_doc_id = l.tsl_src_doc_id
                               AND t.atc_acc_year = l.tsl_acc_year
LEFT JOIN public.user_master lu ON lu.usr_id = l.tsl_changed_by
                               AND l.tsl_changed_by <> '00000000-0000-0000-0000-000000000000'
WHERE t.atc_id::text = 'iatc_id'
  AND t.atc_acc_year = 'iacc_year'
  AND t.atc_company_id::text = 'icompany_id'
  AND NOT l.tsl_is_deleted
UNION ALL
SELECT a.log_id::text,
       to_char(a.log_date, 'YYYYMMDDHH24MISSUS') || '3',
       to_char(a.log_date, 'DD-MM-YYYY HH24:MI:SS'),
       CASE WHEN a.log_notes ILIKE 'Follow-up%' THEN 'Follow-up'
            ELSE initcap(a.log_action::text) END,
       concat_ws(' · ',
                 NULLIF(btrim(regexp_replace(COALESCE(a.log_notes, ''), '^Follow-up recorded:\s*', '')), ''),
                 'promise ' || to_char((a.log_modified_record ->> 'atcPromiseDate')::date, 'DD-MM-YYYY')),
       NULL::numeric,
       COALESCE(au.usr_login_name, ''),
       a.log_display_name,
       'FOLLOWUP'
FROM audit.audit_log a
JOIN accounts.acc_temp_credit t ON a.log_pk = t.atc_id::text
LEFT JOIN public.user_master au ON au.usr_id = a.log_user_id
WHERE a.log_table_name = 'acc_temp_credit'
  AND t.atc_id::text = 'iatc_id'
  AND t.atc_acc_year = 'iacc_year'
  AND t.atc_company_id::text = 'icompany_id'
UNION ALL
SELECT j.abj_id::text,
       to_char(j.abj_created_on, 'YYYYMMDDHH24MISSUS') || '4',
       to_char(j.abj_created_on, 'DD-MM-YYYY HH24:MI:SS'),
       CASE WHEN j.abj_reversal_of_id IS NOT NULL OR j.abj_amount < 0 THEN 'Reversed'
            WHEN j.abj_tender_id IS NOT NULL       THEN 'Paid with the bill'
            WHEN j.abj_adj_type = 'ALLOCATION'     THEN 'Received'
            WHEN j.abj_adj_type = 'WRITEOFF'       THEN 'Written off'
            WHEN j.abj_adj_type = 'NOTE_ADJUST'    THEN 'Credit note set-off'
            WHEN j.abj_adj_type = 'ADVANCE_ADJUST' THEN 'Advance set-off'
            ELSE initcap(replace(j.abj_adj_type, '_', ' ')) END,
       concat_ws(' · ',
                 COALESCE(v.avh_voucher_refno, v.avh_voucher_no::text),
                 NULLIF(j.abj_settlement_mode, ''),
                 NULLIF(btrim(COALESCE(j.abj_reversal_reason, j.abj_remarks, '')), '')),
       j.abj_amount,
       COALESCE(ju.usr_login_name, ''),
       COALESCE(v.avh_voucher_refno, v.avh_voucher_no::text, ''),
       CASE WHEN j.abj_tender_id IS NOT NULL THEN 'COUNTER' ELSE 'SETTLE' END
FROM accounts.acc_bill_adjustment j
JOIN accounts.acc_temp_credit t ON j.abj_bill_id = t.atc_abl_id
                               AND j.abj_bill_acc_year = t.atc_abl_acc_year
LEFT JOIN accounts.acc_voucher_header v ON v.avh_voucher_id = j.abj_voucher_id
                                       AND v.avh_acc_year = j.abj_voucher_acc_year
LEFT JOIN public.user_master ju ON ju.usr_id = j.abj_user_id
WHERE t.atc_id::text = 'iatc_id'
  AND t.atc_acc_year = 'iacc_year'
  AND t.atc_company_id::text = 'icompany_id'
  AND NOT j.abj_is_deleted$seed$)
ON CONFLICT (grid_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
    (SELECT GREATEST(COALESCE(MAX(grid_id), 0), 1) FROM fixed.grid_details),
    true
);

COMMIT;
