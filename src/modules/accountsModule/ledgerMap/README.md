# Posting Ledger Map

Role → ledger. Every posting engine turns a **role** (`DISCOUNT_ALLOWED`, `OUTPUT_CGST`,
`ROUND_OFF`, …) into a ledger through `accounts.acc_ledger_map`; until this module there was no
way to see that mapping, let alone change it, without SQL on the box.

A wrong mapping does not fail. It posts money to the wrong account and says nothing — which is
why the checks below are the point of the module, not paperwork around it.

- **Base route:** `ledger-map` (API-versioned via `@Version(API_VERSION)`)
- **Swagger tag:** `Posting Ledger Map`
- **Auth:** Bearer `access-token` (required)
- **Cache:** controller-level `@CacheTTL(1)` — a GET is served from cache for one second, and the
  global invalidation on a write is fire-and-forget. A screen re-reading after a save never
  notices; a test firing the next request a millisecond later does.
- **Primary table:** `accounts.acc_ledger_map` — PK `almId` (`uuidv7()`)
- **Read alongside it:** `accounts.acc_ledger_role`, the role CATALOGUE

## Files

| File | Purpose |
| --- | --- |
| [ledger-map.module.ts](ledger-map.module.ts) | Module wiring — imports `AuditLogModule`, registers the controller, service and exception filter |
| [ledger-map.controller.ts](ledger-map.controller.ts) | The three routes + Swagger docs |
| [ledger-map.service.ts](ledger-map.service.ts) | The catalogue join, the fit check, the in-use check, audit logging |
| [role-usage.ts](role-usage.ts) | Which DOCUMENTS post which role, built from each engine's own enum |
| [ledger-map-exception.filter.ts](ledger-map-exception.filter.ts) | Maps DB/domain errors to the module's error shape |
| [dto/save-ledger-map.dto.ts](dto/save-ledger-map.dto.ts) | Create/update payload and the delete query |
| [dto/ledger-map-response.dto.ts](dto/ledger-map-response.dto.ts) | Swagger response models |
| [types/ledger-map-api.types.ts](types/ledger-map-api.types.ts) | Payload / response contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/roles` | Every role the product knows, with the ledger it resolves to — **or with nothing** |
| `POST` | `/create` | Map a role, or re-point an existing mapping, chosen by presence of `almId` |
| `DELETE` | `/delete` | Soft-delete a mapping by `almId`. Refused while a deployed engine posts that role |

There is no list route. Grid 106 (SETUP - POSTING LEDGER MAP) is registered and the client reads
lists through `/configured-grid-sql/run` like every other screen. `/roles` is not that list — it
is the catalogue joined to the mappings, and a grid over `acc_ledger_map` cannot show a row that
does not exist.

## The role list is the SERVER's

`GET /roles` is driven by `accounts.acc_ledger_role`, never by `SELECT DISTINCT alm_role`. A role
with **no** row is exactly the case the screen exists to show, and it is invisible to a query over
the mappings.

It also ends a class of bug: the client keeps its own copy of the role names in `ReceiptRoles`,
and the two lists have already disagreed once. One list, served, cannot drift from what the
engines ask for, because they ask the same table.

Each row carries `label` (nobody should have to read `BOUNCE_CHARGES_RECOVERED`),
`expectedLedgerType` / `expectedDutyHead` / `expectedGroupNature` (the picker's filter and the
rule below), `usedBy`, and the ledger's own `ledgerIsActive` / `ledgerIsDeleted` — resolution
never looks at those flags, so a mapping pointing at a deleted ledger still posts, and the screen
can only say so if they are on the payload.

## What a ledger must BE for a role

Not restated here. It lives in the catalogue — `alr_want_type`, `alr_want_duty`,
`alr_want_nature` — and is enforced by
[`ledgerRole/ledger-role.helper.ts`](../ledgerRole/ledger-role.helper.ts), the same code the tax
rate master's per-rate overrides go through. Adding a role stays one INSERT into
`acc_ledger_role`; nothing in this module lists role names.

The catalogue is the authority on the pairing, and it is finer-grained than a plain
type-per-family rule: `DISCOUNT_ALLOWED` wants a ledger of type `DISCOUNT`, not `EXPENSE`, and
`ROUND_OFF` wants `ROUNDOFF`. The refusal names the type the role demands and the type the ledger
actually is.

Two rules this module adds on top, because `fn_ledger_for` does not apply them:

- The ledger must be **live** — a deleted or inactive ledger is refused at the moment it is typed.
- The ledger must be **global**. A shared mapping is resolved by every company, so a
  company-owned ledger would make one company's books absorb everyone's postings.

## Unmapping is the dangerous direction

An unmapped role is not a blank screen, it is a posting that fails at the moment money is being
taken. `DELETE` refuses while any deployed engine resolves the role, naming the documents:

> `DISCOUNT_ALLOWED is used by RECEIPT and CHEQUE. Point it at a different ledger instead of
> removing it.`

[role-usage.ts](role-usage.ts) answers "which documents", and it is built from `ReceiptLedgerRole`,
`ChequeLedgerRole` and `OpeningLedgerRole` — the engines' own enums — so a role added to an engine
starts being protected in the same commit that teaches the engine to post it. A role nothing posts
yet (`PURCHASE_RETURN`, say) may be unmapped freely.

An update may not change a mapping's **role**, either: re-pointing a row at a different role would
unmap the old one silently, sidestepping exactly this check.

## Scope: the shared set only

`alm_company_id`, `alm_branch_id` and `alm_supply_nature` are **not accepted** and are written
NULL. Sending one is a 400 naming the field, not a silently ignored value, and a mapping that
already carries a scope is refused for update and delete.

`ux_alm_role` is `UNIQUE (company, branch, role, supply_nature) NULLS NOT DISTINCT WHERE NOT
deleted`, so those three NULLs are a key rather than an absence: exactly one live shared row per
role. The schema keeps the override door open — `fn_ledger_for` already prefers a scoped row,
branch → company → shared — and this API deliberately does not open it until somebody needs it.
When it does, `GET /roles` grows a `from` field saying which level answered.

## Tests

[test/ledger-map-http.e2e-spec.ts](../../../../test/ledger-map-http.e2e-spec.ts) runs the plan's
checklist against the live dev database: every refusal, the delete-then-recreate cycle, and a
final assertion that the table ends with the rows and ids it started with. `PURCHASE_RETURN` is
the only mapping touched destructively, because nothing posts it yet.
