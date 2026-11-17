"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GST_OUTWARD_SIDE = exports.GST_DOC_NO_MAX_LENGTH = exports.KNOWN_FORMAT_TOKENS = exports.SEQ_VOUCHER_SUFFIX_MAX_LENGTH = exports.SEQ_VOUCHER_PREFIX_MAX_LENGTH = void 0;
exports.allocateVoucherNumber = allocateVoucherNumber;
exports.previewNextVoucherNumber = previewNextVoucherNumber;
exports.allocateVoucherSlno = allocateVoucherSlno;
exports.buildRefno = buildRefno;
exports.expandVoucherFormat = expandVoucherFormat;
exports.scanFormatTokens = scanFormatTokens;
exports.shortAccYear = shortAccYear;
exports.fillVoucherFormatTokens = fillVoucherFormatTokens;
exports.voucherStartNo = voucherStartNo;
exports.firstVoucherNumber = firstVoucherNumber;
exports.formatHasBranchToken = formatHasBranchToken;
exports.assertCounterRules = assertCounterRules;
exports.acquireVoucherScopeLock = acquireVoucherScopeLock;
const module_shared_utils_1 = require("../utils/module-shared.utils");
const branch_number_code_helper_1 = require("./branch-number-code.helper");
const sequence_error_codes_1 = require("./types/sequence-error-codes");
const client_1 = require("@prisma/client");
const VOUCHER_SEQ_LOCK_NAMESPACE = 'accounts.acc_voucher_seq.allocate';
const VOUCHER_SLNO_LOCK_NAMESPACE = 'accounts.acc_voucher_header.voucher_slno';
const DEFAULT_DEVICE_CODE = 'MAIN';
const NO_RESET_PERIOD_KEY = 'ALL';
const REFNO_MAX_LENGTH = 100;
const POSTED_REFNO_MAX_LENGTH = 50;
exports.SEQ_VOUCHER_PREFIX_MAX_LENGTH = 60;
exports.SEQ_VOUCHER_SUFFIX_MAX_LENGTH = 20;
const FORMAT_TOKEN = /\{([^{}]*)\}/g;
exports.KNOWN_FORMAT_TOKENS = ['FY', 'YY', 'BR'];
const ACC_YEAR_SHAPE = /^(\d{4})-(\d{4})$/;
exports.GST_DOC_NO_MAX_LENGTH = 16;
exports.GST_OUTWARD_SIDE = 'OUTPUT';
const VOUCHER_TYPE_FORMAT_SELECT = {
    vchrTypeId: true,
    vchrNoPrefix: true,
    vchrNoSuffix: true,
    vchrNoWidth: true,
    vchrResetFreq: true,
    vchrStartNo: true,
    vchrNumberingMode: true,
    vchrGstSide: true,
    vchrParentId: true,
};
function typedNumberFor(voucherType, typedRefno) {
    const mode = voucherType.vchrNumberingMode ?? client_1.VoucherNumberingMode.AUTO;
    if (mode === client_1.VoucherNumberingMode.AUTO) {
        return null;
    }
    const typed = typedRefno?.trim() || null;
    if (typed === null) {
        if (mode === client_1.VoucherNumberingMode.AUTO_MANUAL) {
            return null;
        }
        const message = `Voucher type ${voucherType.vchrTypeId} is numbered by hand; the document number is required.`;
        (0, module_shared_utils_1.throwUnprocessable)(message, [
            { field: 'typedRefno', code: sequence_error_codes_1.SequenceErrorCode.NUMBER_REQUIRED, message },
        ]);
    }
    if (typed.length > POSTED_REFNO_MAX_LENGTH) {
        const message = `The typed number "${typed}" has ${typed.length} characters; a document number may have at most ${POSTED_REFNO_MAX_LENGTH}.`;
        (0, module_shared_utils_1.throwBadRequest)(message, [
            { field: 'typedRefno', code: sequence_error_codes_1.SequenceErrorCode.REFNO_TOO_LONG, message },
        ]);
    }
    return typed;
}
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
        select: VOUCHER_TYPE_FORMAT_SELECT,
    });
    if (!voucherType) {
        (0, module_shared_utils_1.throwNotFound)(`Voucher type ${vchrTypeId} was not found.`, 'vchrTypeId', `Voucher type ${vchrTypeId} was not found.`, sequence_error_codes_1.SequenceErrorCode.VOUCHER_TYPE_NOT_FOUND);
    }
    const periodKey = buildPeriodKey(voucherType.vchrResetFreq, accYear, scope.documentDate);
    const typed = typedNumberFor(voucherType, scope.typedRefno);
    if (typed !== null) {
        return { lastNo: BigInt(0), refno: typed, periodKey, typed: true };
    }
    const resolvedScope = {
        vchrTypeId,
        companyId,
        branchId,
        accYear,
        deviceCode,
        periodKey,
    };
    await acquireVoucherScopeLock(tx, resolvedScope);
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
async function previewNextVoucherNumber(client, scope) {
    const voucherType = await client.accVoucherType.findFirst({
        where: { vchrTypeId: scope.vchrTypeId },
        select: VOUCHER_TYPE_FORMAT_SELECT,
    });
    if (!voucherType) {
        return { refno: null, code: sequence_error_codes_1.SequenceErrorCode.VOUCHER_TYPE_NOT_FOUND };
    }
    if ((voucherType.vchrNumberingMode ?? client_1.VoucherNumberingMode.AUTO) === client_1.VoucherNumberingMode.MANUAL) {
        return { refno: null, code: sequence_error_codes_1.SequenceErrorCode.NUMBER_REQUIRED };
    }
    const periodKey = buildPeriodKey(voucherType.vchrResetFreq, scope.accYear, scope.documentDate);
    const existing = await client.accVoucherSeq.findFirst({
        where: {
            vchrTypeId: scope.vchrTypeId,
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: scope.accYear,
            deviceCode: scope.deviceCode?.trim() || DEFAULT_DEVICE_CODE,
            periodKey,
        },
    });
    try {
        if (existing) {
            if (existing.isDeleted || !existing.isActive) {
                return { refno: null, code: sequence_error_codes_1.SequenceErrorCode.INACTIVE };
            }
            return {
                refno: buildRefno({ ...existing, lastNo: existing.lastNo + BigInt(1) }),
                code: null,
            };
        }
        const format = await expandVoucherFormat(client, scope, {
            prefix: voucherType.vchrNoPrefix,
            suffix: voucherType.vchrNoSuffix,
            noWidth: voucherType.vchrNoWidth,
        });
        const startNo = voucherStartNo(voucherType);
        await assertCounterRules(client, scope, voucherType, format, startNo);
        return { refno: firstVoucherNumber(format, startNo), code: null };
    }
    catch (error) {
        const code = refusalCodeOf(error);
        if (code === null) {
            throw error;
        }
        return { refno: null, code };
    }
}
function refusalCodeOf(error) {
    const response = error && typeof error.getResponse === 'function'
        ? error.getResponse()
        : null;
    const errors = response?.errors;
    const code = Array.isArray(errors) ? errors[0]?.code : undefined;
    return typeof code === 'string' ? code : null;
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
async function expandVoucherFormat(tx, scope, format) {
    if (!format.prefix?.includes('{') && !format.suffix?.includes('{')) {
        return format;
    }
    const tokens = [
        ...formatTokens(format.prefix, 'prefix', scope.vchrTypeId),
        ...formatTokens(format.suffix, 'suffix', scope.vchrTypeId),
    ];
    const values = {
        FY: scope.accYear,
        YY: tokens.includes('YY') ? requireShortAccYear(scope.accYear, scope.vchrTypeId) : '',
        BR: tokens.includes('BR') ? await requireBranchNumberCode(tx, scope.branchId) : '',
    };
    const expanded = {
        prefix: fillFormatTokens(format.prefix, values),
        suffix: fillFormatTokens(format.suffix, values),
        noWidth: format.noWidth,
    };
    assertFormatFits(expanded, scope.vchrTypeId);
    return expanded;
}
function formatTokens(text, part, vchrTypeId) {
    const { names, unknown } = scanFormatTokens(text);
    if (unknown !== undefined) {
        const message = `The number ${part} "${text}" of voucher type ${vchrTypeId} holds an unknown token "${unknown}". Only {FY}, {YY} and {BR} are expanded.`;
        (0, module_shared_utils_1.throwUnprocessable)(message, [
            {
                field: 'vchrTypeId',
                code: sequence_error_codes_1.SequenceErrorCode.FORMAT_TOKEN_UNKNOWN,
                message,
                params: { token: unknown.replace(/[{}]/g, ' ').trim() },
            },
        ]);
    }
    return names;
}
function scanFormatTokens(text) {
    if (!text?.includes('{')) {
        return { names: [], unknown: undefined };
    }
    const names = [];
    const rest = text.replace(FORMAT_TOKEN, (_whole, name) => {
        names.push(name);
        return '';
    });
    const unknown = names.find((name) => !exports.KNOWN_FORMAT_TOKENS.includes(name)) ??
        (/[{}]/.test(rest) ? text : undefined);
    return { names: names, unknown };
}
function shortAccYear(accYear) {
    const m = ACC_YEAR_SHAPE.exec(accYear.trim());
    return m ? `${m[1].slice(2)}-${m[2].slice(2)}` : null;
}
function requireShortAccYear(accYear, vchrTypeId) {
    const yy = shortAccYear(accYear);
    if (yy === null) {
        const message = `Voucher type ${vchrTypeId} prints {YY}, but the accounting year "${accYear}" is not shaped NNNN-NNNN.`;
        (0, module_shared_utils_1.throwUnprocessable)(message, [
            {
                field: 'vchrTypeId',
                code: sequence_error_codes_1.SequenceErrorCode.FORMAT_TOKEN_UNKNOWN,
                message,
                params: { token: 'YY' },
            },
        ]);
    }
    return yy;
}
function fillVoucherFormatTokens(text, values) {
    return fillFormatTokens(text, values);
}
async function requireBranchNumberCode(tx, branchId) {
    const code = await (0, branch_number_code_helper_1.branchNumberCode)(tx, branchId);
    if (!code) {
        const message = `Branch ${branchId} has neither a bill prefix nor a code to print in its document numbers.`;
        (0, module_shared_utils_1.throwUnprocessable)(message, [
            { field: 'branchId', code: sequence_error_codes_1.SequenceErrorCode.BRANCH_CODE_MISSING, message },
        ]);
    }
    if (!branch_number_code_helper_1.BRANCH_NUMBER_CODE_PATTERN.test(code)) {
        const message = `Branch ${branchId} prints "${code}" in its document numbers; it may have only letters, digits and "-", up to 10.`;
        (0, module_shared_utils_1.throwUnprocessable)(message, [
            {
                field: 'branchId',
                code: sequence_error_codes_1.SequenceErrorCode.BRANCH_CODE_INVALID,
                message,
                params: { branchCode: code },
            },
        ]);
    }
    return code;
}
function fillFormatTokens(text, values) {
    if (!text?.includes('{')) {
        return text;
    }
    return text.replace(FORMAT_TOKEN, (_whole, name) => values[name]);
}
function assertFormatFits(format, vchrTypeId) {
    const prefix = format.prefix ?? '';
    const suffix = format.suffix ?? '';
    const first = `${prefix.trim()}${'1'.padStart(Math.max(format.noWidth, 1), '0')}${suffix.trim()}`;
    let message = null;
    if (prefix.length > exports.SEQ_VOUCHER_PREFIX_MAX_LENGTH) {
        message = `The number prefix of voucher type ${vchrTypeId} expands to "${prefix}", over ${exports.SEQ_VOUCHER_PREFIX_MAX_LENGTH} characters.`;
    }
    else if (suffix.length > exports.SEQ_VOUCHER_SUFFIX_MAX_LENGTH) {
        message = `The number suffix of voucher type ${vchrTypeId} expands to "${suffix}", over ${exports.SEQ_VOUCHER_SUFFIX_MAX_LENGTH} characters.`;
    }
    else if (first.length > POSTED_REFNO_MAX_LENGTH) {
        message = `Voucher type ${vchrTypeId} would number documents like "${first}" (${first.length} characters); a document number may have at most ${POSTED_REFNO_MAX_LENGTH}.`;
    }
    if (message) {
        (0, module_shared_utils_1.throwBadRequest)(message, [
            { field: 'vchrTypeId', code: sequence_error_codes_1.SequenceErrorCode.REFNO_TOO_LONG, message },
        ]);
    }
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
    const format = await expandVoucherFormat(tx, scope, {
        prefix: voucherType.vchrNoPrefix,
        suffix: voucherType.vchrNoSuffix,
        noWidth: voucherType.vchrNoWidth,
    });
    const startNo = voucherStartNo(voucherType);
    await assertCounterRules(tx, scope, voucherType, format, startNo);
    return tx.accVoucherSeq.create({
        data: {
            ...scope,
            lastNo: BigInt(startNo - 1),
            voucherPrefix: format.prefix,
            voucherSuffix: format.suffix,
            noWidth: voucherType.vchrNoWidth,
            companyCode: company.compCode,
            branchCode: branch.brCode,
        },
    });
}
function voucherStartNo(voucherType) {
    const n = voucherType.vchrStartNo;
    return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : 1;
}
function firstVoucherNumber(format, startNo = 1) {
    const digits = String(Math.max(1, startNo));
    const width = Math.max(format.noWidth, 1, digits.length);
    return `${(format.prefix ?? '').trim()}${digits.padStart(width, '0')}${(format.suffix ?? '').trim()}`;
}
function formatHasBranchToken(prefix, suffix) {
    return [prefix, suffix].some((t) => scanFormatTokens(t).names.includes('BR'));
}
async function assertCounterRules(tx, scope, voucherType, format, startNo) {
    if (voucherType.vchrGstSide !== exports.GST_OUTWARD_SIDE) {
        return;
    }
    const first = firstVoucherNumber(format, startNo);
    if (first.length > exports.GST_DOC_NO_MAX_LENGTH) {
        const message = `Voucher type ${scope.vchrTypeId} would number GST documents at this branch like "${first}" (${first.length} characters); a GST invoice number may have at most ${exports.GST_DOC_NO_MAX_LENGTH}.`;
        (0, module_shared_utils_1.throwUnprocessable)(message, [
            {
                field: 'vchrTypeId',
                code: sequence_error_codes_1.SequenceErrorCode.REFNO_TOO_LONG,
                message,
                rule: 'GST16',
                params: { sample: first, len: String(first.length) },
            },
        ]);
    }
    if (voucherType.vchrParentId == null ||
        formatHasBranchToken(voucherType.vchrNoPrefix, voucherType.vchrNoSuffix)) {
        return;
    }
    const [row] = await tx.$queryRaw `
    WITH me AS (
      SELECT COALESCE(NULLIF(btrim(b.br_gstin_no), ''), NULLIF(btrim(c.comp_gstin_no), '')) AS gstin
        FROM public.branch_master b
        JOIN public.companys c ON c.comp_id = b.br_comp_id
       WHERE b.br_id = ${scope.branchId}::uuid)
    SELECT count(*)::int AS sharing
      FROM public.branch_master b
      JOIN public.companys c ON c.comp_id = b.br_comp_id
      JOIN me ON me.gstin IS NOT NULL
     WHERE b.br_comp_id = ${scope.companyId}::uuid
       AND b.br_is_deleted = false
       AND b.br_is_active = true
       AND COALESCE(NULLIF(btrim(b.br_gstin_no), ''), NULLIF(btrim(c.comp_gstin_no), '')) = me.gstin`;
    if ((row?.sharing ?? 0) >= 2) {
        const message = `Voucher type ${scope.vchrTypeId} has no {BR} in its number, and ${row.sharing} active branches of this company share this branch's GSTIN: their numbers would repeat.`;
        (0, module_shared_utils_1.throwUnprocessable)(message, [
            { field: 'vchrTypeId', code: sequence_error_codes_1.SequenceErrorCode.BR_REQUIRED, message },
        ]);
    }
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
async function acquireVoucherScopeLock(tx, scope) {
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