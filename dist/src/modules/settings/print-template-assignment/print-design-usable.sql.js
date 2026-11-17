"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRINT_DESIGN_USABLE_RULE = exports.PRINT_DESIGN_ASSIGNMENT_RULE = exports.PRINT_DESIGN_LAYOUT_RULE = exports.PRINT_DESIGN_LIVE_RULE = void 0;
exports.printDesignRuleSql = printDesignRuleSql;
exports.printDesignRuleText = printDesignRuleText;
const client_1 = require("@prisma/client");
exports.PRINT_DESIGN_LIVE_RULE = '{P}.ppo_id IS NOT NULL AND {P}.ppo_is_deleted = false AND {P}.ppo_is_active = true';
exports.PRINT_DESIGN_LAYOUT_RULE = `EXISTS (SELECT 1 FROM public.print_template dl
              WHERE dl.ptl_purpose_id = {P}.ppo_id
                AND dl.ptl_is_active = true AND dl.ptl_is_deleted = false
                AND dl.ptl_published_rev_id IS NOT NULL
                AND (dl.ptl_company_id IS NULL OR dl.ptl_company_id = {C}))`;
exports.PRINT_DESIGN_ASSIGNMENT_RULE = `EXISTS (SELECT 1
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
exports.PRINT_DESIGN_USABLE_RULE = `(${exports.PRINT_DESIGN_LIVE_RULE}
 AND ${exports.PRINT_DESIGN_LAYOUT_RULE}
 AND ${exports.PRINT_DESIGN_ASSIGNMENT_RULE})`;
const SQL_ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;
function printDesignRuleSql(rule, purposeAlias, company) {
    if (!SQL_ALIAS.test(purposeAlias)) {
        throw new Error(`printDesignRuleSql: "${purposeAlias}" is not an SQL alias`);
    }
    const parts = rule.split('{P}').join(purposeAlias).split('{C}');
    return client_1.Prisma.sql(parts, ...parts.slice(1).map(() => company));
}
function printDesignRuleText(rule, purposeAlias, company) {
    return rule.split('{P}').join(purposeAlias).split('{C}').join(company);
}
//# sourceMappingURL=print-design-usable.sql.js.map