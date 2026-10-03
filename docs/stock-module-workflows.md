# Stock Modules — Workflows

Seven modules under [src/modules/stocks/](src/modules/stocks/). One of them,
`stock-voucher`, owns the document engine; four are screens that configure it with a
rule record; two are policy/pricing side-cars.

Routes below omit the URI version segment — NestJS is configured with
`VersioningType.URI` in [main.ts:197](src/main.ts#L197), so a real path is
`/{prefix}/v1/stock/opening`.

---

## 1. Composition — who owns what

```mermaid
graph TD
    subgraph screens["Screen modules (controllers)"]
        OPN["opening-stock-voucher<br/><code>/stock/opening</code>"]
        PHY["physical-stock-voucher<br/><code>/stock/physical</code>"]
        TRF["stock-transfer<br/><code>/stock/transfer</code>"]
        TRI["stock-transfer/receive<br/><code>/stock/transfer/receive</code>"]
        SPB["selling-price-bulk<br/><code>/stock/price-bulk</code>"]
        PRE["stock-track-presets<br/><code>/stock-track-presets/get</code>"]
    end

    subgraph engine["Shared engine (no controller)"]
        SVS["StockVoucherService<br/>save · list · getById · validate<br/>post · cancel · softDelete<br/>importLines · countSheet · variance<br/>pendingItems · reconcile"]
        STS["StockTransferService<br/>despatch · inbound · prefill<br/>saveReceive · receive"]
        STP["StockTrackPolicyService<br/>syncFromItem · syncFromItemGroup"]
        GW["StockMrpPriceGateway<br/>(503 until stock.sql share deploys)"]
    end

    subgraph inv["Inventory modules"]
        ITM["items-master"]
        ITG["items-group-master"]
        IPM["items-price-master"]
    end

    subgraph db["PostgreSQL — schema stock.*"]
        FN1["fn_svh_post"]
        FN2["fn_svh_post_transfer"]
        FN3["fn_svh_receive_transfer"]
        FN4["fn_svh_cancel"]
        TBL[("stock_voucher / _item<br/>stock_ledger · stock_balance<br/>stock_lot · stock_transit<br/>stock_track_policy · stock_track_preset<br/>stock_mrp_price · stock_item_cost")]
    end

    OPN -->|OPENING_RULES| SVS
    PHY -->|PHYSICAL_RULES| SVS
    TRF -->|TRANSFER_OUT_RULES| STS
    TRI -->|TRANSFER_IN_RULES| STS
    STS --> SVS
    SPB --> GW
    SPB --> IPM
    ITM --> STP
    ITG --> STP
    STP -.reads.-> PRE

    SVS --> FN1
    STS --> FN2
    STS --> FN3
    SVS --> FN4
    FN1 --> TBL
    FN2 --> TBL
    FN3 --> TBL
    FN4 --> TBL
    STP --> TBL
    GW --> TBL
```

**The one idea the whole engine rests on:** the *route* pins the voucher type, never the
payload. Each controller holds a frozen `StockVoucherTypeRules` record
([stock-voucher.types.ts](src/modules/stocks/stock-voucher/types/stock-voucher.types.ts))
and hands it to the shared service on every call. The DTO rejects any `voucherType` but
its own, and even that value is discarded.

| Rule | OPENING | PHYSICAL | TRANSFER_OUT | TRANSFER_IN |
|---|---|---|---|---|
| `typeCode` | `OPN` | `PHY` | `TRF` | `TRI` |
| `quantityMode` | `QTY` | `COUNT` | `QTY` | `QTY` |
| `postFunction` | `fn_svh_post` | `fn_svh_post` | `fn_svh_post_transfer` | `fn_svh_receive_transfer` |
| `ledgerTxnTypes` | `OPENING` | `PHYSICAL_PLUS`, `PHYSICAL_MINUS` | transfer out | transfer in |
| `isInward` | true | false (both ways) | false | true |
| `allowsCount` | ✗ | ✓ | ✗ | ✗ |
| `allowsToBranch` | ✗ | ✗ | ✓ | ✗ |
| `requiresLot` | ✗ (engine resolves) | ✓ | ✓ | ✓ |
| `zeroesLineCost` | ✗ | ✓ | ✓ | ✓ |
| `allowsRepeatHolding` | ✗ (one per year) | ✓ | ✓ | ✓ |
| `defaultRateSource` | — (MANUAL) | `AVG_COST` | — | — |

---

## 2. Document lifecycle — the state machine every voucher shares

```mermaid
stateDiagram-v2
    [*] --> DRAFT: POST /stock/SCREEN (create, no header.svhId)
    DRAFT --> DRAFT: POST again with svhId<br/>FULL REPLACE of lines
    DRAFT --> DRAFT: POST /import (CSV)
    DRAFT --> deleted: DELETE — soft delete<br/>DRAFT only
    DRAFT --> POSTED: POST /post · /despatch<br/>same-branch or generic
    DRAFT --> IN_TRANSIT: POST /despatch<br/>inter-branch — writes stock_transit
    IN_TRANSIT --> RECEIVED: receipt posted and<br/>every transit row settled
    IN_TRANSIT --> IN_TRANSIT: short receipt —<br/>stays open on purpose (loss report)
    POSTED --> CANCELLED: POST /cancel<br/>fn_svh_cancel — reversal rows
    CANCELLED --> [*]
    RECEIVED --> [*]
    deleted --> [*]

    note right of POSTED
        A POSTED voucher is CANCELLED, never deleted.
        Soft-deleting it would hide the document while
        its ledger rows went on affecting stock for ever.
    end note
```

A cancellation writes **reversal rows carrying the original `doc_date` and `acc_year`**, so
an as-on-date report reads "this document never moved stock". It can legitimately fail
with 409 — reversing an opening after the stock was sold drives the holding negative and
`fn_sml_apply` refuses under `stp_allow_negative = 'BLOCK'`. The fix is an ADJUSTMENT, not
a retry.

---

## 3. Save — the shared pipeline (`StockVoucherService.save`)

```mermaid
flowchart TD
    A["POST /stock/&lt;screen&gt;<br/>{ header, lines }"] --> B["assertPayloadRules(rules, dto)"]
    B --> B1{"refuseTypes hit?<br/>godowns present?<br/>count columns allowed?<br/>lot / branch / qty rules"}
    B1 -->|violation| E422["422 — one error PER LINE,<br/>the whole grid at once"]
    B1 -->|clean| C["assertReasons — stock_reason_master"]
    C --> D{"quantityMode"}
    D -->|QTY| D1["resolveConversions<br/>item_unit_conversion<br/>+ assertUnitsBelongToItems"]
    D -->|COUNT| D2["skip — a count names no unit,<br/>base uom comes off stock_balance"]
    D1 --> T
    D2 --> T

    subgraph T["prisma.$transaction"]
        direction TB
        T1{"header.svhId?"}
        T1 -->|absent| T2["createDraft<br/>allocateStockVoucherNumber →<br/>slno + refno OPN/2026-2027/TILL-01/1"]
        T1 -->|present| T3["updateDraft — DRAFT check,<br/>header patch"]
        T2 --> T4
        T3 --> T4["replaceLines — hard DELETE + re-INSERT"]
        T4 --> T5{"COUNT?"}
        T5 -->|yes| T6["loadCountHoldings — server READS<br/>svi_book_qty, uom, batch, expiry, MRP,<br/>sale price, serial, supplier from stock_balance"]
        T5 -->|no| T7["apply conversions, zero cost if<br/>rules.zeroesLineCost"]
    end

    T --> R["getById — reload<br/>(trigger tr_svi_refresh_header<br/>re-summed the header counters)"]
    R --> OUT["200/201 · StockVoucherPayload"]
```

Two things the service will never let the client do: **write header totals**
(`svh_line_count`, `svh_total_qty`, `svh_total_value` are re-summed by
`tr_svi_refresh_header` and again by `fn_svh_recompute` at post — Prisma *can* write them,
which is the danger), and **merge lines by line number** (update is a full replace; merging
over a grid the user inserts into the middle of is where line numbers drift from the rows
they name).

---

## 4. Post — preflight, then one statement

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Ctl as Screen controller
    participant Svc as StockVoucherService
    participant PG as PostgreSQL
    participant F as StockVoucherExceptionFilter

    C->>Ctl: GET /validate?svhId (optional, advisory)
    Ctl->>Svc: validate(rules, …)
    Svc->>PG: Q3 — per-line CTE:<br/>doc → line → policy (most-specific-first)<br/>→ lot / balance / cost checks
    PG-->>Svc: one row per line, problem null = clean
    Svc-->>C: 200 — "3 of 40 lines have problems"

    C->>Ctl: POST /post
    Ctl->>Svc: post(rules, svhId, …)
    Svc->>Svc: loadHeaderOrThrow + assertDraft
    Svc->>PG: validate() AGAIN — refuse without calling the engine
    alt any line has a problem
        Svc-->>C: 422 with every bad line named
    else clean
        Svc->>PG: BEGIN
        Svc->>PG: SELECT rules.postFunction(svhId, accYear, actor)
        Note over Svc,PG: name comes from the RULE RECORD via Prisma.raw,<br/>guarded by assertPostFunction against the 3 known names
        PG->>PG: fn_slt_resolve → lot identity<br/>fn_sml_cost_default → cost<br/>fn_sml_apply → stock_ledger + stock_balance<br/>fn_svh_recompute → header totals
        opt afterPost hook (transfer only)
            Svc->>PG: UPDATE stock_transit SET lr_no, vehicle_no, expected_on
        end
        Svc->>PG: COMMIT
        Svc->>PG: getById — reload (post filled lotId, costRateWot, totals)
        Svc->>Svc: auditLogService.logEntityChange
        Svc-->>C: 200 · { …document, rowsPosted, status, postedOn }
    end

    Note over PG,F: any RAISE inside the engine surfaces as a Prisma raw-query error
    PG-->>F: SQLSTATE
    F-->>C: mapped HTTP status (see §9)
```

`validate` runs **twice** on purpose: once as the advisory preflight the screen calls, and
again inside `post` — because `fn_svh_post` raises on the *first* bad line and rolls the
whole document back, which is right for the database and useless as a screen message.

---

## 5. Opening stock — the go-live workflow

```mermaid
flowchart TD
    S(["Go-live day"]) --> P["GET /stock/opening/pending-items<br/>every stockable item with no opening<br/>movement in this branch + year"]
    P --> W{"How is the data coming in?"}
    W -->|typed| K["POST /stock/opening<br/>create DRAFT"]
    W -->|spreadsheet| I1["POST /stock/opening<br/>create the EMPTY draft first"]
    I1 --> I2["POST /stock/opening/import<br/>multipart CSV, ≤ 5 MB"]
    I2 --> I3["resolve item_code → itemId,<br/>unit name → uomId server-side"]
    I3 --> I4{"ambiguous or unknown?"}
    I4 -->|yes| I5["422 — every bad row at once.<br/>NEVER guessed, never posts,<br/>never creates the document"]
    I4 -->|no| K
    K --> V["GET /stock/opening/validate"]
    V --> V1{"problems?"}
    V1 -->|yes| K
    V1 -->|no| PO["POST /stock/opening/post<br/>stock.fn_svh_post"]
    PO --> PO1{"engine verdict"}
    PO1 -->|"23505 — holding already opened this year"| X409["409 · a holding opened twice is<br/>a branch that starts with twice its stock"]
    PO1 -->|"23514 — inward with no cost rate"| X422["422 · an opening defaults to<br/>rateSource MANUAL, stock_item_cost is empty<br/>on day one, so the rate must be typed"]
    PO1 -->|ok| POSTED(["POSTED — ledger rows written"])
    POSTED --> RC["GET /stock/opening/reconcile<br/>opened vs held now vs difference<br/>(opening figure read from the LEDGER,<br/>so a cancelled opening reads zero)"]
    POSTED --> CN["POST /stock/opening/cancel<br/>reason REQUIRED"]
```

`allowsRepeatHolding` is **off**: one opening per holding per year. `requiresLot` is off
too — `fn_slt_resolve` owns lot identity here, so the service refuses a client-supplied
`lotId`; otherwise two documents could open one holding under two lots.

---

## 6. Physical stock count — the COUNT quantity mode

```mermaid
flowchart TD
    CS["GET /stock/physical/count-sheet?godownId<br/>A READ, NOT A DOCUMENT — creates nothing"] --> CS1["one row per godown × lot × bucket<br/>off stock_balance, NOT per item"]
    CS1 --> NOTE["An item with NO balance row is not on<br/>the sheet and must not be added to it.<br/>Found on the shelf ⇒ ADJUSTMENT, another screen."]
    CS1 --> PRINT["print · walk the shelves · fill one number"]
    PRINT --> SV["POST /stock/physical<br/>rows back with lotId VERBATIM<br/>+ countedQty<br/>(freezeStock window optional)"]
    SV --> SV1["loadCountHoldings — the server READS rather<br/>than trusts: svi_book_qty, uom, batch, expiry,<br/>MRP, sale price, serial, supplier from stock_balance"]
    SV1 --> SV2{"lotId has a live balance row<br/>in this godown?"}
    SV2 -->|no| SVX["422 — regenerate the sheet"]
    SV2 -->|yes| DR(["DRAFT<br/>svi_qty = 0, svi_cost_rate = 0<br/>svi_diff_qty GENERATED = counted − book"])
    DR --> VA["GET /stock/physical/validate<br/>every line returned, incl. agreements.<br/>Drift check: 'book qty changed since<br/>the sheet was generated' — should never<br/>fire with the freeze on"]
    VA --> PO["POST /stock/physical/post — fn_svh_post"]
    PO --> SPLIT{"per line: svi_diff_qty"}
    SPLIT -->|"> 0 overage"| OV["PHYSICAL_PLUS<br/>valued at AVG_COST (defaultRateSource)"]
    SPLIT -->|"< 0 shortage"| SH["PHYSICAL_MINUS<br/>relieved at the stamped policy cost<br/>via fn_sml_cost_default — never by the counter"]
    SPLIT -->|"= 0 agrees"| AG["no ledger row"]
    OV --> DONE(["POSTED"])
    SH --> DONE
    AG --> DONE
    DONE --> Z["ZERO LEDGER ROWS IS A SUCCESS —<br/>the message counts lines that VARIED,<br/>not a failure count"]
    DONE --> VR["GET /stock/physical/variance<br/>the count as the LEDGER recorded it:<br/>only lines that varied, keeping the<br/>sheet's own line numbers"]
    DONE --> RE["Miscounted? A SECOND COUNT, not a cancel —<br/>a holding may be counted any number of times"]
```

Four rules invert here relative to an opening, and each one the OPENING satisfied only by
accident: `quantityMode: 'COUNT'` (the line states what was *found*, so a
"every line must have a quantity" rule would refuse a count outright, once per line);
`defaultRateSource: AVG_COST` (MANUAL would make the engine refuse every overage line);
`allowsRepeatHolding: true`; and **two** `ledgerTxnTypes` in one document.

`DELETE /stock/physical` on a draft also **lifts the freeze** — the guard reads DRAFT
sheets, so an abandoned sheet would otherwise block the godown until `freezeTo` passed.

---

## 7. Stock transfer — one despatch endpoint, two shapes

```mermaid
flowchart TD
    A["POST /stock/transfer — DRAFT<br/>lines carry lotId (requiresLot),<br/>cost rate is STRIPPED (zeroesLineCost)"] --> A1["assertTransferOutRules<br/>+ assertLotsAndStock — the lots exist<br/>and the from-godown actually holds them"]
    A1 --> V["GET /stock/transfer/validate"]
    V --> D["POST /stock/transfer/despatch<br/>{ lrNo, vehicleNo, expectedOn }"]
    D --> ENG["stock.fn_svh_post_transfer<br/>+ afterPost hook writes the lorry columns<br/>INSIDE the post's transaction"]
    ENG --> Q{"svh_to_branch_id"}

    Q -->|"null / same branch"| SB["sameBranch: true<br/>2 ledger rows per line, 0 transit rows"]
    SB --> SBP(["POSTED — done in one step"])
    SBP --> SBC["POST /stock/transfer/cancel<br/>same-branch only"]

    Q -->|"another branch"| IB["sameBranch: false<br/>1 OUT ledger row per line<br/>+ stock_transit rows"]
    IB --> IBP(["IN_TRANSIT — a lorry left"])

    IBP --> R1["receiver: GET /receive/inbound<br/>the worklist — what is on its way to me"]
    R1 --> R2["GET /receive/prefill?svhId<br/>opens at the REMAINDER:<br/>remainingQty = sent − received − damage"]
    R2 --> R3["POST /stock/transfer/receive<br/>DRAFT TRANSFER_IN, linkSrcDocId = the OUT<br/>(ck_svh_transfer_in_link + the engine<br/>both check module and doc type)"]
    R3 --> R4["assertReceiveLines — cannot receive<br/>more than remains on the transit row"]
    R4 --> R5["POST /stock/transfer/receive/post<br/>stock.fn_svh_receive_transfer"]
    R5 --> R6["settles stock_transit,<br/>destination keeps the SAME slt_id<br/>so ageing does not reset"]
    R6 --> R7{"any transit row with<br/>remainingQty &gt; 0?"}
    R7 -->|no| CL(["OUT flips to RECEIVED — closed"])
    R7 -->|"yes — short"| OPEN(["OUT stays IN_TRANSIT<br/>on purpose: stt_short_qty is<br/>the loss report"])
```

Three details worth keeping:

- **The despatch response reads `sameBranch` off the *document*, not the request** — the
  engine decided it. One endpoint, two shapes, and the screen cannot know how to finish
  until it is told.
- **`stt_lr_no` / `stt_vehicle_no` / `stt_expected_on` are written by the API**, not the
  engine, and inside the post's own transaction via the narrow `afterPost` hook. A second
  transaction could commit a despatch and then fail to record the lorry — a despatch note
  with no vehicle number, and no way to tell afterwards whether it was never sent or lost
  on the way.
- **The line's cost rate is stripped, not merely discouraged.** A nonzero `svi_cost_rate`
  makes `fn_sml_cost_default` bail (it only fills gaps) *and* the OUT insert omits the
  value columns — the row lands at that rate with **value 0**. Cost travels with the
  stock; nobody re-enters it.

---

## 8. Selling price bulk — Change Selling Price (menu 30)

```mermaid
flowchart TD
    L["GET /stock/price-bulk<br/>one row per item × uom × live bucket with stock"] --> L2["GET /stock/price-buckets/:itemId<br/>F12 — every live bucket of one item"]
    L2 --> S["POST /stock/price-bulk<br/>{ scope: BRANCH | CHAIN, rows[], confirmed? }"]
    S --> A["assertScopeAllowed — BEFORE anything reads or writes"]
    A --> B["resolveBelowCostPolicy →<br/>app setting inventory.below_cost_price<br/>restrict | warning (default) | allow"]
    B --> TX

    subgraph TX["prisma.$transaction — one commit"]
        direction TB
        T1["resolveItemTaxRates · loadMasterPriceRows · loadItemIdentities"]
        T1 --> T2{"per row: isHeadlineRow?"}
        T2 -->|"names a dimension (mrp/salePrice)"| BK["bucket row →<br/>resolveTargetScope(switch, rowScope, branchId)<br/>§5.5, a PURE FUNCTION"]
        T2 -->|"no dimension"| HD["headline row → item_price_master"]
        BK --> Q26["Step 1 — gateway.validateRows (Q26)"]
        HD --> HV["validateHeadlineRows"]
        Q26 --> VD{"verdicts"}
        HV --> VD
        VD -->|"ABOVE_MRP · BELOW_MIN"| AB["422 ALWAYS — confirmed never reaches here.<br/>smp_min_price is DATA, not a CHECK:<br/>this is its ONLY enforcement"]
        VD -->|BELOW_COST| BC{"policy × confirmed"}
        BC -->|restrict| AB2["422 ABORT"]
        BC -->|"warning + not confirmed"| CF["200 · needsConfirm: true, saved: 0<br/>nothing written — the user is being ASKED,<br/>so the transaction commits empty"]
        BC -->|"allow, or warning + confirmed"| OK
        VD -->|clean| OK["Steps 2–4"]
        OK --> W1["applyBucketPrice per row →<br/>S1 find · S2 UPDATE · S3 INSERT"]
        W1 --> W2["fanOutHeadlineRows →<br/>levels 1–4 map to columns a/b/c/d<br/>(ipm_profit_type = 'By User')"]
        W2 --> W3["gateway.listNoStock — priced but nothing on hand"]
        W3 --> W4["auditLogService.logEntityChange"]
    end

    TX --> OUT["200 · { saved, masterRowsSaved, noStock, problems }"]
```

`resolveTargetScope` is the module's actual logic, and it was the legacy 3.0 form's actual
bug: **every real defect in that screen was in which row an edit landed on, not in the
arithmetic.** The header radio is not a display filter — it decides what S1 looks for, and
therefore whether S2 updates or S3 inserts.

```mermaid
graph LR
    subgraph sw["§5.5 — the scope table"]
        R1["CHAIN + no row"] --> O1["INSERT chain row"]
        R2["CHAIN + CHAIN row"] --> O2["UPDATE chain row"]
        R3["CHAIN + BRANCH override"] --> O3["UPDATE the override —<br/>switchIgnored: true.<br/>Promoting it would silently rewrite<br/>every other branch's price"]
        R4["BRANCH + CHAIN row"] --> O4["INSERT a branch override.<br/>The chain row is left byte-identical,<br/>createsBranchOverride: true"]
        R5["BRANCH + BRANCH row"] --> O5["UPDATE the override"]
    end
```

Three statements sit behind `StockMrpPriceGateway` and answer **503** until the external
`stock.sql` share is deployed. A payload of headline-only rows never touches it and saves
end to end today.

---

## 9. Track presets → track policy (no controller of its own)

```mermaid
flowchart TD
    P["GET /stock-track-presets/get<br/>picker: company rows + shared (spt_company_id NULL) rows"] --> M["mergePresets — one preset per code,<br/>the company's row displaces the shared one.<br/>NOT an orderBy: PG's DESC is NULLS FIRST,<br/>which returns the shared row first"]
    M --> PICK["user picks → item_track_preset_id / itg_track_preset_id"]

    PICK --> IM["items-master create/update"]
    PICK --> IG["items-group-master create/update"]

    IM -->|"inside the caller's transaction"| SI["syncFromItem(item, tx)"]
    IG -->|"inside the caller's transaction"| SG["syncFromItemGroup(group, tx)"]

    SI --> SI1{"itemTrackPresetId set<br/>and visible to this company?"}
    SI1 -->|yes| SI2["preset supplies ALL 13 policy columns<br/>incl. sale price / serial / supplier /<br/>valuation / ageing basis — things no<br/>item_master column can express"]
    SI1 -->|no| SI3["fall back to the item's own flags:<br/>batchConfig · isBatchBased · isExpiryItem<br/>· expiryDays · allowNegStock"]
    SI2 --> SLOT
    SI3 --> SLOT

    SLOT{"a row already holds<br/>(company, branch, ITEM, scope_id)?"}
    SLOT -->|"yes, WITHOUT the DERIVED_FROM_ITEM remark"| SK(["skipped_manual — an ADMIN's policy<br/>always wins. Item flags are a starting<br/>point, not a standing override"])
    SLOT -->|"yes, derived"| UP(["updated / unchanged"])
    SLOT -->|"no — but a derived row exists<br/>under the item's OLD company/branch"| MV(["updated — RETARGETED, so an item never<br/>ends up with two competing policies"])
    SLOT -->|"no row anywhere"| CR(["created"])

    SG --> SG1{"itgTrackPresetId?"}
    SG1 -->|null| NP(["no_preset — NOTHING written.<br/>An all-false GROUP row would SHADOW<br/>the company-wide policy and quietly<br/>untrack every item in the group"])
    SG1 -->|"removed"| CLR(["cleared — the row it wrote is retired"])
    SG1 -->|set| CR2(["created / updated<br/>filed under the request context's company,<br/>stp_branch_id NULL"])
```

The resolver every engine query uses runs **most-specific-first**:

```mermaid
graph LR
    A["branch + ITEM"] --> B["branch + GROUP"] --> C["branch + COMPANY"] --> D["company + ITEM"] --> E["company + GROUP"] --> F["company + COMPANY"] --> G["no row at all —<br/>a COMPLETE answer:<br/>track nothing, WAVG, FEFO, ALLOW"]
```

It is also resolved against the **document's** `doc_date`, not today's — see the `policy`
CTE in `validate()`.

---

## 10. Error translation

Every stock controller wears `StockVoucherExceptionFilter` (selling-price has its own,
sharing the same table). A `RAISE` inside an engine function arrives as a Prisma raw-query
error carrying a SQLSTATE; the filter turns it into an HTTP status with a sentence a
shopkeeper can read, and **lets unrecognised failures fall through to the 500 path, stack
and all** — dressing one up as a clean 4xx teaches a client to retry for ever against a bug
it cannot fix.

```mermaid
flowchart LR
    E["engine RAISE"] --> S{"SQLSTATE"}
    S -->|P0002 no_data_found| N404["404 — voucher / year not found"]
    S -->|23001 restrict_violation| N409a["409 — deleted · not DRAFT · not POSTED"]
    S -->|23505 unique_violation| N409b["409 — holding already opened this year,<br/>refno / slno collision"]
    S -->|23P01 exclusion_violation| N409c["409 — another price already covers<br/>this bucket for this period (ex_smp_overlap).<br/>The row is well formed, the TABLE's state is not"]
    S -->|0A000 feature_not_supported| N409d["409 — TRANSFER_* / REPACK_* posted<br/>through the generic route"]
    S -->|23514 check_violation| CK{"message mentions<br/>negative stock?"}
    CK -->|yes| N409e["409 — fn_sml_apply refusing to drive a<br/>holding below zero under BLOCK. Correct<br/>behaviour, the fix is an ADJUSTMENT"]
    CK -->|no| N422a["422 — no quantity · inward with no<br/>cost rate · no lines"]
    S -->|23502 not_null_violation| N422b["422 — e.g. an OPENING with no to-godown"]
    S -->|23503 foreign_key_violation| N422c["422 — bad item / uom / godown / device"]
    S -->|anything else| N500["500 — untouched"]
```

---

## 11. Caching

**No `@CacheTTL` anywhere in the voucher controllers**, deliberately. Every read is a live
balance or a live document status: a cached preflight says a holding is free to open after
another till has opened it, and a cached count sheet is a book figure from before the last
sale.

---

## Route index

| Module | Method | Path | What it does |
|---|---|---|---|
| opening | POST | `/stock/opening` | create/update DRAFT (by `header.svhId`) |
| | GET | `/stock/opening` | list, or load one when `svhId` given |
| | GET | `/stock/opening/validate` | per-line preflight (advisory) |
| | POST | `/stock/opening/post` | `fn_svh_post` |
| | POST | `/stock/opening/cancel` | reversal rows; `reason` required |
| | DELETE | `/stock/opening` | soft delete, DRAFT only |
| | POST | `/stock/opening/import` | replace a DRAFT's lines from CSV (≤5 MB) |
| | GET | `/stock/opening/pending-items` | items with no opening movement |
| | GET | `/stock/opening/reconcile` | opened vs held now vs difference |
| physical | GET | `/stock/physical/count-sheet` | generate a sheet from `stock_balance` |
| | POST | `/stock/physical` | create/update DRAFT count |
| | GET | `/stock/physical` | list / load |
| | GET | `/stock/physical/validate` | per-line preflight incl. drift check |
| | POST | `/stock/physical/post` | `fn_svh_post` — PLUS and MINUS |
| | POST | `/stock/physical/cancel` | un-corrects a correction |
| | DELETE | `/stock/physical` | soft delete; also lifts the freeze |
| | GET | `/stock/physical/variance` | the count as the ledger recorded it |
| transfer | POST | `/stock/transfer` | create/update DRAFT TRANSFER_OUT |
| | GET | `/stock/transfer` | list, or load with transit rows |
| | GET | `/stock/transfer/validate` | per-line preflight |
| | POST | `/stock/transfer/despatch` | `fn_svh_post_transfer` + lorry columns |
| | POST | `/stock/transfer/cancel` | same-branch POSTED only |
| | DELETE | `/stock/transfer` | soft delete, DRAFT only |
| receive | GET | `/stock/transfer/receive/inbound` | what is on its way to me |
| | GET | `/stock/transfer/receive/prefill` | open a receipt at the remainder |
| | POST | `/stock/transfer/receive` | create/update DRAFT TRANSFER_IN |
| | POST | `/stock/transfer/receive/post` | `fn_svh_receive_transfer` |
| | DELETE | `/stock/transfer/receive` | soft delete, DRAFT only |
| price bulk | GET | `/stock/price-bulk` | the price grid |
| | GET | `/stock/price-buckets/:itemId` | F12 — every live bucket |
| | POST | `/stock/price-bulk` | save changed rows, one transaction |
| presets | GET | `/stock-track-presets/get` | picker, company rows over shared |
| track policy | — | *(no controller)* | called by items-master / items-group-master |
