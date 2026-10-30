# Device List Master

CRUD API for **device masters** — the registered devices (desktop, mobile, web) that belong to a
company / branch / user and can be blocked or tied to login sessions.

- **Base route:** `device-list-masters` (API-versioned per route via `@Version(API_VERSION)`)
- **Swagger tag:** `Device List Master`
- **Auth:** Bearer `access-token` (required)
- **Response cache:** controller-level `@CacheTTL(1)`
- **Primary table:** `device_master` (`fixed` schema) — PK `devId` (`dev_id`)

## Files

| File | Purpose |
| --- | --- |
| [device-list-master.module.ts](device-list-master.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter (service is **not** exported) |
| [device-list-master.controller.ts](device-list-master.controller.ts) | HTTP routes + Swagger docs |
| [device-list-master.service.ts](device-list-master.service.ts) | Business logic, persistence, uniqueness checks, audit logging |
| [device-list-master-exception.filter.ts](device-list-master-exception.filter.ts) | Extends `FixedExceptionFilter`; maps DB/domain errors to the module's error shape (matches `dev*` field names) |
| [dto/save-device-list-master.dto.ts](dto/save-device-list-master.dto.ts) | Single create/update payload |
| [dto/list-device-list-master-query.dto.ts](dto/list-device-list-master-query.dto.ts) | List query params (extends `FixedListQueryBaseDto`) |
| [dto/device-list-master-response.dto.ts](dto/device-list-master-response.dto.ts) | Swagger response models |
| [types/device-list-master-api.types.ts](types/device-list-master-api.types.ts) | Payload / response TypeScript contracts |
| [types/device-list-master-enum.ts](types/device-list-master-enum.ts) | App-layer enums (see below) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a device (branches on `devId` presence). |
| `GET` | `/list` | List devices via a configured grid — search + pagination. |
| `GET` | `/get` | Fetch one device by `devId` (UUID v7), with related company/branch/user names. |
| `DELETE` | `/delete` | Soft-delete a device by `devId` (UUID v7). |

### Create / update semantics

- **Omit `devId` → create; include `devId` → update** the existing (non-deleted) device.
- Each mutation runs in a single `$transaction` (create, update, and soft-delete).
- `devDeviceType` is normalized against `DeviceType` and defaults to `Desktop` on create when
  absent; `devPlatform` is normalized against `DevicePlatform` (blank → `null`). An out-of-range
  value raises a validation (bad-request) error.
- **`devDeviceUid` is required when `devDeviceType` is `Desktop`.** For non-desktop types an
  omitted UID is auto-generated as `<TYPE>-<uuid>` (`buildGeneratedDeviceUid`).
- Optional fields are applied only when present in the payload (`applyPresentFields`); on create,
  `devCreatedOn`/`devCreatedBy` are set and modified fields are null, and on update
  `devModifiedOn`/`devModifiedBy` are stamped.
- The acting user is resolved via `resolveActor(devEntryBy, …)` falling back to
  `RequestContextService.getUserId()` then `DEFAULT_ACTOR`.

### List

- Backed by `ConfiguredGridSqlService` through `runConfiguredGridQuery` (grid `erp device master`,
  alias `device_list_master_grid`) with `search` and pagination resolved by `resolvePagination`.
- The query DTO also exposes optional `devCompanyId`, `devIsActive`, and `devIsBlocked` filters.
- A missing configured grid raises a bad-request error.

## Business rules

- **Device UID uniqueness** is per company, case-insensitive (`ensureDeviceUidIsUnique`, scoped by
  `devCompanyId` and excluding the current row on update). The DB also enforces a unique constraint
  on `devDeviceUid`, so Prisma `P2002` errors are mapped to a conflict
  (`throwOnUniqueConstraintError`).
- **Soft delete only** — deleting flags `devIsDeleted = true` / `devIsActive = false` and stamps
  `devModifiedOn` / `devModifiedBy`; rows are never hard-deleted.
- **Delete is blocked when the device is in use** — if any active `userLoginSession`
  (`ulsDeviceId = devId`, not deleted) references it, deletion raises a bad-request error.
- The `/get` response embeds related names (`devCompanyName`, `devBranchName`, `devUserName`)
  resolved from `company`, `branchMaster`, and `userMaster`.
- **Every mutation is audited** via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`),
  capturing original vs. modified records with `devDeviceUid` as the display name.
- **`devCode` (notes 160 C, `fixed.device_master.dev_code` varchar(10))** is the short code stock
  voucher numbers carry — `TRF/2026-2027/D1/00016`, never the machine id (`device-code.helper.ts`).
  - One series across every device, not one per branch: a voucher number is unique per DOCUMENT
    branch (`ux_svh_refno`) and a device posts wherever it is used — the office PC on .106 has no
    branch and posts in three — so two devices with one code would print one number twice.
  - `ux_dev_code` (upper(dev_code), deleted rows included) and the next-code read both count
    deleted devices: a code is never given twice, or a new device would reprint an old one's numbers.
  - Create: blank → the next `D<n>`; keyed → trimmed, upper-cased, letters / digits / `-` / `_`
    (CHECK `ck_dev_code`), 409 `DEVICE_CODE_DUPLICATE` when taken. Update: blank or omitted keeps the
    code (a device always has one); a device with none gets the next. All under one advisory lock.
  - Migration `20261027110000_transfers_notes_160` backfilled the live devices, oldest first
    (NEXERP MACHINE = D1). Grid 31 shows it beside the device name. Old documents keep their refno.

## Enums (app-layer)

Stored as `VarChar` columns and validated in the app; see
[types/device-list-master-enum.ts](types/device-list-master-enum.ts).

- `DeviceType` — `Desktop` · `Mobile` · `Web`
- `DevicePlatform` — `Windows` · `macOS` · `Linux` · `Android` · `iOS` · `Other`
