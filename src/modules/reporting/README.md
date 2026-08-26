# Reporting / Print Designer

A band-based report engine with one layout pass and many renderers: PDF (laser
/ inkjet), ESC/POS (thermal), and ESC/P (dot matrix). Comparable to QtRPT but
multi-output and multi-tenant.

## The one idea everything rests on

**One layout pass, many renderers.** A template definition plus resolved data
becomes a `LayoutTree` — pages of absolutely positioned primitives with every
expression already evaluated. Pagination, grouping, aggregates, auto-grow and
expression evaluation happen once, in the layout engine, with no renderer
involved. A renderer only knows how to draw a rectangle, a line and a run of
text in its own output format.

That is why `engine/layout/layout.engine.spec.ts` is the most important test
file in the module: if the layout fixtures pass, no renderer can introduce a
pagination bug, and a fourth output format is a few hundred lines rather than a
reimplementation.

```
templates/          store, version, clone, import, resolve  ── the storage boundary
providers/          whitelisted named datasets              ── the multi-tenant boundary
engine/
  units/            millimetres <-> points/pixels/cells
  expression/       jexl sandbox + transforms + AST validator
  fonts/            font registry + script-run splitting
  layout/           bands -> LayoutTree
  renderers/        pdfkit | grid/escp | grid/escpos
print/              HTTP endpoints, render orchestration, bulk BullMQ
templates/gallery/  the six shipped designs (also the Fast Path)
```

## Two layout modes, both first-class

| Mode | Coordinates | Output | Vertical unit |
|---|---|---|---|
| `GRAPHIC` | millimetres (float) | PDF | millimetres |
| `GRID` | character cell (int) | ESC/POS, ESC/P | lines |

`GRID` is **not** a degraded `GRAPHIC`. A dot-matrix printer in draft mode has
no concept of a millimetre, and sending it rasterised graphics turns a 2-second
invoice into a 40-second one — which is the entire reason kirana wholesalers
still buy these printers. See `templates/gallery/dotmatrix-invoice-dm80.template.ts`.

## Three security boundaries

1. **Data providers, not SQL.** A template references dataset *tokens*
   (`sales.invoice.lines`), never SQL. A template is tenant-authored content;
   one that could carry SQL would be a cross-tenant read primitive. See
   `providers/`.

2. **The jexl sandbox.** Expressions are jexl, never `eval`/`Function`/`vm`.
   The Phase 0.3 spike (`scripts/reporting/jexl-sandbox-spike.js`) is the
   standing proof that every runtime-reach attempt is contained. Expressions
   are also whitelisted for known root identifiers and transforms at **save**
   time (`engine/expression/expression.validator.ts`), so a bad expression
   fails in the designer, not at a customer's printer.

3. **System templates are read-only.** `pt_company_id NULL` = shipped with the
   product. A tenant clones one to edit it; editing in place would silently
   change every other tenant's default.

## Key design decisions and where they live

- **Tamil renders in PDFKit.** The Phase 0.2 spike
  (`scripts/reporting/tamil-font-spike.js`) established that fontkit shapes
  Tamil correctly — conjuncts, pulli stacking, left-reordering vowel signs — so
  no Chromium fallback is needed. But `NotoSansTamil` has **no Latin coverage**,
  so the renderer never draws a string with one font: it splits into script
  runs and picks a face per run (`engine/fonts/`).

- **Reproducible PDFs.** A render is byte-identical for identical input once
  `creationDate` is pinned (PDFKit derives the trailer `/ID` from it). This is
  what makes reprint de-duplication, render caching and golden-file tests
  possible.

- **Aggregates in three scopes.** REPORT and GROUP are pre-computed in one pass
  before layout, which is what lets a GROUP_HEADER print its own group's total
  — a forward reference an accumulate-as-you-go engine cannot satisfy. PAGE is
  accumulated live. See `engine/layout/aggregate.accumulator.ts`.

- **`aggregate.over`.** An aggregate over a display expression formatted with
  accounting parentheses (`(1,234.00)`) would lose the sign. `over` names the
  raw field to total while `value` stays the display format. The party
  statement depends on this to keep its closing balance equal to the sum of its
  subtotals.

- **Printer profiles, not code.** ESC/P and ESC/POS differ by model family in
  ways no datasheet settles. The command bytes come from
  `reports.printer_profile` (sparse hex overrides merged over built-in Epson
  defaults), so onboarding a new model is a seed row. See
  `docs/reporting-printer-inventory.md` for the Phase 0.4 questionnaire.

- **Bulk print is queued.** PDFKit is CPU-bound and synchronous; rendering a
  hundred invoices in a request handler blocks the event loop and stalls the
  whole API on a single-process VPS. Anything over one document goes through
  BullMQ with capped concurrency. See `print/bulk-print.processor.ts`.

## HTTP API

All under `/api/v1/reports`, `access-token` auth, company from the request
context (never a query parameter).

### Templates
```
GET    /templates                     list (tenant + system), filterable
GET    /templates/schema              the designer's palette vocabulary
GET    /templates/datasets/catalogue  dataset providers + field metadata
GET    /templates/:id                 one template, definition migrated
POST   /templates                     create (full validation)
PUT    /templates/:id                 update (bumps version, archives old body)
DELETE /templates/:id                 soft delete
POST   /templates/:id/clone           system -> tenant copy
PUT    /templates/:id/set-default
GET    /templates/:id/revisions
POST   /templates/:id/rollback/:version
GET    /templates/:id/export          portable JSON
POST   /templates/import
```

### Print
```
GET  /:docType/:docId/print?paper=A4&mode=PDF&accYear=2026-2027[&templateId=&printerProfile=]
     -> application/pdf | application/octet-stream

POST /preview     { definition, useSampleData?, mode?, ... }  -> stream (designer)
POST /bulk-print  { docType, docIds[], paper, mode, accYear } -> { jobId }
GET  /jobs/:jobId -> state, progress, per-document results
```

`accYear` is required on document print: `sales.sale_bill` is partitioned by
`sb_acc_year`, so a lookup without it scans every partition.

### Template resolution order

1. explicit `templateId`
2. branch default (company + branch)
3. company default (branch NULL)
4. system default (company NULL) — what makes a fresh install printable
5. 404 naming exactly what was missing

## The Fast Path

Until the designer UI (Phase 7) exists, the six gallery templates in
`templates/gallery/` **are** the templates. They are seeded as system defaults,
a tenant clones one to customise, and the dev team iterates a design by editing
its builder and re-running the seed. The whole storage/print API is complete
and usable with no UI.

## Rendering a sample

```
npx tsx scripts/reporting/render-sample-invoice.ts            # every gallery template
npx tsx scripts/reporting/render-sample-invoice.ts gst-invoice-a4
```

Output lands in `artifacts/reporting-samples/`. Open the PDFs; decode the raw
`.prn`/`.bin` with the snippet in the dot-matrix / thermal template files.

## Adding things

- **A dataset provider:** implement `IReportDataProvider`, decorate with
  `@ReportDataProvider('token')`, and add it to `reporting.module.ts` (the
  decorator makes it findable; the module registration makes it exist).
- **A gallery template:** add a builder, register it in `gallery/gallery.index.ts`,
  bump `reportTemplatesSeed.version`.
- **A schema version:** bump `SCHEMA_VERSION`, add a `MIGRATIONS` entry keyed by
  the version it migrates *from*, add a fixture. Never edit an existing
  migration — it has already run against real data.
