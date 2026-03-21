# NestJS Audit Logging Plan (Method-Based, No SQL Function)

## Summary
Implement audit logging as internal NestJS services and TypeScript methods using Prisma transactions.  
Use the existing `audit.audit_log` and `audit.audit_screen` tables.

## Reference Mapping
1. Legacy `iflag=2` -> `captureScreenSnapshot(...)`.
2. Legacy `iflag=1` -> `logEntityChange(...)`.
3. Snapshot capture is method-based; `modifiedRecord` should be passed by the caller for write flows.
4. No PL/pgSQL function is used.

## Public Interfaces
1. `src/modules/audit-log/types/audit-log.types.ts`
   - `AuditAction`
   - `CaptureScreenSnapshotInput`
   - `CreateAuditLogInput`
   - `LogEntityChangeInput`
2. `src/modules/audit-log/audit-log.service.ts`
   - `captureScreenSnapshot(input, tx?)`
   - `createAuditLog(input, tx?)`
   - `logEntityChange(input, tx?)`
3. Internal-only scope for this phase (no REST controllers).

## Data / Schema Changes
1. Use existing `AuditLogAction` values (`insert`, `update`, `approve`, `cancel`).
2. Soft-delete events are logged as `cancel`.

## Integration Scope
Audit service is integrated into write flows of:
1. `items-group-master`
2. `items-brand-master`
3. `items-section-master`
4. `units-master`
5. `grid-details`
6. `grid-columns`

Each create/update/soft-delete path logs within the same transaction (fail-closed).

## Defaults
1. No external `dblink` replication.
2. `log_user_id` accepts UUID; invalid/non-UUID values are stored as `null`.
