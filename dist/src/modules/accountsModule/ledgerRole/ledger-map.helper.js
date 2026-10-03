"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPLY_NATURES = void 0;
exports.isSupplyNature = isSupplyNature;
exports.roleLedgerKey = roleLedgerKey;
exports.resolveRoleLedgers = resolveRoleLedgers;
exports.resolveRoleLedger = resolveRoleLedger;
exports.requireRoleLedgers = requireRoleLedgers;
exports.collectRoleLedgerGapErrors = collectRoleLedgerGapErrors;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
exports.SUPPLY_NATURES = ['INTRA', 'INTER'];
function isSupplyNature(value) {
    return typeof value === 'string' && exports.SUPPLY_NATURES.includes(value);
}
function roleLedgerKey(request) {
    return `${request.role}|${request.taxId ?? '*'}|${request.supplyNature ?? '*'}`;
}
async function resolveRoleLedgers(client, requests, options) {
    const resolved = new Map();
    if (requests.length === 0) {
        return resolved;
    }
    const roleNames = [...new Set(requests.map((request) => request.role))];
    const taxIds = [
        ...new Set(requests
            .map((request) => request.taxId)
            .filter((taxId) => typeof taxId === 'string' && taxId.length > 0)),
    ];
    const [roles, overrides, maps] = await Promise.all([
        client.accLedgerRole.findMany({
            where: { alrRole: { in: roleNames } },
            select: { alrRole: true, alrLabel: true, alrBySupply: true, alrIsActive: true },
        }),
        taxIds.length > 0
            ? client.taxRateLedger.findMany({
                where: {
                    trlTaxId: { in: taxIds },
                    trlRole: { in: roleNames },
                    trlIsDeleted: false,
                    trlIsActive: true,
                },
                select: {
                    trlId: true,
                    trlTaxId: true,
                    trlRole: true,
                    trlSupplyNature: true,
                    trlLedgerId: true,
                    ledger: { select: { ledName: true } },
                },
            })
            : Promise.resolve([]),
        client.accLedgerMap.findMany({
            where: { almRole: { in: roleNames }, almIsDeleted: false, almIsActive: true },
            select: {
                almId: true,
                almRole: true,
                almCompanyId: true,
                almBranchId: true,
                almSupplyNature: true,
                almLedgerId: true,
                ledger: { select: { ledName: true } },
            },
        }),
    ]);
    const roleByName = new Map(roles.map((role) => [role.alrRole, role]));
    const unknownRole = requests.find((request) => !roleByName.has(request.role));
    if (unknownRole) {
        (0, module_service_utils_1.throwNotFound)(`${options.where}: "${unknownRole.role}" is not a posting role`, unknownRole.field ?? unknownRole.role, `accounts.acc_ledger_role has no row for ${unknownRole.role}`);
    }
    const companyId = options.companyId ?? null;
    const branchId = options.branchId ?? null;
    for (const request of requests) {
        const key = roleLedgerKey(request);
        if (resolved.has(key)) {
            continue;
        }
        const role = roleByName.get(request.role);
        const nature = role.alrBySupply && isSupplyNature(request.supplyNature) ? request.supplyNature : null;
        resolved.set(key, role.alrIsActive
            ? (bestOverride(overrides, request, nature, role.alrLabel) ??
                bestMapping(maps, request.role, nature, companyId, branchId, role.alrLabel))
            : null);
    }
    return resolved;
}
async function resolveRoleLedger(client, request, options) {
    const resolved = await resolveRoleLedgers(client, [request], options);
    return resolved.get(roleLedgerKey(request)) ?? null;
}
async function requireRoleLedgers(client, requests, options) {
    const resolved = await resolveRoleLedgers(client, requests, options);
    const errors = describeUnresolved(requests, resolved, options.where);
    if (errors.length > 0) {
        (0, module_service_utils_1.throwBadRequest)(options.message ?? 'Validation failed', errors);
    }
    return resolved;
}
async function collectRoleLedgerGapErrors(client, requests, options) {
    const resolved = await resolveRoleLedgers(client, requests, options);
    return describeUnresolved(requests, resolved, options.where);
}
function bestOverride(overrides, request, nature, roleLabel) {
    if (!request.taxId) {
        return null;
    }
    let best = null;
    for (const row of overrides) {
        if (row.trlTaxId !== request.taxId || row.trlRole !== request.role)
            continue;
        if (row.trlSupplyNature !== null && row.trlSupplyNature !== nature)
            continue;
        if (best === null || (row.trlSupplyNature !== null && best.trlSupplyNature === null)) {
            best = row;
        }
    }
    return best === null
        ? null
        : {
            role: request.role,
            roleLabel,
            ledgerId: best.trlLedgerId,
            ledgerName: best.ledger?.ledName ?? '',
            supplyNature: best.trlSupplyNature,
            source: 'TAX_RATE',
            sourceRowId: best.trlId,
        };
}
function bestMapping(maps, role, nature, companyId, branchId, roleLabel) {
    let best = null;
    let bestScore = -1;
    for (const row of maps) {
        if (row.almRole !== role)
            continue;
        if (row.almBranchId !== null && row.almBranchId !== branchId)
            continue;
        if (row.almCompanyId !== null && row.almCompanyId !== companyId)
            continue;
        if (row.almSupplyNature !== null && row.almSupplyNature !== nature)
            continue;
        const score = (row.almBranchId !== null ? 4 : 0) +
            (row.almCompanyId !== null ? 2 : 0) +
            (row.almSupplyNature !== null ? 1 : 0);
        if (score > bestScore) {
            best = row;
            bestScore = score;
        }
    }
    return best === null
        ? null
        : {
            role,
            roleLabel,
            ledgerId: best.almLedgerId,
            ledgerName: best.ledger?.ledName ?? '',
            supplyNature: best.almSupplyNature,
            source: 'LEDGER_MAP',
            sourceRowId: best.almId,
        };
}
function describeUnresolved(requests, resolved, where) {
    const errors = [];
    const reported = new Set();
    for (const request of requests) {
        const key = roleLedgerKey(request);
        if (resolved.get(key) || reported.has(key)) {
            continue;
        }
        reported.add(key);
        errors.push({
            field: request.field ?? request.role,
            message: `${where}: nothing maps "${request.role}"` +
                `${request.supplyNature ? ` for ${request.supplyNature} supply` : ''} to a ledger` +
                `${request.taxId ? ' — neither the rate nor accounts.acc_ledger_map has a row for it' : ' — accounts.acc_ledger_map has no row for it'}`,
        });
    }
    return errors;
}
//# sourceMappingURL=ledger-map.helper.js.map