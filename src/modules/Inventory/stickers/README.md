# Sticker Printing (menu 32)

Plan: `Shared/Prathap/printing/sticker-printing/plan-sticker-printing-sp1-2026-11-25.md` (S-P1, §7).
Base route `/api/v1/stickers`. Rights: View on menu 32 for the reads, Print for the job writes
(`STICKER_RIGHT_VIEW` / `_PRINT`); Test print needs Print on Print Assignments 248
(`PRINT_ASSIGN_RIGHT_PRINT`). Nothing is cached. The Printed jobs list is grid 223 — no `/list`.

| Method | Route               | Right        | What                                                                            |
| ------ | ------------------- | ------------ | ------------------------------------------------------------------------------- |
| GET    | `/lines/from-items` | View         | Add items · F3: lines for the items a filter picks (ONE / TYPED / STOCK labels) |
| POST   | `/lines/resolve`    | View         | scan / type and every re-resolve; a bad line answers 200 with its `problem`     |
| GET    | `/lots`             | View         | lots with SALEABLE stock here, newest first                                     |
| POST   | `/preview`          | View         | one label of a line (PDF), nothing logged                                       |
| POST   | `/jobs/print`       | Print        | one design group → a SENT job + PDF (`inspect` = JSON)                          |
| POST   | `/jobs/status`      | Print        | the printing counter reports PRINTED / FAILED                                   |
| POST   | `/jobs/reprint`     | Print        | a REPRINT job of a printed job's lines, with a reason                           |
| POST   | `/jobs/resend`      | Print        | a failed job sent again (new PRINT job, no reason)                              |
| GET    | `/jobs/get`         | View         | one job: head, frozen lines with Reprinted, its reprints                        |
| POST   | `/test-print`       | Print on 248 | one test label in cell 1 of the design's page (PDF)                             |

## The pieces

- `sticker-lines.service.ts` — **the one line builder** (design JOB → ITEM → PURPOSE → NONE, unit,
  lot, barcode, MRP, Our price, cost / price code, Last printed). S-P2 (GRN / purchase bill) calls
  `buildLines` with its document lines.
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
