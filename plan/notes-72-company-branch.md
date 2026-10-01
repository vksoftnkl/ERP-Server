# Notes 72 — Company + Branch masters: what the server side did (2026-10-01)

Answer to notes 72. Migration `20261001120000_company_branch_notes_72` (applied to 192.168.0.106),
the services under `src/modules/settings/{companyMaster,branchMaster,gstinLookup,shared}`, and two
specs: `test/company-branch-notes-72.e2e-spec.ts` (11 cases, one rolled-back transaction) and
`test/company-branch-notes-72-http.e2e-spec.ts` (4 read-only HTTP cases). Not committed yet.

## For the client

| Route / key | Change |
|---|---|
| `POST /company-masters/create` (new company) | Also writes the company's first **`fiscal_years`** row (A1): `compFinYearFrom` / `compFinYearTo` / `compBooksBeginFrom`, defaulting to the Indian year containing today. 400 on `compFinYearTo` when it is not after From or the year is longer than one year; 400 on `compBooksBeginFrom` when outside the year. |
| `compAatoClass` (A2) | **In.** `LE_1_5CR / LE_5CR / LE_10CR / GT_10CR`, not nullable. Add the Tax-tab combo. |
| `compDcPurposes` (A3) | **In.** Array, at least one of `SUPPLY JOB_WORK APPROVAL EXHIBITION OWN_USE LINE_SALES OTHER` (the `sdc_purpose` CHECK). Upper-cased. |
| `compTdsApplicable` (C1) | **New boolean** (column converted). Split the "TCS/TDS" box. |
| `compFinYearFrom/To`, `compBooksBeginFrom`, `compBooksLockDate` (C2) | Create-only seed; **ignored on update**; the lock date is ignored always. GET returns the **current fiscal year's** begin / end / books-begin / `fy_lock_date`. |
| `compGstRegType`, `brGstRegType` (C3) | `REGULAR / COMPOSITION / UNREGISTERED / SEZ` (upper-cased; anything else 400; CHECK on both tables; existing rows normalised). Cut Consumer / Overseas from the combo. |
| GSTIN (C7) | 400 when chars 1-2 ≠ `*StateCode` (field `*GstinNo`) or chars 3-12 ≠ a given `*PanNo` (field `*PanNo`). A blank PAN is filled from the GSTIN. An update that omits GSTIN / PAN is checked against the stored ones. |
| `compAuthorizeSignature` (C5) | A data URL or bare base64 of a PNG / JPEG / GIF / WebP, at most 512 KB (kind read from the bytes). Stored and **returned as a data URL** (`data:image/png;base64,…`), usable directly as an image source. `null` / `""` clears. |
| `GET /gst/search?gstin=` (C6) | **New.** `{ gstin, legalName, tradeName, status, registrationType, gstRegType, stateCode, panNo, registeredOn, address{building,street,locality,city,district,state,pin}, raw }`. 400 bad GSTIN, 404 no details, 502 provider failure, 503 not configured. |
| `DELETE /company-masters/delete` (B2) | 409 for the **default** company, and while **live branches, live ledgers or vouchers** use it. |
| `POST /company-masters/restore?compId=` (B1) | **New.** Back active, not default. 409 when not deleted. |
| `DELETE /branch-masters/delete` (B3) | 409 while the branch has **any document or stock row** (quotation, order, DC, DC return, bill, return, voucher, opening balance, stock voucher / ledger / balance / transit) or **live users or devices**; and for the **default** branch while the company has other live branches. |
| `POST /branch-masters/restore?brId=` (B1) | **New.** 409 when not deleted, when its company is deleted ("restore the company first"), or when a live branch of the company took its name. |
| `brCompId` on branch update (B4) | 400 for the default branch and for a branch with any of the B3 references. An unused, non-default branch may still move. |
| C4 columns | Swagger now says **informational**: `br_rounding_mode/value`, `br_bill_prefix`, `br_invoice_series_prefix`, `br_pos_type`, `br_terms`, `br_bill_greeting`, `comp_prefix_code`, `comp_price_fixing`, `comp_bill_greeting` are stored and drive nothing (nothing reads them, print-render included). |

## Decisions taken here (say if you want otherwise)

- **B3, the company's only branch may be deleted** (once unused), even if it is the default.
  Refusing it as well would make every company undeletable, since B2 needs no live branches.
- **B3, users and devices block** a branch delete: they sign in to it.
- **B3, documents count whatever their status** — a cancelled bill is still the branch's.
- **C6, provider choice:** env `GST_LOOKUP_PROVIDER_CODE`; else the company's GSP Company Service
  mapping; else the only active provider. Source GSTIN: the request company's GSTIN, else env
  `GST_LOOKUP_SOURCE_GSTIN`. Endpoint: env `GST_LOOKUP_ENDPOINT`, else the provider's base URL +
  `/commonapi/v1.1/search`. On dev two providers are active and only Acme is mapped (to SAND
  BOX, whose stored password equals its user name), so **set `GST_LOOKUP_PROVIDER_CODE`** before
  using it. Not yet called against the real provider from here.

## Data

- **A1 backfill:** every live company without a fiscal year got the current Indian year (dev:
  LEAPSWITCH NETWORKS → 2026-2027, OPEN, current).
- **C3:** dev companies → REGULAR (ZT-CO-AUDIT → UNREGISTERED); two branches normalised.
- **Acme Foods fails C7:** GSTIN `33ABNPL5414F1ZU` carries PAN `ABNPL5414F`, but `comp_pan_no` is
  `ABCDE1234F`, so the next full save of Acme is a 400 on `compPanNo` until the PAN is fixed.
- **bana** (deleted) still has a live branch `test3` from before B2; restore the company or
  delete the branch.

## Not done

- **A4** (`company_aato` routes) — low priority, as the notes say.
- **`/fiscal-years/get|save|close`** — the "later" family for a year screen.
