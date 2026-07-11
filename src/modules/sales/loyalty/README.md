# Promotion Loyalty Points

CRUD API for **loyalty schemes** and their three child collections — **party scope**
(who the scheme applies to), **point slabs** (how points accrue), and **gift rules**
(what points redeem for). One scheme header owns all three, and a single `GET` returns the
whole graph.

- **Base route:** `promotion-loyalty-points` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Promotion Loyalty Points`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `loyalty_sch_list` (`sales` schema) — PK `ls_id`
- **Child tables** (each FK'd to `ls_id`, soft-deleted with the scheme):
  - `loyalty_sch_party` — PK `lps_id`, FK `lps_ls_id → ls_id`
  - `loyalty_sch_points` — PK `lspt_id`, FK `lspt_ls_id → ls_id`
  - `loyalty_sch_gift` — PK `lsg_id`, FK `lsg_ls_id → ls_id`

## Files

| File | Purpose |
| --- | --- |
| [promotion-loyalty-points.module.ts](promotion-loyalty-points.module.ts) | Module wiring — imports `AuditLogModule` (service is **not** exported) |
| [promotion-loyalty-points.controller.ts](promotion-loyalty-points.controller.ts) | HTTP routes + Swagger docs; `@CacheTTL(1)`, binds the exception filter |
| [promotion-loyalty-points.service.ts](promotion-loyalty-points.service.ts) | Business logic, persistence, validation, audit logging |
| [promotion-loyalty-points-exception.filter.ts](promotion-loyalty-points-exception.filter.ts) | Extends `SalesExceptionFilter`; regex maps snake_case field tokens into the error shape |
| [utils/loyalty.utils.ts](utils/loyalty.utils.ts) | Validation/format helpers, optional-field appliers, payload converters, Prisma error mapping |
| [types/promotion-loyalty-points-api.types.ts](types/promotion-loyalty-points-api.types.ts) | Payload / response / delete-result TypeScript contracts |
| [dto/save-loyalty-scheme.dto.ts](dto/save-loyalty-scheme.dto.ts) | Scheme create/update payload (embeds `parties[]`) |
| [dto/save-loyalty-party.dto.ts](dto/save-loyalty-party.dto.ts) | A single nested party-scope entry |
| [dto/save-loyalty-point.dto.ts](dto/save-loyalty-point.dto.ts) | Point-slab create/update payload |
| [dto/save-loyalty-gift.dto.ts](dto/save-loyalty-gift.dto.ts) | Gift-rule create/update payload |
| [dto/loyalty-scheme-id-query.dto.ts](dto/loyalty-scheme-id-query.dto.ts) · [dto/loyalty-point-id-query.dto.ts](dto/loyalty-point-id-query.dto.ts) · [dto/loyalty-gift-id-query.dto.ts](dto/loyalty-gift-id-query.dto.ts) | `GET` query DTOs (required id) |
| [dto/delete-loyalty-scheme-query.dto.ts](dto/delete-loyalty-scheme-query.dto.ts) · [dto/delete-loyalty-point-query.dto.ts](dto/delete-loyalty-point-query.dto.ts) · [dto/delete-loyalty-gift-query.dto.ts](dto/delete-loyalty-gift-query.dto.ts) | `DELETE` query DTOs (id + optional `*_updated_by`) |
| [dto/promotion-loyalty-points-response.dto.ts](dto/promotion-loyalty-points-response.dto.ts) | Swagger response models; re-exports the shared sales error DTOs |
| [dto/loyalty-dto.helpers.ts](dto/loyalty-dto.helpers.ts) | Barrel re-export of the shared DTO transforms/decorators |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a scheme by `ls_id` presence. Embeds `parties[]`. |
| `GET` | `/get` | Fetch one full scheme graph by `ls_id` (header + active parties, points, gifts). |
| `DELETE` | `/delete` | Soft-delete a scheme by `ls_id` (cascades to its children). |
| `POST` | `/points/create` | Create **or** update a point slab by `lspt_id` presence. |
| `GET` | `/points/get` | Fetch one point slab by `lspt_id`. **Deprecated** (compatibility). |
| `DELETE` | `/points/delete` | Soft-delete a point slab by `lspt_id`. |
| `POST` | `/gifts/create` | Create **or** update a gift rule by `lsg_id` presence. |
| `GET` | `/gifts/get` | Fetch one gift rule by `lsg_id`. **Deprecated** (compatibility). |
| `DELETE` | `/gifts/delete` | Soft-delete a gift rule by `lsg_id`. |

There is **no list endpoint** — points and gifts are read through the scheme graph (`GET /get`);
the `points/get` and `gifts/get` single-record endpoints exist only for backward compatibility.

## Create / update semantics

- **Omit the id → create; include the id → update.** This applies independently to schemes
  (`ls_id`), points (`lspt_id`), gifts (`lsg_id`), and nested parties (`lps_id`).
- **Updates are partial.** Only fields actually present on the payload are written — the service
  gates every column on `hasOwnProperty(dto, …)`, and the DTOs use `@ValidateIf` so a field is
  only required when the row is new or that field is supplied.
- Writes run inside a `$transaction`; on failure `handleLoyaltyWriteError` maps Prisma errors
  (`P2002 →` 409 conflict, `P2003 →` 400 with the offending FK field resolved from error meta)
  and everything rolls back.

### Scheme header

- **On create**, `ls_name`, `ls_type`, `ls_start_date`, `ls_end_date`, and `ls_comp_id` are
  required. Dates are parsed as UTC day boundaries (start `00:00:00`, end `23:59:59.999`) and
  `ls_start_date ≤ ls_end_date` is enforced both in the DTO (`LoyaltySchemeDateRangeConstraint`)
  and the service (`ensureDateRange`).
- Optional times (`ls_valid_from_time` / `ls_valid_to_time`) accept `HH:mm` / `HH:mm:ss` and are
  stored as `1970-01-01` UTC times.
- The scheme carries the whole accrual/redemption **configuration** (apply-on basis, calc-amount
  type, rounding, redeem caps/value-per-point, point validity/expiry basis, etc. — see the
  payload contract and value sets below). This module persists that configuration; it does not
  itself post an accrual or redemption against a bill.

### Nested parties (`parties[]` on the scheme payload)

Managed only through the scheme `POST /create` body, via `syncSchemeParties`:

- Item **with** `lps_id` → updates that row (must already belong to the scheme, else 404).
- Item **without** `lps_id` → inserts a new row.
- Existing active rows **absent from the array** → soft-deleted.
- **Omitting `parties` entirely** leaves the scheme's parties untouched (the update returns the
  existing set); sending an empty array removes them all.
- `lps_slno` defaults to the 1-based array index; **duplicate serials within one payload → 409**.
- Party scope type is limited to `CUSTOMER_GROUP` / `CUSTOMER`.

### Point slabs (`/points`)

- Target scheme must be **active** (`getActiveScheme`).
- `lspt_slno` auto-increments per scheme (`getNextPointSlno`) when omitted; it must be **unique
  per scheme** (`ensurePointSlnoUnique`, else 409).
- **Accrual factor is derived, not trusted:** `lspt_factor = lspt_points / lspt_each`
  (`calculatePointFactor`), and `lspt_each` must be `> 0` (400 otherwise). A slab therefore means
  "earn `lspt_points` points per `lspt_each` of the measured base," optionally above an
  `lspt_exceeds` threshold and scoped to a specific `lspt_item_id` / `lspt_unit_id`.
- Optional scope references are validated against the **scheme's `ls_item_type`**
  (`ensurePointScopeReference`), so `lspt_item_id` must point at the right master:

  | scheme `ls_item_type` | validated against |
  | --- | --- |
  | `ITEM_GROUP` | `itemGroupMaster` (active) |
  | `ITEM_BRAND` | `itemBrandMaster` (active) |
  | `ITEM_CATEGORY` | `categoryMaster` (active) |
  | `ITEM_SECTION` | `itemSectionMaster` (active) |
  | `ALL` / `ITEM` / other | `itemMaster` (active) |

  `lspt_unit_id`, when supplied, must reference an active `unit`.

### Gift rules (`/gifts`)

- Target scheme must exist (`ensureSchemeExists`).
- `lsg_item_id` (active `itemMaster`) and `lsg_unit_id` (active `unit`) are required and validated.
- `lsg_slno` auto-increments per scheme (`getNextGiftSlno`) when omitted and must be **unique per
  scheme** (`ensureGiftSlnoUnique`, else 409).
- A rule means "redeem `lsg_redeem_points` points for `lsg_item_qty` of `lsg_item_id`"
  (`lsg_item_qty > 0`, `lsg_redeem_points ≥ 0`), with an `lsg_repeat` flag.

## Soft delete

- **Soft delete only** — rows are never hard-deleted. Each delete sets `*_is_deleted = true`,
  `*_is_active = false`, and stamps `*_updated_on` / `*_updated_by`.
- `DELETE /delete` runs in one transaction and **cascades**: the scheme plus all its
  not-yet-deleted parties, points, and gifts are flagged (`updateMany`).
- `DELETE /points/delete` and `DELETE /gifts/delete` flag only the single target row.
- `GET /get` and every write read only active, non-deleted records
  (`findActiveSchemeWithChildren` filters `*_is_deleted = false` / `*_is_active = true` and orders
  children by `*_slno`, then id).

## Uniqueness & validation

- **Scheme code** is unique per company, case-insensitive, only when a code is supplied
  (`ensureSchemeCodeUnique`).
- **Point / gift serial numbers** are unique per scheme; **party serials** are checked for
  duplicates within the submitted payload.
- Numeric guards run through `requireNumber` / `requireInteger`; UUIDs through a strict
  `UUID_PATTERN` (`requireUuid` / `resolveActorUuid`). Blank strings normalize to `null`.

## Actor resolution & audit logging

- **Every mutation is audited** via `AuditLogService.logEntityChange` — actions `insert` /
  `update` / `cancel`, `screenName` `Promotion Loyalty Points`, `screenType` `master`, capturing
  original vs. modified payloads. Table labels are the friendly names `loyalty scheme list`,
  `loyalty scheme points`, `loyalty scheme gift`, and `loyalty scheme party scope`.
- The **audit actor** comes from `RequestContextService.getUserId()`, falling back to
  `DEFAULT_AUDIT_ACTOR`.
- The persisted `*_created_by` / `*_updated_by` columns are resolved by `resolveActorUuid`, which
  takes the first candidate matching the UUID pattern among the DTO-supplied ids and the
  request-context user id.

## Validated value sets (DTO `@IsIn`)

Scheme string fields are constrained by fixed vocabularies in
[dto/save-loyalty-scheme.dto.ts](dto/save-loyalty-scheme.dto.ts) (validation lives in the app,
not as native DB enums):

- `ls_type` — `REDEEM` · `BOTH` · `GIFT`
- `ls_status` — `DRAFT` · `APPROVED` · `ACTIVE` · `CLOSED` · `CANCELLED`
- `ls_apply_on` — `BILL_AMOUNT` · `ITEM_AMOUNT` · `BILL_QTY` · `ITEM_QTY` · `MASTER_PV`
- `ls_calc_on_amount_type` — `NET_AMOUNT` · `GROSS_AMOUNT` · `TAXABLE_AMOUNT`
- `ls_bill_type` — `ALL` · `CASH` · `CREDIT`
- `ls_cust_type` — `ALL` · `CUSTOMER_GROUP` · `CUSTOMER`
- `ls_item_type` — `ALL` · `ITEM_GROUP` · `ITEM_BRAND` · `ITEM_CATEGORY` · `ITEM_SECTION` · `ITEM`
- `ls_rounding_method` — `FLOOR` · `ROUND` · `CEIL`
- `ls_expiry_basis` — `EARN_DATE` · `SCHEME_END_DATE` · `MONTH_END` · `YEAR_END` · `NONE`
- party `lps_scope_type` — `CUSTOMER_GROUP` · `CUSTOMER`

## Referenced masters (read-only)

Beyond its own tables, the service validates foreign references against other masters but never
writes them: `itemMaster`, `unit`, `itemGroupMaster`, `itemBrandMaster`, `categoryMaster`, and
`itemSectionMaster` (each checked for an active, non-deleted row).
</content>
</invoke>
