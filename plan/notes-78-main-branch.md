# Notes 78 — A new company gets its main branch: what the server side did (2026-10-02)

Answer to notes 78. Migration `20261002100000_main_branch_notes_78` (applied to the local ERP
database; the backfill did 1 insert and 3 marks, as the live preview said), the services under
`src/modules/settings/{companyMaster,branchMaster}` and `src/modules/Inventory/godowns-master`, the
share's 45 file as `prisma/seed/Main_Branch_Seed.sql`, and one spec:
`test/company-branch-notes-78.e2e-spec.ts` (5 cases, one rolled-back transaction). Not committed yet.

## For the client

| Route / key | Change |
|---|---|
| `POST /company-masters/create` (new company) | **Items 1 and 2.** Inside the same transaction as the company and its fiscal year, writes one branch — `Main Branch`, type `HEAD OFFICE`, default, active, `brCode` NULL; state / state code, GSTIN, PAN, reg type, address, region address, tel / phone / mail copied from the company row — and one godown under it, `Main Godown`, type `WAREHOUSE`, no parent, set as the branch's `brDefaultGodownId`. Both audited as "Seeded on company create". |
| `compMainBranch` on the create payload | **New, create only.** `{ brId, brName, gdlId, gdlName }`. Absent on get and update. Name both in the "saved" message. |
| Branch update with `brIsDefault: false` on the current default | **Item 5.** 400, field `brIsDefault`: "*name* is its company’s default branch; make another branch the default instead". Re-ticking it, or leaving the flag out, is an ordinary update. Saving another branch with `brIsDefault: true` is the only way to move the flag. |
| `DELETE /branch-masters/delete` on the company's only branch | **Item 6, kept as it was.** The only branch (once unused, even if default) is still deleted, 200. The company is then branchless until it is deleted or a branch is added. Word the message so: "*name* was the company's only branch; the company has no branch now — delete the company, or add a branch." Refusing instead would make the company undeletable, since a company is deleted only once it has no live branches (notes 72 B2). |
| `uq_branch_master_default` | **Item 4.** UNIQUE `(br_comp_id) WHERE br_is_default AND NOT br_is_deleted`. The service clears the old default in the same transaction before every write, so a client never sees it; a raw second default is a 23505. Partial, so a deleted branch keeps its flag for restore (notes 72 B1). |

Nothing new is needed for the Branch list (grid 56) or the login branch combo: the seeded row is an
ordinary branch.

## Decisions taken here (say if you want otherwise)

- **Item 2, the godown is seeded** (the recommended option). `Main Godown`, WAREHOUSE, level 0,
  the branch's default godown. The client need not prompt for one after create.
- **Item 6, the last branch may still go.** See the table. The alternative ("refuse; delete the
  company instead") needs the company delete to take its unused last branch with it and the
  company restore to bring it back, which reopens notes 72 B1 / B2; not done.
- **The backfill seeds no godown** (as the 45 file says). LEAPSWITCH's new `Main Branch` has
  none until one is added from the Godown screen.
- **The copy rules are the 45 file's**, in `BranchMasterService.seedMainBranch()`:
  `comp_region_name`, `comp_short`, `comp_legal_name` are not copied; `brCountry` is the
  company's (NOT NULL on both); the reg type is already one of the four (notes 72 C3).

## Data

- **Backfill (migration and seed, idempotent):** a live company with no live branch gets
  `Main Branch`; a lone unflagged branch is marked default; several-with-none is listed, never
  guessed. Local run: LEAPSWITCH inserted; CHANDRA SAW MILL, HAP Solutions, THE SCM SILK marked.
  The seed file also prints the preview and result SELECTs when run by hand (`psql -d ERP -f`).
- **`prisma/public/branchMaster.prisma`** carries the index as a comment: a partial unique index
  is not expressible in Prisma, so `prisma migrate dev` will not try to drop it.

## Side notes (no ask)

- A branch delete does not count its godowns (notes 72 B3 list), so a seeded branch can still be
  deleted with its `Main Godown` live underneath; the godown is then unreachable from any login.
  `br_default_godown_id` still has no FK (cross-schema), as the notes say.
- Specs that make a company by the service now get a branch with it:
  `company-branch-notes-72.e2e-spec.ts` (B1 / B2 / B3 count or delete the seeded branch) and
  `app-theme.e2e-spec.ts` (constructor) were updated. `app-theme`'s token-count case and
  `godown-exception.filter.spec.ts` fail on the untouched tree too (pre-existing).
