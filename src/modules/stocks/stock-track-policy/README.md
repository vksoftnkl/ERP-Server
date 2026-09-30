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
| `no_preset` | no preset on the group or the item: nothing written — for an item, the group / company policy governs |
| `cleared` | the preset was removed (or the item deleted), so the derived row was retired |

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

### No preset means no ITEM row (notes 68)

**An item follows its group unless it names its own preset** — the user's rule,
2026-09-30. `item_track_preset_id` is the only item-level choice: a preset (NONE
included) is written as the item's row; with no preset `syncFromItem` writes
nothing (`no_preset`) and retires a derived row the item had (`cleared`), so
the resolver answers from the GROUP, then the COMPANY. An ITEM row outranks the
GROUP one, which is why the item's own flags (`item_batch_config`,
`item_is_batch_based`, `item_is_expiry_item`, `item_allow_neg_stock`, the
expiry-day columns) no longer derive a row: until then `deriveFromItem` did, and
any of them hid the group's "Tracked as". Migration
`20260930140000_item_policy_needs_preset` retired the rows it had written for
items with no preset.

Those flags still mean something OUTSIDE the stock engine: the sales screens'
"may this line go negative" answer reads `item_allow_neg_stock` together with
the godown's and the company's flag (`saleLineAllowsNegativeStock`), and
`GET /items/bulk-load`'s `tracking_type` and the sales lookups' `batch_config`
are read from `item_batch_config` / `item_is_batch_based` /
`item_is_expiry_item`. For an item that follows its group those can now disagree
with the policy the engine keys its stock by.

`retireForItem` retires an item's derived rows when the item is deleted;
restoring it runs `syncFromItem` again.

### A group has no fallback either, so no preset means no row

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

A group policy is **shared by every company**: `stp_company_id = NULL`,
`stp_branch_id = NULL` (notes 69). `item_group_master` has no company and its
save carries none. It used to be filed under the request context's company —
the LOGIN token's company, not the one the user works in — so an item of any
other company never saw its group's "Tracked as". A company that must track a
group differently authors a company-specific GROUP row on the policy screen: the
resolver prefers it (the `company IS NULL` tie-break sorts it first), and this
service never touches a hand-authored row. Derived GROUP rows stranded under a
company are moved to the shared slot (the first, when free) or retired on the
group's next save; migration `20260930150000_group_policy_shared` did the same
for the rows already there.

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
