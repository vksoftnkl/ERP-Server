# GSP Company Service

CRUD API for **GSP company service configs** — each row links a company to a GSP
(GST Suvidha Provider) and stores that company's e-user service credentials (service type,
username, password, and auth token) used to talk to the provider.

- **Base route:** `gsp-company-services` (API-versioned via `API_VERSION`)
- **Swagger tag:** `GSP Company Service`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `gsp_company_service` (`fixed` schema) — PK `csgCompanyServiceId`
- **References:** `company` (`compId`) via DB FK `csgCompanyId` (`onDelete: Restrict`); `gsp_provider_master` (`gspProviderId`) via `csgGspProviderId` — a logical reference validated in code, not a Prisma relation

## Files

| File | Purpose |
| --- | --- |
| [gsp-company-service.module.ts](gsp-company-service.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter |
| [gsp-company-service.controller.ts](gsp-company-service.controller.ts) | HTTP routes + Swagger docs (controller-level `@CacheTTL(1)`) |
| [gsp-company-service.service.ts](gsp-company-service.service.ts) | Business logic, persistence, reference checks, audit logging |
| [gsp-company-service-exception.filter.ts](gsp-company-service-exception.filter.ts) | Extends `SettingsExceptionFilter`; maps DB/domain errors to the module's error shape (matches `csg*` field names) |
| [dto/save-gsp-company-service.dto.ts](dto/save-gsp-company-service.dto.ts) | Single create/update payload |
| [dto/gsp-company-service-response.dto.ts](dto/gsp-company-service-response.dto.ts) | Swagger response models |
| [types/gsp-company-service-api.types.ts](types/gsp-company-service-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a GSP company service (chosen by `csgCompanyServiceId` presence). |
| `GET` | `/get` | Fetch one config by `csgCompanyServiceId` (required UUID v7 query param). |
| `DELETE` | `/delete` | Soft-delete a config by `csgCompanyServiceId` (required UUID v7 query param). |

### Create / update semantics

- **Omit `csgCompanyServiceId` → create; include it → update** the existing config
  ([`save`](gsp-company-service.service.ts) branches on its presence).
- Required text fields `csgServiceType`, `csgEuserName`, `csgEuserPassword` are normalized/trimmed
  (`normalizeRequiredText`); `csgServiceType` is also uppercased and capped at 20 chars
  (`UpperMaxString(20)`, matching the `VarChar(20)` column).
- `csgAuthToken` is normalized to a nullable string (`normalizeNullableString`).
- The optional fields `csgAuthToken`, `csgAuthTokenValidTill`, and `csgIsActive` are written **only
  when present** in the payload (`hasOwnProperty` guard), so update never clobbers an omitted field.
- Each write runs in a `$transaction` and returns the persisted [payload](types/gsp-company-service-api.types.ts).

### Reference validation

- `ensureCompanyExists` — `csgCompanyId` must match an active (`compIsDeleted = false`) `company`,
  else a `400` with field `csgCompanyId`.
- `ensureGspProviderExists` — `csgGspProviderId` must match an active
  (`gspIsDeleted = false`) `gsp_provider_master`, else a `400` with field `csgGspProviderId`.
- Both checks run on create **and** update, inside the transaction.

### Error mapping

Write failures are routed through `handleWriteError`:

- A DB **unique-constraint** violation → `409 Conflict` (`throwOnUniqueConstraintError`). There is no
  explicit app-level uniqueness check; the schema defines no composite unique constraint.
- A DB **foreign-key** violation → `400 Bad Request` ("Invalid company or provider reference").

## Soft delete

- `softDelete` verifies the row exists and is not already deleted, then flags
  `csgIsDeleted = true` / `csgIsActive = false` and stamps `csgModifiedOn` / `csgModifiedBy`.
  Rows are never hard-deleted. Returns `{ csgCompanyServiceId, deleted: true }`.

## Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` as a `master`-type screen
("GSP Company Service"), capturing original vs. modified records:

- Create → action `New`, update → action `update`, soft delete → action `cancel`.
- The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
- `displayName` is built as `` `${csgServiceType} (${csgEuserName})` `` (`buildDisplayName`).

## Response payload

`toPayload` returns the stored record plus derived reference labels. `GET /get` embeds the linked
**company** name (`companyName` / `companyDisplay`, from the `company` relation) and the **provider**
name (`providerName` / `providerDisplay`, resolved through `loadProviderNameMap` against
`gsp_provider_master`); create/update responses return these reference names as `null`.
The payload includes the stored service credentials (`csgEuserName`, `csgEuserPassword`,
`csgAuthToken`) and the ISO-formatted `csgAuthTokenValidTill` / `csgSyncDate` / audit timestamps.
