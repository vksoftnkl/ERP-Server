# Promotion Scheme

CRUD API for **promotion schemes** and their four child collections — **branch scope**
(which shops run it), **party scope** (who it applies to), **item scope** (which stock),
and **slabs** (the offer bands). One header owns all four, and a single `GET` returns the
whole graph.

- **Base route:** `promotion-scheme` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Promotion Scheme`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sales.promotion_scheme` — PK `prm_id`
- **Child tables** (each FK'd to `prm_id`, soft-deleted with the scheme):
  - `sales.promotion_scheme_branch` — PK `prb_id`
  - `sales.promotion_scheme_party` — PK `prp_id`
  - `sales.promotion_scheme_item` — PK `pri_id`
  - `sales.promotion_scheme_slab` — PK `prs_id`, composite FK `(prs_prm_id, prs_benefit)`

## Payload shape

`POST /create` takes the **whole campaign in one object** — the header fields plus optional
`branches`, `parties`, `items` and `slabs` arrays. Header and grids are written in a single
transaction, and the response is the same graph `GET /get` returns, so a screen can post
back exactly what it loaded.

A grid array that is **present replaces** that grid: rows carrying their own id are updated,
rows without one are inserted, and rows already on the scheme but absent from the array are
soft deleted. That is what lets one POST save a grid the user edited, removed lines and all.

There are no per-grid routes. A grid row is created, changed and removed by posting the
array it belongs to — `prb_id`/`prp_id`/`pri_id`/`prs_id` on a row means "update this one",
no id means "insert", and leaving a row out means "delete it".

A grid key that is **absent leaves that grid alone**. This is the distinction that keeps a
header-only save (a status flip, an approval) from wiping rows the caller never loaded:

| Body | Effect on the item grid |
| --- | --- |
| no `items` key | untouched |
| `"items": []` | every item row soft deleted |
| `"items": [ … ]` | the grid is made to match the array |

```jsonc
POST /api/v1/promotion-scheme/create
{
  "prm_comp_id": "01963d86-caf0-7b26-89f0-58ac380a2d5e",
  "prm_code": "DIWALI25",
  "prm_name": "Diwali 2025 — 10% off own brand",
  "prm_apply_on": "ITEM_QTY",
  "prm_benefit": "DISC_PERC",
  "prm_item_scope": "LIST",
  "prm_start_date": "2025-10-01",
  "prm_end_date": "2025-10-31",
  "items": [
    { "pri_kind": "ITEM_BRAND", "pri_scope_id": "0196…", "pri_match_priority": 3 }
  ],
  "slabs": [
    { "prs_exceeds": 1000, "prs_upto": 4999, "prs_disc_perc": 5 }
  ]
}
```

Nullable fields are genuinely nullable — send `null` or omit the key. Swagger UI renders
them as `{}` in the generated example body; that is a UI placeholder, not a valid value.

## Endpoints

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `POST` | `/create` | object | Create or update header + all four grids by `prm_id` presence |
| `GET` | `/get?prm_id=` | — | Header + branches + parties + items + slabs, grid-ready |
| `GET` | `/list?company=&branch=` | — | The live schemes, each with all four grids; both filters optional |
| `GET` | `/eligibility?prm_id=&cus_id=` | — | Does this one customer qualify for this one scheme? |
| `DELETE` | `/delete?prm_id=&prm_modified_by=` | — | Soft delete the header **and all four child sets** |

### `GET /list` — every live campaign

Same graph as `/get`, many schemes at a time: each row carries its `branches`, `parties`,
`items` and `slabs` arrays, so a screen can load the campaigns and edit any one of them
without a second call.

```jsonc
GET /api/v1/promotion-scheme/list?company=01963d86-…&branch=01963d86-…
{
  "success": true,
  "message": "Promotion schemes fetched successfully",
  "data": [
    {
      "prm_id": "0196…", "prm_code": "DIWALI25", "prm_name": "Diwali 2025",
      "prm_comp_id": "0196…", "prm_comp_name": "Sri Krishna Traders",
      "prm_branch_id": "0196…", "prm_branch_name": "Main Shop",
      "prm_status": "APPROVED", "prm_benefit": "DISC_PERC",
      "prm_start_date": "2025-10-01", "prm_end_date": "2025-10-31", …
      "branches": [ { "prb_id": "0196…", "prb_branch_name": "Main Shop", … } ],
      "parties":  [ { "prp_id": "0196…", "prp_kind": "CUSTOMER_GROUP", … } ],
      "items":    [ { "pri_id": "0196…", "pri_scope_name": "Own Brand", … } ],
      "slabs":    [ { "prs_id": "0196…", "prs_exceeds": 1000, "prs_disc_perc": 5, … } ]
    }
  ]
}
```

Two filters are **not parameters**: `is_deleted = false` and `is_active = true`. They hold
for the child rows as well as the header, so a deactivated slab band or party rule is
absent from its array rather than present and flagged — stricter than `/get`, which keeps
deactivated rows so the grid can switch them back on. `prm_status` is a separate axis: an
`APPROVED` scheme that has been deactivated is still absent here, a `DRAFT` active one is
present.

**Both params are optional** and each narrows independently — no company means every
company, no branch means every branch, and a bare `/list` is every live scheme there is:

| Query | Returns |
| --- | --- |
| `/list` | every live scheme, all companies |
| `/list?company=` | every live scheme of that company, all branches |
| `/list?branch=` | every live scheme stamped with that branch, whatever the company |
| `/list?company=&branch=` | both narrowings together |

`branch` matches the `prm_branch_id` **column** literally, so company-wide schemes
(`prm_branch_id` NULL) come back only when no branch is named. It does **not** consult
`prm_branch_scope` or the branch grid — "which schemes run at this till" is a resolver
question, not a pick-list one.

`company`/`branch` are short spellings; `prm_comp_id`/`prm_branch_id` are accepted for the
same two params. Schemes come back ordered by `prm_code`, their grids in `slno` order.

## Display names on the read paths

The header points at a company and (optionally) a branch; a scope row stores an id and a
kind, and the name behind that id lives in one of nine masters.
Every read joins them through the relations Prisma declares on the generated columns — one
join per kind, no `CASE` — so a grid renders straight off the response:

| Grid | Resolved fields | Source |
| --- | --- | --- |
| header | `prm_comp_name`, `prm_branch_name` | `comp_name`, `br_name` — `prm_branch_name` is null on a company-wide scheme |
| branches | `prb_branch_name`, `prb_branch_code` | `br_name`, then `br_code` else `br_short` |
| parties | `prp_scope_name`, `prp_scope_code` | `cus_name`/`cgr_name`/`arm_name`/`ctm_name`, and `cus_code`/`cgr_short`/`arm_short`/`ctm_short` |
| items | `pri_scope_name`, `pri_unit_name` | `item_name_en`/`itg_name`/`category_name`/`brand_name`/`sec_name`, and `unit_name` via `item_unit_conversion` |
| slabs | `prs_free_item_name`, `prs_free_unit_name` | `item_name_en`, `unit_name` |

These are **display only**. They are ignored on write — the id columns are the truth, and
the four/five FK carrier columns beside them are generated by Postgres and rejected on
write. Note the master columns are not uniform: customers use `cus_code`, but cust_groups
use `cgr_short` (there is no `cgr_code`), area uses `arm_short`, city uses `ctm_short`.

## Validation lives here, not in the table

`sales.promotion_scheme` carries **no CHECK constraints** — the migration creates the
columns and the foreign keys and stops there, deliberately. A rejected campaign should come
back as a field-addressed 400 the screen can drop on an input, not as a Postgres error
string it has to parse.

So every CHECK from the DDL is a named function in
[`utils/promotion-scheme-invariants.ts`](utils/promotion-scheme-invariants.ts), one per
constraint, each keyed in `SCHEME_INVARIANTS` by the constraint name it stands in for:

| Constraint | Function |
| --- | --- |
| `ck_prm_code_shape` | `ckPrmCodeShape` |
| `ck_prm_status` / `apply_on` / `benefit` / `stack_mode` / `calc_on` / `bill_type` | `ckPrmStatus`, `ckPrmApplyOn`, `ckPrmBenefit`, `ckPrmStackMode`, `ckPrmCalcOn`, `ckPrmBillType` |
| `ck_prm_branch_scope` / `cust_scope` / `item_scope` | `ckPrmBranchScope`, `ckPrmCustScope`, `ckPrmItemScope` |
| `ck_prm_fixed_price_scope` | `ckPrmFixedPriceScope` |
| `ck_prm_dates`, `ck_prm_time_pair`, `ck_prm_weekdays` | `ckPrmDates`, `ckPrmTimePair`, `ckPrmWeekdays` |
| `ck_prm_priority`, `ck_prm_thresholds`, `ck_prm_caps` | `ckPrmPriority`, `ckPrmThresholds`, `ckPrmCaps` |
| `ck_prm_approved` | `ckPrmApproved` |

They **collect** rather than throw, so one bad payload is answered with everything wrong
with it at once instead of the first thing:

```jsonc
{ "success": false, "message": "Validation failed", "errors": [
  { "field": "prm_code", "message": "prm_code may contain only letters, digits, underscore and hyphen" },
  { "field": "prm_stack_mode", "message": "prm_stack_mode must be one of EXCLUSIVE, STACKABLE" },
  { "field": "prm_approved_by", "message": "prm_approved_by is required once prm_status is APPROVED" }
] }
```

The service's job is now normalisation only — `normalizeEnum` trims and upper-cases, and
the verdict belongs to the layer above. Two rules are worth restating because they look
like bugs and are not: the time window has **no** `to >= from` rule (22:00→04:00 is a
late-night offer, and the engine reads `from > to` as "spans midnight"), and
`ck_prm_fixed_price_scope` tests **only** `FIXED_PRICE` even though the DDL comment above
it says "FIXED_PRICE or FREE_ITEM" — the function follows the constraint body, so a
FREE_ITEM scheme on a bill-level trigger is still accepted, as it always was.

The party grid's constraints live in the same file under `PARTY_INVARIANTS`:

| Constraint | Function |
| --- | --- |
| `ck_prp_kind` | `ckPrpKind` |
| `ck_prp_slno` | `ckPrpSlno` |
| `ck_prp_match_priority` | `ckPrpMatchPriority` |

They are checked against the row **as it will stand after the write** — stored values
overlaid with what the caller sent — so an update that touches only `prp_notes` is still
judged on the kind and priority the row will actually have. This closed a gap: an
out-of-range `prp_match_priority` on an *insert* was previously unchecked by the service.

The item and slab grids complete the set, under `ITEM_INVARIANTS` and `SLAB_INVARIANTS`:

| Constraint | Function |
| --- | --- |
| `ck_pri_kind`, `ck_pri_unit`, `ck_pri_one_rate`, `ck_pri_exclude` | `ckPriKind`, `ckPriUnit`, `ckPriOneRate`, `ckPriExclude` |
| `ck_pri_values`, `ck_pri_slno`, `ck_pri_match_priority` | `ckPriValues`, `ckPriSlno`, `ckPriMatchPriority` |
| `ck_prs_band`, `ck_prs_each`, `ck_prs_amounts` | `ckPrsBand`, `ckPrsEach`, `ckPrsAmounts` |
| `ck_prs_free_unit_pair`, `ck_prs_benefit_columns`, `ck_prs_slno` | `ckPrsFreeUnitPair`, `ckPrsBenefitColumns`, `ckPrsSlno` |

All five tables now answer through the one layer, so a bad grid row comes back fully
diagnosed — an item row breaking six rules returns eight field errors, not one.

Two of these are worth reading carefully because they are easy to half-implement.
`ck_pri_unit` is a **biconditional**: a unit is required on an `ITEM` row and forbidden on
every other kind, because a unit is a row of `item_unit_conversion` keyed to one item, and
on a BRAND row it would silently claim to apply to items that never define it.
`ck_prs_benefit_columns` writes DISC_AMT's rule as `(prs_disc_amt > 0) <> (prs_disc_qty > 0)`
— an **XOR**, so a band with neither is as wrong as a band with both.

## Eligibility — the other direction

`/get` answers "who does this scheme cover". `/eligibility` answers the question the till
asks: "does THIS customer qualify". A customer can be reached by four rows at once — by
name, by their group, by their area and by their city — so the response names the row that
decided it:

```jsonc
GET /api/v1/promotion-scheme/eligibility?prm_id=…&cus_id=…
{
  "qualifies": false,
  "decided_by": "RULE",
  "matched_by": "AREA",
  "matched_row_id": "0196…",
  "match_priority": 3,
  "is_exclude": true,
  "reason": "NO — carved out by the AREA rule"
}
```

Highest `prp_match_priority` wins, and at equal priority an **EXCLUDE beats an INCLUDE**.
Seeded priorities: `CUSTOMER` 4, `AREA` 3, `CITY` 2, `CUSTOMER_GROUP` 1 — CITY sits *below*
area on purpose, because a city contains many areas, so an AREA rule is the more specific
statement about the same customer.

`decided_by` distinguishes the three ways an answer is reached: `ALL` (the scheme's
`prm_cust_scope` is `ALL`, so no party row is consulted and everyone qualifies), `RULE` (a
party row decided it), `NO_RULE` (scoped to a LIST that nothing on it reaches — not
eligible).

A customer reaches a CITY rule **only through their area**; `cus_area_id` is the one path,
whatever their free-text `cus_city` says.

## The generated columns

`promotion_scheme_party` and `promotion_scheme_item` each carry a `*_kind` + `*_scope_id`
pair plus a set of `GENERATED ALWAYS ... STORED` columns — `prp_cust_id`,
`prp_cust_group_id`, `prp_area_id`, `prp_city_id`; `pri_item_id`, `pri_group_id`,
`pri_category_id`, `pri_brand_id`, `pri_section_id`. Those exist only to carry a real
foreign key per kind: one column cannot reference five tables.

**They are not accepted in any payload and never written by this module.** Postgres
computes them; the DTOs do not declare them; they come back on reads. The grid is two
columns wide and stays that way.

## Where the rules live

The DDL's CHECK constraints are deliberately **not** in the migration, so this module is
what enforces them. `PromotionSchemeService` carries them all:

- **header** — the seven vocabularies, `prm_code` shape, `prm_end_date >= prm_start_date`,
  both time bounds or neither (a window may legitimately cross midnight, so there is no
  `to >= from` rule), the weekday shape, priority 1–9, `FIXED_PRICE` needs an item trigger,
  and `APPROVED` needs `prm_approved_by`.
- **items** — a unit is required on an `ITEM` row and forbidden on every other kind; at
  most one of the perc/qty/amt trio is non-zero; an exclude row carries no rate.
- **slabs** — the band bounds, the repeat rules, the free item/unit pair, and the
  benefit-column matrix (`DISC_PERC` needs a percentage and nothing else, `DISC_AMT` needs
  exactly one of flat or per-unit, and so on).

Two things stay in the database and are only *translated* here:

- `fk_prs_scheme_benefit`, the composite FK, still makes a free-item band on a percentage
  scheme physically impossible. Because it is `ON UPDATE CASCADE`, changing `prm_benefit`
  on a scheme that already has bands would silently relabel them — so the service refuses
  that edit and tells you to retype the bands first.
- `ex_prm_exclusive_clash`, the GiST EXCLUDE, still refuses two approved exclusive schemes
  on the same company/branch/trigger at the same priority over overlapping dates. Prisma
  reports it with no error code at all, so `handlePromotionWriteError` matches SQLSTATE
  23P01 in the driver message and answers 409 instead of 500.

`ux_prm_code` and the four child uniques are **partial** indexes, which Prisma neither
declares nor necessarily creates — the service checks the code app-side and rejects
same-batch duplicates before writing.

## Not yet wired

`prm_coupon_batch_id` is stored and returned but has **no foreign key and no relation**:
`sales.loyalty_coupon_batch` does not exist in this schema yet. Add
`fk_prm_coupon_batch` and the Prisma relation when that table lands.

`sales.promotion_usage` (§6 of the DDL — the per-document benefit tally that lets a chain
count caps it cannot derive from the bills it can see) is **not** part of this module.
