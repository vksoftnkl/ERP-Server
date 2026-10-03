# NestJS — Physical Stock Count on the new stock engine

Target repo: `/home/vk/Dev/erp/ERP server` (NestJS + Prisma, PostgreSQL 18).
Schema it is written against: `schema/stock/16_stock.sql` + `19_stock_posting.sql`,
worked example `schema/stock/19_physical_stock_flow.md`, twin plan
`plan/plan-nestjs-opening-stock.md`.

## Context

**A physical count is `svh_voucher_type = 'PHYSICAL'` on the same two tables an
opening uses** — `stock.stock_voucher` and `stock.stock_voucher_item` — so this is
the *third* controller over `StockVoucherService`, not a third module with a third
copy of save/post/cancel. The opening module is already built and mounted; this
plan is what tests whether §2 of `plan-nestjs-opening-stock.md` was right.

It was right about the shape and wrong about the cost: the controller really is
~200 lines of type-pinning, but the shared service needs **six changes** (§3),
and every one of them is a rule OPENING happened to satisfy by accident.

Four things make a count behave differently from an opening, and all four cost
code:

1. **It cannot start from nothing.** An opening creates stock; a count corrects
   it. The count sheet is *generated* from `stock_balance` (§4), not typed. An
   item with no `stock_balance` row has no book quantity, so it cannot have a
   variance — finding it on the shelf is an `ADJUSTMENT`, not a count line.
2. **Only the difference posts.** `svi_qty`, `svi_base_qty` and `svi_cost_rate`
   stay **0 for the whole document**; the operator types one number per line,
   `svi_counted_qty`, and `svi_diff_qty` is GENERATED from it.
3. **A line that agrees writes nothing** — and the document still closes POSTED.
   Three lines counted, two ledger rows, and that is a success.
4. **It moves stock in both directions at once**, so one document exercises both
   the inward and the outward cost path, with two different rules for where the
   rate comes from.

`19_physical_stock_flow.md` captured a real run — 1 voucher + 3 lines written by
the application, 2 ledger rows written by the engine, 1 line that wrote nothing.
That file is the acceptance test for this module, figure for figure (§15).

**Scope of this plan (decided):** one new controller module, six surgical changes
to `StockVoucherService`, one new generated-sheet endpoint, one variance report.
Nothing about the opening module's behaviour may change — every change in §3 is
gated on the per-type rules record, and the OPENING path must come out
byte-identical.

---

## 0. Blockers to settle first

### 0.1 The engine, and the two fixes dated 2026-09-04

Same deployment story as the opening (`plan-nestjs-opening-stock.md` §0.1):
the `stock` schema is **not** managed by Prisma migrations in this repo — models
only, deployed out of band from `schema/stock/`. Confirmed here: nothing in
`prisma/migrations/` creates `stock.stock_voucher`, `stock.stock_reason_master`
or `fn_svh_post`.

Two fixes landed *after* the flow doc's run was captured, and this module depends
on both. **Verify they are in the deployed build before writing a line of code:**

```sql
-- the freeze guard must exist as a BEFORE INSERT trigger on the ledger
SELECT tgname FROM pg_trigger WHERE tgname = 'tr_sml_freeze_guard';

-- fn_svh_recompute must have a PHYSICAL branch that reads the LEDGER
SELECT pg_get_functiondef('stock.fn_svh_recompute'::regproc) LIKE '%PHYSICAL%';
```

- `tr_sml_freeze_guard` refuses any movement touching the counted godown while a
  DRAFT count's freeze window is open, except the count's own posting. It keys on
  **wall clock, not document date** — a back-dated entry still changes today's
  shelf. Other godowns keep trading; posting or cancelling the sheet lifts the
  freeze by itself. Without it, `svhFreezeStock` is decoration and §11 is a lie
  the API tells the operator.
- `fn_svh_recompute`'s PHYSICAL branch makes the header carry the **net
  variance** read off the ledger (the captured example: qty +1, value 86.00 =
  −2×20 + 3×42), and the same fix reordered the line write-back in `fn_svh_post`
  (INSERT … RETURNING first) so a **shortage line shows the COGS the trigger
  stamped** — SALT's line reads 20.00, not 0.

If either is missing, the tests in §15 must assert the *pre-fix* figures (header
totals 0.00, shortage line cost 0.00) and the screen must not display header
totals for a count at all. Say which build was verified, in the commit message.

### 0.2 There is nothing to retire — and one thing not to import

Unlike the opening, no legacy path competes here. `inventory.physical_stock_header`,
`_detail` and `_batch_detail` were **dropped by migration
`20260509061137_remove_four_tables`**, and `src/modules/` contains no physical
stock module. `app.module.ts` mounts none.

One trap: `~/physical-stock/` in the user's home is `nest g resource` output from
2026-05-08, written against those dropped tables. **Do not move it into the repo.**
Its DTO knows nothing about `svi_counted_qty`, its service knows nothing about the
engine, and its entity file is a stub. Start from the opening module's files.

### 0.3 Masters that must exist before the screen opens

| Table | Why |
|---|---|
| `fixed.device_master` | `svh_device_id` is NOT NULL — the device is the counter (§3 of the opening plan) |
| `inventory.godown_locations` | a count is **per godown**, and the sheet is generated from one |
| `inventory.item_unit_conversion` | `svi_uom_id` is `iuc_id`, not `unit_id` — and for a count it is *not typed*, it is carried over from the balance row |
| `stock.stock_track_policy` | decides which lot dimensions the count sheet must show as separate lines |
| **`stock.stock_reason_master`** | `svh_reason_id` / `svi_reason_id` FK here. **A model and `prisma/seed/Stock_Reason_Master.sql` exist; no migration in this repo creates the table** — it is deployed with the rest of `schema/stock/`. The seed already carries `PHYSICAL_PLUS` / `PHYSICAL_MINUS`-scoped reasons (Shrinkage, Damage, Counting error…), which is exactly what §5.3 needs. |

### 0.4 Client-side rows

`menu_master` and the `ui_table_master` / grid rows for the count screen do not
exist. Same gap the opening hit. Not this module's work; the screen cannot open
without them.

---

## 1. Prisma — nothing to add, three rules to hold

**No new models, no new files, no migration.** `prisma/stocks/stockVoucher.prisma`
and `stockVoucherItem.prisma` already carry every PHYSICAL column, and the model
comments already say why:

| Column | Model field | Status |
|---|---|---|
| `svh_freeze_stock` | `svhFreezeStock` | writable — §11 |
| `svh_freeze_from` / `_to` | `svhFreezeFrom` / `svhFreezeTo` | writable, and `ck_svh_freeze` refuses a freeze with no window |
| `svh_reason_id` | `svhReasonId` | writable — §5.3 |
| `svi_book_qty` | `sviBookQty` | writable — **and that is the danger** |
| `svi_counted_qty` | `sviCountedQty` | writable — the one number the operator types |
| `svi_diff_qty` | `sviDiffQty` | **GENERATED ALWAYS … STORED**, `counted − book` |
| `svi_reason_id` | `sviReasonId` | writable — per-line override of the header reason |

Three rules:

1. **Never write `sviDiffQty`.** Same class as `sviValue` / `sviValueWot` —
   Postgres rejects any write, including a write of the value it would compute.
   It is signed where every other quantity in the engine is a magnitude, because
   it is not a quantity, it is a *difference*, and it cannot be edited to zero to
   make a variance disappear.
2. **`sviBookQty` is written by the server, never taken from the payload.** It is
   an ordinary writable numeric column, so nothing in the database stops a client
   sending its own book figure — and a book figure the client chose turns a
   variance into a wish. Read it from `stock_balance` at save time (§5.2).
3. **`sviBookQty` is a snapshot and is kept for ever.** Not refreshed at post, not
   recomputed on load. It is what lets a variance be defended a year later, when
   `stock_balance` has moved on.

`stock.stock_ledger` still needs **no model**. The two reads that touch it (§12,
§15) are raw.

---

## 2. Module shape

```
src/modules/stocks/physical-stock-voucher/
  physical-stock-voucher.module.ts
  physical-stock-voucher.controller.ts
  dto/save-physical-stock-voucher.dto.ts        <- extends the shared DTO, pins PHYSICAL
  dto/generate-count-sheet-query.dto.ts         <- §4
  dto/list-physical-stock-voucher-query.dto.ts
  dto/post-physical-stock-voucher.dto.ts
  dto/physical-stock-voucher-response.dto.ts
```

Mirror `opening-stock-voucher/` file for file. The rules record:

```ts
const PHYSICAL_RULES: StockVoucherTypeRules = {
  voucherType: 'PHYSICAL',
  typeCode: 'PHY',                       // PHY/2026-2027/TILL-01/1
  displayName: 'Physical stock count',
  // A count moves stock BOTH ways, and the godown it counts is named once.
  // See the open item in §17 — confirm which side fn_svh_post reads.
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: false,                       // superseded by quantityMode — §3.3
  quantityMode: 'COUNT',                 // NEW — §3.1
  defaultRateSource: 'AVG_COST',         // NEW — §3.3
  auditScreenName: 'Physical Stock Count',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};
```

**The type is never in the payload**, exactly as for the opening: the route pins
it, `@IsIn(['PHYSICAL'])` rejects anything else in the DTO, and even that value is
discarded in favour of the record above.

Routes resolve under the global `v1` versioning and auth guard as
`/api/v1/stock/physical…`.

---

## 3. What `StockVoucherService` must gain — six changes

Every one is gated on the rules record. The OPENING path must be unchanged; the
first test of this module is that `opening-stock-voucher` still behaves.

| # | Site | Today | Needed |
|---|---|---|---|
| 3.1 | `types/stock-voucher.types.ts` | `StockVoucherTypeRules` | `quantityMode`, `defaultRateSource`, `allowsRepeatHolding` |
| 3.2 | `assertPayloadRules` ~line 274 | refuses `qty === 0 && freeQty === 0` | under COUNT that refuses **every** line — replace with a counted-qty rule |
| 3.3 | `assertPayloadRules` ~line 297 | `rules.isInward && costRate === 0 && !rateSource` | per-line and signed: only an **overage** needs a rate, and the shortage rate is the engine's |
| 3.4 | `replaceLines` ~line 569 | writes `sviQty` from the payload, `sviLotId: null` | under COUNT: quantities 0, `bookQty` server-read, `countedQty` from payload, **`sviLotId` written** |
| 3.5 | `validate` ~line 950 | two OPENING-only problem branches | parameterise them; add the three PHYSICAL ones |
| 3.6 | `post` ~line 1038 | fine as written | only the message wording — 0 rows is a success |

### 3.1 The rules record

```ts
export type StockQuantityMode = 'QTY' | 'COUNT';

export interface StockVoucherTypeRules {
  // … existing fields …
  /**
   * QTY   — the line states a quantity to move (OPENING, RECEIPT, ISSUE …).
   * COUNT — the line states what was FOUND. svi_qty stays 0 for the whole
   *         document and svi_diff_qty, generated from counted − book, is what
   *         reaches the ledger. Only PHYSICAL is COUNT today.
   */
  quantityMode: StockQuantityMode;
  /** Applied when the header names none. AVG_COST for a count — §3.3. */
  defaultRateSource?: StockRateSource;
  /**
   * OPENING guards one opening per holding per year. A holding may be COUNTED
   * any number of times, so the preflight's already-opened branch must be off.
   */
  allowsRepeatHolding?: boolean;
}
```

Default `quantityMode: 'QTY'` is not available on a required field, and should not
be — make it required and add `quantityMode: 'QTY'` to `OPENING_RULES` in the same
commit, so the next five screens have to decide rather than inherit.

### 3.2 The zero-quantity refusal

Today, verbatim:

```ts
} else if (qty === 0 && freeQty === 0) {
  errors.push({ field, message: `Line ${line.lineNo} has no quantity.` });
}
```

A count sends `qty: 0` on **every line, always**. Unchanged, this refuses the
whole document at save with one error per line. Under COUNT the rule inverts:

- `qty`, `freeQty` must be **absent or 0** — a payload that sends a quantity on a
  count line is a client that thinks it is writing an adjustment. Refuse it, do
  not silently zero it.
- `countedQty` must be **present and >= 0**. Absent is not "0 found", it is *not
  counted yet* — and posting an uncounted line as a total shortage is the single
  most expensive mistake this screen can make. Absent → 422 naming the line.
- `bookQty` in the payload → refuse. §1 rule 2.

The magnitude rule still holds for what the operator types: `countedQty` is a
count, so it cannot be negative. Only the derived `svi_diff_qty` is signed.

### 3.3 The cost rule, per line and signed

Today the check is one flag for the whole document — right for an opening, which
is inward on every line. A count is both at once, and the two directions get
their rate from two different places:

| Direction | Line | Where the rate comes from |
|---|---|---|
| overage (`diff > 0`) | SUGAR +3 @ 42.00 | `svh_rate_source` in `fn_svh_post` |
| shortage (`diff < 0`) | SALT −2 @ 20.00 | left at 0 on purpose; the BEFORE trigger `fn_sml_cost_default` stamps it from the item's valuation policy |

So: **a shortage is valued at what it cost us, by policy, never by the counter**,
and the service must not put a rate on it. Only lines with `counted > book` are
subject to the inward-cost rule, and even those are satisfied by the header's
rate source.

**`svh_rate_source` defaults to `AVG_COST` for a count.** Found stock is worth
what the rest of that item is worth. `MANUAL` — the right default for an opening
— makes the engine refuse the document:

```
ERROR:  line 3/1 of voucher PHY/2026-2027/TILL-01/1 is an inward with no cost
        rate; set one or set svh_rate_source
```

The schema will not guess, because guessing zero drags the item's moving average
toward zero for every future sale. Apply `rules.defaultRateSource` in
`createDraft`/`updateDraft` when `header.rateSource` is absent — not in the DTO
default, so the stored document says out loud what it was valued at.

### 3.4 `replaceLines` — the three writes that differ

Under `quantityMode === 'COUNT'`:

```ts
sviQty:          new Prisma.Decimal(0),
sviBaseQty:      new Prisma.Decimal(0),
sviFreeQty:      new Prisma.Decimal(0),
sviFreeBaseQty:  new Prisma.Decimal(0),
sviCostRate:     new Prisma.Decimal(0),   // §3.3 — the engine decides both ways
sviBookQty:      new Prisma.Decimal(bookQty),      // read from stock_balance
sviCountedQty:   new Prisma.Decimal(line.countedQty),
sviLotId:        line.lotId,              // SEE BELOW
sviReasonId:     line.reasonId ?? null,
// sviDiffQty absent — GENERATED
```

**`sviLotId` is written on save.** This is the one place a count breaks the
opening's iron rule, and it is not an exception, it is the definition: *the lot is
where the book figure came from.* A count line is generated from a
`stock_balance` row, which is keyed by `sbl_lot_id`; `fn_svh_post` uses it as
given and never calls `fn_slt_resolve` for these lines. An opening line has no lot
because the holding does not exist yet; a count line cannot have any lot but this
one.

Guard it, in the same transaction that writes it: every `lotId` must come back
from a `stock_balance` row for this **company + branch + godown + item + bucket**,
and `bookQty` is read from that same row — the client tells the server which
holding, never how much was in it. One query, `sbl_lot_id IN (…)`, not one per
line. A `lotId` with no matching balance row → 422 *"this holding no longer
exists — regenerate the count sheet"*, which is also what happens when someone
sells the last of a lot mid-count.

`svi_uom_id` / `svi_base_uom_id` / `svi_to_base_factor` come from the balance row's
`sbl_base_uom_id` with factor 1: a count is taken in the base unit, because the
book figure is in the base unit. `resolveConversions` still validates that the
unit belongs to the item — leave that path alone.

### 3.5 The preflight

Two branches in the Q3 CASE are OPENING-only and must be gated on the rules:

```sql
WHEN keyed.svi_qty = 0 AND keyed.svi_free_qty = 0
  THEN 'this line has no quantity'          -- fires on EVERY count line
…
WHEN opened.already_opened
  THEN 'this holding already has an opening in this year'   -- a holding may be
                                                            -- counted any number
                                                            -- of times
```

Gate both on `${rules.quantityMode === 'QTY'}` / `${!rules.allowsRepeatHolding}`
the same way `${rules.isInward}` is already parameterised into that query, and
skip the whole `opened` CTE for a count — it is the expensive half.

Three PHYSICAL branches replace them:

```sql
WHEN keyed.svi_counted_qty IS NULL
  THEN 'this line has not been counted yet'
WHEN keyed.svi_book_qty IS DISTINCT FROM COALESCE(bal.sbl_on_hand_qty, 0)
  THEN 'the book quantity has changed since this sheet was generated'
WHEN keyed.svi_diff_qty > 0 AND keyed.svh_rate_source IS NULL
  THEN 'this line found stock and the document names no rate source'
WHEN keyed.svi_diff_qty > 0 AND keyed.svh_rate_source = 'AVG_COST'
                            AND sic.sic_avg_cost_rate IS NULL
  THEN 'the rate source is AVG_COST and this item has no average cost yet'
```

The batch/expiry/MRP/serial-tracking branches stay and cost nothing: a generated
sheet satisfies them by construction, and they are the check that the sheet was
not hand-edited.

The **drift check** is the one worth the join. It is the count's version of the
opening's "already opened": a sheet generated at 18:00 and posted at 23:00 has a
book figure that may no longer be true, and the difference posted is then the
difference between two moments rather than a variance. With the freeze on
(§11) it should never fire; it is what tells you the freeze is not working.

### 3.6 Post — zero rows is a success

`post()` needs no structural change. Only the wording: a count where every line
agrees returns **0** from `fn_svh_post` and still closes POSTED, and the
controller message must not read like a failure.

```
'Physical stock count posted — 2 of 3 lines had a variance'
```

not `'— 0 ledger rows'`. `rowsPosted` stays in the payload as the honest number.
Note that this makes PHYSICAL the only type where the §12 error table's
`23514 check_violation` ("voucher has no lines") is the *only* empty-document
refusal — an empty *ledger* is fine.

---

## 4. `GET /api/v1/stock/physical/count-sheet` — the sheet is generated, not typed

```
?companyId=&branchId=&accYear=&godownId=[&bucket=][&itemGroupId=][&limit=&offset=]
```

The grain is `stock_balance`'s own: **one line per godown × lot × bucket**, not per
item. Two batches of MILK are two lines to count, because they are two holdings.

```sql
SELECT b.sbl_item_id, itm.item_code, itm.item_name_en,
       b.sbl_lot_id, b.sbl_godown_id, b.sbl_bucket,
       b.sbl_base_uom_id, unt.unit_name,
       b.sbl_batch_no, b.sbl_expiry_date, b.sbl_mrp, b.sbl_sale_price,
       b.sbl_supplier_id,
       b.sbl_on_hand_qty AS book_qty,
       b.sbl_avg_cost_rate, b.sbl_stock_value
  FROM stock.stock_balance b
  JOIN inventory.item_master itm ON itm.item_id = b.sbl_item_id
  LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = b.sbl_base_uom_id
  LEFT JOIN inventory.item_unit_master unt     ON unt.unit_id = iuc.iuc_unit_id
 WHERE b.sbl_company_id = ${companyId}::uuid
   AND b.sbl_branch_id  = ${branchId}::uuid
   AND b.sbl_godown_id  = ${godownId}::uuid
   AND b.sbl_is_deleted = false
 ORDER BY itm.item_name_en, b.sbl_batch_no NULLS FIRST, b.sbl_expiry_date
```

Returns `lineNo` assigned server-side in that order, `splitNo` 1, `countedQty`
null. The screen fills one column.

Four things to be explicit about:

- **It is a read, not a document.** It creates nothing. The sheet becomes a
  document at the first save (§5), and the operator can print it and walk the
  aisles before any row exists.
- **It is paged**, like the opening's two reports — a main warehouse is tens of
  thousands of holdings. Default 200, max 1000. A count of a whole warehouse is
  many sheets by design, which is also how counts are actually run.
- **Zero-quantity holdings are included by default** (`sbl_on_hand_qty = 0` with a
  live lot). A holding the book says is empty is exactly where a count finds
  something. Offer `?includeZero=false` for the operator who does not want them.
- **An item with no balance row is not on the sheet, and must not be added to
  it.** No book quantity means no variance. Finding it on the shelf is an
  `ADJUSTMENT` — which is a different screen, and one that does not exist yet
  (§17). Say so in the API description, or the first field question will be "how
  do I add a line".

---

## 5. `POST /api/v1/stock/physical` — save a draft

Create when `header.svhId` is absent, update when present; update is a full
replace of the lines, as for the opening.

### 5.1 Payload

```ts
{
  header: {
    svhId?, accYear, companyId, branchId, tenantId?,
    deviceId, sessionId?,
    slno?, refno?, usrRefno?,
    docDate,
    toGodownId,                     // the godown being counted — §17 open item
    rateSource?,                    // defaults AVG_COST — §3.3
    reasonId?,                      // §5.3
    freezeStock?, freezeFrom?, freezeTo?,   // §11
    remarks?, userId
  },
  lines: [{
    lineNo, splitNo?,
    itemId, godownId, bucket?,
    lotId,                          // from the count sheet — REQUIRED — §3.4
    countedQty,                     // the one number typed
    reasonId?, remarks?
  }]
}
```

Absent by design, and rejected if sent: `qty`, `freeQty`, `costRate`,
`costRateWot`, `bookQty`, `diffQty`, `uomId`, `baseUomId`, `batchNo`, `mrp`,
`expiryDate`, `serialNo`, `supplierId`. All of them are properties of the holding
the line already names by `lotId`, and the server reads them from
`stock_balance` / `stock_lot`. A count sheet with a client-supplied batch number
is a count sheet that can be pointed at the wrong lot.

That makes `SavePhysicalStockVoucherItemDto` a **narrower** DTO than the shared
one, not an extension of it. Write it standalone and map to
`SaveStockVoucherItemDto` in the controller, or the Swagger page shows eleven
fields the API refuses.

### 5.2 What the service reads rather than trusts

| Column | Source |
|---|---|
| `svi_book_qty` | `stock_balance.sbl_on_hand_qty` for the named lot, at save time |
| `svi_uom_id` / `svi_base_uom_id` | `sbl_base_uom_id`, factor 1 |
| `svi_batch_no` / `_expiry_date` / `_mrp` / `_sale_price` / `_serial_no` / `_supplier_id` | copied from the balance/lot row, so the printed sheet and the document agree |
| `svi_qty` / `_base_qty` / `_free_qty` / `_free_base_qty` / `_cost_rate` | 0 (§3.4) |
| `svi_diff_qty` | never — GENERATED |
| totals | never |

### 5.3 The reason

`svh_reason_id` is worth setting on the header: every variance line inherits it,
so a whole count is explained by *"Shrinkage"* without touching a line, and
`sml_reason_id` came back `t` on both ledger rows in the captured run. A per-line
`sviReasonId` overrides it for the one pallet that was damaged rather than
shrunk.

Validate the reason against `stock_reason_master`'s applicable-txn-type array —
the seed scopes rows to `PHYSICAL_PLUS` / `PHYSICAL_MINUS`, and a reason scoped to
`OPENING` on a count line is a report that will not group. The seed also marks
which reasons require a remark; honour that flag rather than inventing a second
rule in TypeScript.

### 5.4 Editing a posted count

Identical to the opening: `tr_svh_post_lock` / `tr_svi_post_lock` refuse every
edit once the status leaves DRAFT. `assertDraft` already turns that into a 409
naming the status. Cancel (§9) and print are the only things a posted count
accepts.

---

## 6. `GET /api/v1/stock/physical` — list and load

`?svhId=&accYear=` → one document; otherwise the list. Both go through the
existing `list()` / `getById()` — the voucher type is already a parameter of both.

Two additions to the shared queries and their payload types:

- lines gain `bookQty`, `countedQty`, `diffQty` (`toNullableNumber`, all three —
  they are NULL on every non-count line and NULL is the right answer there).
- the header gains `freezeStock`, `freezeFrom`, `freezeTo`, `reasonId`,
  `reasonName`.

**Header totals on a count mean the net variance**, after the §0.1 fix: qty +1 and
value 86.00 for the captured run, not the sum of anything on the screen. A DRAFT
count truthfully totals 0, because nothing has posted. Label the field on the
screen as *Net variance*, or do not show it — a column headed "Total" reading 1
under three lines totalling 236 counted units is worse than no column.

`lotId` is filled from the moment of save here, unlike an opening — so the screen
cannot use it as the "reached the ledger" tick. Use `svi_diff_qty <> 0` plus
`status = 'POSTED'` for that, or §12.

---

## 7. `GET /api/v1/stock/physical/validate` — the preflight

`?svhId=&accYear=` → the same `validate()`, with §3.5's branches. Return every
line, `problem` null on the clean ones, including the ones that agree — a line
with no variance is still a line that was counted, and the screen ticks it.

Called on demand and again immediately before Post. Advisory, as always: the
freeze makes the drift check unlikely, not impossible — a count sheet can be
generated before the freeze window opens.

---

## 8. `POST /api/v1/stock/physical/post`

`fn_svh_post(svhId, accYear, userId)` — one statement, no lock, no pre-update, as
§7 of the opening plan. What it does for a count, in order:

`fn_svh_txn_map` derives `sml_txn_type` and `sml_direction` from
`sign(svi_diff_qty)` → `PHYSICAL_PLUS` / `PHYSICAL_MINUS`, magnitude in `sml_qty`
→ the ledger rows are inserted, **keeping the count sheet's own line numbers**
(the captured run wrote rows 2 and 3; line 1 is missing, deliberately, so a
variance row can be pointed back at the line it came from) → `tr_sml_apply`
maintains `stock_balance`, `slt_total_on_hand` and `stock_item_cost` →
`fn_sml_cost_default` has already stamped the shortage rate → the resolved rates
are written back to the lines → `fn_svh_recompute` → POSTED.

Three assertions worth making in the response, not just the tests:

- **the average must not move.** Shortage relieved at the average
  (2400 − 40 = 2360 over 118 = 20.000000), overage added at it
  (2520 + 126 = 2646 over 63 = 42.000000). A count finds a *quantity* error, not
  a price error. Correcting a price is a different problem and one this engine
  cannot express yet (§17).
- **a line that agrees leaves no trace anywhere** — no ledger row, no balance
  row, no `sbl_last_out_date`, nothing. MILK was untouched in the captured run.
- **the evidence that MILK was counted lives on the document**, which is exactly
  why the sheet is kept after posting and why §1 rule 3 exists.

---

## 9. `POST /api/v1/stock/physical/cancel`

`fn_svh_cancel(...)` — reversal rows carrying the original `doc_date`, never a
delete. `reason` required by the API.

A cancelled count is a rarer and nastier thing than a cancelled opening: it
un-corrects a correction, so the book figure goes back to being the one the shelf
disagreed with. Two consequences for the screen:

- it can legitimately fail with 409 when the reversal would drive a holding
  negative under `stp_allow_negative = 'BLOCK'` — cancel an overage after the
  found stock has been sold and that is exactly what happens. The fix is another
  count or an ADJUSTMENT, not a retry.
- the correct answer to "the counter miscounted" is usually a **second count**,
  not a cancellation: a holding may be counted any number of times (§3.1), each
  posting its own variance from the then-current book figure, and the ledger keeps
  both for ever. Put that in the confirm dialog.

---

## 10. `DELETE /api/v1/stock/physical`

`?svhId=&accYear=` → soft delete, DRAFT only, lines in the same transaction.
POSTED → 409 pointing at cancel. Unchanged from the opening — but note it also
**lifts the freeze**, since the guard reads DRAFT sheets; a sheet abandoned with
its window still open otherwise blocks the godown until `freezeTo` passes.

---

## 11. The freeze

*A count that does not freeze the stock it is counting is counting a moving
target.* Three header columns only this voucher type uses:

```
svh_freeze_stock = true, svh_freeze_from = 2026-06-30 20:00,
                         svh_freeze_to   = 2026-06-30 23:00
```

- `ck_svh_freeze` refuses a freeze with no window, so the DTO must require both
  timestamps whenever `freezeStock` is true — as a 422, before the check fires.
- **Wall clock, not document date.** The window is `timestamptz`, and
  `tr_sml_freeze_guard` compares it to `now()`: a back-dated entry still changes
  today's shelf. Send real instants with an offset, not dates.
- The guard refuses movements **touching the counted godown only** — other
  godowns keep trading — and lets the count's own posting through. Posting or
  cancelling the sheet lifts it without waiting for `freezeTo`.
- A refused movement surfaces in *other* modules (sales, transfers), not this
  one. Their exception filters need the SQLSTATE the guard raises with, and a
  message that names the count blocking them. **Confirm the SQLSTATE against the
  deployed function** and add it to the shared map — a checkout that fails with
  an unexplained 500 during a stock count is the worst possible outcome of this
  feature.
- Default the window on the screen, do not make the operator type it: `now()` to
  `now() + 3h` is what the captured run used.

---

## 12. `GET /api/v1/stock/physical/variance` — the report

`?svhId=&accYear=` → the count as the ledger recorded it, which is not the same
document the screen holds:

```sql
SELECT sml.sml_line_no, itm.item_code, itm.item_name_en,
       sml.sml_batch_no, sml.sml_txn_type, sml.sml_direction,
       sml.sml_qty, sml.sml_signed_base_qty,
       sml.sml_cost_rate, sml.sml_cost_value,
       srm.srm_name AS reason_name
  FROM stock.stock_ledger sml
  JOIN inventory.item_master itm ON itm.item_id = sml.sml_item_id
  LEFT JOIN stock.stock_reason_master srm ON srm.srm_id = sml.sml_reason_id
 WHERE sml.sml_src_doc_id  = ${svhId}::uuid
   AND sml.sml_acc_year    = ${accYear}::bpchar
   AND sml.sml_is_deleted  = false
 ORDER BY sml.sml_line_no, sml.sml_split_no
```

Raw, no model (§1). This is the row set an auditor asks for, and it is the only
place the shortage's stamped cost and the overage's derived cost sit side by side.

Because the ledger is append-only, the opening figure and every later count
survive as separate rows for ever, so a branch-level version of this query —
`opened / counted / on-hand` per item, the shape of the opening plan's Q5 — is the
report that answers *"last year's count, explain it"*. Same paging rules.

---

## 13. Errors

The shared filter and its `meta.code` switch cover this module unchanged — **the
trap is still that every RAISE inside a function reaches Prisma as `P2010`**, with
the real SQLSTATE in `error.meta.code`.

Three additions to the map or its messages:

| Raised for | SQLSTATE | HTTP |
|---|---|---|
| an overage line with no rate source | `23514` | **422** — and the message the engine gives already names the line: *"line 3/1 … is an inward with no cost rate"* |
| a freeze-guard refusal, seen from **another** module | confirm (§11) | **409**, naming the count |
| `lotId` with no matching `stock_balance` row (ours, §3.4) | — | **422** *"regenerate the count sheet"* |

`23505 unique_violation` keeps its refno/slno meaning here but loses the
already-opened one — there is no holding-level uniqueness for a count.

---

## 14. Wiring

- `PhysicalStockVoucherModule` imports `StockVoucherModule`; it is the second
  consumer of the exported service and the first proof that exporting it was
  right.
- Add to `src/app.module.ts` imports, next to `OpeningStockVoucherModule`
  (~line 201). Nothing comes out — §0.2.
- `@ApiTags('Physical Stock')`; check `https://192.168.0.106:3011/api/docs`.
- **No `@CacheTTL` anywhere.** A cached count sheet is a book figure from before
  the last sale.
- Imports nothing from `~/physical-stock/` (§0.2).

---

## 15. Tests

Unit, mirroring the existing specs:

- **the OPENING path is unchanged** — run the existing
  `opening-stock-voucher` specs first, and add one asserting `OPENING_RULES`
  still refuses a zero-quantity line after §3.2 lands.
- a count line carrying `qty`, `bookQty` or `diffQty` → 400/422, per §3.2.
- `countedQty` absent → 422 naming the line; `countedQty: 0` → accepted, and
  produces a full shortage.
- `bookQty` stored is the one from `stock_balance`, not the one sent: send a
  deliberately wrong figure and assert the row.
- `lotId` not in this godown's balance → 422.
- `sviDiffQty` never appears in a `create`/`update` payload.
- `rateSource` absent → stored as `AVG_COST`.
- `freezeStock: true` with no window → 422 before the check constraint.
- the SQLSTATE map, driven off `meta.code`.

Integration — **run `19_physical_stock_flow.md` end to end** on a throwaway PG 18
cluster with the §0.1 fixes in, starting from the state the opening flow leaves:

> MILK 55 @ 28.00 batch B-2604 · SALT 120 @ 20.00 · SUGAR 60 @ 42.00.
>
> Sheet of 3 lines counted MILK 55, SALT 118, SUGAR 63 → `diff` 0, −2, +3.
> After save: 1 voucher + 3 lines, `svi_qty` / `svi_base_qty` / `svi_cost_rate`
> **0 on all three**, ledger/balance untouched.
>
> Post with `rateSource = MANUAL` → **422**, naming line 3.
> Post with `AVG_COST` → returns **2**.
>
> Ledger: 2 rows, line numbers **2 and 3**; SALT `PHYSICAL_MINUS` dir −1 qty
> **2** (magnitude, not −2) rate 20.00 value 40.00; SUGAR `PHYSICAL_PLUS` dir +1
> qty 3 rate 42.00 value 126.00; `sml_reason_id` set on both.
> Balance: SALT on-hand **118** value **2360.00** `last_out_date` 2026-06-30;
> SUGAR **63** / **2646.00**; **MILK untouched — no row, no timestamp**.
> `stock_item_cost`: SALT avg **20.000000**, SUGAR **42.000000** — *neither
> moved*.
> `stock_lot.slt_total_on_hand`: 118 / 63 / 55.
> Document POSTED, `line_count` 3, header totals qty **+1** value **86.00**
> (post-fix; 0 / 0.00 pre-fix — assert whichever §0.1 verified).
> Line 2 shows cost **20.00** written back (post-fix; 0.00 pre-fix).
>
> `SELECT stock.fn_sbl_rebuild(...)` → **0 holdings differed**.
>
> Line 1: 0 ledger rows, and still on the document.

Negative assertions, each refusing cleanly:

1. post twice → 409 "is POSTED".
2. a **second** count of the same holding → **succeeds** (this is the assertion
   that catches §3.5's gating regressing).
3. edit a line after post → 409.
4. an overage with `rateSource` unset → 422.
5. a movement into the counted godown while the freeze window is open → refused;
   the same movement into another godown → allowed; the count's own post →
   allowed; after posting, the first movement → allowed.
6. a count where every line agrees → posts, returns **0**, status POSTED, zero
   ledger rows, and `fn_sbl_rebuild` still 0.

> `fn_sbl_rebuild` re-derives **quantities only** — it never recomputes
> `sbl_stock_value`, `sbl_avg_cost_rate` or `stock_item_cost`, so it can return 0
> while a valuation is wrong. The average-unchanged assertion above is the
> value-side check, and there is no engine-side equivalent.

---

## 16. Opening versus physical, at the API

| | `/stock/opening` | `/stock/physical` |
|---|---|---|
| starting point | an empty branch | a populated one |
| the grid | typed by the operator | **generated** — `GET …/count-sheet` |
| operator types | item, qty, cost, batch… | **one number per line** — the count |
| `svi_qty` | the quantity | **0** for the whole document |
| what posts | `svi_qty` | `abs(svi_diff_qty)` |
| `svi_lot_id` at draft | NULL — resolved at post | **written on save** — it came from the balance |
| lines → ledger rows | 1 : 1 | 1 : 1 **or 1 : 0** when the count agrees |
| direction | always +1 | +1 and −1 in the same document |
| txn type | `OPENING` | `PHYSICAL_PLUS` / `PHYSICAL_MINUS` |
| cost | from the line, or `svh_rate_source` | overage: `svh_rate_source`; shortage: `fn_sml_cost_default` |
| default `rateSource` | `MANUAL` | **`AVG_COST`** |
| effect on the average | sets it | **leaves it alone** |
| can post zero rows | no — raises | **yes**, and still closes POSTED |
| header totals | the document's totals | the **net variance**, read from the ledger |
| freeze | none | `svh_freeze_stock` + window, enforced |
| guard | one opening per holding per year | none — count as often as you like |

---

## Open items to close with the DB owner / client

1. **Which godown column does `fn_svh_post` read for a PHYSICAL?** The flow doc's
   header capture does not show one, and `ck_svh_godowns` is satisfied by either
   side. §2 assumes `svh_to_godown_id` = the counted godown. Confirm against the
   deployed function before the DTO is frozen — every line's `svi_godown_id` must
   equal it either way, and the service should enforce that.
2. **The freeze guard's SQLSTATE and message (§11).** Needed by *other* modules'
   exception filters, not this one. Until it is known, a blocked sale during a
   count is an unexplained 500.
3. **The §0.1 build.** Which of the two 2026-09-04 fixes are actually deployed
   decides whether §15 asserts the pre- or post-fix figures, and whether the
   screen shows header totals at all.
4. **ADJUSTMENT is the missing neighbour.** Stock found for an item with no
   balance row cannot be a count line (§4), and there is no adjustment screen yet.
   Until there is, the honest answer on the count screen is "this item is not in
   this godown's book — raise it as a receipt", and users will not like it.
5. **Re-count workflow.** Confirm the client wants a second count rather than a
   cancel (§9), and whether a count sheet should be regenerable in place — today
   a re-save replaces the lines wholesale and silently refreshes `svi_book_qty`,
   which is right for a sheet being filled in and wrong for one being re-counted
   after a partial post.
6. **Revaluation remains a gap.** A count corrects quantity and deliberately does
   not touch the average; an item carried at the wrong cost cannot be fixed by
   counting it, and the engine has no REVALUE. Say so before someone tries.
