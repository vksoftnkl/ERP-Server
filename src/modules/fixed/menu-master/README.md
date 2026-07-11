# Menu Master

Read + visibility API for the application's **navigation menu** — a self-referencing
parent/child tree of menu items ordered by menu position, with per-user visibility and
permission overlays.

- **Base route:** `menu-masters` (API-versioned via `API_VERSION` — every route carries `@Version(API_VERSION)`)
- **Swagger tag:** `Menu Master`
- **Auth:** Bearer `access-token`
- **Response caching:** controller-level `@CacheTTL(1)`
- **Primary table:** `menu_master` (`fixed` schema) — PK `menuId`, self-FK `menuParentId → menuId`
- **Related table:** `user_menus` (`public` schema) — per-user menu assignments/permissions, joined for the user-menu route

## Files

| File | Purpose |
| --- | --- |
| [menu-master.module.ts](menu-master.module.ts) | Module wiring — declares the controller and service (no extra imports/exports) |
| [menu-master.controller.ts](menu-master.controller.ts) | HTTP routes + Swagger docs |
| [menu-master.service.ts](menu-master.service.ts) | Business logic — tree building, ordering, visibility updates |
| [dto/get-menu-query.dto.ts](dto/get-menu-query.dto.ts) | Query params for `GET /get` (`visibleOnly`) |
| [dto/update-menu-visibility.dto.ts](dto/update-menu-visibility.dto.ts) | Payload for `PATCH /visibility` (`{ menus: [...] }`) |
| [dto/menu-master-response.dto.ts](dto/menu-master-response.dto.ts) | Swagger response models |
| [types/menu-master-api.types.ts](types/menu-master-api.types.ts) | Payload / response TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/get` | Return the full **active** menu tree. Pass `?visibleOnly=true` to keep only visible menus (default `false`). |
| `GET` | `/usermenu` | Return the menu tree visible to the **current user**, built from their `user_menus` rows (`umVisibility = true`), with per-menu permissions attached. |
| `PATCH` | `/visibility` | Set `menuVisibility` for one or more menus. |

## Tree building & ordering

- Menus are stored flat with a self-referencing `menuParentId`; the service assembles the tree
  in memory (`groupByParent` → `getRootRecords` → recursive `toSimplePayload`).
- **Roots** are records whose `menuParentId` is `null` **or** `0` (both are treated as top level;
  zero-parent roots are merged in without duplicating an id).
- Recursion carries a `visited` set so a self/ancestor reference can never cause an infinite loop.
- **`GET /get` ordering:** `menuParentId` asc, then `menuPosition` asc, then `menuId` asc.
- **`GET /usermenu` ordering:** the user's `umSortOrder` asc, then `menuPosition` asc, then `menuId` asc.
- `menuPosition` is a `Decimal(12,2)` in the DB and is serialized to a **string** (e.g. `"1.00"`)
  in the response, or `null` when unset.
- Every response includes a `meta` object: `{ visibleOnly, count }`, where `count` is the number
  of **root** items returned.

## User menus & permissions

- `GET /usermenu` resolves the caller via `RequestContextService.getUserId()`; if no user id can
  be derived from the token it throws `UnauthorizedException`.
- It reads `user_menus` filtered to `umUserId = <current user>`, `umVisibility = true`,
  `umIsDeleted = false`, and only active parent menus (`menu.menuIsActive = true`).
- Each returned menu carries a `permissions` object mapped from the user-menu row —
  `canCreate`, `canEdit`, `canDelete`, `canPrint`, `canExport`, `isVisible`, `isFavourite`,
  `isPinned`, `sortOrder`. On the plain `GET /get` route `permissions` is `null`.

## Visibility updates

- `PATCH /visibility` takes `{ menus: [{ menuId, menuVisibility }, ...] }` (validated:
  `menuId` is an int `≥ 1`, `menuVisibility` a boolean).
- All referenced `menuId`s are checked first; any missing id raises
  `NotFoundException` listing the offending ids, and nothing is written.
- Updates run inside a single `$transaction` (all-or-nothing).
- Each update re-pins `menuIsActive` to its current value so a DB trigger can't flip active status
  when visibility is turned off.
- Responds with the updated `{ menuId, menuVisibility }` rows.

## Notes

- **Read-only master for structure:** this module exposes no create / update / soft-delete of menu
  rows themselves; the only mutation is toggling `menuVisibility`.
- The DB column backing `menuVisibility` is spelled `menu_visiblity` (typo preserved via Prisma
  `@map`); the API surface uses the corrected `menuVisibility`.
