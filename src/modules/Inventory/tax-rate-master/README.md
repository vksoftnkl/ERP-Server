# Tax Rate Master

CRUD API for **GST rates** — one row per statutory rate, plus the per-rate
**ledger overrides** it carries. Header and grid save, read and delete as one
thing.

- **Base route:** `tax-rates` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Tax Rate Master`
- **Auth:** Bearer `access-token` (required)
- **Tables:** `inventory.tax_rate_master` (PK `tax_id`) and
  `inventory.tax_rate_ledger` (PK `trl_id`), from migration
  [20260911090000_add_tax_rate_master_and_ledger](../../../../prisma/migrations/20260911090000_add_tax_rate_master_and_ledger/migration.sql)
- **Referenced masters:** `accounts.acc_ledger_role` (`fk_trl_role`),
  `accounts.acc_ledger_master` (`fk_trl_ledger`), and the rate's own
  supersession chain (`fk_tax_supersedes`)

## Files

| File | Purpose |
| --- | --- |
| [tax-rate-master.module.ts](tax-rate-master.module.ts) | Module wiring — imports `AuditLogModule` |
| [tax-rate-master.controller.ts](tax-rate-master.controller.ts) | HTTP routes + Swagger docs |
| [tax-rate-master.service.ts](tax-rate-master.service.ts) | Business logic, persistence, audit logging |
| [tax-rate-master-exception.filter.ts](tax-rate-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape |
| [utils/tax-rate-ledger.guard.ts](utils/tax-rate-ledger.guard.ts) | **The grid's rules** — the TypeScript form of what a BEFORE INSERT/UPDATE trigger would enforce |
| [utils/tax-rate-reference.helper.ts](utils/tax-rate-reference.helper.ts) | **What makes a `tax_id` reference usable** — shared by every table that points at a rate |
| [utils/tax-rate.utils.ts](utils/tax-rate.utils.ts) | Vocabularies, payload mappers, write-error mapping |
| [dto/save-tax-rate.dto.ts](dto/save-tax-rate.dto.ts) | The header payload, carrying `lines` |
| [dto/save-tax-rate-ledger.dto.ts](dto/save-tax-rate-ledger.dto.ts) | One grid line |
| [dto/tax-rate-query.dto.ts](dto/tax-rate-query.dto.ts) | `/get`, `/list` and `/delete` query params |
| [dto/tax-rate-response.dto.ts](dto/tax-rate-response.dto.ts) | Swagger response models |
| [types/tax-rate-api.types.ts](types/tax-rate-api.types.ts) | Payload / response TypeScript contracts |
| [../../../../test/tax-rate-master-http.e2e-spec.ts](../../../../test/tax-rate-master-http.e2e-spec.ts) | 20 HTTP-level tests against the live dev DB |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a whole rate — header and `lines` — chosen by `tax_id` presence. |
| `GET` | `/get` | One rate with its overrides, ready to edit and post back. |
| `GET` | `/list` | Live rates, each one whole, with optional `search` / `tax_taxability` / `tax_rate_perc` / `active_only`. |
| `GET` | `/resolve` | **Where the rate actually posts** — every role it can influence, resolved the way posting will resolve it. |
| `DELETE` | `/delete` | Soft-delete a rate and every one of its overrides. |

## The payload

```jsonc
{
  "tax_name": "GST 18%",
  "tax_code": "GST18",
  "tax_rate_perc": 18,
  "lines": [
    { "trl_role": "OUTPUT_CGST", "trl_ledger_id": "…", "trl_supply_nature": null }
  ]
}
```

**A rate with no lines is the normal case and a complete configuration** — it
posts wherever `accounts.acc_ledger_map` says. Lines exist only where a rate
genuinely differs, which is why the eighteen ledger columns of the old
`item_tax_master` are rows here: the next axis costs an insert, not an `ALTER`.

### Grid semantics

Sending `lines` **replaces** the grid: lines carrying `trl_id` are updated,
lines without one are inserted, and lines already on the rate but missing from
the array are soft deleted. **Omit the key** to leave the grid untouched —
`"lines": []` means "delete every override", which is not the same request.

### Generated columns

`tax_cgst_perc`, `tax_sgst_perc` and `tax_igst_perc` are `GENERATED ALWAYS`
columns computed from `tax_rate_perc` by Postgres. They are returned on every
read and **rejected on write** (`forbidNonWhitelisted`) — 18 becomes 9 + 9
locally and 18 inter-state, and the two can no longer disagree.

### Resolved names (read paths only)

`tax_supersedes_name`, `trl_role_label` and `trl_ledger_name` are joined on
`/get` and `/list` so a grid renders without a second round-trip. They are
ignored on write and come back `null` from `/create` and `/delete`.

## Validation

Field-level rules live in the DTOs; everything below is the service, and every
one of them restates a rule the database also holds — so a bad payload returns a
field error the form can highlight instead of a SQLSTATE the ORM reports as a
500. Header and grid errors are collected and returned **together**, so a form
with fourteen ledger pickers is corrected in one round-trip.

| Rule | Mirrors |
| --- | --- |
| `tax_taxability` ∈ TAXABLE / EXEMPT / NIL_RATED / NON_GST / ZERO_RATED | `ck_tax_taxability` |
| `tax_rate_perc` 0…100 | `ck_tax_rate` |
| Cess basis agrees with its figures (both blocks) | `ck_tax_cess_agrees`, `ck_tax_acess_agrees` |
| EXEMPT / NIL_RATED / NON_GST charge nothing. **ZERO_RATED is not one of them** — an export is taxable at 0% and must stay distinguishable on the return | `ck_tax_exempt_zero` |
| `tax_name` / `tax_code` unique among **live** rows, case-insensitively | `ux_tax_name`, `ux_tax_code` (partial — invisible to Prisma, so the check must live here) |
| No two lines override the same `(role, supply nature)`; two lines both leaving the nature open collide | `ux_trl_rate_role` (`NULLS NOT DISTINCT`) |
| A rate may not supersede itself | `ck_tax_no_self_supersede` |
| A supersession chain may not loop | **nothing** — see below |

### The two rules only this module can state

`utils/tax-rate-ledger.guard.ts` is the TypeScript form of what began as a
`BEFORE INSERT OR UPDATE` trigger (`inventory.fn_tax_rate_ledger_guard`):

1. **`alr_by_rate`** — round-off, discount, write-off and advances have one
   answer for the whole business. They have nothing to do with a GST rate, so
   `acc_ledger_map` is their only home.
2. **`alr_by_supply`** — CGST and SGST exist only on an intra-state sale and
   IGST only on an inter-state one, so a tax role already *says* its supply
   nature; a row narrowing it further could never be the best match.
3. **Ledger fitness** — delegated to the shared
   [ledger-role.helper](../../accountsModule/ledgerRole/ledger-role.helper.ts),
   which checks ledger type, GST duty head and account-group nature against
   `acc_ledger_role`, and requires a **global** ledger: a rate is shared by
   every company, so a company-scoped ledger would make one company's books
   absorb everyone's postings.

An FK cannot read a column of the table it points at, which rules out 1 and 2 as
constraints. A trigger could do all three — but it answers with a `RAISE` that
Prisma surfaces as an opaque 500, one failure at a time, on the first bad row it
reaches. Here they answer with a 400 carrying a field path per bad line
(`lines.0.trl_ledger_id`).

The **supersession cycle** check is likewise app-only: `ck_tax_no_self_supersede`
blocks `A → A`, but nothing blocks `A → B → A`, which would make "what was this
rate before?" unanswerable.

## Soft delete

Rows are never hard-deleted. `DELETE /delete` sets `tax_is_deleted = true` /
`tax_is_active = false` on the header and on every live override, in one
`$transaction`, and reports `lines_deleted`. Deleting **frees the name and code
for reuse** — that is what the partial unique indexes are for, and how
`GST @ 18%` stops piling up beside `GST 18%`.

## Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` under screen
name **Tax Rate Master** (`screenType: 'master'`), actions `insert` / `update` /
`cancel`. The header is logged first and each line as it is written, so the log
reads in order. The actor comes from `RequestContextService.getUserId()`, falling
back to `DEFAULT_ACTOR`.

## Resolution — `GET /resolve`

`/get` returns the overrides the grid carries, which is only where the rate
*differs*. `/resolve` asks the question posting asks:

```jsonc
{
  "tax_id": "…", "tax_name": "GST 18%", "supply_nature": null,
  "roles": [
    { "role": "SALES",       "source": "DEFAULT",  "ledger_name": "Sales Account", … },
    { "role": "OUTPUT_CGST", "source": "OVERRIDE", "ledger_name": "CGST Output 9%", … },
    { "role": "OUTPUT_CESS", "source": "UNMAPPED", "ledger_id": null, … }
  ]
}
```

`source` is the point of it — `OVERRIDE` where this rate carries a row of its
own, `DEFAULT` where it inherits `accounts.acc_ledger_map`, and `UNMAPPED` where
neither answers, which is the one state that makes a voucher touching that role
unpostable.

The roles listed are those the catalogue marks `alr_by_rate`: exactly the set a
rate is allowed to have an opinion about. Round-off, discount, write-off and
advances are deliberately absent.

The precedence itself lives in
[ledger-map.helper](../../accountsModule/ledgerRole/ledger-map.helper.ts) — the
application-layer form of `accounts.fn_ledger_for`, and the read-side
counterpart to `ledger-role.helper`. The rate's own override is tried first,
then `acc_ledger_map`, and within each the most specific eligible row wins:
branch beats company beats global, and a row naming a supply nature beats one
that leaves it open. Nothing is scoped today — every `acc_ledger_map` row has a
NULL company and branch — so those terms change no answer until someone inserts
a scoped row, which is what those columns are for.

## Who else references a rate

Five columns now point at `tax_rate_master`, and every one of them is an FK,
which buys "the row exists" and nothing else. Two rules an FK cannot state are
the ones an operator notices, so
[utils/tax-rate-reference.helper.ts](utils/tax-rate-reference.helper.ts) holds
them once for everybody: a **soft-deleted** rate still satisfies the FK, and so
does a **deactivated** one — which is the whole reason `tax_is_active` is
separate from `tax_is_deleted`.

| Column | Set by | Guarded in |
| --- | --- | --- |
| `sales.sale_quotation_item.sqi_tax_id` | `sqiTaxId` on the item grid | [quotation.service.ts](../../sales/quotation/quotation.service.ts) |
| `sales.sale_order_item.soi_tax_id` | `soiTaxId` on the item grid | [sale-order.service.ts](../../sales/sale-order/sale-order.service.ts) |
| `public.txn_charge_detail.cd_tax_code` | `cdTaxCode` on a charge line | [charge-detail.service.ts](../../master/charge-detail/charge-detail.service.ts) and quotation's own charge path |
| `sales.sale_bill_item.sbi_tax_id` | not wired yet | — |
| `accounts.acc_ledger_master.led_tax_id` | not wired yet | — |

A charge line carries the extra half of `charge_master.ck_chg_tax_id`:
`cdTaxCode` is only meaningful on a charge that carries its **own** GST, so it
must be null unless `cdTaxApl` is set and `cdBeforeTax` is not. A before-tax
charge is taxed at the *item's* rate inside the item line, and a non-taxable one
is never taxed — either way a rate there would be one nothing reads.

## Relationship to items-tax-master

[items-tax-master](../items-tax-master) still owns `inventory.item_tax_master`,
which remains the **live** GST rate master until the read/write paths move.
Nothing in this module touches it. The two differ in shape, not just in table:
the old one carries its ledgers as eighteen columns that went 12 → 14 → 4 → 14 →
18 in a week as each new axis turned up, and every one of those was an `ALTER`.
