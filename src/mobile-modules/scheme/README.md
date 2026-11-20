# Mobile · Schemes

The promotion schemes the React Native (Expo) salesman app downloads on Sync, so that its offline offer
engine can show and apply them on phone orders. Plan: `Shared/Prathap/mobile/plan-item-schemes-offers.md`
(§6.1). **Read-only, no database change, no menu right.**

- **Base route:** `mobile/schemes` (API-versioned: `/api/v1/mobile/schemes/...`)
- **Swagger tag:** `Mobile · Schemes`. Own docs page `/api/docs/mobile-schemes`.
- **Auth:** optional (`@OptionalAuth`), as the other `/mobile/*` reads. A token that is sent is still
  checked (a bad one is a 401).
- **Plain HTTP:** works on the main port, because `mobile/` is a phone prefix in
  `src/common/phone-http/phone-http.ts`.

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/active?companyId=&deviceUid=` | Every scheme of the company the phone can apply by itself, with its live branch, party, item and slab rows |

## `GET /active`

The query takes the same two keys as `GET /mobile/items/list`.

- `companyId` is required. It must be a uuid; a missing one is a 400 `VALIDATION_IS_UUID` (the
  same decorator as items/list). An unknown, switched-off or deleted company is a 404
  `MOBILE_COMPANY_NOT_FOUND`.
- `deviceUid` is optional. When it is sent, it must be a registered phone, else a 403
  `MOBILE_DEVICE_NOT_REGISTERED` / `_BLOCKED` / `_INACTIVE`. It does not narrow the answer.
- Any other key is a 400 `VALIDATION_WHITELIST`.

**Which schemes** (plan decision 4: only what the engine can apply):

- `prm_comp_id = companyId`, `prm_is_deleted = false` and `prm_is_active = true`;
- `prm_status = 'APPROVED'`, `prm_auto_apply = true` and `prm_coupon_batch_id IS NULL`;
- `prm_end_date >= asOf`, where `asOf` is the database's `CURRENT_DATE` (IST). It is bound as a
  `'YYYY-MM-DD'::date` in SQL, never as a JS `Date` (memory `db-session-timezone-ist`). A scheme that
  starts in the future is sent: it starts working offline on its own start date.
- There is **no branch filter.** Every branch row is sent, and the phone checks the order's branch.
- Sorted by `prm_priority`, then `prm_code`, then `prm_id`.

**Children** (`branches`, `parties`, `items`, `slabs`) are the rows with `*_is_deleted = false` and
`*_is_active = true`, sorted by slno and then id.

**Keys** are the VK Nex column names, so the phone's tables mirror them (plan §5.2):

- Header: `prm_id`, `prm_comp_id`, `prm_branch_id`, `prm_code`, `prm_name`, `prm_status`, `prm_apply_on`,
  `prm_benefit`, `prm_priority`, `prm_stack_mode`, `prm_auto_apply`, `prm_allow_with_manual_disc`,
  `prm_calc_on_amount_type`, `prm_include_tax`, `prm_bill_type`, `prm_min_bill_amount`, `prm_min_qty`,
  `prm_branch_scope`, `prm_cust_scope`, `prm_item_scope`, `prm_price_level_id`, `prm_max_benefit_per_bill`,
  `prm_coupon_batch_id`, `prm_start_date`, `prm_end_date`, `prm_valid_from_time`, `prm_valid_to_time`,
  `prm_valid_weekdays`, `prm_remarks`, `prm_modified_on`, then `branches`, `parties`, `items` and `slabs`.
- `branches[]`: `prb_id`, `prb_branch_id`, `prb_branch_name`, `prb_is_exclude`.
- `parties[]`: `prp_id`, `prp_kind`, `prp_scope_id`, `prp_scope_name`, `prp_is_exclude`,
  `prp_match_priority`.
- `items[]`: `pri_id`, `pri_kind`, `pri_scope_id`, `pri_scope_name`, `pri_unit_id`, `pri_unit_name`,
  `pri_is_exclude`, `pri_disc_perc`, `pri_disc_qty`, `pri_disc_amt`, `pri_min_qty`, `pri_factor`,
  `pri_max_benefit`, `pri_match_priority`.
- `slabs[]`: `prs_id`, `prs_slno`, `prs_benefit`, `prs_exceeds`, `prs_upto`, `prs_each`, `prs_is_repeat`,
  `prs_max_repeats`, `prs_free_item_id`, `prs_free_item_name`, `prs_free_unit_id`, `prs_free_unit_name`,
  `prs_free_unit_factor`, `prs_free_qty`, `prs_free_stock_check`, `prs_disc_perc`, `prs_disc_qty`,
  `prs_disc_amt`, `prs_fixed_price`, `prs_max_benefit_amt`.

**Formats:**

- Integer columns are JSON numbers: `prm_priority`, `prm_price_level_id`, `*_match_priority`,
  `prs_slno` and `prs_max_repeats`.
- Every numeric column is exact text at its column scale (`Prisma.Decimal.toFixed(scale)`). Money is
  `(18,2)`; quantities are `(18,3)`; rates, factors and `prs_fixed_price` are `(18,4)`; and
  `prs_free_unit_factor` is `(18,6)`. A NULL numeric (`prs_upto`, `prs_fixed_price`) is `null`.
- Dates are `YYYY-MM-DD`, and times are `HH:MM:SS` or null.
- `prm_modified_on` is IST text with its offset (`2026-08-29T12:51:10.886+05:30`), or null.

**Joined fields** are display only. They are resolved as `/promotion-scheme/list` resolves them (see
that module's README, "Display names"):

- `prb_branch_name` is `br_name`.
- `prp_scope_name` is `cus_name`, `cgr_name`, `arm_name` or `ctm_name`, by kind.
- `pri_scope_name` is `item_name_en`, `itg_name`, `category_name`, `brand_name` or `sec_name`.
- `pri_unit_name` and `prs_free_unit_name` are `unit_name`, reached through `item_unit_conversion`.
  `pri_unit_id` and `prs_free_unit_id` are `iuc_id`s, the same id as an order line's `soiItemUnitId`.
- `prs_free_item_name` is `item_name_en`.
- `prs_free_unit_factor` is the free unit's `item_unit_conversion.iuc_to_base_factor`.

**Caching:** none. The route has no `@CacheTTL`, because the answer is per company and the HTTP
cache key holds no company (memory `redis-usage-audit`).

**Related keys for scope matching** (the same build, 2026-11-19):

- `GET /mobile/items/list` items carry `categoryId` / `sectionId`.
- `GET /mobile/customers/options` areas carry `cityId`.

## Tests

- Unit: [`mobile-scheme.service.spec.ts`](mobile-scheme.service.spec.ts). It covers the keys and
  formats per table, the SQL filter (including the date binding, and that there is no branch
  filter), the Prisma where, order and child filters, an empty company, and the 404 and the three
  device 403s.
- HTTP, live dev DB, read-only: `test/mobile-schemes-http.e2e-spec.ts`. It compares the set and
  order with its own SQL, checks the excluded schemes, the exact keys, the child counts and the
  free-unit factor, that a registered phone gets the same answer, and the coded refusals.
