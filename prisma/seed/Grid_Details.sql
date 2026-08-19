-- Seed: fixed.grid_details -- the configured list/report grids and the SQL behind them (84 rows).
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
    ,(2 , 'state master'                , 'state master', 'State Name'      , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
    ,(3 , 'Area master'                 , 'area master', 'Area name'       , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
    ,(4 , 'unit master'                 , 'unit master', 'Unit name'       , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT unit_name, unit_alias, unit_code, unit_description, unit_decimal_count, unit_weight, unit_loading, unit_unloading, unit_attach_charge, unit_is_pack_unit, unit_conversion, unit_is_active,  unit_id, unit_base_unit_id
	FROM inventory.item_unit_master
where unit_is_deleted=wantdelete$seed$)
    ,(5 , 'item tax master'             , 'item tax master', 'Tax name'        , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT tax_id, tax_name, tax_code, tax_taxability_type, tax_is_reverse_charge, tax_cgst_perc, tax_sgst_perc, tax_igst_perc, tax_cgst_pur_perc, tax_sgst_pur_perc, tax_igst_pur_perc, tax_cess_type, tax_cess_perc, tax_cess_unit, tax_cess_pur_perc, tax_cess_pur_unit, tax_gst_rate_total, tax_sales_ledger_id, tax_sales_return_ledger_id, tax_purchase_ledger_id, tax_purchase_return_ledger_id, tax_cgst_output_ledger_id, tax_sgst_output_ledger_id, tax_igst_output_ledger_id, tax_cess_output_ledger_id, tax_cgst_input_ledger_id, tax_sgst_input_ledger_id, tax_igst_input_ledger_id, tax_cess_input_ledger_id
	FROM inventory.item_tax_master where tax_is_deleted=wantdelete$seed$)
    ,(6 , 'item group master'           , 'item group master', 'Group Name'      , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
    ,(7 , 'brand master'                , 'brand master', 'Brand name'      , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT brand_id, brand_name, brand_alias, brand_short, brand_description, brand_photo, brand_photo_url, brand_parent_id, brand_sort, brand_level, brand_path_ids
	FROM inventory.item_brand_master
where brand_is_deleted=wantdelete$seed$)
    ,(8 , 'Customers'                   , NULL, 'Customer name'   , 'Ascending', 'desktop', true , false, 'system', $seed$SELECT cus_id, cus_title, cus_short, cus_code, cus_name
	FROM sales.customers where cus_is_deleted=false$seed$)
    ,(9 , 'godown master'               , 'godown master', '#'               , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
    ,(10, 'section master'              , NULL, 'Section name'    , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT sec_id, sec_name, sec_alias, sec_short, sec_description, sec_parent_id, sec_sort, sec_level, sec_path_ids, sec_position, sec_color_code,sec_is_active
	FROM inventory.item_section_master where sec_is_deleted=wantdelete$seed$)
    ,(11, 'item category master'        , NULL, 'category name'   , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT category_id, category_name, category_alias, category_short, category_description, category_parent_id, category_sort, category_level, category_path_ids_cache, category_photo, category_photo_url, category_is_active FROM inventory.item_category_master where  category_is_deleted=wantdelete$seed$)
    ,(12, 'company master'              , NULL, '#'               , 'Ascending', 'desktop', true , false, 'system', $seed$SELECT
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
    ,(13, 'Branch master'               , NULL, '#'               , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
    ,(14, 'Employee Master'             , NULL, 'Employee name'   , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT emp_id,emp_name,  emp_code, emp_alias, emp_mobile1
	FROM public.employee_master
where emp_is_deleted=false$seed$)
    ,(15, 'Godown master'               , NULL, 'Name'            , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT gdl_id,gdl_name, gdl_short, gdl_code, gdl_type, gdl_parent_id, gdl_sort, gdl_level
	FROM inventory.godown_locations
where gdl_is_deleted=false$seed$)
    ,(16, 'opening stock list'          , NULL, 'Ref No'          , 'Ascending', 'web'    , true , false, 'system', NULL)
    ,(17, 'suppliers'                   , 'suppliers', 'supplier address', 'Ascending', 'web'    , true , false, 'system', $seed$SELECT sup_id, sup_addr1, sup_addr2, sup_addr3, sup_billed_date, sup_branch_id, sup_cash_disc_perc
	FROM purchase.suppliers$seed$)
    ,(18, 'supplier groups'             , 'supplier groups', 'Name'            , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT spg_id, spg_name, spg_alias, spg_short, spg_desc, spg_is_active
	FROM purchase.supplier_groups where spg_is_deleted=wantdelete$seed$)
    ,(19, 'customer group'              , 'customer group', 'group name'      , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT cgr_id, cgr_branch_id, cgr_name, cgr_alias, cgr_short, cgr_narration, cgr_order, cgr_disc_perc, cgr_collection_days, cgr_debit_allowed, cgr_debit_days, cgr_debit_limit, cgr_bills_limit, cgr_overdue_billing, cgr_company_id
	FROM sales.cust_groups$seed$)
    ,(20, 'City'                        , 'city', 'Name'            , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
    ,(21, 'Category master'             , NULL, 'Names'           , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT category_id, category_name, category_alias, category_short, category_description, category_parent_id, category_sort, category_level
	FROM inventory.item_category_master
where category_is_deleted=false$seed$)
    ,(22, 'Employee Master'             , NULL, 'Name'            , 'Ascending', 'web'    , false, true , 'system', $seed$SELECT emp_id,  emp_name, emp_alias, emp_code,emp_branch_id
	FROM sales.emp_master
where emp_is_deleted=false$seed$)
    ,(23, 'Employee department master'  , NULL, 'Name'            , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT edpt_id, edpt_name, edpt_code, edpt_alias
	FROM public.employee_departments
where edpt_is_deleted=false$seed$)
    ,(24, 'Employee designation master' , NULL, 'Name'            , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT ed_id, ed_name, ed_code, ed_is_default
	FROM public.employee_designations
where ed_is_deleted=wantdelete$seed$)
    ,(25, 'Account groups'              , NULL, '#'               , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
	accounts.account_groups GRP
	LEFT JOIN accounts.account_groups PRN ON PRN.acc_group_id = GRP.acc_group_id
WHERE
	GRP.acc_group_is_deleted = wantdelete
ORDER BY
	GRP.acc_group_name$seed$)
    ,(26, 'Account ledger master'       , NULL, '#'               , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
    INNER JOIN accounts.account_groups AG ON AG.acc_group_id = LM.led_group_id
WHERE
	LM.led_is_deleted = wantdelete
ORDER BY
	LM.led_name$seed$)
    ,(27, 'gsp company service'         , NULL, 'provider id'     , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT  csg_gsp_provider_id, csg_service_type, csg_euser_name,csg_company_service_id
	FROM fixed.gsp_company_service
where csg_is_deleted=false$seed$)
    ,(28, 'device list master'          , NULL, 'Device UID'      , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT dev_id, dev_company_id, dev_branch_id, dev_user_id, dev_device_uid, dev_device_name, dev_device_type, dev_platform, dev_mac_address, dev_is_blocked, dev_block_reason, dev_last_ip, dev_last_login
	FROM fixed.device_master
where dev_is_deleted=false$seed$)
    ,(29, 'User administration'         , NULL, 'ID'              , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT usr_id, usr_company_id, usr_branch_id, usr_employee_id, usr_login_name, usr_display_name, usr_full_name, usr_mobile_no, usr_email, usr_last_login_on
	FROM public.user_master
WHERE usr_is_deleted = iisdeleted$seed$)
    ,(30, 'loyalty points'              , NULL, 'ID'              , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT lspt_id, lspt_ls_id, lspt_slno, lspt_item_id, lspt_unit_id, lspt_exceeds, lspt_each, lspt_factor, lspt_points, lspt_notes
	FROM sales.loyalty_sch_points
where lspt_is_deleted=false$seed$)
    ,(31, 'DESKTOP - DEVICE MASTER LIST', NULL, NULL              , NULL       , 'Desktop', true , false, 'system', $seed$SELECT
	dev_id,
	dev_device_name,
	dev_device_type,
	dev_platform,
	dev_is_active,
	dev_is_blocked,
	dev_last_login
FROM
	fixed.device_master
WHERE
	dev_is_deleted = false
ORDER BY
	dev_device_name$seed$)
    ,(33, 'Grid -master'                , NULL, 'Grid name'       , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT grid_id, grid_name, grid_device_type, grid_sort_column, grid_sort_order, grid_description, grid_status
    FROM fixed.grid_details
    WHERE grid_device_type = 'web' and grid_is_deleted='false'
    ORDER BY grid_id$seed$)
    ,(34, 'GRID MASTER LIST'            , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
    ,(35, 'ui-table master'             , NULL, 'UI id'           , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_is_active,ui_tbl_device_type
	FROM fixed.ui_tables
WHERE ui_tbl_device_type='web'
ORDER BY ui_tbl_id$seed$)
    ,(38, 'UI TABLE LIST'               , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	ui_tbl_id,
	ui_tbl_name,
	ui_tbl_device_type,
	ui_tbl_editable,
	ui_tbl_is_active
FROM fixed.ui_tables
ORDER BY ui_tbl_id$seed$)
    ,(39, 'cv'                          , NULL, NULL              , 'Ascending', 'web'    , false, true , 'system', NULL)
    ,(40, 'Loyalty Scheme List'         , 'Promotion loyalty scheme list grid', 'Scheme'          , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT ls.ls_id, ls.ls_code, ls.ls_name, ls.ls_type, ls.ls_status, ls.ls_branch_id, ls.ls_start_date, ls.ls_end_date, ls.ls_is_active, (SELECT COUNT(*) FROM sales.loyalty_sch_points lspt WHERE lspt.lspt_ls_id = ls.ls_id AND lspt.lspt_is_deleted = false AND lspt.lspt_is_active = true) AS points_count, (SELECT COUNT(*) FROM sales.loyalty_sch_gift lsg WHERE lsg.lsg_ls_id = ls.ls_id AND lsg.lsg_is_deleted = false AND lsg.lsg_is_active = true) AS gifts_count, (SELECT COUNT(*) FROM sales.loyalty_sch_party lps WHERE lps.lps_ls_id = ls.ls_id AND lps.lps_is_deleted = false AND lps.lps_is_active = true) AS parties_count FROM sales.loyalty_sch_list ls WHERE ls.ls_is_deleted = false AND ls.ls_comp_id = p_comp_id::uuid AND (NULLIF(p_branch_id, '') IS NULL OR ls.ls_branch_id = NULLIF(p_branch_id, '')::uuid) AND (NULLIF(p_status, '') IS NULL OR ls.ls_status = NULLIF(p_status, '')) AND (NULLIF(p_type, '') IS NULL OR ls.ls_type = NULLIF(p_type, '')) ORDER BY ls.ls_name, ls.ls_id$seed$)
    ,(41, 'dropdown master'             , NULL, 'Id'              , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT dropdown_id, dropdown_name, dropdown_description, dropdown_sql, dropdown_sort_order, dropdown_sort_column, dropdown_completion, dropdown_sql_regional, dropdown_max_visible_items, dropdown_show_header, dropdown_width
	FROM fixed.dropdown_details$seed$)
    ,(42, 'test'                        , NULL, NULL              , 'Ascending', 'web'    , false, true , 'system', NULL)
    ,(43, 'DROPDOWN LIST'               , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
    ,(44, 'tender master'               , NULL, 'tnd_name'        , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT
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
    ,(45, 'ITEM UNIT MAIN LIST'         , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
    ,(46, 'widget master'               , NULL, 'Id'              , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT section_id,section_menu_id,section_name,section_position,section_platform
FROM fixed.form_section$seed$)
    ,(47, 'MENU SECTIONS MAIN LIST'     , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
    ,(48, 'ITEM GROUPS MAIN LIST'       , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	itg_id,
	itg_name,
	itg_short,
	itg_alias,
	itg_description,
	itg_parent_id,
	itg_sort,
	itg_is_active
FROM inventory.item_group_master
WHERE itg_is_deleted = iitg_is_deleted
ORDER BY itg_name$seed$)
    ,(49, 'ITEM BRAND MAIN LIST'        , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	brand_id,
	brand_name,
	brand_short,
	brand_alias,
	brand_description,
	brand_sort,
	brand_is_active
FROM inventory.item_brand_master
WHERE brand_is_deleted = ibrand_is_deleted
ORDER BY brand_name$seed$)
    ,(50, 'ITEM SECTION MAIN LIST'      , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	sec_id,
	sec_short, 
	sec_name,
	sec_alias,
	sec_description, 
	sec_sort,
	sec_is_active
FROM inventory.item_section_master
WHERE sec_is_deleted = isec_is_deleted
ORDER BY sec_name$seed$)
    ,(51, 'ITEM CATEGORY MAIN LIST'     , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	category_id,
	category_short, 
	category_name,
	category_alias,
	category_description, 
	category_sort,
	category_is_active
FROM inventory.item_category_master
WHERE category_is_deleted = icategory_is_deleted
ORDER BY category_name$seed$)
    ,(52, 'COMPANYS MAIN LIST'          , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
WHERE comp_is_deleted = false
ORDER BY comp_id$seed$)
    ,(53, 'ACCOUNT GROUP MAIN LIST'     , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
	accounts.account_groups GRP
	LEFT JOIN accounts.account_groups PRN ON PRN.acc_group_id = GRP.acc_group_id
WHERE
	GRP.acc_group_is_deleted = false
ORDER BY
	GRP.acc_group_name$seed$)
    ,(54, 'LEDGER MAIN LIST'            , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
    INNER JOIN accounts.account_groups AG ON AG.acc_group_id = LM.led_group_id
WHERE
	LM.led_is_deleted = iled_is_deleted
ORDER BY
	LM.led_name$seed$)
    ,(55, 'GODOWN MAIN LIST'            , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
    ,(56, 'BRANCH MAIn LIST'            , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
	BR.br_is_deleted = false
ORDER BY CMP.comp_id, BR.br_is_default DESC, BR.br_name ASC$seed$)
    ,(57, 'STATE MAIN LIST'             , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	stm_id,
	stm_name,
	stm_short,
	stm_alias,
	stm_order,
	stm_is_active
FROM sales.state_master
WHERE stm_is_deleted = istm_is_deleted
ORDER BY stm_name$seed$)
    ,(58, 'CITY MAIN LIST'              , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	CM.ctm_id,
	CM.ctm_name,
	CM.ctm_short,
	CM.ctm_alias,
	SM.stm_name,
	CM.ctm_order,
	CM.ctm_is_active
FROM sales.city_master CM
	 INNER JOIN sales.state_master SM ON SM.stm_id = CM.ctm_state_id
WHERE CM.ctm_is_deleted = ictm_is_deleted
ORDER BY CM.ctm_name$seed$)
    ,(59, 'AREA MAIN LIST'              , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	AM.arm_id,
	AM.arm_name,
	AM.arm_short,
	AM.arm_alias,
	CM.ctm_name,
	AM.arm_sort,
	AM.arm_distance_km,
	AM.arm_is_active
FROM sales.area_master AM
	 INNER JOIN sales.city_master CM ON CM.ctm_id = AM.arm_city_id
WHERE AM.arm_is_deleted = iarm_is_deleted
ORDER BY AM.arm_name$seed$)
    ,(60, 'Ledger shipping address'     , NULL, 'Name'            , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT saa_id, saa_ledger_id, saa_addr_type, saa_is_default, saa_sort, saa_trade_name
	FROM accounts.acc_ship_addrs where saa_is_deleted=wantdelete$seed$)
    ,(61, 'SUPPLIER GROUP MAIN LIST'    , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	spg_id,
	spg_name,
	spg_short,
	spg_alias,	
	spg_desc,
	spg_is_active
FROM purchase.supplier_groups
WHERE spg_is_deleted = ispg_is_deleted
ORDER BY spg_name$seed$)
    ,(62, 'USERS MAIN LIST'             , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
    usr_id,                  
    usr_login_name,
    usr_display_name,
    usr_full_name,
    usr_mobile_no,
    usr_type,
    usr_is_active,
    usr_is_locked,
    usr_last_login_on
FROM public.user_master
WHERE usr_is_deleted = false
ORDER BY usr_display_name$seed$)
    ,(63, 'SUPPLIER MAIN LIST'          , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
    sup_id,                  
    sup_short,
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
    ,(64, 'configs'                     , NULL, 'Id'              , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT config_id, config_name, config_value
	FROM public.configs$seed$)
    ,(65, 'CUSTOMER MAIN LIST'          , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	cus_id,
	cus_short,
	cus_name
	
FROM sales.customers
ORDER BY cus_name$seed$)
    ,(66, 'CUSTOMER GROUP MAIN LIST'    , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	cgr_id,
	cgr_short
	cgr_name,
	cgr_alias,
	cgr_narration,
	cgr_order, 
	cgr_is_active
FROM sales.cust_groups
WHERE cgr_is_deleted = icgr_is_deleted
ORDER BY cgr_name$seed$)
    ,(67, 'ITEM MAIN LIST'              , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	item_id,
	item_code,
	item_name_en,
	item_name_ta
FROM inventory.item_master
ORDER BY item_name_en$seed$)
    ,(68, 'POPUP - UNITS'               , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	unit_id,
	unit_name,
	unit_weight
FROM inventory.item_unit_master
WHERE unit_is_active = true AND unit_is_deleted = false
ORDER BY unit_name$seed$)
    ,(69, 'POPUP - GODOWNS'             , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	gdl_id,
	gdl_name
FROM inventory.godown_locations
WHERE gdl_is_active = true AND gdl_is_deleted = false
ORDER BY gdl_name$seed$)
    ,(70, 'POPUP - BRANCH'              , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	br_id,
	br_name
FROM public.branch_master
WHERE br_is_active = true AND br_is_deleted = false
ORDER BY br_name$seed$)
    ,(71, 'POPUP - ITEMS'               , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	IM.item_id,
	CM.iuc_id AS item_uom_id,
	IM.item_name_en,
	UM.unit_name
FROM inventory.item_master IM
	 INNER JOIN inventory.item_unit_conversion CM ON CM.iuc_item_id = IM.item_id
	 INNER JOIN inventory.item_unit_master UM ON UM.unit_id = CM.iuc_unit_id
WHERE IM.item_is_active = true AND IM.item_is_deleted = false
ORDER BY IM.item_name_en$seed$)
    ,(72, 'POPUP - COMPANYS'            , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	comp_id, 
	comp_name
FROM public.companys
WHERE comp_is_active = true AND comp_is_deleted = false
ORDER BY comp_id$seed$)
    ,(73, 'EMP DEPARTMENT MAIN LIST'    , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	edpt_id,
	edpt_code,
	edpt_name,	
	edpt_alias,
	edpt_remarks
FROM public.employee_departments
WHERE edpt_is_active = true  
ORDER BY edpt_name$seed$)
    ,(74, 'FREIGHT CHARGES MAIN LIST'   , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
WHERE FM.fr_is_deleted = false
ORDER BY FM.fr_company_id, FM.fr_branch_id, FM.fr_from_km, FM.fr_from_weight$seed$)
    ,(75, 'EMP DESIGNATIONS MAIN LIST'  , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	ed_id,
	ed_code
	ed_name,
	ed_remarks,
	ed_is_active
FROM public.employee_designations
WHERE ed_is_deleted = ied_is_deleted
ORDER BY ed_name$seed$)
    ,(76, 'LOADING CHARGES MAIN LIST'   , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
WHERE ilc_is_deleted = false
ORDER BY LC.ilc_comp_id, LC.ilc_branch_id, LC.ilc_from_weight$seed$)
    ,(77, 'EMPLOYEES MAIN LIST'         , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
    e.emp_id,
    e.emp_code,
    e.emp_name,
    e.emp_alias,
    e.emp_mobile1,
    d.edpt_name              AS department,
    g.ed_name                AS designation,
    e.emp_status,
    e.emp_salary_type
FROM public.employee_master e
INNER JOIN public.employee_departments  d ON d.edpt_id = e.emp_department_id
LEFT JOIN public.employee_designations g ON g.ed_id   = e.emp_designation_id
WHERE e.emp_is_deleted = false  
ORDER BY e.emp_name$seed$)
    ,(78, 'POPUP - PRICE LEVELS'        , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	ipl_id,
	ipl_name
FROM inventory.item_price_levels
WHERE ipl_status = true
ORDER BY ipl_id$seed$)
    ,(79, 'POPUP - CUSTOMERS'           , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	cus_id,
	cus_name,
	cus_short
FROM sales.customers
WHERE cus_is_active = true AND cus_is_deleted = false
ORDER BY cus_name$seed$)
    ,(80, 'charge master'               , NULL, '#'               , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT chg_id, chg_name, chg_code, chg_module, chg_role, chg_method, chg_type, chg_apply_on, chg_default_rate, chg_landing_cost, chg_cost_alloc, chg_ledger_code, chg_tax_apl, chg_before_tax, chg_sep_post, chg_man_party, chg_disp_order, chg_auto_apply
	FROM public.charge_master$seed$)
    ,(81, 'CHARGES MAIN LIST'           , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
    ,(82, 'POPUP - CHARGE MASTER'       , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	chg_id,
	chg_name
FROM public.charge_master
WHERE chg_is_active = true
	AND chg_is_deleted = false
	AND chg_module IN ('B', 'imodule_name')
ORDER BY chg_name$seed$)
    ,(83, 'QUOTATION - MAIN LIST'       , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
     
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
    q.sq_converted_doc_id,
    q.sq_cancelled_on

FROM sales.sale_quotation q

 WHERE q.sq_company_id = 'icompany_id'::uuid
  AND q.sq_branch_id  = 'ibranch_id'::uuid
  AND q.sq_acc_year   = 'iacc_year'

   
   
  AND (NULLIF('ifrom_date', '') IS NULL OR q.sq_quote_date >= 'ifrom_date'::date)
  AND (NULLIF('ito_date',   '') IS NULL OR q.sq_quote_date <= 'ito_date'::date)

ORDER BY q.sq_quote_date DESC, q.sq_quote_slno DESC$seed$)
    ,(84, 'Quotation'                   , NULL, '#'               , 'Ascending', 'web'    , true , false, 'system', $seed$SELECT     
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
    q.sq_converted_doc_id,
    q.sq_cancelled_on
FROM sales.sale_quotation q
 WHERE q.sq_company_id = 'icompany_id'::uuid
  AND q.sq_branch_id  = 'ibranch_id'::uuid
  AND q.sq_acc_year   = 'iacc_year' 
   AND (NULLIF('ifrom_date', '') IS NULL OR q.sq_quote_date >= 'ifrom_date'::date)
  AND (NULLIF('ito_date',   '') IS NULL OR q.sq_quote_date <= 'ito_date'::date)
ORDER BY q.sq_quote_date DESC, q.sq_quote_slno DESC$seed$)
    ,(85, 'TENDERS - MAIN LIST'         , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
     
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
    ,(86, 'BILLS - MAIN LIST'           , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
	b.sb_id,
	b.sb_company_id,
	b.sb_branch_id,
	b.sb_acc_year,
	b.sb_bill_date,
	b.sb_bill_refno,
	b.sb_bill_type,
	c.cus_name,
	c.cus_addr3,
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
    ,(87, 'SO - MAIN LIST'              , NULL, NULL              , 'Ascending', 'Desktop', true , false, 'system', $seed$SELECT
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
ON CONFLICT (grid_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
    (SELECT GREATEST(COALESCE(MAX(grid_id), 0), 1) FROM fixed.grid_details),
    true
);

COMMIT;
