# Ledger Shipping Address

CRUD API for a ledger's **shipping / billing addresses** — the ship-to / bill-to delivery
locations (with GSTIN, state code and PIN) that hang off an account ledger for use on
invoices and dispatch documents.

- **Base route:** `ledger-shipping-addresses` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Ledger Shipping Address`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `acc_ship_addrs` (`accounts` schema) — PK `saaId`
- **FK references:** `saaLedgerId → acc_ledger_master.ledId` (required), `saaCompanyId → company.compId`, `saaBranchId → branch_master.brId` (both optional)

## Files

| File | Purpose |
| --- | --- |
| [ledger-shipping-address.module.ts](ledger-shipping-address.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service and exception filter |
| [ledger-shipping-address.controller.ts](ledger-shipping-address.controller.ts) | HTTP routes + Swagger docs |
| [ledger-shipping-address.service.ts](ledger-shipping-address.service.ts) | Business logic, persistence, audit logging |
| [ledger-shipping-address.validation.ts](ledger-shipping-address.validation.ts) | App-layer data-quality checks (addr type, PIN, state code, GSTIN) that were formerly DB CHECK constraints |
| [ledger-shipping-address-exception.filter.ts](ledger-shipping-address-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `saa*` field names) |
| [dto/save-ledger-shipping-address.dto.ts](dto/save-ledger-shipping-address.dto.ts) | Single create/update payload |
| [dto/ledger-shipping-address-response.dto.ts](dto/ledger-shipping-address-response.dto.ts) | Swagger response models |
| [types/ledger-shipping-address-api.types.ts](types/ledger-shipping-address-api.types.ts) | Payload / response TypeScript contracts |
| [types/ledger-shipping-address-enum.ts](types/ledger-shipping-address-enum.ts) | App-layer enum (see below) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a shipping address (single object; branch decided by `saaId` presence). |
| `GET` | `/get` | Fetch one active shipping address by `saaId` (required UUID query param). |
| `DELETE` | `/delete` | Soft-delete a shipping address by `saaId` (required UUID query param). |

### Create / update semantics

- **Omit `saaId` → create; include `saaId` → update** the existing address
  ([`save` dispatch](ledger-shipping-address.service.ts)).
- `saaId` on `GET /get` and `DELETE /delete` is validated as a **UUID v7** query param via
  `ParseUUIDPipe`.
- Each mutation runs inside a `$transaction`, covering existence checks, the write and its
  audit log.
- On update, unsent fields fall back to the existing row's values (`saaAddrType`,
  `saaCompanyId`, `saaBranchId`, `saaCountryCode`, `saaIsDefault`); optional fields are only
  written when the property is actually present on the payload (`applyOptionalFields`,
  keyed on `hasOwnProperty`).

## Default-address rule

- `saaAddrType` defaults to `SHIP_TO` when omitted.
- `saaCountryCode` defaults to `IN`, normalized to trimmed upper-case.
- **At most one default per (`saaLedgerId`, `saaAddrType`)** — enforced in code
  (`clearDefaultAddress`). Setting `saaIsDefault = true` first clears the current default for
  the same ledger + address type (excluding the row being updated) before the write. This is
  a code-level guarantee; there is no DB partial unique index.

## Validation

The four data-quality checks that were DB CHECK constraints on `acc_ship_addrs` are enforced
in the app layer (see [ledger-shipping-address.validation.ts](ledger-shipping-address.validation.ts),
migration `20260624130000_restructure_acc_ship_addrs_and_move_checks_to_app_layer`):

- **`saaAddrType`** — must be one of `SHIP_TO` / `BILL_TO` / `BOTH`; normalized trimmed
  upper-case (`assertSaaAddrType`, also `@IsEnum(SaaAddrType)` in the DTO).
- **`saaGstin`** — mandatory (NOT NULL); must match the standard 15-character GSTIN format;
  normalized trimmed upper-case (`assertSaaGstin`).
- **`saaStateCode`** — optional; when present must be a 2-digit GST numeric state code
  (`assertSaaStateCode`).
- **`saaPin`** — optional; only enforced when the country is `IN`, where it must be 6 digits
  (`assertSaaPin`).
- Related-record existence is checked before write: the target **ledger must exist and be
  active** (`ensureLedgerExists`), and a supplied **company** / **branch** must exist and be
  active (`ensureCompanyExists`, `ensureBranchExists`).

## Business rules

- **Soft delete only** — rows are never hard-deleted. Deleting flags `saaIsDeleted = true` /
  `saaIsActive = false`; all reads filter on `saaIsDeleted = false`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` /
  `cancel`), capturing original vs. modified records with a resolved display name
  (`saaTradeName ?? saaContactName ?? saaId`). The acting user comes from
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`, and is stamped into
  `saaCreatedBy` / `saaModifiedBy`.
- Duplicate unique-constraint violations are surfaced as a conflict via
  `throwOnUniqueConstraintError`.

## Enums (app-layer)

Validation lives in the app, not in Postgres — `saaAddrType` is a plain `VarChar(20)` column
with the allowed values enforced in code. See
[types/ledger-shipping-address-enum.ts](types/ledger-shipping-address-enum.ts).

- `SaaAddrType` — `SHIP_TO` · `BILL_TO` · `BOTH`
