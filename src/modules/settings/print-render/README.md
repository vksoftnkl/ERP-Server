# Print Render

**§8 — the renderer.** It takes a revision's body, runs the datasets that revision
declares, and returns a PDF or an ESC/POS stream.

This is the piece the rest of the printing engine is arranged around. `print_template`
stores designs, `print_template_version` freezes them, `print_template_dataset` says where
the rows come from and `print_template_assignment` says which design wins — and until this
module existed, none of it could produce a page.

- **Base route:** `print-render` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Print Render`
- **Auth:** Bearer `access-token` (required)
- **Tables owned:** none. It reads §1–§5 and appends to §7.

## Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/preview` | Render one revision you name. Nothing is logged. |
| `POST` | `/print` | Render what the assignment ladder resolves to, and log every copy. |
| `GET` | `/providers` | The dataset provider codes this build carries. |

Both render routes answer with **bytes** — `application/pdf`, or
`application/octet-stream` for a text engine — plus `X-Print-*` headers naming the
revision, page count, copies and warning count. `inspect: true` returns JSON instead:
dataset row counts, timings, warnings, and (on `/print`) the log ids.

Neither takes a company. It comes from the authenticated context, because a render reads a
company's documents and a company id in the body would make either route a cross-tenant
read with a friendly name.

## The one sequence

```
        ┌ /preview: the revision you name
version ┤                                   ── §3 body ─┐
        └ /print:   whatever §5 resolves to             │
                                                        ▼
                              paper + datasets ← version WINS
                                    │                   │
              §4 datasets ──────────┴──► rows ──────────┤
                                                        ▼
                                              LayoutTree (one pass)
                                                        │
                                    ┌───────────────────┼──────────────────┐
                                    ▼                   ▼                  ▼
                                   PDF               ESC/POS            ESC/P
                                                        │
                              /print only ──────────────┴──► print_log, one row per COPY
```

`preview` and `print` differ in three things and nothing else: where the revision comes
from, whether an unsaved body may stand in for the stored one, and whether the result is
logged. Everything between is one path called from both. **A second copy of that path is
precisely how a preview starts disagreeing with the print.**

## Which side owns what

The version wins for the page and the datasets; the body wins only for the bands.

| | comes from |
| --- | --- |
| paper, orientation, margins, columns | `print_template_version.ptv_*` |
| datasets | `print_template_dataset` rows |
| bands and elements | `ptv_body` |

This is the same division the client's `canvasBridge.toTemplateDefinition` applies on the
way *into* the designer, and it has to be. A body that redefined the paper would print on
stationery the Template tab does not name; a body that invented a dataset would bind to a
query with no row in `print_template_dataset`, so it would resolve to nothing and print
blank — the most confusing failure available, because the design looks right.

`ptv_body` is a TEXT column whose only database check is that a JSON_BANDS body parses as
an object. Nothing says its bands are the canvas's bands, so `{"bands":[{"kind":"HEADER"}]}`
is a perfectly legal stored body — and a renderer that trusted it died on `band.elements`.
Everything goes through the zod schema in [`definition/`](./definition/), and a refusal
names the path that failed: `bands.3.elements.7.value`, not "invalid template".

## Where the engine came from

`engine/` is **restored intact** from the reporting module removed on 2026-08-27
(`6a97b0d`). The layout pass, both renderer families, the jexl expression sandbox and the
font registry are unchanged, because they were never the part that was wrong: they were
written against exactly the band/element body the canvas still produces, and the client's
`types/template-definition.ts` still describes itself as a mirror of their zod schema.

What was wrong with `/reports/*` was everything *above* the engine — a parallel set of
tables, a second template store, a second answer to which design is default. None of that
came back. The storage this reads is `print_template_version`, and this module has no
tables of its own.

Its 180 tests came back with it and still pass. `__fixtures__/` holds two designs copied
verbatim from `ERP client/features/print-designer/lib/__fixtures__/` — a GST A4 invoice and
a T80 thermal receipt — so the schema and service specs test bodies the canvas actually
produces rather than a second copy of this server's opinion.

## Two layout modes, both first-class

| Engine (`ptv_engine`) | Layout | Coordinates | Renders as |
| --- | --- | --- | --- |
| `JSON_BANDS` | GRAPHIC | millimetres | PDF |
| `ESCPOS_TEXT` | GRID | character cells | ESCPOS, ESCP_DOTMATRIX |
| `HTML_CSS` | — | — | refused: would need a browser |
| `QTRPT_XML` | — | — | refused: 3.0's format, kept so a migration can read it |
| `RAW` | — | — | refused: bytes the server must not interpret |

A GRID design in a PDF is not a degraded render, it is a wrong one — its coordinates are
character cells and the PDF renderer reads millimetres — so the two are **refused against
each other** rather than reinterpreted, even when explicitly asked for.

## The three runtime facts

§4 says the eleven `ck_ptd_sql_*` guards are an authoring lint and that the real boundary is
three runtime facts. All three live in [`data/`](./data/), and none is a check on query text:

1. **Parameters bound over the extended protocol** — [`dataset-sql-binder.ts`](./data/dataset-sql-binder.ts).
   A hand-written scanner, not a regular expression, because the three things that must
   *not* yield a parameter are all context: a `:name` inside a literal (**the 3.0 bug** —
   its stored SQL contained `':iacc_year'` *with* the quotes), inside a comment, or a `::`
   cast. A value cannot become syntax.
2. **A READ ONLY transaction** — `PgService.queryReadOnlyTx`, added for this module. An
   explicit `BEGIN … READ ONLY` plus `SET LOCAL statement_timeout` per dataset, which is
   what makes `ptd_timeout_ms` mean something without imposing one dataset's timeout on
   every other caller sharing the pool.
3. **A role with no write privilege** — `DATABASE_READONLY_URL`. Deployment's half of the
   bargain; `PgService` warns at boot when it is missing.

The guards still run at save time. They buy the error message, not the boundary.

## Providers

A `PROVIDER` dataset is code; a `SQL` dataset is data. The dividing line is not "hard
queries go here" — a stored query is bound, read-only and company-scoped, and can join
whatever it likes. What it cannot do is pick a partition from a year it does not know
until render time, or carry a rule that has to stay right when the law changes.

| code | shape | why it is code |
| --- | --- | --- |
| `company.profile` | one | `:company_id` — a stored copy is one WHERE clause from another tenant's letterhead |
| `branch.profile` | one | same, plus the branch/company pair |
| `sales.bill.header` | one | `sale_bill` is partitioned by `sb_acc_year`; the year is a join key the query text cannot know |
| `sales.bill.items` | many | `sbi_item_unit_id` references `item_unit_conversion(iuc_id)`, **not** `item_unit_master` — a trap worth getting right once |
| `sales.bill.tax_summary` | many | Rule 46's HSN table is a legal requirement whose shape changes when the law does |

Registration is an explicit list in [`print-render.module.ts`](./print-render.module.ts),
not a decorator scan: a stored row names a provider *by string*, so the valid set must be a
fact about the build rather than about which files an import graph pulled in.

Every provider must go through `providerQuery`. Calling `PgService` directly returns
`numeric` as a **string**, which formats correctly and adds wrongly — `'7960.00' +
'1432.80'` is `'7960.001432.80'`. Found exactly that way on a live invoice, where the
totals looked right because the formatter was parsing them.

## Copies

Each copy is **laid out separately**, because it is a different document: its copy label is
in expression scope (`ctx.copyLabel`), so a design that prints `ORIGINAL FOR RECIPIENT`
renders different text, and its page numbering starts again at one. The trees are merged
into one stream, so three copies of a one-page invoice is a three-page PDF or three
receipts with a cut between.

Labels come from the purpose (`ORIGINAL,DUPLICATE,TRIPLICATE`). Running out is normal: a
fourth copy prints with no label rather than a wrong one, and the seed's `NA` means "this
paper says nothing about which copy it is". Deciding that the second print of a tax invoice
is a DUPLICATE is a rule about GST and lives in the service layer, which is where §7 says
it belongs.

## What gets logged

`/print` appends one `print_log` row **per copy** — because that is what was printed, and a
single row saying "3 copies" cannot answer which copy went where. `plg_version_id` is a real
foreign key to the exact bytes rendered, which is the whole point of the body living on the
version.

- `plg_acc_year` is the **render's** year (from `fiscal_years.fy_is_current`, falling back to
  the request and then to the April–March calendar); `plg_src_acc_year` is the **document's**.
  A reprint of last year's bill is logged this year.
- A missing partition is repaired and retried — `fn_create_printing_partitions` — rather than
  reported. A new accounting year would otherwise fail its first print.
- **A failed log never fails a print.** The paper is already out of the printer. Throwing
  would make the operator print again, and the table would end up with two renders logged as
  one, or a customer holding an invoice the system denies issuing. Failures are logged loudly
  and swallowed, with the row's contents in the message.
- Previews are **not** logged. A designer iterating a layout would put fifty rows into an
  immutable table that exists to answer "what did the customer get".

## Unsaved bodies

`/preview` accepts a `body` — the canvas's unsaved change — but only against a **DRAFT**
revision. A published revision is frozen precisely so `print_log`'s reference to it stays
true, and previewing something else against it would put a picture in front of the operator
that no document will ever match. The way through is the one the save path already offers: a
version row with no `ptvId` becomes the next revision.

The paper and the datasets still come from the revision even then, so what Preview shows
differs from what Print produces by exactly the bands being edited, and by nothing else.

## Notes for the next person

- **Nesting is data, not a band.** `ptd_parent_no`/`ptd_link_fields` attach each child's rows
  onto the matching parent row under the child's name, so `{{ row.batches }}` works from
  inside a line. It is not a nested *band*: `bandSchema` has one `dataset` per band and no
  sub-bands, and inventing one here would produce data no design can reach. The child still
  runs once for the whole render, which is what §4 requires.
- **Row limits are named, not silent.** A dataset returning exactly `ptd_row_limit` rows
  raises a warning: a bill printing 5,000 of 5,140 lines is a legal document missing rows.
- **`plg_byte_count` is the whole render's size on every copy's row.** The copies are laid
  out separately and emitted as one stream, so a per-copy figure would have to be invented.
  §7's authoritative column list adds `plg_render_id` and `plg_output_bytes`, at which point
  this becomes a render-level fact recorded once — see
  [`prisma/staging/README-17-printing-correction.md`](../../../../prisma/staging/README-17-printing-correction.md).
- **Fonts** live in `assets/fonts` (`PRINT_FONT_DIR` overrides). `NotoSansTamil` has no Latin
  coverage, so the renderer splits a string into script runs and picks a face per run rather
  than drawing the whole thing in one font.
- **Printer profiles are not wired in yet.** The grid renderers accept a
  `PrinterCommandProfile` — command dialect, codepage, column budget — and this module passes
  `null`, so they use their built-in Epson defaults. §6 `printer_profile` is still the
  RECONSTRUCTED table; wiring it before the correction lands would build against a column
  list the authoritative file is known to contradict. The assignment's resolved printer name
  is returned to the caller and logged; **delivery to a queue is the caller's job**, not this
  module's.
- **Bulk printing is not here.** PDFKit is CPU-bound and synchronous, so a hundred invoices
  in a request handler blocks the event loop. The removed module queued anything over one
  document through BullMQ, which is still in this project's dependencies and is the right
  shape when that need arrives.
- Siblings in the printing engine: `print-template` (§2–§4), `print-template-assignment`
  (§5), and the not-yet-built `print-purpose` (§1) and `printer-profile` (§6).
