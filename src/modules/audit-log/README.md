# Audit Log

Shared **audit-logging service** for the ERP. Other modules call
`AuditLogService.logEntityChange` inside their own transactions to record every master/transaction
mutation (create / update / cancel) as a before-and-after snapshot; the module also exposes a read
API for browsing those logs.

- **Base route:** `audit-logs` (also aliased as `audit-log`) — API-versioned via `API_VERSION`
- **Swagger tag:** `Audit Logs`
- **Auth:** Bearer `access-token` (required)
- **Response cache:** `@CacheTTL(60)` on the controller
- **Primary table:** `audit_log` (`audit` schema) — PK `logId` (`uuidv7`)
- **Screen catalog table:** `audit_screen` (`audit` schema) — PK `screenId` (autoincrement), FK
  `AuditLog.logScreenId → screenId`

## Files

| File | Purpose |
| --- | --- |
| [audit-log.module.ts](audit-log.module.ts) | Module wiring — declares the controller and **exports `AuditLogService`** so any module can inject it |
| [audit-log.controller.ts](audit-log.controller.ts) | Read-only HTTP route (`GET list`) + Swagger docs |
| [audit-log.service.ts](audit-log.service.ts) | The cross-cutting service: write API (`logEntityChange`, `createAuditLog`), the list/search reader, screen resolution, field projection and reference-name enrichment |
| [audit-screen-sql.constants.ts](audit-screen-sql.constants.ts) | Per-screen `SELECT … AS "Label"` templates that map raw DB columns to human labels; used to project/rename audit snapshots |
| [dto/list-audit-log-query.dto.ts](dto/list-audit-log-query.dto.ts) | Query params for the list endpoint (filters, pagination, cursor) |
| [dto/audit-log-response.dto.ts](dto/audit-log-response.dto.ts) | Swagger response models (`AuditLogListItemDto`, `AuditLogListMetaDto`, `AuditLogSuccessListDto`) and re-exported error DTOs |
| [types/audit-log.types.ts](types/audit-log.types.ts) | Public input contracts consumed by callers (`LogEntityChangeInput`, `CreateAuditLogInput`, `CaptureScreenSnapshotInput`) and the `AuditAction` / `AuditScreenKind` unions |
| [types/audit-log-api.types.ts](types/audit-log-api.types.ts) | List response TypeScript contracts (`AuditLogListItem`, `AuditLogListMeta`, success/error wrappers) |
| [audit-log.service.spec.ts](audit-log.service.spec.ts) | Unit tests for the service |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/list` | List audit logs, newest first, with filters, offset **or** cursor pagination, and optional total count. |

### List query parameters ([list-audit-log-query.dto.ts](dto/list-audit-log-query.dto.ts))

- `action` — `New` / `insert` / `update` / `approve` / `cancel` (`New` is normalized to `insert`).
- `screen_id` — filter by audit screen id.
- `screen_name` — exact audit screen name.
- `record_pk` — exact primary-key value of the audited record.
- `date_from` / `date_to` — ISO or date-only (`YYYY-MM-DD`); date-only bounds expand to full-day
  start/end. `date_from` must be `<= date_to`.
- `search` — case-insensitive contains across table name, pk, display name, notes and screen name.
- `page` / `limit` — offset pagination (`limit` default 20, capped at 200).
- `cursor` — `next_cursor` from a previous page; when present, `page`/`total` are skipped.
- `include_total` — opt-in `COUNT(*)`; omitted by default to avoid the count query.

Ordering is fixed to `logDate desc, logId desc` (matching the composite index). Each returned item
enriches the raw row: `insert` is shown back as `"New"`, snapshot columns are renamed to their
labels, and id references (user, branch, and many masters) are resolved to display names.

## Public service API (consumed by other modules)

`AuditLogService` is exported and injected wherever a mutation must be audited. Callers pass their
active Prisma transaction as the optional second argument so the audit row commits atomically with
the change (`tx ?? this.prisma` — omitting `tx` writes on the base client).

### `logEntityChange(input: LogEntityChangeInput, tx?): Promise<void>`

The primary entry point. Given an entity change it resolves the audit screen, projects the
before/after records through that screen's field map, computes the diff, and inserts one
`audit_log` row.

`LogEntityChangeInput` fields ([types/audit-log.types.ts](types/audit-log.types.ts)):

- `action` — `New` / `insert` / `update` / `approve` / `cancel` (case-insensitive; `New` → `insert`).
  Any other value throws `BadRequestException`.
- `tableName` — required; the physical table being audited (trimmed, stored in `logTableName`).
- `screenId` **or** `screenName` — identifies the audit screen (one is required). By name: an active
  screen is looked up (or **created on the fly** with `screenType` and the SQL template from the
  constants); by id: the active screen must already exist.
- `screenType` — `master` / `transaction` / `settings` / `other` (defaults to `other`); only used
  when a screen is auto-created.
- `pk` — record primary key (string / number / bigint), stored as text in `logPk`.
- `displayName` — human label for the record (e.g. the entity name).
- `entityId` — optional UUID stored in `logEntityId` (non-UUIDs are dropped).
- `originalRecord` / `modifiedRecord` — the before/after snapshots (plain objects). Both are
  projected onto the screen's audit fields before storage.
- `userId`, `branchId`, `accYear`, `notes` — actor, scope, accounting year hint, free-text note.

Action semantics:

- **insert** — stores the record (uses `modifiedRecord`, falling back to `originalRecord`) as
  `logOriginalRecord`; no diff is written. Throws if neither snapshot is available.
- **update** — requires **both** `originalRecord` and `modifiedRecord`; stores both plus a computed
  `logChangedFields` diff. Throws if either is missing.
- **approve / cancel** — stored like an update (both snapshots + diff when present).

If `modifiedRecord` is omitted, the service attempts an automatic snapshot via
`captureScreenSnapshot`; that path is currently disabled (returns `null`), so callers are expected
to pass `modifiedRecord` explicitly or a `BadRequestException` is raised.

### `createAuditLog(input: CreateAuditLogInput, tx?): Promise<void>`

Lower-level writer used internally by `logEntityChange`; also callable directly. It writes a row
verbatim (no screen resolution or diffing) after normalizing values:

- `logAction` normalized (`New` → `insert`); unknown actions throw.
- `tableName` required (trimmed); empty throws.
- `pk` coerced to trimmed text; `entityId` / `branchId` kept only if valid UUIDs.
- JSON snapshots serialized with `bigint → string` handling; `undefined` omitted, `null` stored as
  JSON null.
- **Actor resolution:** `userId` if it is a valid UUID, else
  `RequestContextService.getUserId()`.
- **IP resolution:** `RequestContextService.getIpAddress()`, stored only if a valid IP.

### `list(queryDto): Promise<{ items; meta }>`

Backs the `GET /list` endpoint (see above).

### What an audit entry captures

Each `audit_log` row records: action, screen (`logScreenId` + name), table name, record pk,
display name, optional entity UUID, the projected **original** and **modified** records, the
**changed-fields** diff, the acting **user id**, **branch id**, client **IP**, and free-text notes,
timestamped by `logDate`.

## Audit screen SQL constants ([audit-screen-sql.constants.ts](audit-screen-sql.constants.ts))

`AUDIT_SCREEN_SQL_BY_NAME` maps each screen name (e.g. `Account Ledger Master`, `Customer Master`,
`Units Master`) to a `SELECT column AS "Human Label" … FROM schema.table;` template built by
`buildAuditSql`. `getAuditScreenSql(screenName)` returns the template for a name (or `undefined`).

These templates are the source of truth for **which columns are auditable and how they are
labelled**. The service uses them two ways:

- **On write** (`logEntityChange`) — the template's `SELECT` list is parsed
  (`extractAuditFields`) into `{ sourceFieldName, targetFieldName }` pairs, and both snapshots are
  projected so only listed fields are kept, each renamed to its label. When a screen is looked up by
  id/name, its stored `screenAuditSql` is refreshed from the constants if it has drifted
  (`syncAuditScreenSqlIfNeeded`).
- **On read** (`list`) — stored snapshots are re-labelled through the same field map, and select id
  columns are replaced by the referenced record's name.

### Reference-name enrichment

On read, id-typed audit fields are resolved to display names. `GLOBAL_AUDIT_FIELD_REFERENCE_TYPES`
maps common labels (e.g. `Company ID`, `Item ID`, `Ledger ID`, `Unit ID`) to a lookup type, and
`SCREEN_AUDIT_FIELD_REFERENCE_TYPES` adds per-screen overrides (e.g. `Parent Group ID` →
account group / item group depending on screen). `fetchAuditReferenceNameMap` batch-loads names for
each lookup type from its master table (account group, area, branch, category, city, company,
customer, customer group, employee department/designation, godown, GSP provider, item, item
brand/group/section/tax, ledger, state, supplier group, tender type, unit, unit rate). Values
appear both as scalars and as `{ from, to }` diff leaves, and all are resolved in place.

## Enums / unions ([types/audit-log.types.ts](types/audit-log.types.ts))

App-layer string unions mirror the native Postgres enums on the audit tables:

- `AuditAction` — `insert` · `update` · `approve` · `cancel` (mirrors the `audit_log_action` PG
  enum). Callers may also pass `New`, which the service normalizes to `insert`.
- `AuditScreenKind` — `master` · `transaction` · `settings` · `other` (mirrors the
  `audit_screen_type` PG enum); used as `screenType` when a screen is auto-created.
