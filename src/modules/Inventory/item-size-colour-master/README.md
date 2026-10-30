# item-size-colour-master — `/item-sizes/*`, `/item-colours/*` (textile addendum 2 E1)

Two picked lists for the textile inward line: `inventory.item_size_master`
(`isz_`) and `inventory.item_colour_master` (`icl_`), migration
`20261023160000_textile_size_colour_batch_detail`. One service
(`ItemAttributeMasterService`) runs both; they differ by prefix and by the size's
`isz_size_set` (ALPHA / WAIST / KIDS / free text).

| Route | What |
|---|---|
| `POST create` | Create, or update when `isz_id` / `icl_id` is sent. A body with only the name (and the company) is the **quick-add**. |
| `GET get` | One live row by id. |
| `DELETE delete` | Soft delete. 409 `ITEM_SIZE_IN_USE` / `ITEM_COLOUR_IN_USE` while a live batch detail names it: deactivate instead (`*_is_active` false). |
| `POST restore` | Undo a delete (409 when the name is taken meanwhile). |

The house route is `/create` (create-or-update by id), not the plan's `/save`. There is
no `/list`: each list is a registered grid. Notes 147 registered the screens (migration
`20261023170000_textile_size_colour_screens`, menus also in `Menu_Master.sql`):

| | Size | Colour |
|---|---|---|
| Menu (under 34, item masters) | **291** Item Size Master | **292** Item Colour Master |
| List grid | **181** `MAIN LIST - ITEM SIZE`: params `iisz_is_deleted`, `iisz_company_id` | **182** `MAIN LIST - ITEM COLOUR`: params `iicl_is_deleted`, `iicl_company_id` |
| Dropdown | **70** `ITEM SIZES`: param `icompany_id` | **71** `ITEM COLOURS`: param `icompany_id` |

The grids list the company's rows plus the shared ones; `''` as the company lists the
shared rows only. The dropdowns list live, active rows by sort, then name.

* **Company NULL = shared** by every company; set on create, ignored on update.
* **Names are unique ignoring case** among the live rows of the company and the
  shared ones (a shared row against the shared ones). This is checked under an advisory
  lock on the folded name, and `ux_isz_name` / `ux_icl_name` hold the exact scope in the DB.
* **A taken name is 409 `ITEM_SIZE_NAME_TAKEN` / `ITEM_COLOUR_NAME_TAKEN`** whose
  `errors[0].existingId` is the live row that has it. A quick-add simply uses it.
* **Payload and response use column names** (`isz_*`, `icl_*`), as the other masters do.
  On update, a field left out is kept and null clears it (code, size set).
* **Sort:** `isz_sort` / `icl_sort` order the lists and the reports (S < M < L < XL),
  not the name.
* Audited on `audit.audit_log` (screens "Item Size Master", "Item Colour Master").
