# Sticker Printing (menu 32)

Plans: `Shared/Prathap/printing/sticker-printing/plan-sticker-printing-sp1-2026-11-25.md` (S-P1, §7) and
`plan-sticker-printing-sp2-2026-11-26.md` (S-P2 documents, §4 / §7).
Base route `/api/v1/stickers`. Rights: View on menu 32 for the reads, Print for the job writes
(`STICKER_RIGHT_VIEW` / `_PRINT`); Test print needs Print on Print Assignments 248
(`PRINT_ASSIGN_RIGHT_PRINT`). Nothing is cached. The Printed jobs list is grid 223 — no `/list`.

| Method | Route               | Right        | What                                                                            |
| ------ | ------------------- | ------------ | ------------------------------------------------------------------------------- |
| GET    | `/lines/from-items` | View         | Add items · F3: lines for the items a filter picks (ONE / TYPED / STOCK labels) |
| GET    | `/lines/from-doc`   | View         | S-P2 Load from a document · Ctrl+O: a posted bill / receipt's lines, labels = left |
| GET    | `/docs/state`       | View         | S-P2 a document's counts + state (pill, question after Post, cancel sentence)   |
| POST   | `/lines/resolve`    | View         | scan / type and every re-resolve; a bad line answers 200 with its `problem`     |
| GET    | `/lots`             | View         | lots with SALEABLE stock here, newest first                                     |
| POST   | `/preview`          | View         | one label of a line (PDF), nothing logged                                       |
| POST   | `/jobs/print`       | Print        | one design group (of one document, or manual) → a SENT job + PDF (`inspect`)    |
| POST   | `/jobs/status`      | Print        | the printing counter reports PRINTED / FAILED                                   |
| POST   | `/jobs/reprint`     | Print        | a REPRINT job of a printed job's lines, with a reason                           |
| POST   | `/jobs/resend`      | Print        | a failed job sent again (new PRINT job, no reason)                              |
| GET    | `/jobs/get`         | View         | one job: head, frozen lines with Reprinted, its reprints                        |
| POST   | `/test-print`       | Print on 248 | one test label in cell 1 of the design's page (PDF)                             |

## The pieces

- `sticker-lines.service.ts` — **the one line builder** (design JOB → ITEM → PURPOSE → NONE, unit,
  lot, barcode, MRP, Our price, cost / price code, Last printed). S-P2 calls `buildLines` with each
  document line's Def unit and lot.
- `sticker-doc-source.service.ts` — S-P2: one reader per document type (purchase bill, shortage
  receipt; S-P3 adds the Make's), the counts per document + item + lot, the per-document lock, and
  the two GET routes' work.
- `sticker-jobs.service.ts` — the routes' work: the §7.2 refusal order, freezing what the builder
  resolved (never a figure the client sent), numbering per counter (`D8-000127`, MAX + 1 under an
  advisory lock, restarting each financial year), rendering inside the job's transaction (a failed
  render leaves no job), `txn_status_log` steps (LABEL_JOB: SENT, then PRINTED / PRINT_FAILED).
- `sticker-label-row.ts` — a line as the `label` dataset row (the `stickers.label` field list).
- `sticker.rules.ts` — pure: the cost-code cipher, labels from stock, lot choice, sizes, reasons,
  numbers, IST times.
- Rendering is print-render's ONE label path (`PrintRenderService.renderLabels`, README "Labels").

## Rules worth knowing

- Lots = the item's lots with SALEABLE stock > 0 at this branch (any godown), newest first. Several
  MRPs → `lotRequired`, and Print refuses `STICKER_LOT_REQUIRED` until a lot is picked.
- Barcode: a textile lot's batch (a `stock_batch_detail` row) → the label unit's EAN (default
  first) → `item_default_barcode` (Def unit only) → none. Never written while printing.
- `assignment` (from-items, resolve) = the purpose's assignment for this counter (output PRINT) plus
  `lastPriceLevel`: the price level of THIS counter's newest job (any kind or status), else 2 = RET
  (SM6, decision 31). The Price level box starts on it; there is no setting.
- MRP = the lot's, else the price line's `ipm_max_price`. Our price = `resolveEffectivePrice` for
  the unit and the lot's bucket, column A-D by the level. Cost (PQ1) = the lot's cost rate × the
  unit's factor, else the price line's cost. Codes use `inventory.label_cost_code` (company).
- The job line keeps barcode ≤ 50 and batch ≤ 60 characters: a longer one is the line's problem
  (`STICKER_BARCODE_TOO_LONG` / `STICKER_BATCH_TOO_LONG`), never a truncation.
- A reprint uses the ORIGINAL job's frozen figures and design revision; a reprint of a reprint
  goes back to its original. Its `lines[].lineId` may name the original's lines OR the selected
  reprint job's own lines (what `/jobs/get` of that job shows): those map to the original line
  through `lbjl_reprint_of_line_id`. Two entries naming one original line add up into one job line
  (more than 9,999 in all → `STICKER_LABELS_INVALID`); a line of neither job →
  `STICKER_LINE_NOT_ON_JOB`. A resend copies a FAILED job and is refused (409
  `STICKER_ALREADY_RESENT`) once a resend of it has printed, or — variant `rule=SENT` — while a
  resend of it is still SENT (checked again inside the job's transaction under a per-job advisory
  lock, so two presses at once cannot both pass). A FAILED resend does not block. No reprint
  limit (S6).
- "Reprinted" (`/jobs/get` `lines[].reprintedLabels`, the Reprint dialog's Before) sums the lines
  of every job pointing at the line except FAILED jobs, as Last printed does. `reprints[]` lists
  the same jobs (FAILED ones too, with `status`), so a resend of a failed reprint — kind PRINT,
  decision 30 — shows with `resendOfJobNo` and the reprint's reason.
- `X-Print-Warning-Texts` is capped at 20 entries and 2,048 characters encoded (entries dropped
  from the end; one too-long entry is cut with "…").
- `/jobs/status` marks a SENT job PRINTED / FAILED once, from the counter that printed it (the
  session's device = the job's `lbj_device_id`, else 403 `STICKER_JOB_OTHER_COUNTER`); no age
  limit, so Printed jobs can mark an old SENT job ("Mark result…").
- Every PDF answer sends `X-Print-Warnings` (the count) and, when there is one,
  `X-Print-Warning-Texts`: standard base64 of the UTF-8 JSON array of the warning strings (the
  inspect answer's `warnings`), at most 20. Each cell is clipped to its own label, so a barcode
  wider than its box is cut at the label edge (with its warning), never printed on the next one.
- Jobs write no `print_log` and no audit revision; `/txn/adjacent` is not used.

## Documents (S-P2)

- **Sources:** a POSTED purchase bill (`PURCHASE_BILL`: direct, sister, or made from GRNs) or shortage
  receipt (`SHORTAGE_RECEIPT`) of this branch. The GRN gives none (`/purchase/labels/from-doc` and the
  GRN check's `labels` were removed). A bill line made from a GRN reads that GRN line's
  `pur_item_alloc` rows (the lots the GRN received); a direct line its own. SALEABLE rows with a lot only.
- **Counts per document + item + lot = grid 224's** (the picker; its CTEs are mirrored in
  `readCounts` / `foldDocCounts`): needed = Σ (qty + free) × the line's factor ÷ the Def unit's factor,
  `floor(round(…, 6))`, at least 1, 1 for a Def unit with decimals; printed = this document's PRINT
  jobs not FAILED, over job lines that are not a reprint's copy (`lbjl_reprint_of_line_id IS NULL`:
  a resend of a failed REPRINT is kind PRINT but reprints — review F2; grid 224 via migration
  20261127100100); REPRINT jobs and those copies come back as `reprinted`, and `docs/state
  jobs[].reprint` marks such jobs; carried (Q20) = the same over the PRINT jobs of a
  CANCELLED bill that billed one of this bill's lines' GRN lines, same item; shown printed / carried
  are capped so left = needed − both ≥ 0 and printed + carried = the grid's Printed. State NONE / NOT /
  PART / DONE over the items ticked Sticker.
- **A job holds one document's lines or none (C6):** with `source` every line names its `srcLineId`,
  its lot (one that came in on that line) and the item's Def unit (`STICKER_DOC_LINE_NOT_ON_DOC`, rule
  UNIT). These run before the lines are re-resolved. Inside the job's transaction, after the
  counter's number lock, `pg_advisory_xact_lock(hashtextextended('STICKER_DOC|company|branch|doc', 0))`
  then the document is read again (still POSTED) and the labels per item + lot must be ≤ left
  (`STICKER_DOC_OVER_LEFT`, rule LEFT when some is left; `params` fill the words, `meta` has the
  figures). Code, never a constraint (offline §5).
- **The job keeps the source:** `lbj_src_kind` DOCUMENT + type / id / year / `lbj_src_refno` (frozen
  number), `lbjl_src_line_id` per line (a merged line: the lowest line number's). Reprint and resend
  copy them. A reprint is never limited (S6). A resend of a FAILED document job (review F1) takes,
  in its transaction, numbering → resend → document lock, then refuses `STICKER_DOC_NOT_POSTED` when
  the document is no longer POSTED and `STICKER_DOC_OVER_LEFT` when the failed job's print lines
  exceed left (it never counted). A resend counts once it is not FAILED.
- **Label fields:** `doc_no` = the job's frozen number, `doc_date` = the document's date dd/MM/yyyy
  (read at print), `supplier_code` = the lot supplier's Short name (manual lines too); a lot with no
  supplier on a document job takes the document supplier's (review F4: print, and reprint / resend
  through the job's source); a blank Short name prints blank. Not frozen.
- **from-doc `labels`** = min(left, 9,999) (review F9): one line takes at most 9,999.
- **`docs/state.afterPost`** = `purchase.labels_after_post` through `fn_app_settings_effective` with the
  session's device (max scope DEVICE; ASK when unset). `/purchase/invoices/settings` is unchanged.
