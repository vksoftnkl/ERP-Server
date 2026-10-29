"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateVoucherNumber = allocateVoucherNumber;
exports.allocateVoucherSlno = allocateVoucherSlno;
exports.buildRefno = buildRefno;
const module_shared_utils_1 = require("../utils/module-shared.utils");
const sequence_error_codes_1 = require("./types/sequence-error-codes");
const client_1 = require("@prisma/client");
const VOUCHER_SEQ_LOCK_NAMESPACE = 'accounts.acc_voucher_seq.allocate';
const VOUCHER_SLNO_LOCK_NAMESPACE = 'accounts.acc_voucher_header.voucher_slno';
const DEFAULT_DEVICE_CODE = 'MAIN';
const NO_RESET_PERIOD_KEY = 'ALL';
const REFNO_MAX_LENGTH = 100;
const INITIAL_LAST_NO = BigInt(0);
async function allocateVoucherNumber(tx, scope) {
    const vchrTypeId = scope.vchrTypeId;
    if (!Number.isInteger(vchrTypeId) || vchrTypeId <= 0) {
        (0, module_shared_utils_1.throwBadRequest)('vchrTypeId must be a positive integer.', [
            {
                field: 'vchrTypeId',
                code: sequence_error_codes_1.SequenceErrorCode.FIELD_NOT_INTEGER,
                message: 'vchrTypeId must be a positive integer.',
            },
        ]);
    }
    const companyId = requireText(scope.companyId, 'companyId');
    const branchId = requireText(scope.branchId, 'branchId');
    const accYear = requireText(scope.accYear, 'accYear');
    const deviceCode = scope.deviceCode?.trim() || DEFAULT_DEVICE_CODE;
    const voucherType = await tx.accVoucherType.findFirst({
        where: {
            vchrTypeId,
        },
        select: {
            vchrTypeId: true,
            vchrNoPrefix: true,
            vchrNoSuffix: true,
            vchrNoWidth: true,
            vchrResetFreq: true,
        },
    });
    if (!voucherType) {
        (0, module_shared_utils_1.throwNotFound)(`Voucher type ${vchrTypeId} was not found.`, 'vchrTypeId', `Voucher type ${vchrTypeId} was not found.`, sequence_error_codes_1.SequenceErrorCode.VOUCHER_TYPE_NOT_FOUND);
    }
    const periodKey = buildPeriodKey(voucherType.vchrResetFreq, accYear, scope.documentDate);
    const resolvedScope = {
        vchrTypeId,
        companyId,
        branchId,
        accYear,
        deviceCode,
        periodKey,
    };
    await acquireScopeLock(tx, resolvedScope);
    const sequence = await findOrCreateSequence(tx, resolvedScope, voucherType);
    const consumed = await tx.accVoucherSeq.update({
        where: {
            id: sequence.id,
        },
        data: {
            lastNo: {
                increment: 1,
            },
        },
    });
    const refno = buildRefno(consumed);
    await tx.accVoucherSeq.update({
        where: {
            id: sequence.id,
        },
        data: {
            lastRefno: refno,
            modifiedOn: new Date(),
        },
    });
    return {
        lastNo: consumed.lastNo,
        refno,
        periodKey,
    };
}
async function allocateVoucherSlno(tx, companyId, accYear) {
    const lockKey = [companyId, accYear].join('|');
    await tx.$queryRaw `
    -- The lock sits in the select list: an unreferenced CTE is never run,
    -- so the old WITH advisory_lock AS (...) form took no lock at all.
    SELECT count(pg_advisory_xact_lock(
             hashtext(${VOUCHER_SLNO_LOCK_NAMESPACE}),
             hashtext(${lockKey})
           ))::int AS locked
  `;
    const rows = await tx.$queryRaw `
    SELECT COALESCE(MAX(avh_voucher_slno), 0) + 1 AS next_slno
    FROM accounts.acc_voucher_header
    WHERE avh_company_id = ${companyId}::uuid
      AND avh_acc_year = ${accYear}
  `;
    return rows[0]?.next_slno ?? BigInt(1);
}
function buildRefno(sequence) {
    const prefix = sequence.voucherPrefix?.trim() ?? '';
    const suffix = sequence.voucherSuffix?.trim() ?? '';
    const digits = sequence.lastNo.toString();
    const width = Math.max(sequence.noWidth, digits.length);
    const refno = `${prefix}${digits.padStart(width, '0')}${suffix}`;
    if (refno.length > REFNO_MAX_LENGTH) {
        const message = `Generated reference number "${refno}" exceeds ${REFNO_MAX_LENGTH} characters. Shorten the prefix, suffix, or number width on voucher type ${sequence.vchrTypeId}.`;
        (0, module_shared_utils_1.throwBadRequest)(message, [
            { field: 'vchrTypeId', code: sequence_error_codes_1.SequenceErrorCode.REFNO_TOO_LONG, message },
        ]);
    }
    return refno;
}
async function findOrCreateSequence(tx, scope, voucherType) {
    const existing = await tx.accVoucherSeq.findFirst({
        where: {
            vchrTypeId: scope.vchrTypeId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: scope.accYear,
            deviceCode: scope.deviceCode,
            periodKey: scope.periodKey,
        },
    });
    if (existing) {
        if (existing.isDeleted || !existing.isActive) {
            const message = `Voucher sequence ${existing.id} for voucher type ${scope.vchrTypeId} is inactive. Reactivate it before creating documents in ${scope.accYear}.`;
            (0, module_shared_utils_1.throwBadRequest)(message, [
                { field: 'vchrTypeId', code: sequence_error_codes_1.SequenceErrorCode.INACTIVE, message },
            ]);
        }
        return existing;
    }
    const [company, branch] = await Promise.all([
        tx.company.findFirst({
            where: {
                compId: scope.companyId,
                compIsDeleted: false,
            },
            select: {
                compCode: true,
            },
        }),
        tx.branchMaster.findFirst({
            where: {
                brId: scope.branchId,
                brCompId: scope.companyId,
                brIsDeleted: false,
            },
            select: {
                brCode: true,
            },
        }),
    ]);
    if (!company) {
        const message = `No active company found with id ${scope.companyId}.`;
        (0, module_shared_utils_1.throwBadRequest)(message, [
            { field: 'companyId', code: sequence_error_codes_1.SequenceErrorCode.COMPANY_NOT_FOUND, message },
        ]);
    }
    if (!branch) {
        const message = `No active branch found with id ${scope.branchId} for company ${scope.companyId}.`;
        (0, module_shared_utils_1.throwBadRequest)(message, [
            { field: 'branchId', code: sequence_error_codes_1.SequenceErrorCode.BRANCH_NOT_FOUND, message },
        ]);
    }
    return tx.accVoucherSeq.create({
        data: {
            ...scope,
            lastNo: INITIAL_LAST_NO,
            voucherPrefix: voucherType.vchrNoPrefix,
            voucherSuffix: voucherType.vchrNoSuffix,
            noWidth: voucherType.vchrNoWidth,
            companyCode: company.compCode,
            branchCode: branch.brCode,
        },
    });
}
function buildPeriodKey(resetFreq, accYear, documentDate) {
    const reference = documentDate && !Number.isNaN(documentDate.getTime()) ? documentDate : new Date();
    const year = String(reference.getUTCFullYear());
    const month = String(reference.getUTCMonth() + 1).padStart(2, '0');
    const day = String(reference.getUTCDate()).padStart(2, '0');
    switch (resetFreq) {
        case client_1.VoucherResetFreq.NEVER:
            return NO_RESET_PERIOD_KEY;
        case client_1.VoucherResetFreq.DAILY:
            return `${year}-${month}-${day}`;
        case client_1.VoucherResetFreq.MONTHLY:
            return `${year}-${month}`;
        case client_1.VoucherResetFreq.YEARLY:
        default:
            return accYear;
    }
}
async function acquireScopeLock(tx, scope) {
    const lockKey = [
        scope.vchrTypeId,
        scope.companyId,
        scope.branchId,
        scope.accYear,
        scope.deviceCode,
        scope.periodKey,
    ].join('|');
    await tx.$queryRaw `
    -- The lock sits in the select list: an unreferenced CTE is never run,
    -- so the old WITH advisory_lock AS (...) form took no lock at all.
    SELECT count(pg_advisory_xact_lock(
             hashtext(${VOUCHER_SEQ_LOCK_NAMESPACE}),
             hashtext(${lockKey})
           ))::int AS locked
  `;
}
function requireText(value, fieldName) {
    const trimmed = value?.trim();
    if (!trimmed) {
        (0, module_shared_utils_1.throwBadRequest)(`${fieldName} is required.`, [
            {
                field: fieldName,
                code: sequence_error_codes_1.SequenceErrorCode.FIELD_EMPTY,
                message: `${fieldName} is required.`,
            },
        ]);
    }
    return trimmed;
}
//# sourceMappingURL=voucher-sequence.helper.js.map