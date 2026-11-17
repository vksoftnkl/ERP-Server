"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRANCH_NUMBER_CODE_PATTERN = void 0;
exports.branchNumberCode = branchNumberCode;
exports.BRANCH_NUMBER_CODE_PATTERN = /^[A-Z0-9-]{1,10}$/;
async function branchNumberCode(tx, branchId) {
    const [row] = await tx.$queryRaw `
    SELECT upper(COALESCE(NULLIF(btrim(br_bill_prefix), ''), NULLIF(btrim(br_code), ''))) AS code
      FROM public.branch_master
     WHERE br_id = ${branchId}::uuid`;
    return row?.code || null;
}
//# sourceMappingURL=branch-number-code.helper.js.map