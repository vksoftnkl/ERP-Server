# GSP Provider Master

CRUD API for **GSP (GST Suvidha Provider) providers** — the external GST API gateways the ERP
connects to. Each record stores a provider's identity (code, name), its API endpoint
(base URL, route, server IP) and the credentials (user name, password) used to reach it.

- **Base route:** `gsp-provider-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `GSP Provider Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `gsp_provider_master` (`fixed` schema) — PK `gspProviderId` (UUIDv7)
- **Related table:** `gsp_company_service` — FK `csgGspProviderId → gspProviderId` (delete guard)

## Files

| File | Purpose |
| --- | --- |
| [gsp-provider-master.module.ts](gsp-provider-master.module.ts) | Module wiring — imports `AuditLogModule` |
| [gsp-provider-master.controller.ts](gsp-provider-master.controller.ts) | HTTP routes + Swagger docs |
| [gsp-provider-master.service.ts](gsp-provider-master.service.ts) | Business logic, persistence, audit logging |
| [gsp-provider-master-exception.filter.ts](gsp-provider-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `gsp*` field names) |
| [dto/save-gsp-provider-master.dto.ts](dto/save-gsp-provider-master.dto.ts) | Single create/update payload |
| [dto/gsp-provider-master-response.dto.ts](dto/gsp-provider-master-response.dto.ts) | Swagger response models |
| [types/gsp-provider-master-api.types.ts](types/gsp-provider-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a GSP provider (routed by `gspProviderId` presence in the body). |
| `GET` | `/get` | Fetch one active provider by `gspProviderId` (UUIDv7 query param). |
| `DELETE` | `/delete` | Soft-delete a provider by `gspProviderId` (UUIDv7 query param). |

### Create / update semantics

- **Omit `gspProviderId` → create; include `gspProviderId` → update** the existing provider
  (`save` dispatches to `createProvider` / `updateProvider`).
- Update first loads the active row and 404s if it is missing or already deleted.
- Both operations run in a `$transaction`, persist the record, then write the audit log.
- `gspProviderCode`, `gspProviderName`, `gspBaseUrl`, `gspRoute`, `gspUserName` and
  `gspUserPassword` are required and trimmed via `normalizeRequiredText`.
- `gspIpAddress` is validated with Node's `isIP` (`normalizeIpAddress`) — a non-IP value is
  rejected with a bad-request error — in addition to the DTO's `@IsIP()` check.
- `gspIsActive` is optional; it is only written when present in the payload (`hasOwnProperty`),
  otherwise the DB default (`true`) applies.

### Uniqueness / validation rules

- **Provider code uniqueness** — case-insensitive among non-deleted rows (`ensureCodeIsUnique`).
- **Provider name uniqueness** — case-insensitive among non-deleted rows (`ensureNameIsUnique`).
- A race that slips past those checks is caught by `throwOnUniqueConstraintError`, which maps a
  DB unique-constraint violation to a conflict on `gspProviderCode`.
- DTO length caps: `gspProviderCode` ≤ 50, `gspProviderName` ≤ 150.

### Soft delete

- **Soft delete only** — deleting flags `gspIsDeleted = true` / `gspIsActive = false` and stamps
  `gspModifiedOn` / `gspModifiedBy`; rows are never hard-deleted.
- **Referential guard:** deletion is blocked (bad request) when the provider is linked to any
  active `gsp_company_service` row (`csgGspProviderId`, `csgIsDeleted = false`).

## Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`),
with `screenType: 'master'`, `tableName: 'gsp provider master'` and
`screenName: 'GSP Provider Master'`, capturing original vs. modified records. The acting user
comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.
