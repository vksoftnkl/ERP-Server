# Mobile · Customers

Customer master for the React Native (Expo) app: the "Customer list and entry" screens
(mockup: `Shared/Prathap/mobile/customer_list_entry_mobile_ui_mockup.png`).

- **Base route:** `mobile/customers` (API-versioned, so `/api/v1/mobile/customers/...`)
- **Swagger tag:** `Mobile · Customers`. Own docs page `/api/docs/mobile-customers` (JSON at
  `/api/docs/mobile-customers-json`, entry in [`swaggerDocs.ts`](../../utils/swaggerDocs.ts)), and
  in the combined `/api/docs`
- **Auth:** **optional** (`@OptionalAuth`, user's call 2026-11-16). No token needed. A token that
  is sent is still checked (a malformed, expired or revoked one = 401) and read. Without one there
  is no user and no company: balances are `null`, delete / delete-check answer 403, and saves are
  stamped with the default actor (`00000000-0000-0000-0000-000000000000`). Anyone who can reach
  the server can read and edit customers here.
- **No new tables.** Reads `sales.customers` and the accounts books; writes go through the
  desktop [`CustomerService`](../../modules/sales/customer/customer.service.ts), which
  `CustomerModule` exports for this.

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/list` | Paged list with search, filter chips, chip counts, balances and outstanding |
| `GET` | `/options` | Pickers for the form: areas, groups, price levels, states, GST types |
| `GET` | `/get?cusId=` | The desktop `/customers/get` payload plus `balance` / `balanceStatus` and the outstanding |
| `POST` | `/create` | Create (desktop payload **without** `cusId`) |
| `PUT` | `/update` | Update (desktop payload, `cusId` **required**, no `cusLinkLedId`) |
| `GET` | `/delete-check?cusId=` | Would the delete go through? (party rules D1-4) |
| `DELETE` | `/delete?cusId=` | Soft delete (menu-10 delete right) |

### `GET /list`

Query: `search` (≤100), `filter` = `ALL` \| `OUTSTANDING` \| `UNREGISTERED` \| `INACTIVE`,
`page` (from 1), `pageSize` (1-200, default 50).

- **Search** matches name, short name, code, city, GSTIN and the phone / WhatsApp / landline
  numbers, any case. A term made only of digits, spaces and `+ - ( )` (3+ digits) also matches the
  phone columns with their punctuation stripped, so `98431 23456` finds `9843123456`.
- **Sort:** `lower(cus_name)` in the database collation, then `cus_id`.
- **Chips:** `OUTSTANDING` = balance > 0 (DR). `UNREGISTERED` = `cus_gst_type` is `UNREGISTERED`
  or blank. `INACTIVE` = `cus_is_active = false`. `ALL` = every live (not deleted) customer,
  inactive ones included.
- `data.counts` = the chip counts **with the search applied and the filter not**.
  `data.total` = rows matching both. `hasMore` = another page exists.
- **Balance** = the ledger's closing **today** in the **login company**, all branches: this year's
  opening set plus the counted legs (POSTED / CANCELLED) up to `CURRENT_DATE`. It uses the same
  fragments as the Ledger Statement and the Party Outstanding card
  ([`voucher-books.sql.ts`](../../modules/reports/common/voucher-books.sql.ts)). Money is text with
  two decimals, as `{ amount, side }`. `balanceStatus`: `OUTSTANDING`, `OVER_LIMIT`
  (DR above `cusCreditAmtLimit` when that is > 0), `ADVANCE` (CR) or `SETTLED` (0).
- **Outstanding** (since 2026-11-20) = what the customer's **unpaid bills** still owe today:
  the Party Outstanding report's `owed` on the Receivable side, login company, all branches, read
  through the report's own CTEs (`partiesWith` in
  [`party-outstanding.sql.ts`](../../modules/reports/party-outstanding/party-outstanding.sql.ts))
  with its party card's scope (no group / area / salesman filter, PDC in hand not deducted).
  `outstanding` (two decimals, never negative), `outstandingBills` (unpaid DR bills) and
  `oldestBillDate` (bill date of the oldest one, null when none). The e2e suite checks every row
  against `/reports/party-outstanding/parties`.
- **Balance vs outstanding.** The balance is the whole ledger: it nets bills with everything else
  posted to the customer. The outstanding is bill-wise: a credit the customer holds (an advance,
  a sales return, a receipt left on account) lowers the balance but not the outstanding, and a
  post-dated cheque counts in neither until its date. 12,000 of bills open plus a 2,000 advance
  = outstanding 12,000.00, balance 10,000.00 DR.
- `balance` / `balanceStatus` / `outstanding*` are `null` (and `balanceAsOn` / `accYear` /
  `companyId` too) when the login has no company or no financial year holds today. The row shows
  no figure rather than a wrong 0. `companyId` names the company the figures are read in.
- Like the desktop customer grid, the list is **not** company-filtered: customers are shared.

### `GET /options`

Live, active rows only: `areas` {id, name, cityId, cityName}, `groups` {id, name}, `priceLevels`
{id, name}, `states` {code, name}, `gstTypes`. `cityId` (since 2026-11-19) is
`area_master.arm_city_id` (NOT NULL): the phone's offer engine reaches a customer's city through
the beat (`cus_area_id`), as the desktop promotion rules do, to match `CITY` scheme rows.

### Writes

`create` / `update` call `CustomerService.save()`, so everything in the
[desktop README](../../modules/sales/customer/README.md) holds: the linked ledger (same id), the
party GST rules, the state-code check, the audit row, the `CUSTOMER_*` error codes. The
`CustomerExceptionFilter` shapes the errors.

- `create` with a `cusId` → 400 `VALIDATION_WHITELIST`, so a create never turns into an update.
- `update` needs the full form (the desktop's required fields: name, state, area, group,
  price level), not a patch.
- After a save that touched the supplier of the same ledger (`partySync.otherRoleUpdated`), the
  controller announces `suppliers` on the data-change feed, as the desktop controller does.

### Caching and refresh

- No `@CacheTTL`: the list carries the login company's balances, and the HTTP cache key holds
  neither the user nor the company.
- The write interceptor ([`http-cache-invalidation.interceptor.ts`](../../common/interceptors/http-cache-invalidation.interceptor.ts))
  skips a leading `mobile` path segment. A phone save is announced as `customers`, so open desktop
  customer lists re-read.

### Rights

list / get / options / create / update check no menu right and need no token. Delete and
delete-check need the menu-10 `delete` right (`CustomerService`), so they need a token whose user
holds it: no token = 403.

## Not here

- **Opening balance** (the mockup's "Opening balance · Dr/Cr · As on" card) is not part of the
  customer save. It lives in `accounts.acc_opening_balance`, written by the Opening Balance
  module (`/opening-balance/*`).

## Tests

- Unit: `mobile-customer.service.spec.ts`, `mobile-customer.controller.spec.ts`,
  `dto/mobile-customer.dto.spec.ts`.
- HTTP, live dev DB: `test/mobile-customers-http.e2e-spec.ts`
  (`npx jest --config ./test/jest-e2e.json --runInBand test/mobile-customers-http.e2e-spec.ts`).
  It creates one `ZT-MOBILE-CUS <ts>` customer and soft-deletes it through the route. It also
  checks the first five OUTSTANDING balances against an independent closing query.
