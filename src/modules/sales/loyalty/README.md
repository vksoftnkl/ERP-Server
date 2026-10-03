# Promotion Loyalty Points

CRUD API for **loyalty schemes** — the RULES of a points campaign: who earns, on what,
how fast, and what a point is worth. It holds no balances and no movements; those belong
to a points ledger and a coupon/gift-issue table, neither of which exists yet.

One scheme header owns **five** child grids, and a single `POST` saves the whole graph
in one transaction while a single `GET` returns it.

- **Base route:** `promotion-loyalty-points` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Promotion Loyalty Points`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `sales.loyalty_scheme` — PK `lsc_id`
- **Child tables** (each FK'd to `lsc_id` with `ON DELETE CASCADE`, soft-deleted with the scheme):
  - `loyalty_scheme_branch` — PK `lsb_id`, which branches run it
  - `loyalty_scheme_party` — PK `lsp_id`, who it applies to
  - `loyalty_scheme_item` — PK `lsi_id`, which stock it applies to
  - `loyalty_scheme_slab` — PK `lss_id`, the earn rate bands
  - `loyalty_scheme_gift` — PK `lsg_id`, points → free item

## What replaced what

`20260831060000_replace_loyalty_scheme_tables` **dropped** `loyalty_sch_list`,
`loyalty_sch_party`, `loyalty_sch_points` and `loyalty_sch_gift`, and the per-child
endpoints that wrote them (`points/create`, `points/get`, `points/delete`,
`gifts/create`, `gifts/get`, `gifts/delete`) are gone with them. A grid row is now
created, changed and removed by posting the array it belongs to.

Their rows were **not** migrated; that is a data task, not a schema one.

Three things the predecessor could not express and this can:

- **Scope by more than one grouping at once.** `loyalty_sch_list` held one
  `ls_item_type` per scheme and could not exclude at all. "Double points on own-brand,
  but nothing on tobacco" is now one scheme: an `ITEM_BRAND` include row and an
  `ITEM_CATEGORY` exclude row in the same `items` array.
- **Real foreign keys on a polymorphic scope.** See below.
- **A return-window defence.** `lsc_activation_days` — points earn on bill save but are
  not redeemable until the lot has aged, so a customer cannot earn 500 points, spend
  them the same evening, and return the bill next morning.

## Kind + scope id, with the foreign keys kept

`loyalty_scheme_party` and `loyalty_scheme_item` store a **kind** and a **scope id** —
the two columns the entry grid binds to. Beside them sit `GENERATED ALWAYS ... STORED`
columns, one per kind, each holding the id only when the kind matches, and each
therefore carrying a real foreign key to its own master.

```sql
lsp_cust_id uuid GENERATED ALWAYS AS
  (CASE WHEN lsp_kind = 'CUSTOMER' THEN lsp_scope_id END) STORED
```

**Never write them.** Postgres computes them and refuses any INSERT or UPDATE that
touches them; the Prisma models map them `@default(dbgenerated())` (the no-argument
form, which also stops a later `migrate dev` emitting an `ALTER COLUMN ... DROP DEFAULT`
that Postgres rejects with 42601). Set the kind and the scope id; read the relations
back. The DTOs do not accept the carriers at all.

Their FKs are `ON UPDATE NO ACTION`, not CASCADE — Postgres forbids a cascading update
on a key containing a generated column. Costs nothing: every master key is a `uuidv7()`
that is never reissued.

This is the same shape as `promotion_scheme_party` / `promotion_scheme_item`,
deliberately — with one difference: **loyalty has no AREA or CITY kind.** A wallet
follows the person, not the route.

## Files

| File | Purpose |
| --- | --- |
| [promotion-loyalty-points.module.ts](promotion-loyalty-points.module.ts) | Module wiring — imports `AuditLogModule` |
| [promotion-loyalty-points.controller.ts](promotion-loyalty-points.controller.ts) | HTTP routes + Swagger docs; `@CacheTTL(1)`, binds the exception filter |
| [promotion-loyalty-points.service.ts](promotion-loyalty-points.service.ts) | Business logic, persistence, grid sync, audit logging |
| [promotion-loyalty-points-exception.filter.ts](promotion-loyalty-points-exception.filter.ts) | Extends `SalesExceptionFilter`; maps snake_case field tokens into the error shape |
| [utils/loyalty.utils.ts](utils/loyalty.utils.ts) | Vocabularies, display lookups, row mappers, Prisma error mapping |
| [utils/loyalty-scheme-invariants.ts](utils/loyalty-scheme-invariants.ts) | One function per CHECK constraint the tables carry |
| [types/promotion-loyalty-points-api.types.ts](types/promotion-loyalty-points-api.types.ts) | Payload / response / delete-result contracts |
| [dto/save-loyalty-scheme.dto.ts](dto/save-loyalty-scheme.dto.ts) | The header, with the five grids nested |
| [dto/save-loyalty-scheme-branch.dto.ts](dto/save-loyalty-scheme-branch.dto.ts) · [-party](dto/save-loyalty-scheme-party.dto.ts) · [-item](dto/save-loyalty-scheme-item.dto.ts) · [-slab](dto/save-loyalty-scheme-slab.dto.ts) · [-gift](dto/save-loyalty-scheme-gift.dto.ts) | One row of each grid |
| [dto/list-loyalty-scheme-query.dto.ts](dto/list-loyalty-scheme-query.dto.ts) | `GET /list` filters, with `company`/`branch` aliases |
| [dto/loyalty-scheme-id-query.dto.ts](dto/loyalty-scheme-id-query.dto.ts) | `GET`/`DELETE`/eligibility query DTOs |
| [dto/promotion-loyalty-points-response.dto.ts](dto/promotion-loyalty-points-response.dto.ts) | Swagger response models |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a whole scheme by `lsc_id` presence — header and all five grids, one transaction |
| `GET` | `/get` | Fetch one scheme graph by `lsc_id`, names resolved, ready to post back |
| `GET` | `/list` | Every live scheme, whole, optionally narrowed by company and branch |
| `GET` | `/eligibility` | Does one customer earn on one scheme, and which rule decided it |
| `DELETE` | `/delete` | Soft delete the scheme and every child row |

## Create / update semantics

- **Omit `lsc_id` → create; include it → update.** The same rule governs each grid row
  by its own id (`lsb_id`, `lsp_id`, `lsi_id`, `lss_id`, `lsg_id`).
- **Updates are partial.** Only keys actually present on the payload are written — the
  service gates every column on `hasOwnProperty(dto, …)`.
- **A grid array that is PRESENT replaces that grid**: rows with an id are updated, rows
  without one are inserted, and rows already on the scheme but missing from the array
  are soft deleted. **Omit the key** to leave the grid untouched — `"slabs": []` means
  "delete every band", which is not the same thing.

## Validation

The loyalty tables **do** carry their CHECK constraints, unlike `promotion_scheme`.
[utils/loyalty-scheme-invariants.ts](utils/loyalty-scheme-invariants.ts) mirrors every
one, function-per-constraint and named after it, so a bad payload comes back as a
field-addressed 400 the screen can put on an input rather than a Postgres 23514 string.
The table is the last word; the service is the one that explains itself. Errors are
**collected**, not short-circuited — one bad payload is answered with everything wrong
with it at once.

Two partial unique indexes are invisible to Prisma and are therefore checked in the
service before the write:

- `ux_lsc_code` — one live `lsc_code` per company, case-insensitively.
- `ux_lsc_primary` — one APPROVED, active, priority-1 scheme per company / branch /
  type. Two primaries on one bill is a tie the resolver cannot break.

## Redemption rate: one source of truth

`lsc_redeem_value_per_point` is what a point is worth in rupees. It **wins** over
`accounts.acc_tender_master.tnd_conversion_rate` whenever a scheme matches; the tender
master is the fallback for a company running no scheme; and
`acc_tender_detail.td_conversion_rate` snapshots whichever was used, so a historic
redemption stays re-derivable. A write-path rule the schema cannot enforce — obeyed
wherever a redemption is priced.
