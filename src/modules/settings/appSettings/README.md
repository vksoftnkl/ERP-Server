# App Settings

Overrides for every configurable behaviour in the product, and the resolver that
answers what a setting actually comes to for a given caller.

| Table                      | Prisma model      | Owned by                                  |
| -------------------------- | ----------------- | ----------------------------------------- |
| `public.app_setting_value` | `AppSettingValue` | **This module** — one row per (setting, target) |
| `public.app_setting_def`   | `AppSettingDef`   | **SQL** — the catalog, no endpoints        |

Fragment: [prisma/public/appSettings.prisma](../../../../prisma/public/appSettings.prisma).
Migration: `20260812120000_add_app_settings`.

**The catalog has no CRUD here on purpose.** Adding a setting to the product is
an `INSERT INTO public.app_setting_def` — no DDL, no column, no client release,
and no API either: the catalog is a deployment artefact, changed alongside the
code that reads the key. This module still *reads* it on every write (see
[How the catalog is enforced](#how-the-catalog-is-enforced)).

A row in the override table exists only where somebody changed something, and
*reset to default* is a **delete**, never a write of the default value.

## The five layers

```
GLOBAL  <  COMPANY  <  BRANCH  <  DEVICE  <  USER
```

The deepest override matching the caller's ids wins; where nothing matches, the
catalog's `asd_default_value` applies. `asd_max_scope` caps how deep a given
setting may be overridden at all — `COMPANY` means a per-user override is
refused, not ignored.

That merge lives in **`public.fn_app_settings_effective`** and nowhere else —
`fn_app_settings` is built on it too — so a rule evaluated in SQL and the same
rule evaluated in the client cannot drift apart. Do not reimplement the
precedence in TypeScript.

## Endpoints — `/app-setting-values` (`API_VERSION`)

| Method | Path                                | Purpose                                          |
| ------ | ----------------------------------- | ------------------------------------------------ |
| POST   | `/app-setting-values/create`        | Set overrides — an **array**, upserted on each entry's scope target |
| GET    | `/app-setting-values/effective`     | Every setting as it stands — override where one matched, catalog where none did |
| DELETE | `/app-setting-values/delete`        | Reset one override                               |

Three routes, and that is the whole surface: one write, one read, one reset.
There is no `/list`, `/get`, `/resolve` or `/resolve-one` — `/effective` answers
all of those questions for a caller in one round trip, and a diff view of "what
has been changed and where" is a report, not something a settings screen reads.

All routes answer the shared envelope `{ success, message, data }` and require
the bearer `access-token`.

## Files

| File | Purpose |
| --- | --- |
| [app-settings.module.ts](app-settings.module.ts) | Wiring — imports `AuditLogModule`, exports `AppSettingValueService` |
| [app-setting-value.controller.ts](app-setting-value.controller.ts) | Routes + Swagger |
| [app-setting-value.service.ts](app-setting-value.service.ts) | Override logic, and the call into the DB resolver |
| [app-settings.validation.ts](app-settings.validation.ts) | The value rules `tr_asv_check_scope` enforces, restated to name the field |
| [app-settings-exception.filter.ts](app-settings-exception.filter.ts) | Maps stray DB errors onto `asd*` / `asv*` field names |
| [dto/](dto/) | Request payload, query filters, Swagger response models |
| [types/app-settings-api.types.ts](types/app-settings-api.types.ts) | Payload contracts + the enum sets mirroring the CHECK constraints |

## How writing an override works

**The payload is always an array**, even for one override. Per entry: the key,
the scope, and **the id that scope names** — the other id columns must be
absent:

```jsonc
POST /app-setting-values/create
{
  "data": [
    {
      "asvSettingKey": "sales.max_discount_percent",
      "asvScope": "BRANCH",
      "asvBranchId": "019ca3f5-…",
      "asvValue": "40",
      "asvRemarks": "approved for the Anna Nagar counter"
    },
    {
      "asvId": "019ff5…",              // edits that override in place
      "asvValue": "false"
    }
  ]
}
```

`data` answers with one payload per entry, in the order sent.

- **The array is one transaction.** A settings screen saves a page of boxes, and
  if any entry is refused none of them are written — a half-applied page would
  leave the client unable to say which half took. Errors name the entry they
  came from (`data[2].asvValue`), so each message lands on the box that caused
  it.
- **Two entries naming the same target** are the second one winning — the same
  answer as saving twice, since each entry sees the ones before it.
- **It is an upsert**, keyed on (setting, target) rather than on an id: saving
  the same box twice moves the row it wrote the first time instead of answering
  409. That is what `ux_asv_scope_target` means by *one row per target*, and it
  is what a settings screen means by Save.
- **Exactly one id, and it must be the scope's own** (`ck_asv_scope_ids`). A
  `BRANCH` row carries the branch and nothing else — branch ids are globally
  unique, so a second copy of the company could only ever go stale, and since
  every id column is inside `ux_asv_scope_target`, a stale one would let two
  rows claim the same target.
- **The value is text, always** — `"40"`, not `40`. A non-string is a 400: the
  column is text for every type and the catalog says how to read it back, so
  coercing here would quietly store `[object Object]` for a mistyped JSON
  setting.
- **`asvValue: null` is legal and means "explicitly nothing"** — it BLANKS the
  setting for this layer. It is not the same as having no row: no row means
  *inherit the layer above*. To go back to inheriting, delete the override.
- Sending `asvId` edits that row in place. The key and the target are immutable
  there: pointing an override somewhere else is a reset plus a new override, not
  an edit, and treating it as an edit would move somebody's audit trail onto a
  target they never set.

## How the catalog is enforced

Every write reads the catalog row first, so a bad override comes back as a 400
naming the field rather than as a raw 23514 from `tr_asv_check_scope`. Refused
here:

- an **unknown key** — no `app_setting_def` row (400);
- a **retired setting** (`asd_is_active = false`) — it keeps the overrides it
  has, they are history, but takes no new ones (409);
- a **scope deeper than `asd_max_scope`** (400);
- a value that **will not cast** to `asd_data_type`, sits **outside
  `asd_allowed_values`**, or **breaks the min/max** (400);
- a **scope target that does not exist** — the FKs are `ON DELETE CASCADE`, so
  without this check a typo'd id would be accepted and then vanish.

The trigger is still the authority; these checks exist to make the answer
readable. `fn_app_settings` casts blindly (`val::boolean`, `val::bigint`,
`val::jsonb`) for every caller, so one uncastable value would break the settings
object for *everybody* — which is why the write path refuses rather than storing
and hoping.

**Maintaining the catalog is a SQL job.** A new setting:

```sql
INSERT INTO public.app_setting_def
  (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
   asd_max_scope, asd_label, asd_created_by)
VALUES
  ('sales.allow_rate_edit', 'sales', 'Billing', 'BOOL', 'true',
   'USER', 'Allow rate edit on the bill', 'SYSTEM');
```

Two rules the database does not enforce, so mind them by hand:

- `asd_default_value` must cast to `asd_data_type` — nothing constrains it
  against the type, and the resolver casts it for every caller who has not
  overridden the setting.
- Never rename `asd_key`, and never reuse a retired one. Overrides point at the
  key, not the id (`ux_app_setting_def_key` covers deleted rows too, so a
  retired key stays taken). Retire with `asd_is_active = false` and add a new
  key.

## Reset

```
DELETE /app-setting-values/delete?asvId=…
```

The soft delete **is** the reset: `ux_asv_scope_target` is partial on
`asv_is_deleted = false`, so the slot frees immediately while the row stays as
the record of what somebody once set. The layer above takes over again.

## Reading settings

```
GET /app-setting-values/effective?companyId=…&branchId=…&deviceId=…&userId=…
```

Every id is optional and additive — a layer whose id is not sent simply never
matches, so a caller that knows only its company resolves GLOBAL + COMPANY. The
ids are not inferred from one another; each layer is looked up by the id the
caller states.

One row per live setting, carrying the catalog row, the override row that won,
and the value the two come to — what to **apply** and what to **draw** in one
answer:

```jsonc
{
  "asdKey": "sales.max_discount_percent",
  "asdLabel": "Maximum discount %",
  "asdDataType": "DECIMAL",
  "asdMinValue": 0, "asdMaxValue": 100,
  "asdMaxScope": "USER",              // how deep the screen may offer to set it
  "asdDefaultValue": "10",            // what Reset goes back to

  "source": "OVERRIDE",               // or "DEFAULT"
  "value": "40",                      // raw text — cast by asdDataType
  "override": {                       // null when the default stands
    "asvId": "019ff5…",               // → /create to edit, /delete to reset
    "asvScope": "BRANCH",             // "set on this branch"
    "asvBranchId": "019ca3f5-…",
    "asvValue": "40",
    "asvRemarks": "approved for the Anna Nagar counter",
    "asvCreatedOn": "…", "asvCreatedBy": "…"
  }
}
```

Three things worth knowing:

- **A setting resolving to nothing is still returned**, with `value: null`. An
  empty box has to be drawn before it can be filled.
- **`value` is raw text, not cast.** The type comes back beside it, so the
  client casts — or renders a control — as it likes. `"40"`, never `40`.
- **`source` is read from the override ROW, not its value.** An override that
  deliberately blanks a setting reads `OVERRIDE` with `value: null`, so the
  screen still offers Reset on it.

Rows come back in `asdModule` → `asdGroup` → `asdSortOrder` order — the tree the
screen draws, and the order `ix_asd_module` is built on. Unpaged: the catalog is
small and a settings screen wants all of it.

It reads `public.fn_app_settings_effective`
(`20260812180000_add_app_settings_effective`), which **`fn_app_settings` is
itself built on** — so a rule resolved in SQL and this view can never disagree
about which layer won.

Server-side rules should read through `AppSettingValueService.resolveEffective`
(the module exports the service) rather than querying either table directly.

## Notes

- `/effective` is the only read: values *and* the labels, groups, types and
  bounds a settings **screen** needs. The catalog still has no CRUD — this
  exposes it read-only, joined to what the caller actually sees, and it only
  ever shows LIVE settings (retired and deleted ones are invisible).
- Audit entries are written for every write under screen **App Settings**
  (`screenType: settings`), naming the setting and its scope target.
- Keys are normalised to lower case and scopes to upper case by the DTOs, so a
  caller that shouts one still finds its row.
