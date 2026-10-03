"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadVoucherType = loadVoucherType;
exports.writeChequeVoucher = writeChequeVoucher;
exports.allocateNumber = allocateNumber;
exports.loadVoucherRef = loadVoucherRef;
exports.loadVoucherLegs = loadVoucherLegs;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const voucher_totals_helper_1 = require("../accountVoucherHeader/voucher-totals.helper");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_guards_1 = require("../receipt/receipt.guards");
const receipt_utils_1 = require("../receipt/receipt.utils");
const cheque_enum_1 = require("./types/cheque-enum");
async function loadVoucherType(tx, code, field) {
    const type = await tx.accVoucherType.findFirst({
        where: { vchrTypeCode: code },
        select: { vchrTypeId: true, vchrTypeCode: true, vchrTypeName: true, vchrIsActive: true },
    });
    if (!type || !type.vchrIsActive) {
        (0, module_service_utils_1.throwAccountsNotFound)('Voucher type is not configured', field, `accounts.acc_voucher_types has no active row with vchr_type_code = '${code}'. ` +
            'Run migration 20260916120000.');
    }
    return {
        vchrTypeId: type.vchrTypeId,
        vchrTypeCode: type.vchrTypeCode,
        vchrTypeName: type.vchrTypeName,
    };
}
async function writeChequeVoucher(tx, params) {
    const type = await loadVoucherType(tx, params.typeCode, params.field);
    await (0, receipt_guards_1.assertAccYearWritable)(tx, params.companyId, params.accYear, params.field);
    await (0, receipt_guards_1.assertVoucherPartitionExists)(tx, params.accYear, params.field);
    const legs = params.legs.filter((leg) => leg.amount.greaterThan(0));
    if (legs.length === 0) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Nothing to post', [
            {
                field: params.field,
                message: 'Every leg of this voucher came to zero, so there is nothing to record.',
            },
        ]);
    }
    const number = await allocateNumber(tx, {
        companyId: params.companyId,
        branchId: params.branchId,
        accYear: params.accYear,
        voucherTypeId: type.vchrTypeId,
        voucherDate: params.voucherDate,
    });
    const header = await createHeader(tx, params, type, number);
    await tx.accVoucher.createMany({
        data: legs.map((leg, index) => ({
            avVoucherId: header.avhVoucherId,
            avCompanyId: params.companyId,
            avBranchId: params.branchId,
            avTenantId: params.tenantId,
            avAccYear: params.accYear,
            avVoucherTypeId: type.vchrTypeId,
            avVoucherNo: number.voucherNo,
            avRowNo: index + 1,
            avVoucherDate: params.voucherDate,
            avVoucherRefno: number.voucherRefno,
            avDrCr: leg.drCr,
            avLedgerId: leg.ledgerId,
            avAmount: leg.amount,
            avRole: leg.role ?? null,
            avRemarks: leg.remarks ?? null,
            avReconDate: leg.reconDate ?? null,
            avSessionId: params.sessionId ?? null,
            avUserId: params.userId,
            avCreatedBy: params.actor,
        })),
    });
    const totals = await (0, voucher_totals_helper_1.deriveVoucherTotals)(tx, header.avhVoucherId, params.accYear);
    if (!totals.difference.isZero()) {
        (0, module_service_utils_1.throwAccountsBadRequest)('The voucher does not balance', [
            {
                field: params.field,
                message: `${number.voucherRefno} is out by ${totals.difference.abs().toFixed(2)} ` +
                    `(debit ${totals.totalDebit.toFixed(2)}, credit ${totals.totalCredit.toFixed(2)}). ` +
                    'Nothing has been posted.',
            },
        ]);
    }
    const now = new Date();
    await tx.accVoucherHeader.update({
        where: {
            avhVoucherId_avhAccYear: {
                avhVoucherId: header.avhVoucherId,
                avhAccYear: params.accYear,
            },
        },
        data: {
            avhVoucherStatus: receipt_enum_1.VoucherStatus.POSTED,
            avhStatusOn: now,
            avhStatusBy: params.actor,
            avhPostedOn: now,
        },
    });
    const ledgerNames = await loadLedgerNames(tx, legs.map((leg) => leg.ledgerId));
    return {
        ref: {
            voucherId: header.avhVoucherId,
            accYear: params.accYear,
            voucherRefno: number.voucherRefno,
            voucherDate: (0, receipt_utils_1.toDateString)(params.voucherDate) ?? '',
            voucherStatus: receipt_enum_1.VoucherStatus.POSTED,
            totalDebit: (0, receipt_utils_1.toAmount)(totals.totalDebit),
            totalCredit: (0, receipt_utils_1.toAmount)(totals.totalCredit),
        },
        legs: legs.map((leg, index) => ({
            rowNo: index + 1,
            drCr: leg.drCr,
            ledgerId: leg.ledgerId,
            ledgerName: ledgerNames.get(leg.ledgerId) ?? '',
            amount: (0, receipt_utils_1.toAmount)(leg.amount),
            role: leg.role ?? null,
            remarks: leg.remarks ?? null,
        })),
        voucherTypeId: type.vchrTypeId,
        voucherNo: number.voucherNo,
    };
}
async function createHeader(tx, params, type, number) {
    try {
        return await tx.accVoucherHeader.create({
            data: {
                avhCompanyId: params.companyId,
                avhBranchId: params.branchId,
                avhTenantId: params.tenantId,
                avhAccYear: params.accYear,
                avhVoucherTypeId: type.vchrTypeId,
                avhVoucherNo: number.voucherNo,
                avhVoucherSlno: number.voucherSlno,
                avhVoucherRefno: number.voucherRefno,
                avhVoucherDate: params.voucherDate,
                avhPartyId: params.partyId,
                avhEmployeeId: params.employeeId ?? [],
                avhDocAmount: params.docAmount,
                avhRemarks: params.remarks,
                avhAgainstVoucherId: params.againstVoucherId ?? null,
                avhAgainstAccYear: params.againstAccYear ?? null,
                avhSrcModule: params.srcDocId ? cheque_enum_1.CHEQUE_SRC_MODULE : null,
                avhSrcDocType: params.srcDocId ? cheque_enum_1.CHEQUE_SRC_DOC_TYPE : null,
                avhSrcDocId: params.srcDocId ?? null,
                avhDeviceType: params.deviceType ?? null,
                avhDeviceId: params.deviceId ?? null,
                avhSessionId: params.sessionId ?? null,
                avhUserId: params.userId,
                avhVoucherStatus: receipt_enum_1.VoucherStatus.DRAFT,
                avhCreatedBy: params.actor,
            },
            select: { avhVoucherId: true },
        });
    }
    catch (error) {
        if ((0, module_service_utils_1.isUniqueConstraintError)(error) && params.duplicateMessage) {
            (0, module_service_utils_1.throwAccountsConflict)('Already done', [
                { field: params.field, message: params.duplicateMessage },
            ]);
        }
        throw error;
    }
}
async function allocateNumber(tx, scope) {
    const allocated = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
        vchrTypeId: scope.voucherTypeId,
        companyId: scope.companyId,
        branchId: scope.branchId,
        accYear: scope.accYear,
        documentDate: scope.voucherDate,
    });
    const slno = await (0, voucher_sequence_helper_1.allocateVoucherSlno)(tx, scope.companyId, scope.accYear);
    return { voucherNo: allocated.lastNo, voucherSlno: slno, voucherRefno: allocated.refno };
}
async function loadLedgerNames(tx, ledgerIds) {
    const unique = [...new Set(ledgerIds)];
    if (unique.length === 0) {
        return new Map();
    }
    const ledgers = await tx.accLedgerMaster.findMany({
        where: { ledId: { in: unique } },
        select: { ledId: true, ledName: true },
    });
    return new Map(ledgers.map((ledger) => [ledger.ledId, ledger.ledName]));
}
async function loadVoucherRef(tx, voucherId, accYear) {
    if (!voucherId || !accYear) {
        return null;
    }
    const header = await tx.accVoucherHeader.findFirst({
        where: { avhVoucherId: voucherId, avhAccYear: accYear, avhIsDeleted: false },
        select: {
            avhVoucherId: true,
            avhAccYear: true,
            avhVoucherRefno: true,
            avhVoucherDate: true,
            avhVoucherStatus: true,
        },
    });
    if (!header) {
        return null;
    }
    const totals = await (0, voucher_totals_helper_1.deriveVoucherTotals)(tx, header.avhVoucherId, header.avhAccYear);
    return {
        voucherId: header.avhVoucherId,
        accYear: header.avhAccYear,
        voucherRefno: header.avhVoucherRefno,
        voucherDate: (0, receipt_utils_1.toDateString)(header.avhVoucherDate) ?? '',
        voucherStatus: header.avhVoucherStatus,
        totalDebit: (0, receipt_utils_1.toAmount)(totals.totalDebit),
        totalCredit: (0, receipt_utils_1.toAmount)(totals.totalCredit),
    };
}
async function loadVoucherLegs(tx, voucherId, accYear) {
    const legs = await tx.accVoucher.findMany({
        where: { avVoucherId: voucherId, avAccYear: accYear, avIsDeleted: false },
        orderBy: { avRowNo: 'asc' },
        select: {
            avRowNo: true,
            avDrCr: true,
            avLedgerId: true,
            avAmount: true,
            avRole: true,
            avRemarks: true,
            ledger: { select: { ledName: true } },
        },
    });
    return legs.map((leg) => ({
        rowNo: leg.avRowNo,
        drCr: leg.avDrCr,
        ledgerId: leg.avLedgerId,
        ledgerName: leg.ledger?.ledName ?? '',
        amount: (0, receipt_utils_1.toAmount)(leg.avAmount),
        role: leg.avRole,
        remarks: leg.avRemarks,
    }));
}
//# sourceMappingURL=cheque-voucher.helper.js.map