"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertAccYearWritable = assertAccYearWritable;
exports.loadVisibleLedgers = loadVisibleLedgers;
exports.isBalanceSheetNature = isBalanceSheetNature;
exports.staleLaterYears = staleLaterYears;
exports.countBillsByOpening = countBillsByOpening;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const opening_balance_enum_1 = require("./types/opening-balance-enum");
const opening_balance_utils_1 = require("./opening-balance.utils");
async function assertAccYearWritable(client, companyId, accYear, field) {
    if (!(0, opening_balance_utils_1.isValidAccYear)(accYear)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `"${accYear}" is not an accounting year — expected YYYY-YYYY with the second half one greater than the first`,
            },
        ]);
    }
    const year = await client.fiscalYear.findFirst({
        where: { compId: companyId, fyYearName: accYear, isDeleted: false },
        select: { fyStatus: true, fyLockDate: true, fyYearName: true },
    });
    if (!year) {
        return;
    }
    if (year.fyStatus !== opening_balance_enum_1.FiscalYearStatus.OPEN) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `Accounting year ${year.fyYearName} is ${year.fyStatus} and cannot be written to`,
            },
        ]);
    }
    if (year.fyLockDate && year.fyLockDate.getTime() <= Date.now()) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `Accounting year ${year.fyYearName} was locked on ${year.fyLockDate
                    .toISOString()
                    .slice(0, 10)} and cannot be written to`,
            },
        ]);
    }
}
async function loadVisibleLedgers(client, companyId) {
    const ledgers = await client.accLedgerMaster.findMany({
        where: {
            ledIsDeleted: false,
            OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
        },
        select: {
            ledId: true,
            ledName: true,
            ledCompanyId: true,
            ledIsBillByBill: true,
            accGroupMaster: { select: { accGroupName: true, accGroupNature: true } },
        },
        orderBy: { ledName: 'asc' },
    });
    return new Map(ledgers.map((ledger) => [
        ledger.ledId,
        {
            ledId: ledger.ledId,
            ledName: ledger.ledName,
            ledCompanyId: ledger.ledCompanyId,
            ledIsBillByBill: ledger.ledIsBillByBill,
            groupName: ledger.accGroupMaster?.accGroupName ?? null,
            groupNature: ledger.accGroupMaster?.accGroupNature ?? null,
        },
    ]));
}
function isBalanceSheetNature(nature) {
    return nature !== null && opening_balance_enum_1.BALANCE_SHEET_NATURES.includes(nature);
}
async function staleLaterYears(client, params) {
    const laterYears = await client.accOpeningBalance.findMany({
        where: {
            opCompanyId: params.companyId,
            opIsDeleted: false,
            opSource: opening_balance_enum_1.OpeningSource.CARRY_FORWARD,
            opIsStale: false,
            ...(params.branchId === null ? {} : { OR: [{ opBranchId: params.branchId }, { opBranchId: null }] }),
        },
        select: { opAccYear: true },
        distinct: ['opAccYear'],
    });
    const affected = laterYears
        .map((row) => row.opAccYear)
        .filter((year) => (0, opening_balance_utils_1.isAccYearAfter)(year, params.accYear));
    if (affected.length === 0) {
        return [];
    }
    await client.accOpeningBalance.updateMany({
        where: {
            opCompanyId: params.companyId,
            opAccYear: { in: affected },
            opIsDeleted: false,
            opSource: opening_balance_enum_1.OpeningSource.CARRY_FORWARD,
            opIsStale: false,
            ...(params.branchId === null ? {} : { OR: [{ opBranchId: params.branchId }, { opBranchId: null }] }),
        },
        data: {
            opIsStale: true,
            opStaleSince: new Date(),
            opStaleReason: params.reason,
            opStaleRefId: params.refId,
            opStaleRefAccYear: params.refId ? params.accYear : null,
        },
    });
    return affected.sort();
}
async function countBillsByOpening(client, accYear, opIds) {
    if (opIds.length === 0) {
        return new Map();
    }
    const grouped = await client.accBillBalance.groupBy({
        by: ['ablSrcDocId'],
        where: {
            ablSrcDocType: opening_balance_enum_1.OPENING_SRC_DOC_TYPE,
            ablSrcDocId: { in: [...opIds] },
            ablAccYear: accYear,
            ablIsDeleted: false,
        },
        _count: { _all: true },
    });
    return new Map(grouped
        .filter((row) => row.ablSrcDocId !== null)
        .map((row) => [row.ablSrcDocId, row._count._all]));
}
//# sourceMappingURL=opening-balance.guards.js.map