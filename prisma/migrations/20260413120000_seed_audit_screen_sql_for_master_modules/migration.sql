UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    unit_name AS "Unit Name",
    unit_alias AS "Alias",
    unit_code AS "Code",
    unit_description AS "Description",
    unit_decimal_count AS "Decimal Count",
    unit_weight AS "Weight",
    unit_loading AS "Loading",
    unit_unloading AS "Unloading",
    unit_attach_charge AS "Attach Charge",
    unit_is_pack_unit AS "Is Pack Unit",
    unit_base_unit_id AS "Base Unit ID",
    unit_conversion AS "Conversion Factor",
    unit_is_active AS "Is Active",
    unit_is_deleted AS "Is Deleted",
    unit_sync_date AS "Sync Date",
    unit_created_on AS "Created On",
    unit_created_by AS "Created By",
    unit_modified_on AS "Modified On",
    unit_modified_by AS "Modified By"
FROM inventory.item_unit_master;$$
WHERE screen_name = 'Units Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    itg_name AS "Item Group Name",
    itg_alias AS "Item Group Alias",
    itg_short AS "Short Code",
    itg_description AS "Description",
    itg_parent_id AS "Parent Group ID",
    itg_sort AS "Sort Order",
    itg_level AS "Hierarchy Level",
    itg_path_ids_cache AS "Path IDs Cache",
    itg_tax_claim AS "Tax Claim",
    itg_default_tax_id AS "Default Tax ID",
    itg_default_hsn AS "Default HSN Code",
    itg_default_uom_id AS "Default UOM ID",
    itg_photo_url AS "Photo URL",
    itg_is_active AS "Is Active",
    itg_is_deleted AS "Is Deleted",
    itg_sync_date AS "Sync Date",
    itg_created_on AS "Created On",
    itg_created_by AS "Created By",
    itg_modified_on AS "Modified On",
    itg_modified_by AS "Modified By"
FROM inventory.item_group_master;$$
WHERE screen_name = 'Item Group Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    brand_name AS "Brand Name",
    brand_alias AS "Alias",
    brand_short AS "Short Code",
    brand_description AS "Description",
    brand_parent_id AS "Parent Brand ID",
    brand_sort AS "Sort Order",
    brand_level AS "Hierarchy Level",
    brand_path_ids AS "Path IDs",
    brand_photo_url AS "Photo URL",
    brand_is_active AS "Is Active",
    brand_is_deleted AS "Is Deleted",
    brand_sync_date AS "Sync Date",
    brand_created_on AS "Created On",
    brand_created_by AS "Created By",
    brand_modified_on AS "Modified On",
    brand_modified_by AS "Modified By"
FROM inventory.item_brand_master;$$
WHERE screen_name = 'Item Brand Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    category_name AS "Category Name",
    category_alias AS "Alias",
    category_short AS "Short Code",
    category_description AS "Description",
    category_parent_id AS "Parent Category ID",
    category_sort AS "Sort Order",
    category_level AS "Hierarchy Level",
    category_path_ids_cache AS "Path IDs Cache",
    category_photo_url AS "Photo URL",
    category_is_active AS "Is Active",
    category_is_deleted AS "Is Deleted",
    category_sync_date AS "Sync Date",
    category_created_on AS "Created On",
    category_created_by AS "Created By",
    category_modified_on AS "Modified On",
    category_modified_by AS "Modified By"
FROM inventory.item_category_master;$$
WHERE screen_name = 'Category Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    sec_name AS "Section Name",
    sec_alias AS "Alias",
    sec_short AS "Short Code",
    sec_description AS "Description",
    sec_parent_id AS "Parent Section ID",
    sec_sort AS "Sort Order",
    sec_level AS "Hierarchy Level",
    sec_path_ids AS "Path IDs",
    sec_position AS "Position",
    sec_color_code AS "Color Code",
    sec_icon AS "Icon",
    sec_photo_url AS "Photo URL",
    sec_is_active AS "Is Active",
    sec_is_deleted AS "Is Deleted",
    sec_sync_date AS "Sync Date",
    sec_created_on AS "Created On",
    sec_created_by AS "Created By",
    sec_modified_on AS "Modified On",
    sec_modified_by AS "Modified By"
FROM inventory.item_section_master;$$
WHERE screen_name = 'Item Section Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    tax_name AS "Tax Name",
    tax_code AS "Tax Code",
    tax_taxability_type AS "Taxability Type",
    tax_is_reverse_charge AS "Is Reverse Charge",
    tax_cgst_perc AS "CGST %",
    tax_sgst_perc AS "SGST %",
    tax_igst_perc AS "IGST %",
    tax_cgst_pur_perc AS "CGST Purchase %",
    tax_sgst_pur_perc AS "SGST Purchase %",
    tax_igst_pur_perc AS "IGST Purchase %",
    tax_cess_type AS "Cess Type",
    tax_cess_perc AS "Cess %",
    tax_cess_unit AS "Cess Unit",
    tax_cess_pur_perc AS "Cess Purchase %",
    tax_cess_pur_unit AS "Cess Purchase Unit",
    tax_gst_rate_total AS "GST Rate Total",
    tax_is_active AS "Is Active",
    tax_is_deleted AS "Is Deleted",
    tax_sync_date AS "Sync Date",
    tax_created_on AS "Created On",
    tax_created_by AS "Created By",
    tax_modified_on AS "Modified On",
    tax_modified_by AS "Modified By"
FROM inventory.item_tax_master;$$
WHERE screen_name = 'Item Tax Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    ith_item_id AS "Item ID",
    ith_tax_id AS "Tax ID",
    ith_effective_from AS "Effective From",
    ith_effective_to AS "Effective To",
    ith_reason AS "Reason",
    ith_created_on AS "Created On",
    ith_created_by AS "Created By"
FROM inventory.item_tax_history;$$
WHERE screen_name = 'Item Tax History';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    ean_item_id AS "Item ID",
    ean_unit_id AS "Unit ID",
    ean_code AS "EAN / Barcode",
    ean_godown_id AS "Godown ID",
    ean_is_default AS "Is Default",
    ean_is_active AS "Is Active",
    ean_is_deleted AS "Is Deleted",
    ean_created_on AS "Created On",
    ean_created_by AS "Created By",
    ean_modified_on AS "Modified On",
    ean_modified_by AS "Modified By",
    ean_remarks AS "Remarks"
FROM inventory.item_ean_codes;$$
WHERE screen_name = 'Item EAN Code Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    csr_branch_id AS "Branch ID",
    csr_customer_id AS "Customer ID",
    csr_unit_rate_id AS "Unit Rate ID",
    csr_rate_type AS "Rate Type",
    csr_item_rate AS "Item Rate",
    csr_disc_perc AS "Discount %",
    csr_disc_qty AS "Discount Qty",
    csr_price_level AS "Price Level",
    csr_valid_from AS "Valid From",
    csr_valid_to AS "Valid To",
    csr_priority AS "Priority",
    csr_is_active AS "Is Active",
    csr_is_deleted AS "Is Deleted",
    csr_created_on AS "Created On",
    csr_created_by AS "Created By",
    csr_modified_on AS "Modified On",
    csr_modified_by AS "Modified By",
    csr_uploaded_at AS "Uploaded At",
    csr_uploaded_by AS "Uploaded By",
    csr_remarks AS "Remarks"
FROM public.cust_item_rates;$$
WHERE screen_name = 'Item Customer Rate Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    iqr_branch_id AS "Branch ID",
    iqr_unit_rate_id AS "Unit Rate ID",
    iqr_price_level AS "Price Level",
    iqr_start_qty AS "Start Qty",
    iqr_end_qty AS "End Qty",
    iqr_each_qty AS "Each Qty",
    iqr_sales_price AS "Sales Price",
    iqr_price_wot AS "Price WOT",
    iqr_price_margin AS "Price Margin",
    iqr_disc_perc AS "Discount %",
    iqr_disc_qty AS "Discount Qty",
    iqr_valid_from AS "Valid From",
    iqr_valid_to AS "Valid To",
    iqr_priority AS "Priority",
    iqr_is_active AS "Is Active",
    iqr_is_deleted AS "Is Deleted",
    iqr_created_on AS "Created On",
    iqr_created_by AS "Created By",
    iqr_modified_on AS "Modified On",
    iqr_modified_by AS "Modified By",
    iqr_remarks AS "Remarks"
FROM inventory.item_qtywise_rates;$$
WHERE screen_name = 'Item Qtywise Rate Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    ir_branch_id AS "Branch ID",
    ir_item_id AS "Item ID",
    ir_godown_id AS "Godown ID",
    ir_unit_id AS "Unit ID",
    ir_min_level AS "Min Level",
    ir_max_level AS "Max Level",
    ir_reorder_level AS "Reorder Level",
    ir_reorder_qty AS "Reorder Qty",
    ir_lead_time_days AS "Lead Time Days",
    ir_review_cycle_days AS "Review Cycle Days",
    ir_reorder_days AS "Reorder Days",
    ir_expiry_buffer_days AS "Expiry Buffer Days",
    ir_reorder_type AS "Reorder Type",
    ir_is_active AS "Is Active",
    ir_is_deleted AS "Is Deleted",
    ir_created_on AS "Created On",
    ir_created_by AS "Created By",
    ir_modified_on AS "Modified On",
    ir_modified_by AS "Modified By",
    ir_remarks AS "Remarks"
FROM inventory.item_reorders;$$
WHERE screen_name = 'Item Reorder Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    gdl_godown_id AS "Godown ID",
    gdl_branch_id AS "Branch ID",
    gdl_name AS "Location Name",
    gdl_short AS "Short Code",
    gdl_code AS "Code",
    gdl_type AS "Type",
    gdl_parent_id AS "Parent Location ID",
    gdl_sort AS "Sort Order",
    gdl_level AS "Hierarchy Level",
    gdl_path_ids_cache AS "Path IDs Cache",
    gdl_del_sheet AS "Delivery Sheet",
    gdl_split_stock AS "Split Stock",
    gdl_negative_stock AS "Allow Negative Stock",
    gdl_volume AS "Volume",
    gdl_remarks AS "Remarks",
    gdl_is_active AS "Is Active",
    gdl_is_deleted AS "Is Deleted",
    gdl_created_on AS "Created On",
    gdl_created_by AS "Created By",
    gdl_modified_on AS "Modified On",
    gdl_modified_by AS "Modified By"
FROM inventory.godown_locations;$$
WHERE screen_name = 'Godown Location Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    acc_group_name AS "Group Name",
    acc_group_alias AS "Alias",
    acc_group_short AS "Short Code",
    acc_group_description AS "Description",
    acc_group_tally_name AS "Tally Name",
    acc_group_primary_name AS "Primary Name",
    acc_group_nature AS "Nature",
    acc_group_type_code AS "Type Code",
    acc_group_parent_id AS "Parent Group ID",
    acc_group_sort AS "Sort Order",
    acc_group_child_ids AS "Child IDs",
    acc_group_company_id AS "Company ID",
    acc_group_is_default AS "Is Default",
    acc_group_behave_as_subledger AS "Behave As Subledger",
    acc_group_net_debit_credit AS "Net Debit/Credit",
    acc_group_used_for_calculation AS "Used For Calculation",
    acc_group_affects_gross_profit AS "Affects Gross Profit",
    acc_group_is_active AS "Is Active",
    acc_group_is_deleted AS "Is Deleted",
    acc_group_sync_date AS "Sync Date",
    acc_group_created_on AS "Created On",
    acc_group_created_by AS "Created By",
    acc_group_modified_on AS "Modified On",
    acc_group_modified_by AS "Modified By"
FROM accounts.account_groups;$$
WHERE screen_name = 'Account Group Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    cog_group_name AS "Company Group Name",
    cog_company_ids AS "Company IDs",
    cog_is_active AS "Is Active",
    cog_is_deleted AS "Is Deleted",
    cog_sync_date AS "Sync Date",
    cog_created_on AS "Created On",
    cog_created_by AS "Created By",
    cog_modified_on AS "Modified On",
    cog_modified_by AS "Modified By"
FROM public.company_group_master;$$
WHERE screen_name = 'Company Group Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    comp_code AS "Company Code",
    comp_name AS "Company Name",
    comp_short AS "Short Name",
    comp_legal_name AS "Legal Name",
    comp_gstin_no AS "GSTIN",
    comp_gst_reg_type AS "GST Reg Type",
    comp_pan_no AS "PAN",
    comp_fssai_no AS "FSSAI No",
    comp_addr1 AS "Address 1",
    comp_addr2 AS "Address 2",
    comp_addr3 AS "Address 3",
    comp_city AS "City",
    comp_district AS "District",
    comp_state AS "State",
    comp_state_code AS "State Code",
    comp_pin AS "PIN Code",
    comp_country AS "Country",
    comp_tel AS "Telephone",
    comp_phone AS "Phone",
    comp_mail AS "Email",
    comp_support_email AS "Support Email",
    comp_support_phone AS "Support Phone",
    comp_website_name AS "Website",
    comp_fin_year_from AS "Fin Year From",
    comp_fin_year_to AS "Fin Year To",
    comp_gst_applicable AS "GST Applicable",
    comp_einvoice_applicable AS "E-Invoice Applicable",
    comp_eway_applicable AS "E-Way Applicable",
    comp_currency_code AS "Currency Code",
    comp_currency_symbol AS "Currency Symbol",
    comp_locale_code AS "Locale Code",
    comp_default AS "Is Default",
    comp_is_active AS "Is Active",
    comp_is_deleted AS "Is Deleted",
    comp_sync_date AS "Sync Date",
    comp_created_on AS "Created On",
    comp_created_by AS "Created By",
    comp_modified_on AS "Modified On",
    comp_modified_by AS "Modified By"
FROM public.companys;$$
WHERE screen_name = 'Company Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    br_code AS "Branch Code",
    br_name AS "Branch Name",
    br_mailing_name AS "Mailing Name",
    br_alias AS "Alias",
    br_short AS "Short Name",
    br_type AS "Branch Type",
    br_is_default AS "Is Default",
    br_is_active AS "Is Active",
    br_addr1 AS "Address 1",
    br_addr2 AS "Address 2",
    br_addr3 AS "Address 3",
    br_city AS "City",
    br_district AS "District",
    br_state AS "State",
    br_state_code AS "State Code",
    br_pin AS "PIN Code",
    br_country AS "Country",
    br_landmark AS "Landmark",
    br_contact_person AS "Contact Person",
    br_tel AS "Telephone",
    br_phone AS "Phone",
    br_mail AS "Email",
    br_bill_prefix AS "Bill Prefix",
    br_rounding_mode AS "Rounding Mode",
    br_rounding_value AS "Rounding Value",
    br_pos_type AS "POS Type",
    br_allow_negative_stock AS "Allow Negative Stock",
    br_fssai_no AS "FSSAI No",
    br_fssai_license_type AS "FSSAI License Type",
    br_fssai_valid_upto AS "FSSAI Valid Upto",
    br_is_deleted AS "Is Deleted",
    br_sync_date AS "Sync Date",
    br_created_on AS "Created On",
    br_created_by AS "Created By",
    br_modified_on AS "Modified On",
    br_modified_by AS "Modified By"
FROM public.branch_master;$$
WHERE screen_name = 'Branch Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    edpt_name AS "Department Name",
    edpt_alias AS "Alias",
    edpt_code AS "Code",
    edpt_remarks AS "Remarks",
    edpt_is_active AS "Is Active",
    edpt_is_deleted AS "Is Deleted",
    edpt_sync_date AS "Sync Date",
    edpt_created_on AS "Created On",
    edpt_created_by AS "Created By",
    edpt_modified_on AS "Modified On",
    edpt_modified_by AS "Modified By"
FROM accounts.employee_departments;$$
WHERE screen_name = 'Employee Department Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    ed_name AS "Designation Name",
    ed_code AS "Code",
    ed_is_default AS "Is Default",
    ed_remarks AS "Remarks",
    ed_is_active AS "Is Active",
    ed_is_deleted AS "Is Deleted",
    ed_sync_date AS "Sync Date",
    ed_created_on AS "Created On",
    ed_created_by AS "Created By",
    ed_modified_on AS "Modified On",
    ed_modified_by AS "Modified By"
FROM accounts.employee_designations;$$
WHERE screen_name = 'Employee Designation Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    emp_company_id AS "Company ID",
    emp_branch_id AS "Branch ID",
    emp_code AS "Employee Code",
    emp_name AS "Employee Name",
    emp_alias AS "Alias",
    emp_mobile1 AS "Mobile 1",
    emp_mobile2 AS "Mobile 2",
    emp_email AS "Email",
    emp_addr1 AS "Address 1",
    emp_addr2 AS "Address 2",
    emp_addr3 AS "Address 3",
    emp_city AS "City",
    emp_district AS "District",
    emp_state AS "State",
    emp_pincode AS "PIN Code",
    emp_gender AS "Gender",
    emp_marital_status AS "Marital Status",
    emp_blood_group AS "Blood Group",
    emp_dob AS "Date of Birth",
    emp_department_id AS "Department ID",
    emp_designation_id AS "Designation ID",
    emp_employment_type AS "Employment Type",
    emp_status AS "Status",
    emp_joined_on AS "Date of Joining",
    emp_probation_end_on AS "Probation End On",
    emp_confirmation_on AS "Confirmation On",
    emp_left_on AS "Date of Leaving",
    emp_overtime_allowed AS "Overtime Allowed",
    emp_has_commission AS "Has Commission",
    emp_commission_type AS "Commission Type",
    emp_commission_value AS "Commission Value",
    emp_salary_type AS "Salary Type",
    emp_salary_amount AS "Salary Amount",
    emp_bata_amount AS "Bata Amount",
    emp_km_bata_amount AS "KM Bata Amount",
    emp_pan_no AS "PAN",
    emp_aadhar_no AS "Aadhaar",
    emp_pf_no AS "PF No",
    emp_esi_no AS "ESI No",
    emp_photo_url AS "Photo URL",
    emp_remarks AS "Remarks",
    emp_is_active AS "Is Active",
    emp_is_deleted AS "Is Deleted",
    emp_sync_date AS "Sync Date",
    emp_created_on AS "Created On",
    emp_created_by AS "Created By",
    emp_modified_on AS "Modified On",
    emp_modified_by AS "Modified By"
FROM sales.emp_master;$$
WHERE screen_name = 'Employee Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    led_name AS "Ledger Name",
    led_alias AS "Alias",
    led_short AS "Short Code",
    led_tally_name AS "Tally Name",
    led_category AS "Category",
    led_group_id AS "Group ID",
    led_company_id AS "Company ID",
    led_branch_id AS "Branch ID",
    led_contact_person AS "Contact Person",
    led_email AS "Email",
    led_tel AS "Telephone",
    led_phone1 AS "Phone 1",
    led_phone2 AS "Phone 2",
    led_whatsapp_no AS "WhatsApp",
    led_addr1 AS "Address 1",
    led_addr2 AS "Address 2",
    led_addr3 AS "Address 3",
    led_city AS "City",
    led_district AS "District",
    led_state_name AS "State",
    led_state_code AS "State Code",
    led_pin AS "PIN Code",
    led_country AS "Country",
    led_gst_party_reg_type AS "GST Reg Type",
    led_gstin_no AS "GSTIN",
    led_pan_no AS "PAN",
    led_aadhar_no AS "Aadhaar",
    led_ecommerce_gstin AS "E-Commerce GSTIN",
    led_is_sez AS "Is SEZ",
    led_holder_name AS "Account Holder",
    led_bank_name AS "Bank Name",
    led_bank_branch AS "Bank Branch",
    led_bank_ac_no AS "Bank Account No",
    led_bank_ifsc AS "Bank IFSC",
    led_upi_id AS "UPI ID",
    led_ob_amount AS "Opening Balance",
    led_ob_type AS "Opening Balance Type",
    led_ob_as_on AS "Opening Balance As On",
    led_total_dr AS "Total Debit",
    led_total_cr AS "Total Credit",
    led_total_balance AS "Total Balance",
    led_is_active AS "Is Active",
    led_is_deleted AS "Is Deleted",
    led_allow_edit AS "Allow Edit",
    led_is_entry AS "Is Entry",
    led_allow_sms AS "Allow SMS",
    led_remarks AS "Remarks",
    led_sync_date AS "Sync Date",
    led_created_on AS "Created On",
    led_created_by AS "Created By",
    led_modified_on AS "Modified On",
    led_modified_by AS "Modified By"
FROM accounts.acc_ledger_master;$$
WHERE screen_name = 'Account Ledger Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    lba_ledger_id AS "Ledger ID",
    lba_account_holder AS "Account Holder",
    lba_bank_name AS "Bank Name",
    lba_branch_name AS "Bank Branch",
    lba_account_no AS "Account Number",
    lba_ifsc_code AS "IFSC Code",
    lba_micr_code AS "MICR Code",
    lba_account_type AS "Account Type",
    lba_upi_id AS "UPI ID",
    lba_cheque_name AS "Cheque Name",
    lba_is_default AS "Is Default",
    lba_is_active AS "Is Active",
    lba_is_deleted AS "Is Deleted",
    lba_sync_date AS "Sync Date",
    lba_created_on AS "Created On",
    lba_created_by AS "Created By",
    lba_modified_on AS "Modified On",
    lba_modified_by AS "Modified By",
    lba_remarks AS "Remarks"
FROM accounts.acc_ledger_bank_accounts;$$
WHERE screen_name = 'Ledger Bank Account';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    saa_company_id AS "Company ID",
    saa_ledger_id AS "Ledger ID",
    saa_addr_type AS "Address Type",
    saa_is_default AS "Is Default",
    saa_sort AS "Sort Order",
    saa_trdnm AS "Trade Name",
    saa_contact_name AS "Contact Name",
    saa_addr1 AS "Address 1",
    saa_addr2 AS "Address 2",
    saa_addr3 AS "Address 3",
    saa_loc AS "Location",
    saa_pin AS "PIN Code",
    saa_state_code AS "State Code",
    saa_state_name AS "State Name",
    saa_distance_km AS "Distance KM",
    saa_phone AS "Phone",
    saa_email AS "Email",
    saa_gstin AS "GSTIN",
    saa_pan AS "PAN",
    saa_sync_date AS "Sync Date",
    saa_is_active AS "Is Active",
    saa_is_deleted AS "Is Deleted",
    saa_created_on AS "Created On",
    saa_created_by AS "Created By",
    saa_modified_on AS "Modified On",
    saa_modified_by AS "Modified By",
    saa_remarks AS "Remarks"
FROM accounts.acc_ship_addrs;$$
WHERE screen_name = 'Ledger Shipping Address';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    gsp_provider_name AS "Provider Name",
    gsp_provider_code AS "Provider Code",
    gsp_base_url AS "Base URL",
    gsp_route AS "Route",
    gsp_ip_address AS "IP Address",
    gsp_user_name AS "Username",
    gsp_is_active AS "Is Active",
    gsp_is_deleted AS "Is Deleted",
    gsp_created_on AS "Created On",
    gsp_created_by AS "Created By",
    gsp_modified_on AS "Modified On",
    gsp_modified_by AS "Modified By"
FROM fixed.gsp_provider_master;$$
WHERE screen_name = 'GSP Provider Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    csg_company_id AS "Company ID",
    csg_gsp_provider_id AS "GSP Provider ID",
    csg_service_type AS "Service Type",
    csg_euser_name AS "E-User Name",
    csg_auth_token_valid_till AS "Auth Token Valid Till",
    csg_is_active AS "Is Active",
    csg_is_deleted AS "Is Deleted",
    csg_sync_date AS "Sync Date",
    csg_created_on AS "Created On",
    csg_created_by AS "Created By",
    csg_modified_on AS "Modified On",
    csg_modified_by AS "Modified By"
FROM fixed.gsp_company_service;$$
WHERE screen_name = 'GSP Company Service';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    acc_ttm_type_name AS "Tender Type Name",
    acc_ttm_type_short_name AS "Tender Type Short Name",
    acc_ttm_type_is_active AS "Is Active",
    acc_ttm_type_is_deleted AS "Is Deleted",
    acc_ttm_type_sync_date AS "Sync Date",
    acc_ttm_type_created_on AS "Created On",
    acc_ttm_type_created_by AS "Created By",
    acc_ttm_type_modified_on AS "Modified On",
    acc_ttm_type_modified_by AS "Modified By"
FROM accounts.tender_type;$$
WHERE screen_name = 'Tender Type Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    acc_tnd_type_id AS "Tender Type ID",
    acc_tnd_tnd_name AS "Tender Name",
    acc_tnd_tnd_short_name AS "Tender Short Name",
    acc_tnd_tnd_ledger_id AS "Ledger ID",
    acc_tnd_tnd_min_amount AS "Min Amount",
    acc_tnd_tnd_max_amount AS "Max Amount",
    acc_tnd_tnd_display_position AS "Display Position",
    acc_tnd_tnd_surcharge_perc AS "Surcharge %",
    acc_tnd_tnd_edit_surcharge AS "Edit Surcharge",
    acc_tnd_tnd_edit_ledger AS "Edit Ledger",
    acc_tnd_tnd_is_active AS "Is Active",
    acc_tnd_tnd_is_deleted AS "Is Deleted",
    acc_tnd_tnd_sync_date AS "Sync Date",
    acc_tnd_tnd_created_on AS "Created On",
    acc_tnd_tnd_created_by AS "Created By",
    acc_tnd_tnd_modified_on AS "Modified On",
    acc_tnd_tnd_modified_by AS "Modified By",
    acc_tnd_tnd_remarks AS "Remarks"
FROM accounts.account_tender_master;$$
WHERE screen_name = 'Tender Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    spg_name AS "Supplier Group Name",
    spg_alias AS "Alias",
    spg_short AS "Short Code",
    spg_desc AS "Description",
    spg_is_active AS "Is Active",
    spg_is_deleted AS "Is Deleted",
    spg_sync_date AS "Sync Date",
    spg_created_on AS "Created On",
    spg_created_by AS "Created By",
    spg_modified_on AS "Modified On",
    spg_modified_by AS "Modified By"
FROM purchase.supplier_groups;$$
WHERE screen_name = 'Supplier Group Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    sup_company_id AS "Company ID",
    sup_branch_id AS "Branch ID",
    sup_group_id AS "Supplier Group ID",
    sup_purchase_type AS "Purchase Type",
    sup_name AS "Supplier Name",
    sup_short AS "Short Name",
    sup_addr1 AS "Address 1",
    sup_addr2 AS "Address 2",
    sup_addr3 AS "Address 3",
    sup_city AS "City",
    sup_district AS "District",
    sup_state_name AS "State",
    sup_country AS "Country",
    sup_pincode AS "PIN Code",
    sup_tel AS "Telephone",
    sup_phone AS "Phone",
    sup_mail_id AS "Email",
    sup_whatsapp_no AS "WhatsApp",
    sup_website_address AS "Website",
    sup_cheque_pre_name AS "Cheque Prefix Name",
    sup_notes AS "Notes",
    sup_credit_days AS "Credit Days",
    sup_cash_disc_perc AS "Cash Discount %",
    sup_collection_days AS "Collection Days",
    sup_gst_no AS "GSTIN",
    sup_state_code AS "State Code",
    sup_pan_no AS "PAN",
    sup_gst_type AS "GST Type",
    sup_sup_cst AS "CST No",
    sup_drug_liscence_no AS "Drug License No",
    sup_is_active AS "Is Active",
    sup_is_deleted AS "Is Deleted",
    sup_sync_date AS "Sync Date",
    sup_created_on AS "Created On",
    sup_created_by AS "Created By",
    sup_modified_on AS "Modified On",
    sup_modified_by AS "Modified By"
FROM purchase.suppliers;$$
WHERE screen_name = 'Supplier Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    cgr_company_id AS "Company ID",
    cgr_branch_id AS "Branch ID",
    cgr_name AS "Customer Group Name",
    cgr_alias AS "Alias",
    cgr_short AS "Short Code",
    cgr_narration AS "Narration",
    cgr_order AS "Sort Order",
    cgr_disc_perc AS "Discount %",
    cgr_collection_days AS "Collection Days",
    cgr_debit_allowed AS "Credit Allowed",
    cgr_debit_days AS "Credit Days",
    cgr_debit_limit AS "Credit Limit",
    cgr_bills_limit AS "Bills Limit",
    cgr_overdue_billing AS "Overdue Billing",
    cgr_is_active AS "Is Active",
    cgr_is_deleted AS "Is Deleted",
    cgr_created_on AS "Created On",
    cgr_modified_on AS "Modified On"
FROM sales.cust_groups;$$
WHERE screen_name = 'Customer Group Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    cus_company_id AS "Company ID",
    cus_branch_id AS "Branch ID",
    cus_area_id AS "Area ID",
    cus_group_id AS "Customer Group ID",
    cus_title AS "Title",
    cus_short AS "Short Name",
    cus_code AS "Customer Code",
    cus_name AS "Customer Name",
    cus_addr1 AS "Address 1",
    cus_addr2 AS "Address 2",
    cus_addr3 AS "Address 3",
    cus_city AS "City",
    cus_district AS "District",
    cus_state_name AS "State",
    cus_country AS "Country",
    cus_state_code AS "State Code",
    cus_landmark AS "Landmark",
    cus_pin AS "PIN Code",
    cus_tel AS "Telephone",
    cus_phone1 AS "Phone 1",
    cus_phone2 AS "Phone 2",
    cus_whatsapp_no AS "WhatsApp",
    cus_email AS "Email",
    cus_contact_person AS "Contact Person",
    cus_credit_allowed AS "Credit Allowed",
    cus_credit_bill_limit AS "Credit Bill Limit",
    cus_credit_amt_limit AS "Credit Amount Limit",
    cus_credit_days AS "Credit Days",
    cus_disc_perc AS "Discount %",
    cus_allow_promotion AS "Allow Promotion",
    cus_allow_loyalty AS "Allow Loyalty",
    cus_allow_discount AS "Allow Discount",
    cus_gst_no AS "GSTIN",
    cus_pan_no AS "PAN",
    cus_gst_type AS "GST Type",
    cus_ecommerce_gstin AS "E-Commerce GSTIN",
    cus_tcs_applicable AS "TCS Applicable",
    cus_price_level_id AS "Price Level ID",
    cus_notes AS "Notes",
    cus_is_active AS "Is Active",
    cus_is_deleted AS "Is Deleted",
    cus_sync_date AS "Sync Date",
    cus_created_on AS "Created On",
    cus_created_by AS "Created By",
    cus_modified_on AS "Modified On",
    cus_modified_by AS "Modified By"
FROM sales.customers;$$
WHERE screen_name = 'Customer Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    stm_name AS "State Name",
    stm_alias AS "Alias",
    stm_short AS "Short Code",
    stm_order AS "Sort Order",
    stm_is_active AS "Is Active",
    stm_is_deleted AS "Is Deleted",
    stm_sync_date AS "Sync Date",
    stm_created_on AS "Created On",
    stm_created_by AS "Created By",
    stm_modified_on AS "Modified On",
    stm_modified_by AS "Modified By"
FROM sales.state_master;$$
WHERE screen_name = 'State Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    ctm_name AS "City Name",
    ctm_alias AS "Alias",
    ctm_short AS "Short Code",
    ctm_state_id AS "State ID",
    ctm_order AS "Sort Order",
    ctm_is_active AS "Is Active",
    ctm_is_deleted AS "Is Deleted",
    ctm_sync_date AS "Sync Date",
    ctm_created_on AS "Created On",
    ctm_created_by AS "Created By",
    ctm_modified_on AS "Modified On",
    ctm_modified_by AS "Modified By"
FROM sales.city_master;$$
WHERE screen_name = 'City Master';

UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    arm_name AS "Area Name",
    arm_alias AS "Alias",
    arm_short AS "Short Code",
    arm_city_id AS "City ID",
    arm_sort AS "Sort Order",
    arm_distance_km AS "Distance KM",
    arm_collection_days AS "Collection Days",
    arm_is_active AS "Is Active",
    arm_is_deleted AS "Is Deleted",
    arm_sync_date AS "Sync Date",
    arm_created_on AS "Created On",
    arm_created_by AS "Created By",
    arm_modified_on AS "Modified On",
    arm_modified_by AS "Modified By"
FROM sales.area_master;$$
WHERE screen_name = 'Area Master';
