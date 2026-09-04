# Print Template

CRUD API for **print templates** and the two collections beneath them — **versions** (the
design itself, one row per revision) and **datasets** (the queries that feed a revision).
One template owns its versions, each version owns its datasets, and a single `GET` returns
the whole graph.

- **Base route:** `print-templates` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Print Template`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `public.print_template` — PK `ptl_id`
- **Child tables:**
  - `public.print_template_version` — PK `ptv_id`, FK `ptv_template_id` → `ptl_id`
  - `public.print_template_dataset` — PK `ptd_id`, FK `ptd_version_id` → **`ptv_id`**

## Payload shape

`POST /create` takes the **whole design in one object**: the template fields, a `versions`
array, and a `datasets` array **nested inside each version**. Everything is written in one
transaction, and the response is the same graph `GET /get` returns, so a screen can post
back exactly what it loaded.

```jsonc
POST /api/v1/print-templates/create
{
  "ptlCompanyId": "01963d86-caf0-7b26-89f0-58ac380a2d5e",
  "ptlPurposeId": "01963d86-caf0-7b26-89f0-58ac380a2d61",
  "ptlCode": "SALE_INVOICE_A4",
  "ptlName": "Tax Invoice — A4",
  "versions": [
    {
      "ptvEngine": "JSON_BANDS",
      "ptvBody": { "bands": [] },          // an object is fine; it is stored as text
      "ptvPaperCode": "A4",
      "ptvParams": [
        { "name": "from_date", "type": "DATE", "required": true, "label": "From date" }
      ],
      "datasets": [
        {
          "ptdRole": "MASTER",
          "ptdDatasetNo": 0,
          "ptdName": "bill",
          "ptdSourceKind": "PROVIDER",
          "ptdProviderCode": "sales.bill.header"
        },
        {
          "ptdDatasetNo": 1,
          "ptdName": "items",
          "ptdSourceKind": "SQL",
          "ptdSql": "SELECT sbi_item_name AS item_name, sbi_qty AS qty FROM sales.sale_bill_items WHERE sbi_comp_id = :company_id AND sbi_sb_id = :doc_id ORDER BY sbi_slno"
        }
      ]
    }
  ]
}
```

There are no per-version and no per-dataset routes. A revision is added by posting the
array it belongs to, and a dataset by posting the array on the revision that owns it.

### Why the datasets nest inside a version

`ptd_version_id` says so. A dataset is part of the report definition, not a setting beside
it — if it hung off the template, editing a query would silently change what every past
version rendered, and `print_log`'s version reference would be a lie.

### The two arrays do **not** behave the same way

This is the one thing to read before using the endpoint. The difference is the schema's,
not a choice:

| Body | Effect |
| --- | --- |
| no `versions` key | history untouched |
| `"versions": [ … ]` | rows with `ptvId` update that revision, rows without one are **appended** |
| a revision **missing** from `versions` | **left alone** — the history is append-only |
| `"ptvIsDeleted": true` on a row | that revision is soft deleted (explicit act) |
| no `datasets` key on a version | that version's datasets untouched |
| `"datasets": []` | **every** dataset on that version soft deleted |
| `"datasets": [ … ]` | the set is made to match the array |

`ux_ptv_template_rev` is **not** partial on `is_deleted`, unlike every other unique index
in the module, because the version history is append-only. Every `ptd` unique index **is**
partial, which is what makes replacement safe for a designer grid and unsafe for revisions.

## A published version is never UPDATEd

`print_log.plg_version_id` is a real foreign key to the exact bytes that were rendered, so
"what did this bill look like" is enforced rather than hoped for. Editing a live revision
would make every past log entry a lie.

- A revision that was **PUBLISHED or RETIRED when the request arrived** is frozen. Sending
  any design key (`ptvBody`, `ptvPaperCode`, `ptvParams`, …) or a `datasets` array for it is
  refused, with a message naming the way through: send a version row with **no `ptvId`** and
  it becomes the next revision.
- The one move still open to a live revision is **RETIRED**. Retiring the revision the
  template currently points at releases the pointer, and the template stops resolving —
  which is what withdrawing a design means.
- A revision being published **by this request** is not yet frozen, so composing a design
  and publishing it in a single call works.

### Publishing is a pointer move

Set a version's `ptvStatus` to `PUBLISHED`:

- it needs an approver — `ptvApprovedBy`, defaulting to the authenticated user, because a
  version whose datasets carry stored SQL is in every meaningful sense code;
- the server stamps `ptvApprovedOn` (an approver who picks their own approval time is not
  an approver);
- `print_template.ptl_published_rev_id` moves to that revision, atomically.

One revision per request — the template has one pointer. `ptlPublishedRevId` may also be
sent directly to point at an already-published revision; it is validated to name a
**PUBLISHED, undeleted revision of this template**, a rule `fk_ptl_published_rev` does not
itself enforce because it points at `ptv_id` alone.

## Validation

Neither the Prisma models nor this module's tables carry their CHECK constraints in the
schema fragments — each fragment lists what "lives in the migration and in
PrintTemplateService". That list is [`print-template.constants.ts`](./print-template.constants.ts),
and [`utils/print-template-invariants.ts`](./utils/print-template-invariants.ts) is where
each entry becomes a refusal with a field name and a sentence.

Every problem in a payload is collected before anything is written, and each error carries
a **path into the body** — `versions[1].datasets[0].ptdName` — so one round trip reports
everything wrong with a long form.

Beyond the per-row CHECKs, the module also enforces what no single row can see: the three
partial unique indexes on the dataset set (`ux_ptd_dataset_no`, `ux_ptd_name`,
`ux_ptd_one_master`), that a `ptdParentNo` names a dataset that exists, and that nesting is
a tree rather than a cycle.

### The stored-SQL guards are an authoring lint, not a security boundary

[`utils/print-template-sql-guards.ts`](./utils/print-template-sql-guards.ts) ports the
eleven `ck_ptd_sql_*` constraints — and the `ptd_sql_norm` normaliser they all read — to
TypeScript, so an author is refused when they **save** rather than by a constraint name when
the database rejects the row. The boundary is three runtime facts and none of them live
here: parameters **bound** over the extended protocol (which makes a second statement
structurally impossible rather than merely filtered), the query run in a `READ ONLY`
transaction, and a role with no write privilege.

What the port buys is the error message. Both of the constraints' documented false
positives — a `:name` inside a `--` comment, and a `--` inside a string literal — are
detected and explained rather than reported as the wrong problem.

## Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/create` | Create or update a whole template — header, revisions, datasets |
| `GET` | `/get` | One template with every revision and its datasets |
| `GET` | `/list` | Paginated list; `includeVersions=false` for a light pick list |
| `DELETE` | `/delete` | Soft delete the template with every revision and dataset |

`GET /list`'s `ptlCompanyId` is deliberately **not** a plain column match: a shipped design
(`ptl_company_id` NULL) is visible to every company, so narrowing to a company returns its
own templates **and** the shipped ones it can use. `onlyOwned=true` gives the other reading.
`engine` and `isPublished` ask about the **published** revision, so a template holding only
a draft matches neither.

`DELETE` is soft and is **refused while a print template assignment still points at the
template** — a counter would otherwise resolve to a design that is gone. The revisions go
down with it rather than away, because `print_log` still points at them.

## Notes for the next person

- `ptl_company_key` and `ptd_sql_norm` are `GENERATED ALWAYS … STORED`. Writing either
  raises `428C9`, so neither is accepted on input; both come back on every read, and
  `ptdSqlNorm` is what to look at when a SQL guard refuses a query that looks fine.
- `ptl_created_by` and its siblings are real foreign keys to `user_master`, so the nil-uuid
  `DEFAULT_ACTOR` the older masters fall back to would fail `fk_ptl_created_by`. This module
  writes `NULL` when nobody is authenticated.
- `applyDatasetPlan` takes **every** live dataset down before writing any back. PostgreSQL
  checks a unique index per statement with no deferral, so the obvious order collides with
  itself in two ordinary cases: a fresh row reusing the number of a row the same request
  drops, and two kept rows swapping numbers. Clearing the partial index first makes the
  ordering irrelevant.
- Siblings in the printing engine: `print-template-assignment` (§5, which design wins for a
  counter), and the not-yet-built `print-purpose` (§1) and `printer-profile` (§6).
