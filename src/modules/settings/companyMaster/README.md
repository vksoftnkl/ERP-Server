# Company Master

CRUD API for the **company master** — the tenant / legal company entity that owns the books
(GST identity, addresses, financial-year and compliance settings, branding and defaults).

- **Base route:** `company-masters` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Company Master`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `companys` (`public` schema) — Prisma model `Company`, PK `compId` (UUID)
- **Read-only lookups:** `stylesheet` relation (`compStylesheetId`) and `acc_ledger_master`
  (`compBankId`) are joined for display names only

## Files

| File | Purpose |
| --- | --- |
| [company-master.module.ts](company-master.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service and exception filter |
| [company-master.controller.ts](company-master.controller.ts) | HTTP routes + Swagger docs (`@CacheTTL(1)`) |
| [company-master.service.ts](company-master.service.ts) | Business logic, persistence, uniqueness checks, audit logging |
| [company-master-exception.filter.ts](company-master-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `comp*` field names) |
| [dto/save-company-master.dto.ts](dto/save-company-master.dto.ts) | Single create/update payload |
| [dto/company-master-response.dto.ts](dto/company-master-response.dto.ts) | Swagger response models |
| [types/company-master-api.types.ts](types/company-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a company, chosen by `compId` presence in the body. |
| `GET` | `/get` | Fetch one company by `compId` (required query param, validated by `ParseUUIDPipe`). |
| `DELETE` | `/delete` | Soft-delete a company by `compId` (required query param, validated by `ParseUUIDPipe`). |

### Create / update semantics

- **Omit `compId` → create; include `compId` → update** the existing (non-deleted) company.
  The success message reflects which path ran (`Company created/updated successfully`).
- Update first loads the active row (`compIsDeleted = false`) and throws **not found** if missing.
- `compName` is trimmed/validated as required text; `compStateCode` is uppercased and must be
  **exactly 2 characters** (`normalizeLengthCode`), else a bad-request validation error.
- Only fields **present** in the payload are written — optional columns are copied via
  `applyPresentFields` against a fixed `COMPANY_MASTER_OPTIONAL_FIELDS` list; absent fields are
  left untouched on update.
- Create stamps `compCreatedOn` / `compCreatedBy`; update stamps `compModifiedOn` /
  `compModifiedBy`. Each runs inside a `$transaction` alongside its audit write.
- The create/update response embeds `compStylesheetName` / `compBankName` as `null`; those
  display names are only resolved by `GET /get` (see below).

### Get semantics

- `GET /get` returns the active record plus two joined display names:
  `compStylesheetName` (from the `stylesheet` relation's `thmName`) and `compBankName`
  (from `acc_ledger_master.ledName`, looked up only when `compBankId` is set).

## Business rules

- **Name uniqueness** — `compName` must be unique across companies, case-insensitive
  (`ensureNameIsUnique`); conflict on `compName`.
- **Code uniqueness** — `compCode`, when supplied, must be unique, case-insensitive
  (`ensureCodeIsUnique`); conflict on `compCode`.
- **GSTIN uniqueness** — `compGstinNo`, when supplied, must be unique, case-insensitive
  (`ensureGstinIsUnique`); conflict on `compGstinNo`.
- **Single default company** — setting `compDefault = true` first clears the flag on all other
  active companies (`clearDefaultCompany`) so only one default remains.
- **Soft delete only** — `DELETE /delete` never hard-deletes; it flags `compIsDeleted = true`,
  `compIsActive = false` and `compDefault = false`, then stamps `compModifiedOn` /
  `compModifiedBy`. All reads filter on `compIsDeleted = false`.
- **Delete guards (notes 72 B2)** — 409 for the default company, and while live branches, live
  ledgers or vouchers use it. `POST /restore?compId=` brings a deleted company back active and
  not default (409 when it is not deleted).
- **First fiscal year (notes 72 A1)** — create inserts the company's `fiscal_years` row in the same
  transaction, OPEN and current, always 1 April – 31 March (the derivation of
  `prisma/seed/Fiscal_Year_Seed.sql`): the year beginning on `compFinYearFrom` (must be a 1 April),
  else ending on `compFinYearTo` (must be the following 31 March), else containing
  `compBooksBeginFrom`, else today; books from `compBooksBeginFrom` (inside the year) or 1 April. On update those three
  are ignored; GET reports the current year's begin / end / books-begin dates (C2).
- **Books Lock Date (plan 18/11 Q1)** — `compBooksLockDate` is the company's own
  `comp_books_lock_date`, saved and returned as sent (null clears it). Nothing enforces it yet
  (the next job); it is not the year's `fy_lock_date`.
- **GST (notes 72 C3 / C7)** — `compGstRegType` is REGULAR / COMPOSITION / UNREGISTERED / SEZ
  (`ck_comp_gst_reg_type`). The GSTIN's state digits must equal `compStateCode` and its PAN
  `compPanNo`; a blank PAN is filled from it.
- **Also (notes 72)** — `compAatoClass`, `compDcPurposes`, `compTdsApplicable` (boolean since C1);
  `compAuthorizeSignature` is a PNG / JPEG / GIF / WebP of at most 512 KB, stored and returned as
  a data URL (C5).
- **Company + Branch rework (plan 18/11, `admin/plan-company-branch-master-2026-11-18.md`)**
  - *C1 code* — a create without `compCode` gets one from `compName` (`companyCodeBase`): the
    initials of its words (PRIVATE, PVT, LIMITED, LTD, THE, AND, & skipped; A–Z 0–9 only), at
    most 6, padded to 3 from the first word; `2`, `3`, … added while any company (deleted ones
    too) holds it in any case ("MT Demo Traders" → MDT, MDT2). Creates queue on an advisory lock
    so two never pick the same code. A typed code is kept as typed; update never generates one.
  - *C5* — `compCurrencySymbol` blank or absent on create → `Rs.`.
  - *C8 / I1* — a REGULAR / COMPOSITION / SEZ company needs `compLegalName`
    (`COMPANY_LEGAL_NAME_REQUIRED`) and `compAddr1`, `compCity`, `compStateCode`, `compPin`
    (one `COMPANY_ADDRESS_REQUIRED` per missing key, `field` = the key; district optional), judged
    on what the row holds after the save. A sent `compPin` must be 100000–999999
    (`COMPANY_PIN_INVALID`). All come back in one 400.
  - *New fields* — `compUdyamNo` (upper-cased, `UDYAM-XX-00-0000000`, `COMPANY_UDYAM_INVALID`),
    `compLogo` (the signature's image rules, `COMPANY_LOGO_NOT_BASE64 / _TOO_LARGE / _NOT_IMAGE`),
    `compSignatoryName` (text, 100). The print block `company.profile` has `udyam_no`, `logo`,
    `signatory_name`.
  - *C9a* — the seeded Main Branch gets `brCode` = company code + `01` (`02`, `03` … when taken);
    returned as `compMainBranch.brCode`. *C9b* — while the company has exactly one live branch,
    a company update copies onto it only what that save changed, by group (user 19/11): tax
    (GSTIN, reg type, PAN, state) + the whole address; the address alone; telephone, phone, mail
    each alone. Same transaction, audited as a Branch Master update; nothing to copy, no write.
- A residual unique-constraint DB error (a race) is mapped by `handleWriteError` /
  `uniqueRaceDetail` by what the index covers (review N2, 19/11): `comp_code` →
  `COMPANY_CODE_DUPLICATE` on `compCode`, `comp_gstin_no` → `COMPANY_GSTIN_DUPLICATE` on
  `compGstinNo`, the seeded Main Branch's `br_code` → `COMPANY_DUPLICATE` on `compCode`, anything
  else (the name) → `COMPANY_DUPLICATE` on `compName`.

## Audit logging

Every mutation is recorded via `AuditLogService.logEntityChange` inside the same transaction,
with `screenName: 'Company Master'`, `screenType: 'master'` and `tableName: 'companys'`:

- Create → action `New` (`originalRecord: null`, modified payload).
- Update → action `update` (original vs. modified payload).
- Soft delete → action `cancel` (original vs. modified payload).

The acting user comes from `RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

## Errors

`CompanyMasterExceptionFilter` extends the shared `SettingsExceptionFilter`, initialized with the
`/\b(comp[A-Za-z0-9]+)\b/` field-name pattern so DB errors surface against `comp*` fields.
Domain helpers throw the module error shape: `throwSettingsConflict` (duplicate name / code /
GSTIN), `throwSettingsBadRequest` (validation), and `throwSettingsNotFound` (missing/inactive
`compId`).
