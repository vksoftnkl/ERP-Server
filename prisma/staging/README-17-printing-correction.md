# 17_printing — pending correction

`20260827121000_add_printing_engine` created `print_template_assignment`,
`printer_profile` and `print_log` from a RECONSTRUCTION, because §5–§7 of
17_printing.sql had not arrived. The authoritative §5 and §7 constraint/index
blocks have since arrived and prove the reconstruction wrong. All three tables
are EMPTY, so the correction is a drop-and-recreate, not an ALTER dance.

## §5 IS DONE

`20260827140000_correct_print_template_assignment` drops and recreates
`print_template_assignment` from the authoritative §5, in full: the nullable
company, `pta_template_company_key`, `pta_printer_name`, the composite
`fk_pta_template`, all six CHECKs, the four-rung specificity CASE and the
COALESCE-keyed `ux_pta_scope` / `ix_pta_resolve`. It carries a guard that
refuses to run against a non-empty table.

`prisma/public/printTemplateAssignment.prisma` and the
`print-template-assignment` module were changed with it — output modes,
the four-rung scope vocabulary, the derived template owner, the every-company
rung in the resolver, and the printer fallback.

**§6 `printer_profile` and §7 `print_log` are still RECONSTRUCTED.** The rest
of this file is what remains.

Staged here rather than in `prisma/migrations/` on purpose: a folder under
`migrations/` is applied by the next `prisma migrate deploy`, and this is not
yet complete.

## What the real file proves is wrong in what was applied

### print_template_assignment (§5) — CORRECTED 2026-08-27
| applied | actual |
|---|---|
| `pta_company_id uuid NOT NULL` | **NULLABLE** — NULL = every company, the widest rung |
| — | `pta_template_company_key uuid NOT NULL` (nil uuid = shipped) |
| — | `pta_printer_name` — fallback bare queue name |
| `fk_pta_template` single-column | **composite** `(pta_template_id, pta_template_company_key)` → `ux_ptl_id_company_key` |
| — | `ck_pta_template_scope` — the cross-company lock |
| — | `ck_pta_branch_needs_company` |
| — | `ck_pta_printer_one_of` |
| specificity `CASE 2/1/0` | **counter 4, branch 2, company 0** — four rungs |
| `ux_pta_scope` NULLS NOT DISTINCT | **COALESCE to nil uuid** on company/branch/device |
| `ix_pta_resolve` plain column | leads with the same COALESCE expression |
| output modes PRINT/PREVIEW/EMAIL/FILE | PRINT/PREVIEW/PDF/EMAIL/WHATSAPP/ESCPOS |

### printer_profile (§6)
Applied a connection block (`prf_conn_kind`, `prf_host`, `prf_port`,
`prf_init_sequence`, `prf_cut_sequence`, `prf_width_mm`, `prf_height_mm`,
`prf_dpi`). §11's comments show the real shape is `prf_output_mode`,
`prf_family`, `prf_columns`, `prf_cpi`, `prf_paper_width_mm`, `prf_codepage`,
`prf_supports_bold`, `prf_supports_underline`, `prf_supports_cut`,
`prf_supports_graphics`, `prf_commands` (jsonb, control sequences by name) —
and NO page geometry, because that belongs to the version.

### print_log (§7)
Applied a much thinner table. The real one adds at least: `plg_render_id`,
`plg_copies_total`, `plg_rev_no`, `plg_is_reprint`, `plg_reprint_of_id` +
`plg_reprint_of_acc_year` (self-FK on the composite key), `plg_src_doc_refno`,
`plg_output_uri`, `plg_output_sha256`, `plg_output_bytes`, `plg_sheet_count`,
`plg_render_ms`, `plg_irn`, `plg_idempotency_key`, `plg_recipient`,
`plg_error_code`, `plg_user_id`, `plg_created_by`, `plg_created_on`,
`plg_is_deleted`. Status vocabulary is RENDERED/PRINTED/FAILED/CANCELLED, not
SUCCESS/FAILED/QUEUED/CANCELLED. One row per COPY, not per render.

## Still needed to finish

1. ~~§5 `print_template_assignment` column list~~ — ARRIVED and applied. The
   specificity CASE turned out to be `3` counter / `2` branch / `1` company /
   `0` every company; the §11 comment's "counter 4, branch 2, company 0" was
   describing the weights-summing version §5 rejects.
2. §6 `printer_profile` in full.
3. §7 `print_log` column list (down to `plg_is_deleted`).

Then: drop the remaining two tables, recreate them, and apply §11 (comments)
and §12 (the not-executed legacy migration block) in one correction migration.
`fk_pta_printer` is re-added at the end of the §5 correction, so a later §6
drop-and-recreate must drop and re-add it again.
