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

The header takes a **plain object**. The four child endpoints each take an **array of
objects** under a `prm_id`, because that is how their grids are edited — a page of rows at
once, not one HTTP call per line.

Arrays are an **upsert, not a replace**: rows carrying their own id are updated, rows
without one are inserted, and rows already on the scheme but absent from the array are left
alone. A half-built grid POST must never wipe rows the user cannot see, so deleting is
always an explicit call.

## Endpoints

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `POST` | `/create` | object | Create or update a header by `prm_id` presence |
| `GET` | `/get?prm_id=` | — | Header + branches + parties + items + slabs |
| `DELETE` | `/delete?prm_id=&prm_modified_by=` | — | Soft delete the header **and all four child sets** |
| `POST` | `/branches/create` | `{ prm_id, branches[] }` | Upsert branch scope rows |
| `GET` | `/branches/get?prm_id=` | — | List branch scope rows |
| `DELETE` | `/branches/delete?row_id=&modified_by=` | — | Soft delete one `prb_id` |
| `POST` | `/parties/create` | `{ prm_id, parties[] }` | Upsert party scope rows |
| `GET` | `/parties/get?prm_id=` | — | List party scope rows, narrowest match first |
| `DELETE` | `/parties/delete?row_id=&modified_by=` | — | Soft delete one `prp_id` |
| `POST` | `/items/create` | `{ prm_id, items[] }` | Upsert item scope rows |
| `GET` | `/items/get?prm_id=` | — | List item scope rows, most specific first |
| `DELETE` | `/items/delete?row_id=&modified_by=` | — | Soft delete one `pri_id` |
| `POST` | `/slabs/create` | `{ prm_id, slabs[] }` | Upsert offer bands |
| `GET` | `/slabs/get?prm_id=` | — | List bands, lowest threshold first |
| `DELETE` | `/slabs/delete?row_id=&modified_by=` | — | Soft delete one `prs_id` |

Every response is the shared sales envelope: `{ success, message, data }`, with errors as
`{ success: false, message, errors: [{ field, message }] }` through
`PromotionSchemeExceptionFilter`.

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
