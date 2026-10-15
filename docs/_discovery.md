# Phase 0: discovery inventory

What exists today across the VK Nex ERP repos, and where the code differs from what the
documentation plan assumed. This file is input for later phases. It is not reader-facing
documentation and can be deleted once those phases have landed.

Last verified against commit `4f1ea5db` (ERP-Server, branch `DEV-v1`) on 2026-10-15.
Other repos are pinned in [section 1](#1-repositories-found).

Counts and behaviour describe that commit. During discovery the working tree also held other
people's uncommitted changes (cache invalidation, an SSE data-change feed, the timeout
interceptor and `@CacheTTL` values). Where that work changes a fact, the text says **in flight**.

Ground rules applied: facts come from code, config, scripts and migrations, with file paths.
No secret values, production hostnames or IPs are reproduced here. Anything unconfirmed is
marked `TODO(verify)`.

---

## 0. The brief versus the code

These assumptions in the documentation plan do not match the code. Later phases should
follow the code.

| Brief assumes | Code shows | Effect on the plan |
|---|---|---|
| Backend folders are `core/`, `common/`, `modules/`, `shared-services/` | Top level of `src/` is `common/`, `config/`, `database/`, `modules/`, `utils/`. There is no `core/` and no `shared-services/`. Shared posting services live in `src/common/posting/`, `src/modules/sales/posting/` and `src/modules/stocks/posting/` | `backend-structure.md` describes the real folders |
| Redis is required at boot | Cache and sessions are optional: `REDIS_ENABLED` defaults to `false` and the cache falls back to a no-op store (`src/common/redis/redis.module.ts:26-43,103-118`). BullMQ connects to Redis regardless (`src/common/queue/queue.module.ts:12-29`) | Local setup marks Redis as recommended, not required, and explains the BullMQ quirk |
| BullMQ queues do work | Two queues (`audit-log-archival`, `stock-reconciliation`) and their processors exist, but no code adds jobs (`src/common/queue/queue.service.ts:17-32` has no callers) | `background-jobs.md` is short and states this |
| Tally XML sync, e-invoice, e-way bill and biometric (eSSL) integrations exist | None of them is implemented. Tally exists only as identity columns. E-invoice and e-way bill exist only as an action vocabulary, and `GstGatewayService.configured = false` (`src/modules/sales/posting/gst-gateway.service.ts:26`). Biometric exists only as employee fields | `integrations.md` documents what exists (GST config/verify, GSTIN search, print rendering) and lists the rest as not implemented |
| Purchase, HR and attendance domain modules exist | Purchase has supplier masters only. HR has employee, department and designation masters only. There is no attendance module | Phase 5 module order shrinks |
| Tenant, company and branch headers | No `x-company-id`, `x-branch-id` or `x-acc-year` headers. Company, branch and accounting year arrive in the request DTO. The token also carries `company_id`, `branch_id` and `device_id` claims | `multi-tenancy.md` describes DTO scoping |
| Audit/change-log triggers | `audit.audit_log` is written by the app (`src/modules/audit-log/audit-log.service.ts`), not a trigger. README rule: no new SQL functions or triggers (`README.md`, "Where logic lives") | Database overview states the rule |
| Swagger only at `/api/docs` | One combined doc at `/{API_PREFIX}/docs`, plus about 100 per-module docs at `/{API_PREFIX}/docs/<path>` (`src/main.ts:195-263`, `src/utils/swaggerDocs.ts`). Mounted in every environment, including production | Phase 2 documents both and asks whether production should hide them |
| Swagger needs decorators everywhere | Every controller has `@ApiTags`. All except auth, health and the three public controllers have `@ApiBearerAuth`. 576 of 578 routes have `@ApiOperation` | Phase 2 work is mainly DTO examples, the error schema and the OpenAPI export script |
| `prisma-dbml-generator` gives a usable ERD | `dbml/awesome.dbml` uses Prisma camelCase field names, Prisma types and a placeholder project name. It cannot show partitions, partial indexes or triggers | Phase 3 hand-writes the Mermaid ERDs from DB names, with DBML as a secondary reference |
| Web client: Tailwind v4 lives in devDependencies | `tailwindcss` and `@tailwindcss/postcss` are in `dependencies` on purpose. The node deploy runs `npm ci --omit=dev` (`ERP client/scripts/deploy-on-node.sh`) | The warning moves to the backend: `@nestjs/cli` and `typescript` are devDependencies, and `deploy/deploy.sh:35-36` unsets `NODE_ENV` for that reason |
| Mobile app uses EAS build/submit | No `eas.json` or `app.config.*`. The folder is not a git repo. Release builds are signed with the debug keystore | `release.md` cannot be verified. See the open questions |
| An analytics sidecar (FastAPI + asyncpg) exists | Not found on this machine. Zero references in the backend | Skipped |

---

## 1. Repositories found

| Repo (plan name) | Local path | Remote | State at discovery | Stack |
|---|---|---|---|---|
| `ERP-Server` | `/home/vk/Dev/erp/ERP server` | `vksoftnkl/ERP-Server` | `DEV-v1` @ `4f1ea5db`. Other sessions have uncommitted work in the tree | NestJS 11, Prisma 6.19.2, PostgreSQL 18, optional Redis |
| `erp-client` (web) | `/home/vk/Dev/erp/ERP client` | `vksoftnkl/ERP-frontend` | `dev` @ `f4b3ee2`, with uncommitted changes (SSE change feed) | Next.js 16.1.6 (`latest`), React 19, RTK + RTK Query, redux-saga, Tailwind v4 + SCSS modules |
| Qt desktop | `/home/vk/VKNexERP/NexERP` | `vksoftnkl/NexERP` | `main` @ `c77f3f1`, clean | Qt 6 (declares 6.5, developed on 6.10.2), C++17, CMake 3.19 |
| Mobile | `/home/vk/ERP client mobile` | none (not a git repo) | n/a | Expo SDK 54, React Native 0.81.4, RTK + saga, NativeWind 4 |
| Analytics sidecar | not found | n/a | n/a | n/a |

Other repos seen and judged out of scope:

- `/home/vk/Dev/vkmobileapp-dev` is a separate Express 5 + Prisma recharge/billing ledger
  backend (`vksoftnkl/vkmobileapp-dev`, last commit 2026-03-05). The Expo app does not call it.
- `/home/vk/mobile vk/ContactBook` is an unrelated Expo demo app.

---

## 2. Backend (ERP-Server)

### 2.1 Stack and scripts

| Item | Value | Source |
|---|---|---|
| Node | `>=20` | `package.json` `engines` |
| NestJS | `@nestjs/core ^11.2.1`, `@nestjs/swagger ^11.4.7`, `@nestjs/throttler ^6.5.0` | `package.json` |
| Prisma | `@prisma/client 6.19.2`, `prisma ^6.19.2`, plus `prisma-dbml-generator ^0.12.0` and `prisma-docs-generator ^0.8.0` | `package.json` |
| Queues and cache | `@nestjs/bullmq ^11.0.4`, `bullmq ^5.76.8`, `@nestjs/cache-manager ^3.1.0`, `cache-manager ^7.2.8` | `package.json` |
| PDF | `pdfkit ^0.20.1` (no puppeteer or pdfmake) | `package.json` |
| Not used | `@nestjs/schedule`, `@nestjs/event-emitter`, `ioredis` | `package.json` |
| PostgreSQL | **18 required.** 163 columns default to native `uuidv7()`, and no migration defines it | `deploy/README.md:93-94`, `prisma/**` |

npm scripts by purpose (full list in `package.json`):

| Purpose | Scripts |
|---|---|
| Run | `start`, `start:dev` (watch), `start:debug`, `start:prod` (`node dist/src/main`) |
| Build | `build` (`nest build`), `typecheck`, `lint`, `format` |
| Prisma | `prisma:schema:build`, `prisma:generate`, `prisma:migrate:dev`, `prisma:migrate:deploy`, `prisma:migrate:reset`, `prisma:studio`, `prisma:docs`, `prisma:repair:ui-table-drift`, `prisma:migrate:sync-checksums`, `migration:run`. `postinstall` builds the schema and generates the client |
| Seeds | `seed:run`, `seed:run:dist`, `db:deploy`, `db:deploy:dist`, `seed:export:ui-config`, `seed:export:masters`, `seed:item-groups`, `seed:supermarket-items`, `rights:grant` |
| Test | `test` (unit, `src/**/*.spec.ts`), `test:e2e` (`test/**/*.e2e-spec.ts`), `test:cov`, `test:watch` |
| Perf | `perf:load`, `perf:smoke`, `perf:baseline`, `perf:stress`, `perf:custom` |
| Packaging | `release`, `release:linux`, `release:win` (`pkg` single binaries) |
| TLS (local) | `cert:local` (mkcert-based, `scripts/generate-local-cert.js`) |

### 2.2 Folder structure

| Path | What lives there |
|---|---|
| `src/main.ts`, `src/env.preload.ts` | Bootstrap. `.env` is loaded by `env.preload.ts` before any other import |
| `src/app.module.ts` | Root module: global guards, filter, interceptors, middleware |
| `src/config/` | `configuration.ts` (typed config tree) and `env.validation.ts` (Joi schema) |
| `src/common/` | Cross-cutting code: `configured-grid-sql`, `constants`, `data-changes` (SSE), `decorators`, `dto`, `error-wording`, `filters`, `interceptors`, `logging`, `middleware`, `posting` (voucher posting, doc register, rights), `queue`, `redis`, `request-context` (ALS), `search`, `Sequence` (voucher numbering), `txn-status-log`, `types`, `utils`, `validation` |
| `src/database/` | `prisma/` (PrismaService), `pg/` (raw `pg` pools, including a read-only pool for configured SQL), `seed/` (seed runner, startup seeding, migrate-deploy) |
| `src/modules/` | Domain modules (section 2.3) |
| `src/utils/` | Swagger per-module doc list (`swaggerDocs.ts`) |
| `prisma/` | Schema fragments by area, `base.prisma`, generated `schema.prisma`, `migrations/` (437), `seed/` (SQL seeds + manifest), `staging/` |
| `scripts/` | Schema build, seed export/repair, checksum sync, backfills, cert, perf |
| `deploy/` | VPS deploy: `deploy.sh`, `ecosystem.vps.config.js`, `nginx/`, `systemd/`, `verify-db.sh`, `grant-app-privileges.sql`, `README.md` |
| `test/` | 100 e2e specs (`test/`, `test/sales/`, `test/helpers/`) |
| `docs/`, `plan/` | Existing design notes (section 2.12) |
| `dist/` | Build output, **tracked in git** (3,593 files) |
| `dbml/` | Generated `awesome.dbml` |
| `release/` | `pkg` binaries (gitignored) and a `.desktop` file |

### 2.3 Modules and controllers

- 118 files declare `@Module` and 119 classes declare `@Controller`.
- Not every file follows the `*.controller.ts` / `*.module.ts` naming:
  `gst/controllers/gst-provider-parts.controllers.ts` holds four controllers, and
  `stocks/itemstockbalance/` and `stocks/itembatchstock/` use camelCase file names.
- 118 controllers are wired, serving 577 routes under `/{API_PREFIX}/v{API_VERSION}/` (default `/api/v1/`).
- Modules with no controller: `common/posting`, `common/queue`, `common/redis`,
  `common/request-context`, `database/pg`, `database/prisma`, `accountsModule/billBalance`, `gst`
  (its controllers live in `gst/controllers/`), `sales/posting`, `stocks/stock-track-policy`,
  `stocks/stock-voucher`.

Oddities:

- `src/modules/item-price-details/` is a controller and service that no module imports. It
  would collide with the live `Inventory/item-price-details` prefix if it were wired.
- `src/modules/cloud-sync/` is gitignored and its module import is commented out
  (`src/app.module.ts:21,167`). It is absent from the table.
- Three controllers are class-level `@Public()`: users, device list and user administration
  (see [section 7](#7-risks-found-during-discovery)).
- 2 routes have no `@ApiOperation`: one in `sales/dc-return`, one in `sales/sale-return`.
- **In flight:** `src/common/data-changes/data-changes.controller.ts` (SSE `GET /data-changes/stream`)
  is untracked, so it is not in the table.

| Area | Controller file (under `src/`) | Route prefix(es) | Routes |
|---|---|---|---|
| Platform (common) | `common/configured-grid-sql/configured-grid-sql.controller.ts` | `configured-grid-sql` | 2 |
| Platform (common) | `common/Sequence/sequence.controller.ts` | `sequences` | 4 |
| Platform | `modules/audit-log/audit-log.controller.ts` | `audit-logs`, `audit-log` | 1 |
| Platform | `modules/error-messages/error-messages.controller.ts` | `error-messages` | 1 |
| Platform | `modules/health/health.controller.ts` | `health` | 1 |
| Platform | `modules/txn-status/txn-status.controller.ts` | `txn-status` | 1 |
| Auth & users | `modules/auth/auth.controller.ts` | `auth` | 2 |
| Auth & users | `modules/users/users.controller.ts` | `users` | 5 |
| Settings & admin | `modules/settings/appSettings/app-setting-value.controller.ts` | `app-setting-values` | 3 |
| Settings & admin | `modules/settings/appTheme/app-theme.controller.ts` | `app-themes` | 8 |
| Settings & admin | `modules/settings/branchMaster/branch-master.controller.ts` | `branch-masters` | 4 |
| Settings & admin | `modules/settings/companyMaster/company-master.controller.ts` | `company-masters` | 4 |
| Settings & admin | `modules/settings/employeeDepartmentMaster/employee-department-master.controller.ts` | `employee-department-masters` | 3 |
| Settings & admin | `modules/settings/employeeDesignationMaster/employee-designation-master.controller.ts` | `employee-designation-masters` | 3 |
| Settings & admin | `modules/settings/employeeMaster/employee-master.controller.ts` | `employee-masters` | 4 |
| Settings & admin | `modules/settings/gstinLookup/gstin-lookup.controller.ts` | `gst` | 1 |
| Settings & admin | `modules/settings/print-render/print-render.controller.ts` | `print-render` | 4 |
| Settings & admin | `modules/settings/print-template-assignment/print-template-assignment.controller.ts` | `print-template-assignments` | 5 |
| Settings & admin | `modules/settings/print-template/print-template.controller.ts` | `print-templates` | 4 |
| Settings & admin | `modules/settings/userAdministration/user-administration.controller.ts` | `user-administration` | 3 |
| Fixed / system tables | `modules/fixed/bank-list/bank-list.controller.ts` | `bank-lists` | 4 |
| Fixed / system tables | `modules/fixed/device-list-master/device-list-master.controller.ts` | `device-list-masters` | 4 |
| Fixed / system tables | `modules/fixed/hsn-code-master/hsn-code-master.controller.ts` | `hsn-code-masters` | 1 |
| Fixed / system tables | `modules/fixed/menu-master/menu-master.controller.ts` | `menu-masters` | 3 |
| Fixed / system tables | `modules/fixed/price-level-master/price-level-master.controller.ts` | `price-level-masters` | 2 |
| Fixed / system tables | `modules/fixed/state-code-master/state-code-master.controller.ts` | `state-code-masters` | 4 |
| Fixed / system tables | `modules/fixed/stock-adj-reasons/stock-adj-reasons.controller.ts` | `stock-adj-reasons` | 1 |
| Fixed / system tables | `modules/fixed/ui-table-master/ui-table-master.controller.ts` | `ui-table-masters` | 6 |
| Fixed / system tables | `modules/fixed/user-login-sessions/user-login-sessions.controller.ts` | `user-login-sessions` | 4 |
| UI metadata | `modules/dropdown-details/dropdown-details.controller.ts` | `dropdown-details` | 8 |
| UI metadata | `modules/grid-details/grid-details.controller.ts` | `grid-details` | 7 |
| Lookups | `modules/master-lookup/master-lookup.controller.ts` | `master-lookups` | 13 |
| Inventory masters | `modules/Inventory/godowns-master/godowns-master.controller.ts` | `godowns` | 5 |
| Inventory masters | `modules/Inventory/item-price-details/item-price-details.controller.ts` | `item-price-details` | 2 |
| Inventory masters | `modules/Inventory/item-unit-conversion/item-unit-conversion.controller.ts` | `item-unit-conversions` | 3 |
| Inventory masters | `modules/Inventory/items-brand-master/items-brand-master.controller.ts` | `item-brands` | 4 |
| Inventory masters | `modules/Inventory/items-category-master/items-category-master.controller.ts` | `item-categories` | 4 |
| Inventory masters | `modules/Inventory/items-ean-code-master/items-ean-code-master.controller.ts` | `item-ean-codes` | 3 |
| Inventory masters | `modules/Inventory/items-group-master/items-group-master.controller.ts` | `item-groups` | 4 |
| Inventory masters | `modules/Inventory/items-gst-units-master/items-gst-units-master.controller.ts` | `item-gst-units` | 1 |
| Inventory masters | `modules/Inventory/items-master/items-master.controller.ts` | `items` | 5 |
| Inventory masters | `modules/Inventory/items-price-master/items-price-master.controller.ts` | `item-prices` | 3 |
| Inventory masters | `modules/Inventory/items-qty-price-master/items-qty-price-master.controller.ts` | `item-qty-prices` | 4 |
| Inventory masters | `modules/Inventory/items-reorder-master/items-reorder-master.controller.ts` | `item-reorders` | 3 |
| Inventory masters | `modules/Inventory/items-section-master/items-section-master.controller.ts` | `item-sections` | 4 |
| Inventory masters | `modules/Inventory/items-tax-history-master/items-tax-history-master.controller.ts` | `item-tax-histories` | 3 |
| Inventory masters | `modules/Inventory/tax-rate-master/tax-rate-master.controller.ts` | `tax-rates` | 5 |
| Inventory masters | `modules/Inventory/units-master/units-master.controller.ts` | `units` | 4 |
| Inventory masters | `modules/item-price-details/item-price-details.controller.ts` (not wired) | `item-price-details` | 1 |
| Inventory masters | `modules/items-cust-rates-master/items-cust-rates-master.controller.ts` | `item-cust-rates` | 4 |
| Other masters | `modules/master/batch-prefix/batch-prefix.controller.ts` | `batch-prefixes` | 4 |
| Other masters | `modules/master/charge-detail/charge-detail.controller.ts` | `charge-details` | 3 |
| Other masters | `modules/master/charge-master/charge-master.controller.ts` | `charges` | 3 |
| Other masters | `modules/master/widget-master/widget-master.controller.ts` | `widget-masters` | 6 |
| Stock | `modules/stocks/itembatchstock/itemBatchStockController.ts` | `item-batch-stock` | 1 |
| Stock | `modules/stocks/itemstockbalance/itemStockBalanceController.ts` | `item-stock-balance` | 3 |
| Stock | `modules/stocks/opening-stock-voucher/opening-stock-voucher.controller.ts` | `stock/opening` | 8 |
| Stock | `modules/stocks/physical-stock-voucher/physical-stock-voucher.controller.ts` | `stock/physical` | 7 |
| Stock | `modules/stocks/posting/stock-admin.controller.ts` | `stock/admin` | 3 |
| Stock | `modules/stocks/selling-price-bulk/selling-price-bulk.controller.ts` | `stock` | 3 |
| Stock | `modules/stocks/stock-adjustment/stock-adjustment.controller.ts` | `stock/adjustment` | 7 |
| Stock | `modules/stocks/stock-adjustment/stock-reasons.controller.ts` | `stock/reasons` | 6 |
| Stock | `modules/stocks/stock-track-presets/stock-track-presets.controller.ts` | `stock-track-presets` | 1 |
| Stock | `modules/stocks/stock-transfer/stock-transfer-receive.controller.ts` | `stock/transfer/receive` | 6 |
| Stock | `modules/stocks/stock-transfer/stock-transfer.controller.ts` | `stock/transfer` | 6 |
| Sales | `modules/sales/area/area.controller.ts` | `areas` | 3 |
| Sales | `modules/sales/bill/bill.controller.ts` | `bills` | 14 |
| Sales | `modules/sales/city/city.controller.ts` | `cities` | 3 |
| Sales | `modules/sales/customer-group/customer-group.controller.ts` | `customer-groups` | 3 |
| Sales | `modules/sales/customer/customer.controller.ts` | `customers` | 3 |
| Sales | `modules/sales/dc-return/dc-return.controller.ts` | `dc-returns` | 7 |
| Sales | `modules/sales/delivery-challan/delivery-challan.controller.ts` | `delivery-challans` | 10 |
| Sales | `modules/sales/loyalty/members/loyalty-members.controller.ts` | `loyalty/members` | 3 |
| Sales | `modules/sales/loyalty/promotion-loyalty-points.controller.ts` | `promotion-loyalty-points` | 5 |
| Sales | `modules/sales/promotion-scheme/promotion-scheme.controller.ts` | `promotion-scheme` | 5 |
| Sales | `modules/sales/quotation/quotation.controller.ts` | `quotations` | 3 |
| Sales | `modules/sales/sale-agent/sale-agent.controller.ts` | `sale-agents` | 3 |
| Sales | `modules/sales/sale-freight-charges/sale-freight-charges.controller.ts` | `sale-freight-charges` | 3 |
| Sales | `modules/sales/sale-loading-charges/sale-loading-charges.controller.ts` | `sale-loading-charges` | 3 |
| Sales | `modules/sales/sale-order/sale-order.controller.ts` | `sale-orders` | 8 |
| Sales | `modules/sales/sale-return/sale-return.controller.ts` | `sale-returns` | 9 |
| Sales | `modules/sales/state/state.controller.ts` | `states` | 3 |
| Sales | `modules/sales/temp-credit/temp-credit.controller.ts` | `temp-credits` | 3 |
| Sales | `modules/sales/txn-hold/txn-hold.controller.ts` | `txn-holds` | 8 |
| Purchase (masters only) | `modules/purchase/supplier-group/supplier-group.controller.ts` | `supplier-groups` | 3 |
| Purchase (masters only) | `modules/purchase/suppliers/suppliers.controller.ts` | `suppliers` | 3 |
| Accounts | `modules/accountsModule/accGroupMaster/acc-group-master.controller.ts` | `account-groups` | 3 |
| Accounts | `modules/accountsModule/accountLedgerMasters/account-ledger-masters.controller.ts` | `account-ledger-masters` | 5 |
| Accounts | `modules/accountsModule/cheques/cheques.controller.ts` | `cheques` | 10 |
| Accounts | `modules/accountsModule/companyGroupMaster/company-group-master.controller.ts` | `company-group-masters` | 3 |
| Accounts | `modules/accountsModule/expense/expense.controller.ts` | `expenses` | 7 |
| Accounts | `modules/accountsModule/issuedCheques/issued-cheques.controller.ts` | `cheque-books` | 3 |
| Accounts | `modules/accountsModule/issuedCheques/issued-cheques.controller.ts` | `issued-cheques` | 7 |
| Accounts | `modules/accountsModule/ledgerBankAccount/ledger-bank-account.controller.ts` | `ledger-bank-accounts` | 3 |
| Accounts | `modules/accountsModule/ledgerMap/ledger-map.controller.ts` | `ledger-map` | 3 |
| Accounts | `modules/accountsModule/ledgerShippingAddress/ledger-shipping-address.controller.ts` | `ledger-shipping-addresses` | 3 |
| Accounts | `modules/accountsModule/openingBalance/opening-balance.controller.ts` | `opening-balances` | 7 |
| Accounts | `modules/accountsModule/payment/payment.controller.ts` | `payments` | 11 |
| Accounts | `modules/accountsModule/receipt/receipt.controller.ts` | `receipts` | 12 |
| Accounts | `modules/accountsModule/tenderDetail/tender-detail.controller.ts` | `tender-details` | 3 |
| Accounts | `modules/accountsModule/tenderMaster/tender-master.controller.ts` | `tender-masters` | 4 |
| Accounts | `modules/accountsModule/tenderSettlement/tender-settlement.controller.ts` | `tender-settlement` | 13 |
| Accounts | `modules/accountsModule/tenderTypeMaster/tender-type-master.controller.ts` | `tender-type-masters` | 3 |
| Accounts | `modules/accountsModule/transaction/transaction.controller.ts` | `transactions` | 1 |
| Accounts | `modules/accountsModule/vouchers/vouchers.controller.ts` | `vouchers` | 15 |
| Till / cash | `modules/till/till-masters.controller.ts` | `till` | 19 |
| Till / cash | `modules/till/till-safe.controller.ts` | `till` | 5 |
| Till / cash | `modules/till/till.controller.ts` | `till` | 30 |
| GST | `modules/gst/controllers/gst-company-credential.controller.ts` | `gst/company-credentials` | 6 |
| GST | `modules/gst/controllers/gst-provider-account.controller.ts` | `gst/provider-accounts` | 3 |
| GST | `modules/gst/controllers/gst-provider-parts.controllers.ts` | `gst/provider-endpoints` | 3 |
| GST | `modules/gst/controllers/gst-provider-parts.controllers.ts` | `gst/provider-error-maps` | 2 |
| GST | `modules/gst/controllers/gst-provider-parts.controllers.ts` | `gst/provider-field-maps` | 2 |
| GST | `modules/gst/controllers/gst-provider-parts.controllers.ts` | `gst/provider-services` | 2 |
| GST | `modules/gst/controllers/gst-provider.controller.ts` | `gst/providers` | 4 |
| Reports | `modules/reports/day-summary/day-summary.controller.ts` | `reports/day-summary` | 7 |
| Reports | `modules/reports/ledger-statement/ledger-statement.controller.ts` | `reports/ledger-statement` | 7 |
| Reports | `modules/reports/loyalty-status/loyalty-status.controller.ts` | `reports/loyalty-status` | 9 |
| Reports | `modules/reports/party-outstanding/party-outstanding.controller.ts` | `reports/party-outstanding` | 9 |

### 2.4 Request lifecycle

In order (`src/main.ts`, `src/app.module.ts:286-319`):

1. **Express layer:** body parsers (`REQUEST_BODY_LIMIT`, default 10 MB), helmet with a custom
   CSP, compression, CORS (`CORS_ORIGINS`; dev origins are added outside production).
2. **Middleware:** `RequestContextMiddleware` opens an AsyncLocalStorage store
   (`src/common/request-context/request-context.service.ts:3-10`). The store holds `ipAddress`,
   `userId`, `userType`, `companyId`, `branchId` and `deviceId`, but no accounting year. Then
   `RequestLoggerMiddleware` runs.
3. **Guards:** `AccessTokenGuard` (global `APP_GUARD`) skips `@Public()` routes, verifies the
   HS256 bearer token, and checks the Redis session `auth:session:<sid>` when Redis is on. Next
   comes `ThrottlerGuard` (on unless `THROTTLE_ENABLED=false`).
4. **Menu rights are not a guard.** Services call `assertMenuRight` / `loadRights`
   (`src/common/posting/rights.ts:67-148`) against `public.user_menus`, in 21 files.
5. **Interceptors:**
   - `HttpCacheInterceptor`: GET only, routes with an explicit `@CacheTTL > 0`.
   - `HttpCacheInvalidationInterceptor`: a successful write purges that resource's cache
     entries plus related ones (`RELATED_RESOURCE_INVALIDATIONS` in
     `src/common/redis/http-cache.constants.ts:12-15`).
   - `TimeoutInterceptor`: fixed 15 s, returns 408.
   - **In flight:** a whole-cache purge with an SSE data-change publish, and an SSE exemption
     from the timeout.
6. **Pipe:** the house `ValidationPipe` (`src/common/validation/house-validation.ts`) with
   whitelist, forbidNonWhitelisted and transform. Errors carry codes `VALIDATION_<CONSTRAINT>`.
7. **Filters:**
   - `AllExceptionsFilter` (global) returns
     `{ success:false, statusCode, message, errors?[], path, timestamp }`.
   - About 40 controllers use their own `ModuleExceptionFilter`, which returns
     `{ success, message, errors[] }` with no `statusCode`, `path` or `timestamp`.
   - `errors[]` items are `{ field, code, message, user?: {title, line, todo} }`.
   - The `user` wording comes from `fixed.error_message` (`src/common/error-wording/`).

Success envelope: `{ success:true, message, data, meta?: {page, limit, total, total_pages} }`
(`src/common/types/module-api.types.ts:25-31`). The pagination DTO is `ModuleListQueryBaseDto`:
`search`, `page` (default 1) and `limit` (1-100, default 20). Many list screens use
`configured-grid-sql/run` instead.

### 2.5 Auth, tenancy, settings

**Auth** (`src/modules/auth`):

- Routes: `POST /auth/login` and `POST /auth/refresh`, both public.
  - **There is no logout route.** `revokeAccessTokenSession` exists but has no caller.
- Tokens: hand-rolled HS256 JWTs (`token.service.ts`).
  - Access TTL comes from `ACCESS_TOKEN_TTL_SECONDS` (default 900). Refresh TTL comes from
    `REFRESH_TOKEN_TTL_SECONDS` (default 604800).
  - Refresh reissues the access token and returns the same refresh token, so tokens are not
    rotated.
  - Claims: `sub`, `user_name`, `sid`, `user_type`, `company_id`, `branch_id`, `device_id`,
    `iat`, `exp`, `typ`.
- Login body: `usrLoginName`, `usrPassword`, plus optional `device_id`, `app_version`,
  `ip_address` and `device_type`.
  - `device_type` (web, mobile or desktop) selects the channel flag that is checked.
  - The device is looked up in `fixed.device_master`. A failed lookup does not block login.
- Request headers actually read: `Authorization`, `x-user-id` (seeds the audit user id),
  `x-forwarded-for` / `x-real-ip`, `x-device-id` (txn-hold lease routes only), `if-none-match`
  (app-theme), and `accept-language` or `?lang=` (error wording).

**Tenancy:**

- Company, branch and accounting year (`YYYY-YYYY`) come from the request DTO (query or body).
- Enforcement is per module: explicit `where` clauses, `ensureCompanyExists`, and scope
  asserts such as `src/modules/accountsModule/receipt/receipt.guards.ts:270-290`.
- No code checks the DTO company against the token's `company_id`. There is no RLS or Prisma
  tenant extension.
- A few routes fall back to token scope: `print-render`, `print-template-assignment`,
  `stock-track-presets` and `gstin-lookup`.

**Settings:**

- SQL function `public.fn_app_settings_effective(company, branch, device, user)`
  (`prisma/migrations/20260812180000_add_app_settings_effective/migration.sql:30-133`).
  - Precedence: **GLOBAL < COMPANY < BRANCH < DEVICE < USER**.
  - A layer whose id is NULL never matches.
- `fn_app_settings` casts BOOL, INT, DECIMAL and JSON values.
- TypeScript readers cast with seeded fallbacks, for example `src/modules/sales/posting/sales.settings.ts:119-222`.
- Unknown keys:
  - On read, a missing key falls back to the default.
  - On write, an unknown key is a 400 and a retired key is a 409
    (`src/modules/settings/appSettings/app-setting-value.service.ts:409-433`).

**Voucher numbering:**

- `allocateVoucherNumber` (`src/common/Sequence/voucher-sequence.helper.ts:50`) takes a
  `pg_advisory_xact_lock` per scope, then increments `acc_voucher_seq`. It must run inside a
  transaction.
- `allocateVoucherSlno` (`:124-147`) takes a lock and then computes `MAX+1`.

### 2.6 Environment variables

**There is no `.env.example`.** `README.md` step 1 runs `cp .env.example .env`, which fails.
`.gitignore` already whitelists `!.env.example`.

**Defaults:** three layers set them, in this order of power:

1. Joi defaults (`src/config/env.validation.ts`). `@nestjs/config` writes these into
   `process.env` before `configuration.ts` runs, so they override the fallbacks there.
2. Fallbacks in `src/config/configuration.ts`.
3. Direct `process.env` reads in individual files.

The table shows the value that actually takes effect.

| Variable | Effective default | Read in | Notes |
|---|---|---|---|
| `NODE_ENV` | `development` | `configuration.ts:31`, `main.ts:146`, `startup-seed.ts:59` | `production` changes the CORS and seeding defaults |
| `HOST` | `0.0.0.0` | `configuration.ts:32` | |
| `PORT` | **3000** (Joi). `configuration.ts:33` says 3010 | `configuration.ts:33`, `env.validation.ts:5` | Conflicting defaults |
| `API_PREFIX` | `api` | `configuration.ts:34`, `main.ts:194-198` | |
| `API_VERSION` | `1` | `main.ts:192`, `common/constants/api-version.ts:1` | The constant reads `process.env` raw. Not in the Joi schema |
| `REQUEST_BODY_LIMIT` | `10mb` | `configuration.ts:36` | JSON and urlencoded only |
| `LOG_FILE_PATH`, `ERROR_LOG_FILE_PATH` | `logs/app.log`, `logs/error.log` | `common/logging/file-logger.service.ts:10-11` | |
| `HTTPS_ENABLED` | `false` | `main.ts:72` | |
| `HTTPS_CERT_PATH`, `HTTPS_KEY_PATH`, `HTTPS_PASSPHRASE` | empty | `main.ts:75-85` | Required when HTTPS is on |
| `CORS_ORIGINS` | empty | `main.ts:144` | CSV. In production an empty list means CORS is never enabled |
| `CORS_CREDENTIALS` | depends on origins | `main.ts:151` | |
| `DATABASE_URL` | built from `DB_*` | `configuration.ts:15`, seed runner, scripts | Also used by Prisma (`prisma/base.prisma`) |
| `DATABASE_READONLY_URL` | main URL + `default_transaction_read_only=on` | `configuration.ts:51`, `database/pg/pg.service.ts:40-46` | Pool for configured grid/dropdown SQL |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` | `localhost`, `5432`, dev defaults | `configuration.ts:18-24,52-57` | Hard-coded dev credentials are the fallback |
| `DB_SYNC`, `DB_LOGGING` | `false` | `configuration.ts:58-59` | `DB_SYNC` is unused. `TODO(verify)` |
| `DB_AUTO_SEED` | `true` in production, else `false` | `database/seed/startup-seed.ts:60` | Seeds run before the port opens |
| `DB_AUTO_MIGRATE` | `false` | `startup-seed.ts:61` | Runs `prisma migrate deploy` at boot |
| `DB_SEED_FAIL_FAST`, `DB_SEED_LOCK_TIMEOUT_SECONDS` | `false`, `60` | `startup-seed.ts:62,92` | |
| `JWT_SECRET` | none (required outside test, min 16 chars) | `configuration.ts:67`, `env.validation.ts:60` | |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS` | `900`, `604800` | `configuration.ts:68-69` | |
| `THROTTLE_ENABLED`, `THROTTLE_TTL`, `THROTTLE_LIMIT` | `true`, `60` s, **100** | `app.module.ts:142,159-160` | `configuration.ts:64` says 10000 but is never read |
| `REDIS_ENABLED` | **`false`** (Joi) | `configuration.ts:73`, `env.validation.ts:76` | Setting only `REDIS_URL` does **not** enable it |
| `REDIS_URL` or `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS` | `127.0.0.1`, `6379`, empty, empty, `0`, `false` | `common/redis/redis.module.ts`, `common/queue/queue.module.ts:15-25` | BullMQ reads these even when Redis is disabled |
| `REDIS_TTL` | **3600** (Joi). `configuration.ts` says 300 | `redis.module.ts:28-31` | Applied as milliseconds (`ttlSeconds * 1`) |
| `REDIS_CONNECT_TIMEOUT_MS` | `5000` | `configuration.ts:88,101` | |
| `GST_CRED_KEY`, `GST_CRED_KEY_VERSION`, `GST_CRED_KEY_V<n>` | none | `modules/gst/config/gst-crypto.service.ts:18-41,91` | Encrypts stored GST credentials. Never regenerate an existing key |
| `GST_PUBLIC_KEY_DIR` | `./certs/gst` | `modules/gst/client/gst-nic-crypto.ts:25` | |
| `PRINT_FONT_DIR` | `assets/fonts` | `settings/print-render/engine/fonts/font.registry.ts:239` | |
| `PRINT_IMAGE_ROOTS` | `assets:uploads` | `.../renderers/image.cache.ts:254` | |
| `PRINT_IMAGE_CACHE_BYTES` | 32 MB | `.../renderers/image.cache.ts:56` | |
| `PRINT_ALLOW_REMOTE_IMAGES` | off | `.../renderers/image.cache.ts:54` | |
| `CLOUD_SYNC_ENABLED`, `CLOUD_DATABASE_URL`, `CLOUD_SYNC_INTERVAL_SECONDS`, `CLOUD_SYNC_BATCH_SIZE` | `false`, empty, `60`, `500` | `configuration.ts:108-111` | Feature is local-only (gitignored) |

Script-only variables:

- `CERT_HOSTS` (`scripts/generate-local-cert.js`)
- `PERF_BASE_URL` (`scripts/perf/load-test.js`)
- `SEED_USER_ID`, `CURRENT_USER_ID`, `X_USER_ID`, `ALLOW_SEED_ACTOR_FALLBACK`
  (`scripts/seed-supermarket-items.js`)

The local `.env` also has a duplicated `JWT_SECRET` key and a JS-style `//ACCESS_TOKEN_TTL_SECONDS`
line. dotenv treats that line as a variable named `//ACCESS_TOKEN_TTL_SECONDS`, not a comment.

### 2.7 Database

**Schema build** (`scripts/build-prisma-schema.js`):

- The script concatenates `prisma/base.prisma` with every other `*.prisma` file under
  `prisma/`, sorted by path, into `prisma/schema.prisma`, which carries a "DO NOT EDIT" header.
- It refuses any `generator` or `datasource` block outside `base.prisma`.
- 183 fragments produce 188 models and 21 enums.
- Generators in `base.prisma`:
  - `client`
  - `dbml`, writing `dbml/awesome.dbml`
  - `docs`, writing **`../../docs` relative to `prisma/`, which lands outside the repo**
    (a 160 MB `index.html`)
- `npm run prisma:generate` runs all three generators. `postinstall` runs the client generator only.

**Schemas** and models per schema:

| accounts | public | sales | inventory | fixed | stock | audit | purchase | settings | transport |
|---|---|---|---|---|---|---|---|---|---|
| 45 | 41 | 41 | 22 | 17 | 17 | 3 | 2 | 0 | 0 |

`settings` and `transport` are declared in the datasource, but no model uses them and no
migration creates them. `TODO(verify)`: do they exist in any database?

**Conventions** (counts are from the generated schema):

| Convention | Evidence |
|---|---|
| snake_case via `@map` / `@@map` | 190 `@@map`, e.g. `prisma/sales/saleBill.prisma:231` |
| Per-table column prefix | `sb_` (sale bill), `avh_` (voucher header). Outlier: `prisma/public/batch.prisma` has no prefix |
| UUIDv7 PKs | 163 × `@default(dbgenerated("uuidv7()"))`. Outliers: `uuid(7)`, `gen_random_uuid()`, and 16 `autoincrement()` keys on config tables |
| Soft delete | 160 `<prefix>_is_deleted` columns, filtered by hand (no Prisma middleware) |
| Partial unique indexes | SQL-only. Fragments carry comments telling you not to add `@@unique`, e.g. `prisma/sales/saleOrder.prisma:205-211` |
| `Timestamptz(6)` | 553 uses. Also 75 bare `@db.Timestamptz`, 3 `(0)`, and 9 with no `@db` type |
| Tenant columns | 100 `*_company_id`, 106 `*_branch_id`, 55 `*_tenant_id`, 123 `*_acc_year`. Mostly no FK |
| Sync columns | 177 `*_sync_date` columns are the **offline-to-cloud sync** marker, not Tally |
| Tally columns | Identity only: `*_tally_guid`, `*_master_id`, `*_alter_id`, `vchr_tally_export_enabled` |
| Audit columns | 165 `*_created_by`, 147 `*_modified_by` |

**Migrations** (`prisma/migrations/`):

- 437 folders at `4f1ea5db`, from `20260212000000_init` to `20261015140000_drop_grid_schema`.
  Local trees can hold more: the gitignored cloud-sync migration, and untracked new ones.
- Timestamps are hand-picked, and three are duplicated: `20260922060000`, `20261012120000`,
  `20261015130000`.
- 80 migrations insert data.
- Seven migrations run `OWNER TO postgres`, so a superuser must apply them while the app runs
  as an unprivileged role (`deploy/deploy.sh:49-51`).

**SQL-only objects** (counted across all migrations, including later drops):

| Category | Count | Examples |
|---|---|---|
| `LIST` partitioned by `<prefix>_acc_year` | 52 created, 50 live | Partition names `<table>_YYYY_YYYY`. Helper `public.ensure_acc_year_partitions('YYYY-YYYY')`, latest in `20261008130000_noncash_tender_control` |
| Other partition helpers | 2 | `stock.fn_create_stock_partitions`, `public.fn_create_printing_partitions` |
| Partial UNIQUE indexes | 165 names | `ux_so_order_no`, `uq_led_name_company`, `ux_tsf_default` |
| Partial non-unique indexes | 479 names | |
| `EXCLUDE USING gist` | 6 | `excl_ilc_slab_overlap`, `ex_prm_exclusive_clash`, `ex_stp_overlap`, `ex_sag_overlap`, `ex_tdr_overlap`, `ex_ipm_overlap` |
| Triggers | 12 static | `tr_asv_check_scope`, `tr_acc_group_inherit_nature`, `tr_av_refresh_totals`, `tr_led_name_scope`, `tr_acc_group_name_scope` |
| Functions | 28 distinct | `fn_ledger_map_catalogue`, `fn_books_reconcile`, `fn_party_bill_reconcile`, `fn_app_settings_effective`, `fixed.fn_search_norm` |
| CHECK constraints | 235 added via `ALTER` | Many were later moved to the app layer |
| Views | 3 | `public.v_sync_tables`, `accounts.v_bill_tcs`, `public.vw_gst_credential` |
| Generated columns | 50 | `abl_pending_amount`, `sml_signed_base_qty` |
| Extensions | 2 | `pgcrypto`, `btree_gist` |

`TODO(verify)`: produce the full per-object list in Phase 3. The gitignored cloud-sync migration
adds `zz_sync_*` triggers to every synced table on machines that have it.

**Seeds** (`src/database/seed/`):

- `seed.cli.ts` takes the flags `--migrate`, `--only=`, `--force` and `--stop-on-error`.
- `prisma/seed/seed.manifest.json` lists 35 idempotent SQL seeds: menus, UI tables, grids,
  dropdowns, forms, state codes, account groups, ledger map, voucher types, fiscal year, main
  branch, HSN, banks, GSP providers.
- One TS seed: `seeds/error-messages.seed.ts`, which upserts `Error_Messages.json`.
- Seeds are tracked in `public._erp_seed_history` and serialized with an advisory lock.
- `DB_AUTO_SEED` runs them at boot.

### 2.8 Jobs, scheduling, caching

| Kind | What exists | Source |
|---|---|---|
| BullMQ | Queues `audit-log-archival` and `stock-reconciliation`, each with a processor. **No producer.** The connection ignores `REDIS_ENABLED` | `src/common/queue/` |
| Scheduled | No `@nestjs/schedule`. `setInterval`s: error-message catalogue reload (60 s) and cloud sync (not loaded). **In flight:** a 25 s SSE ping | `modules/error-messages/error-messages.service.ts:30-33` |
| External cron (documented, not scheduled) | `POST /receipts/regularise-pdc` daily per company. `scripts/reconcile-books.ts` | `receipt.controller.ts:551-560`, `scripts/reconcile-books.ts:13` |
| HTTP cache | GET only, routes with `@CacheTTL(>0)`. Key = path + sorted query, with no user or company. TTLs at the commit: 100 × 1 s, 91 × 0, 22 × 60 s (**in flight**: the 60 s ones become 1 s). Each write purges matching keys with `KEYS` (no `SCAN`) | `common/interceptors/http-cache*.ts`, `common/redis/cache-invalidation.service.ts`, `common/redis/redis-cache.service.ts` |
| Grid cache | `ConfiguredGridCacheInterceptor`. Its key omits `sort_by`/`sort_dir` | `common/configured-grid-sql/utils/configured-sql-cache-interceptor.ts:35-42` |
| Sessions | `auth:session:<sid>` with **no TTL**. Checks fail open when Redis errors. No revocation when Redis is off | `modules/auth/auth-session.service.ts:39-42` |
| Events | No event emitter at the commit. **In flight:** an in-process RxJS SSE feed at `GET /data-changes/stream` that assumes a single instance, consumed by the web client | `src/common/data-changes/` (untracked) |
| Health | `GET /api/v1/health` (public). Checks Prisma `SELECT 1` and Redis `PING` when enabled. Returns 503 if either is down | `modules/health/` |

### 2.9 Integrations

| Integration | Status | Source |
|---|---|---|
| GST provider config, credentials, Verify (AUTH) | Implemented. Base URLs come from DB rows. Credentials are encrypted with `GST_CRED_KEY`. Any inactive row returns 503 `GST_SWITCHED_OFF` | `src/modules/gst/` |
| GSTIN search | Implemented: `GET /gst/search` through the `VERIFY_GSTIN` endpoint row | `src/modules/settings/gstinLookup/` |
| E-invoice (IRN), e-way bill | **Not implemented.** The vocabulary exists, `GstGatewayService.configured = false`, and cancel always refuses | `src/modules/sales/posting/gst-gateway.service.ts:26-62` |
| Printing | Implemented: server-side pdfkit plus ESC/POS and ESC/P. Templates live in the DB (`print_template*`). Logs go to `print_log` | `src/modules/settings/print-render/`, `print-template*/` |
| Tally | **Not implemented.** Identity columns only | `prisma/inventory/itemMaster.prisma:72-78` and others |
| Biometric / eSSL / attendance | **Not implemented** | `prisma/sales/employeeMaster.prisma:36-40` |
| Email / SMS / WhatsApp | **Not implemented.** Only number columns and output-mode words | |
| File uploads | Multer memory storage with no size limits. Photos are stored as `bytea` | `opening-stock-voucher.controller.ts:335`, `tender-settlement.controller.ts:129,151` |
| Cloud sync | Local only: gitignored and not imported | `src/modules/cloud-sync/` (untracked) |
| Analytics sidecar | No references | |

### 2.10 Deployment and operations

| Target | Files | Summary |
|---|---|---|
| CloudJiffy (Jelastic) | `ecosystem.config.js` | PM2 app `api`, fork mode, `PORT=3000`. The platform load balancer terminates TLS. Pins `REDIS_ENABLED=false`, `DB_AUTO_SEED=true`, `DB_AUTO_MIGRATE=false`. No partition step. `TODO(verify)`: who creates new fiscal-year partitions there? |
| VPS | `deploy/deploy.sh`, `deploy/ecosystem.vps.config.js`, `deploy/nginx/erp.conf`, `deploy/nginx/erp-proxy.conf`, `deploy/systemd/`, `deploy/README.md` | Builds, migrates as superuser, ensures current and next FY partitions, `pm2 reload erp-api`, then polls `/api/v1/health` for about 120 s. nginx terminates TLS (80 → 443) and proxies to the app on `:3000`. Let's Encrypt via an ACME location |
| Local | `docker-compose.yml` | **`postgres:16-alpine` cannot run the migrations** (needs PG 18 `uuidv7()`). `redis:7-alpine` |
| Binary | `npm run release*` (`pkg`) | Single executables for Linux and Windows, output in `release/` |
| CI | none | `.github/` holds only `copilot-instructions.md` |

Ops facts for `troubleshooting.md`:

- `NODE_ENV=production` during `npm ci` drops `@nestjs/cli` and `typescript`
  (`deploy/deploy.sh:35-36`).
- A `tsc` heap limit needs extra memory (`deploy/deploy.sh:41-43`).
- A missing FY partition makes every save fail (`deploy/README.md`, "Accounting-year partitions").
- With an empty `CORS_ORIGINS` in production, CORS is never enabled (`ecosystem.config.js` comments).
- With Redis down, health returns 503.
- PM2 back-off: `ecosystem.config.js` explains `exponential_backoff_restart_delay` and `min_uptime`.

### 2.11 Tests and tooling

- Unit tests: 130 `*.spec.ts` under `src/` (jest, `rootDir: src`).
- E2E tests: 100 `*.e2e-spec.ts` under `test/` (`test/jest-e2e.json`). They run against a live
  database, and some need `--runInBand`.
- Lint: `.eslintrc.js` in legacy format. `TODO(verify)`: does `npm run lint` need
  `ESLINT_USE_FLAT_CONFIG=false` on the installed ESLint?
- Load testing: `scripts/perf/load-test.js` (`docs/performance-load-testing.md`).

### 2.12 Existing documentation to reuse

| Where | What | Reuse in |
|---|---|---|
| `README.md` | Boilerplate intro (stale), seeding guide (good), HTTPS, "Where logic lives" (posting services and the no-trigger rule) | Phases 1 and 4 |
| `src/modules/**/README.md` | **102 module READMEs**, many detailed (e.g. `sales/bill`, `accountsModule/receipt`) | Phase 5: link and curate rather than rewrite |
| `deploy/README.md` | VPS topology, redeploy, CORS, "two things that make a naive deploy fail", partitions, TLS | Phase 7 |
| `docs/*.md` | Per-feature plans (`*-plan.md`), `production-readiness-todo.md` (partly inaccurate on queues), `stock-module-workflows.md`, `performance-load-testing.md` | Phases 4, 5 and 7 |
| `docs/*.html`, `docs/*.pdf` | `erp-server-architecture.html`, `ERP-Server-Backend-Architecture.pdf`, `vps-deployment-runbook.*`, `stock-module-workflows.*` | Reference only: binary/HTML, not Markdown |
| `plan/` | 20 working notes (`notes-NN-*`, `plan-nestjs-*`) | Background for module docs |
| `.github/copilot-instructions.md` | AI-agent architecture primer | Cross-check in Phase 4 |
| `/home/vk/Dev/erp/docs/` (outside any repo) | `erp-architecture-and-stabilization.md`, `erp-documentation-outline.md`, `erp-product-overview.md`, `erp-user-manual.md`, print templates | `TODO(verify)`: should these move into a repo? |

---

## 3. Web client (`ERP client`)

| Topic | Facts |
|---|---|
| Scripts | `dev` (turbopack + local HTTPS certs), `dev:http`, `build`, `start` (`scripts/ensure-build.js` then `next start -p ${PORT:-3000}`), `start:https` (`https-server.cjs`), `test` (vitest), `typecheck`, `lint` (`--max-warnings=344`), `cert:local`, `gen:print-vocab`, `gen:printing-types` |
| Node | No `engines` field or `.nvmrc`. CI uses Node 22. README says 20+ |
| Structure | `app/` (App Router: `accounts`, `master`, `sales`, `stock`, `reports`, `settings`, `print-designer`, `(auth)`, `(marketing)`, `api/`), `components/`, `features/`, `store/`, `lib/`, `hooks/`, `domain/pricing`, `styles/library` (SCSS tokens), `services/` (re-export barrels) |
| Env | `NEXT_PUBLIC_API_BASE` (default `<page host>:3010/api/v1`), `NEXT_PUBLIC_ENABLE_FIGMA_CAPTURE`, `NEXT_DIST_DIR`, `PORT`, `HTTPS_*`, `GST_LOOKUP_*`, `GOOGLE_TRANSLATE_*`, integration-test `*_IT_*`. **No `.env.example`** |
| API | One `createApi` (`store/api/baseApi.ts`) with about 40 tag types. Every other slice uses `injectEndpoints` |
| Auth | Bearer token from `prepareHeaders`. A 401 triggers one shared `POST /auth/refresh`, then a single retry. Tokens are stored in `sessionStorage`; the device id in `localStorage` |
| Duplicate stack | A second axios stack (`hooks/useApi.ts`) duplicates base-URL and refresh logic |
| Sagas | `auth.saga.ts` (logout), `businessContext.saga.ts` (company → branch), `masters.saga.ts` (post-save invalidation) |
| Freshness | Every mutation invalidates all tags. An SSE feed reads `GET /data-changes/stream` (uncommitted) |
| UI | CSS variables in `app/globals.css` and `styles/library/_tokens.scss`. The per-company theme comes from `GET /app-themes/effective`. Mostly SCSS modules. No central hotkey library. Forms are custom (`dynamic-modal-form.tsx`); react-hook-form and zod are installed but unused |
| Deploy | PM2 `ecosystem.config.cjs` on CloudJiffy. GitHub Actions `.github/workflows/ci.yml` runs typecheck, lint, test and build; a push to `dev` deploys over SSH with `scripts/deploy-on-node.sh` (build into `.next-build`, swap, `pm2 reload`, health check) |
| Existing docs | Custom `README.md` (partly stale: `/dashboard` route, theme toggle, CI section). Stale `PROJECT_STRUCTURE.md`, `REDUX_USAGE_PLAN.md` and `REUSABLE_COMPONENTS.md`. `plan/*-qt-parity.md`. `docs/quotation-module-guide.*` |
| Oddities | `tailwind.config.ts` is v3-style and never loaded. `next`, `react` and `typescript` are pinned to `latest`. Empty `app/sales/test bill/` folder. Two print systems (`features/print-designer` vs `features/printing`) |

---

## 4. Qt desktop (`NexERP`)

| Topic | Facts |
|---|---|
| Build | CMake ≥ 3.19, C++17, `find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Widgets PrintSupport Network Pdf PdfWidgets)`. Qt PDF is a MaintenanceTool extension. One target, `NexERP`, lists its sources by hand. Linux RPATH is `$ORIGIN/lib` |
| Package | `scripts/deploy-linux.sh` produces a portable `dist/NexERP` with `lib/`, `plugins/`, `qt.conf`, `run.sh` and a template `appconfig.ini`. AppImage tools and a staged `AppDir` are committed (about 140 MB) with no driving script. No Windows packaging |
| Structure | `src/app/shell` (MDI shell), `src/core/{api,auth,config,navigation,session,theme,utils}`, `src/modules/{accounts,admin,inventory,purchase,sales}`, `src/shared/{ui,widgets,models,...}` |
| CRUD framework | `NexCrudMasterPage` (`src/shared/ui/nex_crud_master_page.h:115`, config-driven list) and `NexCrudForm` (`src/shared/ui/nex_crud_form.h:320`, declarative fields), both on `NexDialog` (`src/shared/widgets/nex_dialog.h:126`). About 39 lists and 34 forms use them. Reference pair: `src/modules/inventory/master/units/unit_list.h` + `unit_entry.h` |
| Widgets | About 30 `Nex*` classes in `src/shared/{ui,widgets,models}`: dropdowns, `NexApiTableView`, `NexTable`, `NexDateEdit`, `NexDoubleEdit`, `NexWarningStrip` and others |
| Runtime config | `appconfig.ini` next to the executable. Missing `API/BaseUrl` is fatal. Keys: `API/BaseUrl`, `API/CaCertFile`, `API/AllowInsecureSsl`, `Company/*`, `Ui/DefaultRowHeight`, `Sales/Regional`, `Device/DeviceId` |
| Auth | Tokens are held in memory only. Sends `Authorization` and `X-Device-Id`. A 401 triggers a refresh and replay. `unauthorizedDetected` is never connected |
| Endpoints | About 400 path strings in `src/core/api/api_endpoints*.h` and `endpoints/*.h` |
| Tests | 100 standalone `main()` tests under `tests/<area>/`, each run by a `run.sh` that links the app's ninja objects. No CTest |
| Docs | **No README.** No Doxyfile. `docs/` holds three sales gap analyses. Code comments cite `share/*.md` and `schema/NN_*.sql`, which are not in either repo |
| Oddities | Empty tracked file `react`. Commit messages are dates only. The deployed binary is an unstripped debug build |

---

## 5. Mobile (`ERP client mobile`)

| Topic | Facts |
|---|---|
| Scripts | `start` (`expo start`), `android`, `ios` (`expo run:*`), `prebuild`, `lint`, `test` |
| Versions | Expo 54.0.8, RN 0.81.4, React 19.1.0. `app.json`: version `1.0.0`, package and bundle id `com.erpclientmobile`. No `versionCode` or `buildNumber` in `app.json` |
| Build | No `eas.json` or `app.config.*`. `android/` and `ios/` are generated (CNG). The release build type uses the **debug signing config** |
| Config | No env vars. The API base is a hard-coded loopback constant on port 3011 in `src/lib/config/env.ts`, and relies on `adb reverse`. The README describes host switching that the code does not do |
| Auth | Tokens in AsyncStorage. Bearer header. Refresh via `/auth/refresh` |
| Structure | `src/{auth,components,features/masters,hooks,lib,navigation,screens,store}`, with 13 masters implemented |
| Docs and tests | Custom README (partly stale). One template test |

---

## 6. Analytics sidecar

Not found on this machine. There are no Python or FastAPI projects under the home directory
outside tool caches, and no reference from the backend (no URL variable, proxy route or shared
secret). Skipped.

---

## 7. Risks found during discovery

These are outside a docs-only remit, so they are recorded here and not fixed. None of the
values involved are reproduced.

| # | Risk | Where |
|---|---|---|
| 1 | **Unauthenticated user-management routes.** Class-level `@Public()` covers user create, list, get, update and delete, device-master CRUD and user administration. The audit user on these routes comes from the client-set `x-user-id` header | `src/modules/users/users.controller.ts:36`, `src/modules/fixed/device-list-master/device-list-master.controller.ts:41`, `src/modules/settings/userAdministration/user-administration.controller.ts:35` |
| 2 | **Credentials in tracked source.** Hard-coded GST lookup fallback credentials appear in the web client. Hard-coded server address and login appear in Qt test scripts | `ERP client/app/api/gst/search/route.ts`. `NexERP/tests/staffledger/run-api.py`, `tests/loyaltystatus/run-api.py`, `tests/openingstock/run-live.sh` and others |
| 3 | Tenant scope is whatever the caller sends. Nothing ties the DTO `companyId` to the token | section 2.5 |
| 4 | Swagger is served in production at `/api/docs` and `/api/docs/<module>` | `src/main.ts:252-263` |
| 5 | Sessions: no logout, no Redis TTL, checks fail open, no refresh-token rotation | `src/modules/auth/` |
| 6 | BullMQ dials `127.0.0.1:6379` even with `REDIS_ENABLED=false`, which CloudJiffy pins. Expect reconnect noise (`TODO(verify)` in logs) | `src/common/queue/queue.module.ts` |
| 7 | Conflicting defaults: `PORT` 3000 vs 3010, `THROTTLE_LIMIT` 100 vs 10000, `REDIS_TTL` 3600 vs 300 (and the ms unit bug). `REDIS_URL` alone does not enable Redis | section 2.6 |
| 8 | Throttler behind nginx with no `trust proxy` setting, so all clients may share one 100/min bucket (inferred, `TODO(verify)`) | `src/app.module.ts:157-163`, `src/main.ts` |
| 9 | Committed docs and config name a production IP, production hostnames and a LAN IP. This conflicts with the no-IP rule for docs | `deploy/README.md` title and topology, `ecosystem.config.js` comments and `CORS_ORIGINS` |
| 10 | `docker-compose.yml` uses PostgreSQL 16, so a fresh local setup fails at the second migration | `docker-compose.yml:4` |
| 11 | Mobile release builds are debug-signed. Tokens sit in AsyncStorage | `ERP client mobile/android/app/build.gradle` |
| 12 | `PRINT_ALLOW_REMOTE_IMAGES=true` follows redirects with no host allowlist (SSRF). Uploads have no multer size limits | `.../renderers/image.cache.ts`, upload controllers |
| 13 | `dist/` is tracked in the backend. The Qt repo tracks AppImage tooling and a staged binary | `git ls-files dist`, `NexERP/scripts/appimage-tools/` |

---

## 8. Open questions for the human

1. **Branch and PR base.** This branch was cut from `DEV-v1`. Should doc PRs target `DEV-v1`
   or `main`? Push and PR were not done.
2. **Module docs** (Phase 5). There are 102 in-source READMEs. Should `docs/backend/modules/<module>.md`
   be short index pages that link to them, or should the content move into `docs/` with the
   READMEs reduced to pointers?
3. **Mobile.** Will `ERP client mobile` go under git, and where? Is EAS build/submit planned,
   or local Gradle? Without an answer, `mobile/docs/release.md` can only describe the current
   local build.
4. **Analytics sidecar.** Where does it live, or is it not built yet?
5. **PostgreSQL version.** Is CloudJiffy's database also PG 18? Should `docker-compose.yml`
   move to PG 18? Phase 1 needs one of these to make local setup work.
6. **FY partitions on CloudJiffy.** Who runs `ensure_acc_year_partitions` there?
7. **Swagger in production.** Is public `/api/docs` intended? Phase 2 asks the docs to say it
   must not be exposed.
8. **Scrubbing.** May Phase 1/7 remove the production IP and hostnames from `deploy/README.md`
   and the `ecosystem.config.js` comments, or leave the existing files alone?
9. **Cloud sync.** It is gitignored, but its env vars ship in tracked config. Should it be
   documented, or left out until it is committed?
10. **Ports.** The server default is 3000, the dev `.env` uses 3011, and the web client
    defaults to 3010. Which port should the local-setup doc standardise on?
11. **Risks 1 and 2.** Are the public user routes intended? Have the credentials found in
    tracked source been rotated?
12. **Scope of `vkmobileapp-dev`.** Out of scope as assumed here?
13. **Repos outside `ERP-Server`.** Should their docs land as branches in their own repos
    (web, Qt), and as a plain folder for mobile until it has a repo?

---

## 9. Proposed adjustments to the plan

- **Phase 1:**
  - Add `.env.example` from the table in section 2.6.
  - Fix the README quick start (it references `.env.example` and PG 16 compose).
  - Mark Redis as optional.
  - Document PG 18 as a hard prerequisite.
- **Phase 2:**
  - Decorator coverage is nearly complete. Spend the effort on DTO
    `@ApiProperty` examples, documenting `errors[]` in `HttpErrorResponseDto`, the two module
    error shapes, and `npm run docs:openapi`.
  - `TODO(verify)`: whether `SwaggerModule.createDocument` can run from a script without
    `listen()`. It needs the Nest app built, which connects Prisma and Redis.
- **Phase 3:**
  - Hand-write the Mermaid ERDs from DB names.
  - Note that `prisma:generate` writes a 160 MB HTML file outside the repo.
  - List the 50 partitioned tables in full.
- **Phase 4:** use the real folders (`common/`, `config/`, `database/`, `modules/`) and the
  posting layers named in `README.md` ("Where logic lives").
- **Phase 5:** order masters/platform, then inventory and stock, then sales, then accounts and
  till, then GST and print, then reports. Drop purchase transactions and HR/attendance
  (masters only).
- **Phase 7:** two targets (CloudJiffy PM2 + platform TLS, and VPS PM2 + nginx + Let's Encrypt).
  No CI on the backend.
- Add a `docs/glossary.md` entry for **sync date** (offline cloud sync). Readers will otherwise
  confuse it with Tally.
