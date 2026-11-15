import { Prisma } from '@prisma/client';
import {
  PRINT_DESIGN_ASSIGNMENT_RULE,
  PRINT_DESIGN_LAYOUT_RULE,
  PRINT_DESIGN_LIVE_RULE,
  PRINT_DESIGN_USABLE_RULE,
  printDesignRuleSql,
  printDesignRuleText,
} from './print-design-usable.sql';

/**
 * Review S2 / decision 62: one usable-design rule, copied word for word by the
 * server (/bills/get, /voucher-types/get), grid 86 and the print doc_title.
 */
describe('the usable print design rule (S2)', () => {
  it('is (a) live AND (b) layout AND (c) assignment', () => {
    expect(PRINT_DESIGN_USABLE_RULE).toBe(
      `(${PRINT_DESIGN_LIVE_RULE}\n AND ${PRINT_DESIGN_LAYOUT_RULE}\n AND ${PRINT_DESIGN_ASSIGNMENT_RULE})`,
    );
    expect(PRINT_DESIGN_LIVE_RULE).toBe(
      '{P}.ppo_id IS NOT NULL AND {P}.ppo_is_deleted = false AND {P}.ppo_is_active = true',
    );
  });

  it('(b) wants a live, active, published template, shared or the company’s', () => {
    for (const part of [
      'dl.ptl_purpose_id = {P}.ppo_id',
      'dl.ptl_is_active = true AND dl.ptl_is_deleted = false',
      'dl.ptl_published_rev_id IS NOT NULL',
      '(dl.ptl_company_id IS NULL OR dl.ptl_company_id = {C})',
    ]) {
      expect(PRINT_DESIGN_LAYOUT_RULE).toContain(part);
    }
  });

  it('(c) follows the resolver at the company / every-company rungs only, and checks the winner’s template', () => {
    for (const part of [
      'da.pta_purpose_id = {P}.ppo_id',
      "da.pta_output_mode = 'PRINT'",
      'da.pta_is_active = true AND da.pta_is_deleted = false',
      '(da.pta_company_id IS NULL OR da.pta_company_id = {C})',
      // a counter / branch row never resolves for a document print (Qt sends companyId alone)
      'da.pta_branch_id IS NULL AND da.pta_device_id IS NULL',
      // narrowest first, as PrintTemplateAssignmentService.resolve: company before every company
      'ORDER BY da.pta_specificity DESC, da.pta_created_on DESC',
      'LIMIT 1) dw',
      'dwt.ptl_published_rev_id IS NOT NULL',
    ]) {
      expect(PRINT_DESIGN_ASSIGNMENT_RULE).toContain(part);
    }
  });

  it('holds no SQL comment (the grid runner refuses them) and no other placeholder', () => {
    expect(PRINT_DESIGN_USABLE_RULE).not.toMatch(/--|\/\*/);
    const left = PRINT_DESIGN_USABLE_RULE.replace(/\{P\}|\{C\}/g, '');
    expect(left).not.toMatch(/[{}]/);
  });

  it('printDesignRuleSql puts the alias in and binds the company at every {C}', () => {
    const sql = printDesignRuleSql(
      PRINT_DESIGN_USABLE_RULE,
      'op',
      Prisma.sql`${'019c8ea6-19e9-78a8-b15f-749e1cde7292'}::uuid`,
    );
    expect(sql.sql).not.toContain('{P}');
    expect(sql.sql).not.toContain('{C}');
    expect(sql.sql).toContain('op.ppo_is_active = true');
    expect(sql.sql).toContain('dl.ptl_company_id = ?::uuid');
    const holes = PRINT_DESIGN_USABLE_RULE.split('{C}').length - 1;
    // (b) once, (c) twice (the assignment's company, the winner template's company)
    expect(holes).toBe(3);
    expect(sql.values).toEqual(Array(holes).fill('019c8ea6-19e9-78a8-b15f-749e1cde7292'));
  });

  it('printDesignRuleSql refuses anything that is not a plain alias', () => {
    expect(() => printDesignRuleSql(PRINT_DESIGN_LIVE_RULE, 'p; DROP', Prisma.sql`1`)).toThrow();
  });

  it('printDesignRuleText gives the grid 86 / doc_title form', () => {
    const text = printDesignRuleText(PRINT_DESIGN_USABLE_RULE, 'cpp', 'b.sb_company_id');
    expect(text).toContain('cpp.ppo_id IS NOT NULL');
    expect(text).toContain('da.pta_company_id = b.sb_company_id');
    expect(text).not.toMatch(/\{P\}|\{C\}/);
  });
});
