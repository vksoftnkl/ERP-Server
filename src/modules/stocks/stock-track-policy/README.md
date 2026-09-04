# stock-track-policy

Writes `stock.stock_track_policy` — the row that says, for an item, what makes
two holdings of it *different* (batch / mrp / sale price / expiry / serial /
supplier), which lot goes out when nobody names one, which cost a report
believes, and whether the counter may sell into negative stock.

**No controller, no routes.** The policy is a consequence of saving an item,
not a screen of its own. `ItemsMasterService` calls `syncFromItem` inside the
item's own transaction on both create and update, so an item never exists
without a policy and neither is written if the other fails.

## The function

```ts
syncFromItem(item: ItemTrackPolicySource, tx?: Prisma.TransactionClient)
  => { stp_id, item_id, outcome, track_signature }
```

`ItemTrackPolicySource` is a structural subset of `ItemMaster`, so the Prisma
record goes straight in. Always pass `tx`.

| outcome | meaning |
|---|---|
| `created` | no policy held this item's (company, branch, ITEM) slot |
| `updated` | the derived row existed and a column changed — including the item moving company or branch, which retargets the row rather than leaving a second one behind |
| `unchanged` | the derived row already said exactly this; no write, no audit row |
| `skipped_manual` | an admin authored the policy for that slot; it is left alone |

### An admin's policy always wins

Every row this service writes carries `stp_remarks = 'Auto-derived from item
master'` (`DERIVED_FROM_ITEM_REMARK`), and that marker is the only thing
separating a derived row from a hand-authored one. A row without it is never
written to. Item-master flags are a starting point, not a standing override: a
shop that deliberately set `LOT_ACTUAL` valuation and `MANUAL` issue for one
item must not have that undone by someone renaming the item.

## The derivation

`item_batch_config` is read exactly the way `ItemsMasterService.bulkLoad`
already reads it for `tracking_type`, so the billing lookup and the policy
cannot disagree:

| item_master | policy |
|---|---|
| `item_batch_config = 1` | `stp_track_mrp` |
| `item_batch_config = 2`, `item_is_batch_based`, `item_is_expiry_item` | `stp_track_batch` |
| `item_is_expiry_item` | `stp_track_expiry` (+ batch, which `ck_stp_expiry_needs_batch` requires) |
| `item_expiry_days` | `stp_shelf_life_days`, dropped unless > 0 |
| `item_intimate_before_days` | `stp_near_expiry_days`, 30 unless >= 0 |
| `item_allow_neg_stock` | `ALLOW` / `BLOCK` |
| — | `stp_issue_strategy` = `FEFO` when expiry is tracked, else `FIFO` |

Unlike the old single-valued `tracking_type`, the six identity flags are
independent: an MRP item that also carries an expiry date comes out `BME`
rather than having to pick one.

`stp_track_sale_price`, `stp_track_serial` and `stp_track_supplier` stay false
— no `item_master` column expresses them, and inventing one from a related flag
would be a guess. They are admin-only. So are `stp_valuation_method` (always
`WAVG` here) and `stp_ageing_basis` (always `INWARD_DATE`).

The effective window is left to its defaults, `1900-01-01 .. 9999-12-31`: a
derived policy has always been in force, so a receipt back-dated before the
item was created still keys its stock the way the business expects.

## Things to know

- `stp_item_id`, `stp_group_id` and `stp_track_signature` are
  `GENERATED ALWAYS ... STORED`. Write `stp_scope` + `stp_scope_id` and nothing
  else; Postgres rejects any write to the other three.
- `fk_stp_created_by` points at `public.user_master`, so `stp_created_by` gets
  the request-context user id or **null** — never the nil-uuid `DEFAULT_ACTOR`
  the string-typed `*_created_by` columns fall back to.
- `ex_stp_overlap` (a GiST EXCLUDE) refuses two policies for the same
  company/branch/scope with overlapping dates. `syncFromItem` checks that slot
  before inserting rather than catching the violation, because a failed
  statement aborts the whole Postgres transaction — the item save included.
- Soft-deleting an item does **not** touch its policy. Nothing reads a policy
  for a deleted item, and restoring the item finds its policy still there.
