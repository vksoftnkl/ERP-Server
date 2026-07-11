# Employee Master

CRUD API for **employee master** records — staff identity, contact, personal, employment
lifecycle, attendance, commission and payroll details — with links to company, branch,
department and designation.

- **Base route:** `employee-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Employee Master`
- **Auth:** Bearer `access-token` (required)
- **Response caching:** controller sets `@CacheTTL(1)`
- **Primary table:** `employee_master` (`public` schema) — PK `emp_id` (`empId`, a v7 UUID)
- **FK relations:** `emp_company_id → companys.comp_id` (required), `emp_department_id →
  employee_departments.edpt_id` (nullable), `emp_designation_id → employee_designations.ed_id`
  (nullable)

## Files

| File | Purpose |
| --- | --- |
| [employee-master.module.ts](employee-master.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service and exception filter |
| [employee-master.controller.ts](employee-master.controller.ts) | HTTP routes + Swagger docs |
| [employee-master.service.ts](employee-master.service.ts) | Business logic, persistence, FK validation, audit logging |
| [employee-master-exception.filter.ts](employee-master-exception.filter.ts) | Extends `SettingsExceptionFilter`; maps DB/domain errors to the module's error shape, matching `emp*` field names (regex `/\b(emp[A-Za-z0-9]+)\b/`) |
| [dto/save-employee-master.dto.ts](dto/save-employee-master.dto.ts) | Single create/update payload with validation/transform rules |
| [dto/employee-master-response.dto.ts](dto/employee-master-response.dto.ts) | Swagger response models (payload, delete result, success/error envelopes) |
| [types/employee-master-api.types.ts](types/employee-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update an employee, chosen by `empId` presence in the body. |
| `GET` | `/get` | Fetch one employee by `empId` (query param, validated as a v7 UUID). |
| `DELETE` | `/delete` | Soft-delete an employee by `empId` (query param, validated as a v7 UUID). |

### Create / update semantics

- **Omit `empId` → create; include `empId` → update** the existing employee
  ([`save`](employee-master.service.ts) dispatches to `createEmployee` / `updateEmployee`).
- The response message reflects the branch taken (`Employee created successfully` vs
  `Employee updated successfully`).
- Both create and update run inside a Prisma `$transaction` (the record write plus the audit
  log entry commit together).
- **Required fields:** `empCompanyId`, `empName` and `empSalaryType`. `empName` and
  `empSalaryType` are trimmed and rejected when empty (`normalizeRequiredValue`).
- **Optional fields** are copied only when present in the payload via `applyPresentFields`
  (see `EMPLOYEE_MASTER_OPTIONAL_FIELDS`), so an omitted key leaves the stored value untouched.
- On **update**, the row must exist and not be soft-deleted (`empIsDeleted = false`), else
  `404`.
- On **create**, `empCreatedOn`/`empCreatedBy` are stamped; on **update**,
  `empModifiedOn`/`empModifiedBy` are stamped. The acting user comes from
  `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

### FK validation

- **Company must exist and be active** — `ensureCompanyExists` validates `empCompanyId` against
  `company` where `compIsDeleted = false`; a missing company yields a `400` on `empCompanyId`.
- **Department is validated only when provided** — `ensureDepartmentExists` checks
  `empDepartmentId` against `employeeDepartment` where `edptIsDeleted = false`; `null`/`undefined`
  is skipped. A missing department yields a `400` on `empDepartmentId`.
- **Designation is validated only when provided** — `ensureDesignationExists` checks
  `empDesignationId` against `employeeDesignation` where `edIsDeleted = false`; `null`/`undefined`
  is skipped. A missing designation yields a `400` on `empDesignationId`.

### Photo handling

- `empPhoto` accepts a base64 string (optionally a `data:` URI, whose header is stripped) and is
  decoded to raw bytes for storage (`decodePhoto`). Invalid base64 yields a `400` on `empPhoto`.
- On read, the stored bytes are re-encoded to a base64 string in the response payload.

## Business rules

- **Soft delete only** — `softDelete` never hard-deletes; it flags `empIsDeleted = true` /
  `empIsActive = false` and stamps `empModifiedOn`/`empModifiedBy`. The row must currently exist
  and be undeleted, else `404`.
- **Get resolves related display names** — `getById` fetches the undeleted record and augments it
  with `empCompanyName`, `empBranchName`, `empDepartmentName` and `empDesignationName` looked up
  from `company`, `branchMaster`, `employeeDepartment` and `employeeDesignation` respectively.
- **Write-error mapping** (`handleWriteError`): a unique-constraint violation surfaces as
  `Employee already exists` (`409`, field `empCode`); a foreign-key violation surfaces as
  `Invalid relation reference` (`400`, field `empCompanyId`).
- **Every mutation is audited** via `AuditLogService.logEntityChange` with action `New` /
  `update` / `cancel`, `tableName` `emp_master`, `screenName` `Employee Master`, `screenType`
  `master`, capturing original vs. modified records.

## Success / error shapes

- Success responses use the shared envelope `{ success: true, message, data }`
  (`EmployeeMasterSuccessResponse`). Delete returns `{ empId, deleted: true }`.
- Errors use `{ success: false, message, errors: [{ field, message }] }` via the settings-layer
  helpers (`throwSettingsBadRequest`, `throwSettingsNotFound`, `throwOnUniqueConstraintError`)
  and the module's `EmployeeMasterExceptionFilter`.
