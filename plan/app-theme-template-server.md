# App theme part 2 — the template in the database: what the server side did (2026-10-01)

Answer to the share's `theme/plan-app-theme-template.md` §2–§4 (Prathap's half). Migration
`20261001140000_app_theme_template` (the "44" file; applied to 192.168.0.106), `src/modules/settings/appTheme`,
unit spec + `test/app-theme.e2e-spec.ts` (template cases) + `test/app-theme-template-http.e2e-spec.ts`.

## Data (§2)

`public.app_theme_template` exactly as specified (identity `tpl_id`, one live active row by
`ux_tpl_active`, `tpl_sync_date` — the sync triggers are installed by the migration). Seeded with the
share's `theme/seed-template-v1.qss` as `NEXERP` (tpl_id 1 on dev), only when no live template exists,
so a newer version saved through the API is never overwritten by a re-run or a deploy.

## Token keys (§3.1)

`APP_THEME_TOKEN_KEYS` has the 5 v2 keys: `primary.soft`, `primary.softer`, `primary.soft.border`,
`primary.pressed.bg`, `primary.pressed.border` (38 in all). No row was changed: §3.2's MAROON
corrections and the v2 values for the three rows are yours, through `POST /app-themes/save`.

## Routes (§4.1)

| route | answers |
|---|---|
| `GET /app-themes/template` | `{ tplId, tplName, tplQss, tplRemarks, tplModifiedOn, placeholders[] }` (distinct keys, in order of first use). 404 only with no live active template. |
| `POST /app-themes/template/save` | body `{ tplId, tplQss, tplRemarks?, tplModifiedOn }`; menu-266 **edit** right (403 `THM_RIGHT_EDIT`). 409 `tplModifiedOn` when the row was saved after the copy you loaded (the row is locked for the compare). Audited — screen "App Theme Template", the text before and after. |
| `GET /app-themes/effective` | now also `template: { tplId, tplQss, tplModifiedOn }` (null only with no template). ETag `thmId:thmModifiedOn:resolvedFrom:tplId:tplModifiedOn`, 304 on `If-None-Match`. |
| `GET /app-themes/bootstrap` | **no token**: `{ tokens, thmModifiedOn, template }` — the default theme's colours and the template, nothing else. Never 404. ETag `thmModifiedOn:tplId:tplModifiedOn`, 304. Throttled like every route. |

## Validation of `tplQss` (§4.2) — each fault a 400 on `tplQss`, all at once, nothing written

- `unknown placeholder {{x}}` — once per distinct key; a key is a token or `size.font` / `size.icon` /
  `size.header`, exactly as written (`{{ primary }}` is unknown).
- `the { on line N is never closed`, `the } on line N closes nothing`,
  `the comment opened on line N is never closed` — braces in comments, quoted strings and
  placeholders do not count.
- `url(x) on line N is not a :/ resource` — quoted or not; a url( in a comment is ignored.
- `at most 512 KB; this one is N KB` (UTF-8 bytes).

The seed passes all of them (a unit test reads it out of the migration).
