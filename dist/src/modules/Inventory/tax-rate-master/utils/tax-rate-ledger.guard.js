"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTaxRateLedgers = assertTaxRateLedgers;
exports.collectTaxRateLedgerErrors = collectTaxRateLedgerErrors;
const module_service_utils_1 = require("../../../../common/utils/module-service.utils");
const ledger_role_helper_1 = require("../../../accountsModule/ledgerRole/ledger-role.helper");
const tax_rate_utils_1 = require("./tax-rate.utils");
const defaultFieldPath = (index, field) => `lines.${index}.${field}`;
async function assertTaxRateLedgers(client, lines, options = {}) {
    const errors = await collectTaxRateLedgerErrors(client, lines, options);
    if (errors.length > 0) {
        (0, module_service_utils_1.throwBadRequest)(options.message ?? 'Validation failed', errors);
    }
}
async function collectTaxRateLedgerErrors(client, lines, options = {}) {
    if (lines.length === 0) {
        return [];
    }
    const field = options.fieldPath ?? defaultFieldPath;
    const errors = [];
    collectDuplicateErrors(errors, lines, field);
    const roles = await client.accLedgerRole.findMany({
        where: { alrRole: { in: [...new Set(lines.map((line) => line.trl_role))] } },
    });
    const roleByName = new Map(roles.map((role) => [role.alrRole, role]));
    const ledgerRefs = [];
    lines.forEach((line, index) => {
        const role = roleByName.get(line.trl_role);
        if (!role) {
            errors.push({
                field: field(index, 'trl_role'),
                message: `"${line.trl_role}" is not a posting role — accounts.acc_ledger_role has no such row`,
            });
            return;
        }
        collectRoleErrors(errors, line, role, index, field);
        ledgerRefs.push({
            role: line.trl_role,
            ledgerId: line.trl_ledger_id,
            field: field(index, 'trl_ledger_id'),
        });
    });
    if (ledgerRefs.length > 0) {
        errors.push(...(await (0, ledger_role_helper_1.collectRoleLedgerErrors)(client, ledgerRefs, {
            companyId: options.companyId ?? null,
            where: 'tax_rate_ledger',
        })));
    }
    return errors;
}
function collectRoleErrors(errors, line, role, index, field) {
    if (!role.alrIsActive) {
        errors.push({
            field: field(index, 'trl_role'),
            message: `Posting role "${role.alrLabel}" is inactive`,
        });
    }
    if (!role.alrByRate) {
        errors.push({
            field: field(index, 'trl_role'),
            message: `"${role.alrLabel}" has one answer for the whole business and cannot be set per rate — ` +
                'map it in accounts.acc_ledger_map instead',
        });
    }
    const nature = line.trl_supply_nature ?? null;
    if (nature === null) {
        return;
    }
    if (!tax_rate_utils_1.SUPPLY_NATURES.includes(nature)) {
        errors.push({
            field: field(index, 'trl_supply_nature'),
            message: `trl_supply_nature must be ${tax_rate_utils_1.SUPPLY_NATURES.join(' or ')}, or null for both`,
        });
        return;
    }
    if (!role.alrBySupply) {
        errors.push({
            field: field(index, 'trl_supply_nature'),
            message: `"${role.alrLabel}" does not vary by supply nature — CGST and SGST exist only on an ` +
                'intra-state sale and IGST only on an inter-state one, so the role already says it. ' +
                'Leave trl_supply_nature null.',
        });
    }
}
function collectDuplicateErrors(errors, lines, field) {
    const seen = new Map();
    lines.forEach((line, index) => {
        const key = `${line.trl_role}|${line.trl_supply_nature ?? '*'}`;
        const first = seen.get(key);
        if (first === undefined) {
            seen.set(key, index);
            return;
        }
        errors.push({
            field: field(index, 'trl_role'),
            message: `Lines ${first + 1} and ${index + 1} both override ${line.trl_role}` +
                `${line.trl_supply_nature ? ` for ${line.trl_supply_nature}` : ' for both supply natures'}`,
        });
    });
}
//# sourceMappingURL=tax-rate-ledger.guard.js.map