-- ═══════════════════════════════════════════════════════════════════════════
--  Grid 71 "POPUP - ITEMS" scopes the item picker (notes 73 B, 2026-10-01).
--
--  Every Qt screen that offers an item — sale bill, quotation, sale order,
--  delivery challan, opening stock, physical stock, stock adjustment, change
--  selling price — sends iitem_company_id and iitem_branch_id, and the SQL
--  read neither: an Acme Foods picker listed CHANDRA SAW MILL's 10,010 items,
--  which the screen's own lookup then refused ("belongs to another company").
--
--  Now: a company's own items plus the SHARED ones (blank company = every
--  company, the user's rule), and the branch's own items plus the
--  company-wide ones. Deleted unit conversions and deleted units drop out.
--
--  Each token is OPTIONAL, inert when unsent: the grid runner binds a quoted
--  'token' to $N, and an unsent one stays the literal 'iitem_company_id',
--  which equals 'iitem_company' || '_id' (a split the runner never rewrites),
--  so NULLIF turns it into NULL and the filter is off. The React quotation
--  picker runs grid 71 with no grid_param and keeps seeing every item, as
--  before, instead of only the shared ones. '' is off too. Compared as text,
--  never cast, so no value can fail the plan.
--
--  Matched on id AND table, so a database whose 71 means something else is
--  left alone (the live box is seeded separately from dev).
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE fixed.grid_details
   SET grid_sql = $sql$SELECT
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
ORDER BY IM.item_name_en$sql$
 WHERE grid_id = 71
   AND grid_sql ILIKE '%inventory.item_master%'
   AND grid_sql ILIKE '%item_unit_conversion%'
   AND grid_sql NOT LIKE '%iitem_company_id%';
