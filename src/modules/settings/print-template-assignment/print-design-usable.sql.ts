import { Prisma } from '@prisma/client';

/**
 * "Is this print design usable for a document of company C?" — Voucher Types
 * review S2, plan decision 62 (Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md,
 * keys file section "Usable design rule (S2)").
 *
 * A design (public.print_purpose row, alias {P}) is usable for company {C} when:
 *   (a) LIVE        — the design row is there, not deleted, active;
 *   (b) LAYOUT      — it has a live, active, published template, shared or {C}'s;
 *   (c) ASSIGNMENT  — the PRINT assignment the resolver picks for {C} with NO
 *                     branch and NO device (rung 1 "company" before rung 0
 *                     "every company", as PrintTemplateAssignmentService.resolve
 *                     orders them) points at a live, active, published template.
 *
 * Why only rungs 0 and 1 count for (c): every document print in NexERP
 * (PrintOptionsDialog::loadCatalogues, printing_module fetchPdfImpl) calls
 * /print-template-assignments/resolve with companyId alone, so a branch (2) or
 * counter (3) row is never a candidate when a bill prints, and NONE_RESOLVES
 * follows. A bill is also printed from places other than its own counter (the
 * bills list, a reprint at head office), and grid 86 / the print dataset are
 * per bill, not per printing PC: only a company- or every-company row holds
 * wherever the bill is printed. Narrow rows still work where they apply; they
 * just do not make a design "usable" on their own.
 *
 * The rule is TEXT with two placeholders so the server, grid 86 and the print
 * deploy's doc_title copy it word for word: {P} = the print_purpose alias, {C}
 * = the company expression (a column such as b.sb_company_id, or a bound
 * uuid). The inner aliases (dl, da, dw, dwt) are chosen not to collide with the
 * outer queries'. No comment marker: the grid runner refuses SQL comments.
 */

/** (a) the design row is live and active. */
export const PRINT_DESIGN_LIVE_RULE =
  '{P}.ppo_id IS NOT NULL AND {P}.ppo_is_deleted = false AND {P}.ppo_is_active = true';

/** (b) a live, active, published template of the design, shared or the company's. */
export const PRINT_DESIGN_LAYOUT_RULE = `EXISTS (SELECT 1 FROM public.print_template dl
              WHERE dl.ptl_purpose_id = {P}.ppo_id
                AND dl.ptl_is_active = true AND dl.ptl_is_deleted = false
                AND dl.ptl_published_rev_id IS NOT NULL
                AND (dl.ptl_company_id IS NULL OR dl.ptl_company_id = {C}))`;

/** (c) the company / every-company PRINT assignment the resolver picks names a live, published template. */
export const PRINT_DESIGN_ASSIGNMENT_RULE = `EXISTS (SELECT 1
               FROM (SELECT da.pta_template_id
                       FROM public.print_template_assignment da
                      WHERE da.pta_purpose_id = {P}.ppo_id
                        AND da.pta_output_mode = 'PRINT'
                        AND da.pta_is_active = true AND da.pta_is_deleted = false
                        AND (da.pta_company_id IS NULL OR da.pta_company_id = {C})
                        AND da.pta_branch_id IS NULL AND da.pta_device_id IS NULL
                      ORDER BY da.pta_specificity DESC, da.pta_created_on DESC
                      LIMIT 1) dw
               JOIN public.print_template dwt ON dwt.ptl_id = dw.pta_template_id
              WHERE dwt.ptl_is_active = true AND dwt.ptl_is_deleted = false
                AND dwt.ptl_published_rev_id IS NOT NULL
                AND (dwt.ptl_company_id IS NULL OR dwt.ptl_company_id = {C}))`;

/** (a) AND (b) AND (c): the one condition grid 86 and the print doc_title copy. */
export const PRINT_DESIGN_USABLE_RULE = `(${PRINT_DESIGN_LIVE_RULE}
 AND ${PRINT_DESIGN_LAYOUT_RULE}
 AND ${PRINT_DESIGN_ASSIGNMENT_RULE})`;

const SQL_ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * One of the rules above as a Prisma fragment: {P} becomes the alias (a code
 * constant, checked), every {C} the company expression (bound, never spliced).
 */
export function printDesignRuleSql(
  rule: string,
  purposeAlias: string,
  company: Prisma.Sql,
): Prisma.Sql {
  if (!SQL_ALIAS.test(purposeAlias)) {
    throw new Error(`printDesignRuleSql: "${purposeAlias}" is not an SQL alias`);
  }
  const parts = rule.split('{P}').join(purposeAlias).split('{C}');
  // Prisma.sql takes any string array as its "template strings"; the nested
  // fragment is flattened into the outer query's binds.
  return Prisma.sql(parts, ...parts.slice(1).map(() => company));
}

/** The rule's text with {P} and {C} filled in, for grid / dataset SQL (documentation and tests). */
export function printDesignRuleText(rule: string, purposeAlias: string, company: string): string {
  return rule.split('{P}').join(purposeAlias).split('{C}').join(company);
}
