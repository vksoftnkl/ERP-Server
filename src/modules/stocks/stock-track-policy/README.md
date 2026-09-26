# stock-track-policy

Writes `stock.stock_track_policy` — the row that says, for an item or an item
group, what makes two holdings of it *different* (batch / mrp / sale price /
expiry / serial / supplier), which lot goes out when nobody names one, which
cost a report believes, and whether the counter may sell into negative stock.

**No controller, no routes.** The policy is a consequence of saving a master,
not a screen of its own. `ItemsMasterService` calls `syncFromItem` and
`ItemsGroupMasterService` calls `syncFromItemGroup`, both inside the master's
own transaction on create and update, so a master never exists without its
policy and neither is written if the other fails.

## The two functions

```ts
syncFromItem(item: ItemTrackPolicySource, tx?: Prisma.TransactionClient)
syncFromItemGroup(group: ItemGroupTrackPolicySource, tx?: Prisma.TransactionClient)
  => { stp_id, scope_id, scope, outcome, track_signature, preset_code }
```

Both source types are structural subsets of the Prisma records, so the saved
row goes straight in. Always pass `tx`.

| outcome | meaning |
|---|---|
| `created` | no policy held this scope's (company, branch, scope) slot |
| `updated` | the derived row existed and something changed — a value, the preset it came from, or the item moving company or branch, which retargets the row rather than leaving a second one behind |
| `unchanged` | the derived row already said exactly this; no write, no audit row |
| `skipped_manual` | an admin authored the policy for that slot; it is left alone |
| `no_preset` | GROUP only: no preset, so nothing to derive and nothing written |
| `cleared` | GROUP only: the preset was removed, so the derived row was retired |

### An admin's policy always wins

Every row this service writes carries a marker in `stp_remarks` —
`DERIVED_FROM_ITEM_REMARK` or `DERIVED_FROM_GROUP_REMARK` — optionally followed
by the preset it came from:

```
Auto-derived from item master
Auto-derived from item master [preset PHARMA]
Auto-derived from item group master [preset BATCH_EXPIRY]
```

That marker is the only thing separating a derived row from a hand-authored
one, and a row without it is never written to. The test is a **prefix** match,
not equality, so rows written before presets existed still read as derived.
Recording the preset on the row is also what makes drift visible: an admin
edits `PHARMA`, someone re-saves the item, and the policy moves — the row says
which preset it moved with. A changed preset code therefore counts as a change
even when all thirteen values are identical.

## Where the values come from

### A preset, when the master names one

`item_master.item_track_preset_id` / `item_group_master.itg_track_preset_id`
point at `stock.stock_track_preset` (migration `20260907060000`). When set, the
preset supplies **all thirteen** policy columns and the item's own flags are not
read at all. That is the only way to set `stp_track_sale_price`,
`stp_track_serial`, `stp_track_supplier`, `stp_valuation_method` and
`stp_ageing_basis` from a screen — no `item_master` column expresses them.

`resolvePreset` is a plain primary-key read and deliberately does **not** filter
on `spt_is_active` / `spt_is_deleted`. Retiring a preset stops it being
*offered* by `/stock-track-presets/get`; it must not change what an item already
configured with it resolves to. Filtering here would mean deactivating `PHARMA`
and then renaming a pharma item silently dropped batch and expiry from stock
that is already keyed by them.

The company merge — a company preset overriding a shared one of the same code —
is a **picker** concern only, and lives in
[`../stock-track-presets/preset-merge.ts`](../stock-track-presets/preset-merge.ts),
shared with the picker so the two cannot disagree. An `spt_id` names exactly one
row, so nothing here merges again.

### The item's own flags, when it does not

`deriveFromItem` is the fallback, unchanged. `item_batch_config` is read exactly
the way `ItemsMasterService.bulkLoad` reads it for `tracking_type`, so the
billing lookup and the policy cannot disagree:

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
independent: an MRP item that also carries an expiry date comes out `BME` rather
than having to pick one. Sale price, serial and supplier stay false here, and
valuation is always `WAVG`, ageing always `INWARD_DATE`.

### A group has no fallback, so no preset means no row

`item_group_master` has no tracking flags, no company and no branch. There is
nothing to derive from, and writing a defaulted all-false GROUP row would be
**worse than writing nothing**: the resolver runs

```
branch+ITEM -> branch+GROUP -> branch+COMPANY -> company+ITEM -> company+GROUP -> company+COMPANY
```

so an empty GROUP row would shadow the company-wide policy for every item in
that group and quietly untrack them. Hence `no_preset` writes nothing, and
removing a preset **retires** the row it wrote (`cleared`) rather than leaving
it standing.

A group policy is filed at the request context's company with
`stp_branch_id = NULL`. The group itself is not company-owned, but a policy must
be: two companies sharing a group can legitimately track it differently.

## Things to know

- `stp_item_id`, `stp_group_id` and `stp_track_signature` are
  `GENERATED ALWAYS ... STORED`. Write `stp_scope` + `stp_scope_id` and nothing
  else; Postgres rejects any write to the other three.
- `fk_stp_created_by` points at `public.user_master`, so `stp_created_by` gets
  the request-context user id or **null** — never the nil-uuid `DEFAULT_ACTOR`
  the string-typed `*_created_by` columns fall back to.
- `ex_stp_overlap` (a GiST EXCLUDE) refuses two policies for the same
  company/branch/scope with overlapping dates. Both sync functions check that
  slot before inserting rather than catching the violation, because a failed
  statement aborts the whole Postgres transaction — the master save included.
  It is partial on `is_active AND NOT is_deleted`, which is why `cleared` sets
  both: a retired row occupies no slot and is invisible to the resolver.
- The effective window is left to its defaults, `1900-01-01 .. 9999-12-31`: a
  derived policy has always been in force, so a receipt back-dated before the
  item was created still keys its stock the way the business expects.
- Soft-deleting an item or a group does **not** touch its policy. Nothing reads
  a policy for a deleted master, and restoring it finds the policy still there.
