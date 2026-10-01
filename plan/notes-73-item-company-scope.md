# Notes 73 — a blank company on an item means SHARED: what the server side did (2026-10-01)

Migration `20261001130000_item_picker_company_scope` (applied to 192.168.0.106), the services
named below, and `test/item-company-scope-notes-73-http.e2e-spec.ts` (4 read-only HTTP cases).

## A — opening stock opens a shared item (done)

- `/stock/opening/item-lookup`: with a company given, the item may be that company's **or have no
  company** (`item_company_id IS NULL OR = companyId`), the same shape as the branch predicate.
  The "no company set" refusal is gone; "belongs to another company" stays for a company that is
  set and differs. The comment now states the rule. Verified: MRP ITEM in Acme Foods / Coimbatore
  → 200 with its unit and `trackSignature`.
- The other readers were checked. The stock adjustment's pick-stock and the price gateway already
  used the shared rule. The sales item-price and barcode lookups use it for the branch and do not
  filter on company. Physical stock, transfers and adjustments reach items through stock rows that
  carry their own company. One more place was strict: **`GET /items/bulk-load`** (the bulk
  opening-stock load) filtered company AND branch with `=`, so a branch-scoped load dropped every
  company-wide item (10,010 of them) and every shared one. It now uses the shared rule for both.

## B — grid 71 (POPUP - ITEMS) is scoped (done)

The SQL now takes `iitem_company_id` / `iitem_branch_id`: the company's items plus the shared ones,
the branch's plus the company-wide ones; deleted unit conversions and deleted units drop out.
Search still runs on `item_name_en` (the only filter-flagged column).

**The web client:** the React quotation picker runs grid 71 with **no** `grid_param`. So each token
is optional and inert when unsent (the notes 70 `iexclude_id` trick: an unbound `'iitem_company_id'`
equals `'iitem_company' || '_id'`, which the runner never rewrites, so it becomes NULL and the
filter is off). React keeps listing every item, as before, until it sends the two tokens (its
`searchPickerItems` in `store/api/quotationApi.ts`). `''` is off too. Compared as text, never cast.

## C — branch without its company (server side done)

`/items/create` (create, and update by `item_id`) refuses (400, `item_branch_id`) a branch with no company,
an unknown branch, and another company's branch. On update this is checked only when the payload
states `item_company_id` or `item_branch_id`, so a price-only save of SUGAR / MRP ITEM / newlama
still goes through. Those three rows are left for the user's decision, as the notes say.
