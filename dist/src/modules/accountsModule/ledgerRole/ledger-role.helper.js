"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRoleLedgers = checkRoleLedgers;
exports.collectRoleLedgerErrors = collectRoleLedgerErrors;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
async function checkRoleLedgers(tx, refs, options) {
    const errors = await collectRoleLedgerErrors(tx, refs, options);
    if (errors.length > 0) {
        (0, module_service_utils_1.throwBadRequest)(options.message ?? 'Validation failed', errors);
    }
}
async function collectRoleLedgerErrors(tx, refs, options) {
    if (refs.length === 0) {
        return [];
    }
    const companyId = options.companyId ?? null;
    const [roles, ledgers] = await Promise.all([
        tx.accLedgerRole.findMany({
            where: { alrRole: { in: [...new Set(refs.map((ref) => ref.role))] } },
            select: {
                alrRole: true,
                alrLabel: true,
                alrWantType: true,
                alrWantDuty: true,
                alrWantNature: true,
            },
        }),
        tx.accLedgerMaster.findMany({
            where: { ledId: { in: [...new Set(refs.map((ref) => ref.ledgerId))] } },
            select: {
                ledId: true,
                ledName: true,
                ledLedgerType: true,
                ledGstDutyHead: true,
                ledCompanyId: true,
                accGroupMaster: { select: { accGroupNature: true } },
            },
        }),
    ]);
    const roleByName = new Map(roles.map((role) => [role.alrRole, role]));
    const ledgerById = new Map(ledgers.map((ledger) => [ledger.ledId, ledger]));
    const unknownRole = refs.find((ref) => !roleByName.has(ref.role));
    if (unknownRole) {
        (0, module_service_utils_1.throwNotFound)(`${options.where}: "${unknownRole.role}" is not a posting role`, unknownRole.field, `accounts.acc_ledger_role has no row for ${unknownRole.role}`);
    }
    const errors = [];
    for (const ref of refs) {
        const ledger = ledgerById.get(ref.ledgerId);
        if (!ledger) {
            errors.push({ field: ref.field, message: `No ledger found with id ${ref.ledgerId}` });
            continue;
        }
        const problem = describeMismatch(roleByName.get(ref.role), ledger, companyId);
        if (problem) {
            errors.push({ field: ref.field, message: problem });
        }
    }
    return errors;
}
function describeMismatch(role, ledger, companyId) {
    const nature = ledger.accGroupMaster?.accGroupNature ?? null;
    if (role.alrWantType && ledger.ledLedgerType !== role.alrWantType) {
        return `${role.alrLabel} needs a ${role.alrWantType} ledger, but "${ledger.ledName}" is ${describe(ledger.ledLedgerType)}`;
    }
    if (role.alrWantDuty && ledger.ledGstDutyHead !== role.alrWantDuty) {
        return `${role.alrLabel} needs duty head "${role.alrWantDuty}", but "${ledger.ledName}" has ${describe(ledger.ledGstDutyHead)}`;
    }
    if (role.alrWantNature && nature !== role.alrWantNature) {
        return `${role.alrLabel} must sit under a ${role.alrWantNature} group, but "${ledger.ledName}" is under ${describe(nature)}`;
    }
    if (ledger.ledCompanyId !== null && (companyId === null || ledger.ledCompanyId !== companyId)) {
        return `"${ledger.ledName}" belongs to one company, and this mapping is shared — its ledger must be global`;
    }
    return null;
}
function describe(value) {
    return value ? `"${value}"` : '(none)';
}
//# sourceMappingURL=ledger-role.helper.js.map