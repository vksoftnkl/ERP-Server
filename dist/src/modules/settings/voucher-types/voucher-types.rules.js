"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VT_DEFAULT_DELIVERY_MODE = exports.VT_DELIVERY_MODES = exports.sameValue = exports.NUMBERING_FIELDS = exports.BASE_LOCKED_FIELDS = exports.MIRROR_FIELDS = exports.START_NO_MAX = exports.WIDTH_MAX = exports.WIDTH_MIN = exports.ABBR_PATTERN = exports.ALLOWED_METHODS = exports.SCREEN_NUMBERED_CODES = exports.SALES_BILL_TYPE_CODE = exports.PARENT_TYPE_CODES = exports.VOUCHER_TYPES_TABLE_NAME = exports.VOUCHER_TYPES_AUDIT_SCREEN_NAME = exports.VOUCHER_TYPES_MENU_ID = void 0;
exports.kindOf = kindOf;
exports.numberedByOf = numberedByOf;
exports.isBaseType = isBaseType;
exports.canHaveChildren = canHaveChildren;
exports.isGstOutward = isGstOutward;
exports.printDocTypeOf = printDocTypeOf;
exports.childTypeCode = childTypeCode;
exports.issue = issue;
exports.checkNumbering = checkNumbering;
exports.sharedGstin = sharedGstin;
exports.checkChildIdentity = checkChildIdentity;
exports.lockedFieldChanges = lockedFieldChanges;
exports.hasDeliveryMode = hasDeliveryMode;
exports.effectiveDeliveryMode = effectiveDeliveryMode;
exports.checkDeliveryMode = checkDeliveryMode;
const client_1 = require("@prisma/client");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const sequence_error_codes_1 = require("../../../common/Sequence/types/sequence-error-codes");
const voucher_types_error_codes_1 = require("./types/voucher-types-error-codes");
exports.VOUCHER_TYPES_MENU_ID = 303;
exports.VOUCHER_TYPES_AUDIT_SCREEN_NAME = 'Voucher Types';
exports.VOUCHER_TYPES_TABLE_NAME = 'accounts.acc_voucher_types';
exports.PARENT_TYPE_CODES = ['Bil'];
exports.SALES_BILL_TYPE_CODE = 'Bil';
exports.SCREEN_NUMBERED_CODES = [
    'SRt',
    'GRN',
    'PUR',
    'PRN',
    'SHR',
    'PO',
    'SV-ADJ',
    'SV-ISS',
    'SV-DMG',
    'SV-EXP',
    'SV-TRF',
    'SV-TRI',
];
exports.ALLOWED_METHODS = [client_1.VoucherNumberingMode.AUTO];
exports.ABBR_PATTERN = /^[A-Za-z0-9]{1,6}$/;
const GST_DOC_NO_CHARS = /^[A-Za-z0-9/-]*$/;
exports.WIDTH_MIN = 1;
exports.WIDTH_MAX = 9;
exports.START_NO_MAX = 999_999_999;
const POSTED_REFNO_MAX_LENGTH = 50;
exports.MIRROR_FIELDS = [
    'vchrCategory',
    'vchrNature',
    'vchrAffectsAccounts',
    'vchrAffectsInventory',
    'vchrIsCashVoucher',
    'vchrIsBankVoucher',
    'vchrPartyMode',
    'vchrPartySide',
    'vchrBillwiseMode',
    'vchrRaiseBillType',
    'vchrDrGroups',
    'vchrCrGroups',
    'vchrGstRegister',
    'vchrGstSide',
    'vchrTdsMode',
    'vchrMenuId',
    'vchrInRegister',
    'vchrInstruments',
    'vchrTallyExportEnabled',
    'vchrTallyBaseVoucherType',
];
function kindOf(t) {
    if (!t.vchrAffectsAccounts) {
        return 'NUMBERING_ONLY';
    }
    return t.vchrInRegister ? 'VOUCHER_REGISTER' : 'DOCUMENT';
}
function numberedByOf(t) {
    return t.vchrParentId == null && exports.SCREEN_NUMBERED_CODES.includes(t.vchrTypeCode)
        ? 'SCREEN'
        : 'COUNTER';
}
function isBaseType(t) {
    return t.vchrParentId == null;
}
function canHaveChildren(t) {
    return t.vchrParentId == null && exports.PARENT_TYPE_CODES.includes(t.vchrTypeCode);
}
function isGstOutward(t) {
    return t.vchrGstSide === voucher_sequence_helper_1.GST_OUTWARD_SIDE;
}
function printDocTypeOf(base, basePurposeDocType) {
    if (basePurposeDocType) {
        return basePurposeDocType;
    }
    return base.vchrTypeCode === exports.SALES_BILL_TYPE_CODE ? 'SALE_BILL' : null;
}
function childTypeCode(baseCode, abbr, taken) {
    const stem = `${baseCode}-${abbr}`.slice(0, 20);
    const lowerTaken = new Set([...taken].map((c) => c.toLowerCase()));
    if (!lowerTaken.has(stem.toLowerCase())) {
        return stem;
    }
    for (let n = 2; n < 1000; n += 1) {
        const tail = `-${n}`;
        const candidate = `${stem.slice(0, 20 - tail.length)}${tail}`;
        if (!lowerTaken.has(candidate.toLowerCase())) {
            return candidate;
        }
    }
    throw new Error(`No free voucher type code for ${stem}`);
}
function issue(code, field, message, extra = {}) {
    return { field, code, message, ...extra };
}
const seriesKey = (prefix, suffix) => `${(prefix ?? '').trim().toUpperCase()}|${(suffix ?? '').trim().toUpperCase()}`;
function checkNumbering(d, f) {
    const errors = [];
    const warnings = [];
    const widthOk = Number.isInteger(d.width) && d.width >= exports.WIDTH_MIN && d.width <= exports.WIDTH_MAX;
    const startOk = Number.isInteger(d.startNo) && d.startNo >= 1 && d.startNo <= exports.START_NO_MAX;
    if (!widthOk) {
        errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.WIDTH_INVALID, 'vchrNoWidth', `The width ${d.width} is not 1 to ${exports.WIDTH_MAX}.`));
    }
    if (!startOk) {
        errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.START_NO_INVALID, 'vchrStartNo', `The starting number ${d.startNo} is not 1 to ${exports.START_NO_MAX}.`));
    }
    let tokensOk = true;
    const parts = [
        ['vchrNoPrefix', d.prefix],
        ['vchrNoSuffix', d.suffix],
    ];
    const names = new Set();
    for (const [field, text] of parts) {
        const scan = (0, voucher_sequence_helper_1.scanFormatTokens)(text);
        scan.names.forEach((n) => names.add(n));
        if (scan.unknown !== undefined) {
            tokensOk = false;
            errors.push(issue(sequence_error_codes_1.SequenceErrorCode.FORMAT_TOKEN_UNKNOWN, field, `"${text}" holds an unknown code "${scan.unknown}". Only {FY}, {YY} and {BR} are known.`, { params: { token: scan.unknown.replace(/[{}]/g, ' ').trim() } }));
        }
    }
    const yy = (0, voucher_sequence_helper_1.shortAccYear)(f.accYear);
    if (tokensOk && names.has('YY') && yy === null) {
        tokensOk = false;
        errors.push(issue(sequence_error_codes_1.SequenceErrorCode.FORMAT_TOKEN_UNKNOWN, 'vchrNoPrefix', `{YY} needs an accounting year shaped NNNN-NNNN, not "${f.accYear}".`, { params: { token: 'YY' } }));
    }
    if (d.mode !== client_1.VoucherNumberingMode.AUTO) {
        errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.METHOD_GST_AUTO_ONLY, 'vchrNumberingMode', f.gstOutward
            ? 'A GST invoice or note must be numbered automatically.'
            : `Method ${d.mode} needs a number box on the document's screen; none has one yet (Automatic only).`, f.gstOutward ? {} : { rule: 'NO_NUMBER_BOX' }));
    }
    const usesBr = (0, voucher_sequence_helper_1.formatHasBranchToken)(d.prefix, d.suffix);
    const sampleAt = (branchCode) => {
        if (!tokensOk) {
            return null;
        }
        const values = { FY: f.accYear, YY: yy ?? '', BR: branchCode ?? '{BR}' };
        const prefix = (0, voucher_sequence_helper_1.fillVoucherFormatTokens)(d.prefix, values) ?? '';
        const suffix = (0, voucher_sequence_helper_1.fillVoucherFormatTokens)(d.suffix, values) ?? '';
        const first = (0, voucher_sequence_helper_1.firstVoucherNumber)({ prefix, suffix, noWidth: widthOk ? d.width : 1 }, startOk ? d.startNo : 1);
        return { prefix, suffix, first };
    };
    const codes = usesBr
        ? [...new Set(f.branches.map((b) => b.numberCode).filter((c) => !!c))]
        : [null];
    const samples = codes
        .map((c) => sampleAt(c))
        .filter((s) => s !== null);
    const longest = samples.reduce((a, s) => (a === null || s.first.length > a.first.length ? s : a), null);
    if (longest) {
        if (longest.prefix.length > voucher_sequence_helper_1.SEQ_VOUCHER_PREFIX_MAX_LENGTH ||
            longest.suffix.length > voucher_sequence_helper_1.SEQ_VOUCHER_SUFFIX_MAX_LENGTH ||
            longest.first.length > POSTED_REFNO_MAX_LENGTH) {
            errors.push(issue(sequence_error_codes_1.SequenceErrorCode.REFNO_TOO_LONG, 'vchrNoPrefix', `Documents would be numbered like "${longest.first}" (${longest.first.length} characters); a document number may have at most ${POSTED_REFNO_MAX_LENGTH}.`));
        }
        else if (longest.first.length > voucher_sequence_helper_1.GST_DOC_NO_MAX_LENGTH) {
            const params = { sample: longest.first, len: String(longest.first.length) };
            if (f.gstOutward) {
                errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.NO_TOO_LONG, 'vchrNoPrefix', `${longest.first} has ${longest.first.length} characters; a GST invoice number may have ${voucher_sequence_helper_1.GST_DOC_NO_MAX_LENGTH} at most.`, { params }));
            }
            else {
                warnings.push(issue(voucher_types_error_codes_1.VoucherTypeWarningCode.NO_OVER_16, 'vchrNoPrefix', `${longest.first} has ${longest.first.length} characters: fine for this type, not for a GST invoice.`, { params }));
            }
        }
    }
    if (f.gstOutward) {
        const bare = [d.prefix, d.suffix].map((t) => (t ?? '').replace(/\{(FY|YY|BR)\}/g, '')).join('');
        if (tokensOk && !GST_DOC_NO_CHARS.test(bare)) {
            errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.NO_BAD_CHAR, 'vchrNoPrefix', 'A GST invoice number may have only letters, digits, / and -.'));
        }
        if (!usesBr) {
            const shared = sharedGstin(f.branches);
            if (shared) {
                errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.BR_REQUIRED, 'vchrNoPrefix', `${shared.count} active branches share GSTIN ${shared.gstin}; each needs its own numbers: put {BR} in the prefix.`, { params: { gstin: shared.gstin, branches: String(shared.count) } }));
            }
        }
    }
    const key = seriesKey(d.prefix, d.suffix);
    const clash = f.series.find((s) => s.vchrTypeId !== f.vchrTypeId && seriesKey(s.prefix, s.suffix) === key);
    if (clash) {
        const printed = [d.prefix, d.suffix].filter((t) => !!t?.trim()).join(' … ');
        errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.PREFIX_TAKEN, 'vchrNoPrefix', `${clash.vchrTypeName} already prints "${printed}" in this company.`, { params: { other: clash.vchrTypeName, prefix: printed } }));
    }
    const shown = sampleAt(usesBr ? (f.previewBranch?.numberCode ?? null) : null);
    return {
        errors,
        warnings,
        preview: {
            sample: shown?.first ?? null,
            length: shown?.first.length ?? null,
            branchCode: f.previewBranch?.numberCode ?? null,
            branchName: f.previewBranch?.branchName ?? null,
            accYear: f.accYear,
            gstLimit: f.gstOutward ? voucher_sequence_helper_1.GST_DOC_NO_MAX_LENGTH : null,
            clashWith: clash?.vchrTypeName ?? null,
        },
    };
}
function sharedGstin(branches) {
    const counts = new Map();
    for (const b of branches) {
        if (!b.gstin) {
            continue;
        }
        const k = `${b.companyId}|${b.gstin.toUpperCase()}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const [k, count] of counts) {
        if (count >= 2) {
            return { gstin: k.split('|')[1], count };
        }
    }
    return null;
}
function checkChildIdentity(draft, others, selfId) {
    const errors = [];
    const name = draft.name.trim();
    const abbr = draft.abbr.trim();
    const rest = others.filter((o) => o.vchrTypeId !== selfId);
    if (!name) {
        errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.NAME_REQUIRED, 'vchrTypeName', 'A voucher type needs a name.'));
    }
    else {
        const clash = rest.find((o) => o.vchrTypeName.trim().toLowerCase() === name.toLowerCase());
        if (clash) {
            errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.NAME_TAKEN, 'vchrTypeName', `Voucher type ${clash.vchrTypeId} is already named "${clash.vchrTypeName}".`, { params: { name: clash.vchrTypeName } }));
        }
    }
    if (!abbr) {
        errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.ABBR_REQUIRED, 'vchrTypeShort', 'A child type needs an abbreviation.'));
    }
    else if (!exports.ABBR_PATTERN.test(abbr)) {
        errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.ABBR_INVALID, 'vchrTypeShort', `"${abbr}" is not 1 to 6 letters or digits.`));
    }
    else {
        const clash = rest.find((o) => (o.vchrTypeShort ?? '').trim().toUpperCase() === abbr.toUpperCase());
        if (clash) {
            errors.push(issue(voucher_types_error_codes_1.VoucherTypeErrorCode.ABBR_TAKEN, 'vchrTypeShort', `${clash.vchrTypeName} already uses the abbreviation ${clash.vchrTypeShort}.`, { params: { other: clash.vchrTypeName } }));
        }
    }
    return errors;
}
exports.BASE_LOCKED_FIELDS = [
    'vchrTypeName',
    'vchrTypeShort',
    'vchrParentId',
    'vchrIsActive',
    'vchrTallyVoucherTypeName',
];
exports.NUMBERING_FIELDS = [
    'vchrNumberingMode',
    'vchrNoPrefix',
    'vchrNoSuffix',
    'vchrNoWidth',
    'vchrResetFreq',
    'vchrStartNo',
];
const sameValue = (a, b) => {
    const norm = (v) => (typeof v === 'string' ? v.trim() || null : (v ?? null));
    return norm(a) === norm(b);
};
exports.sameValue = sameValue;
function lockedFieldChanges(stored, draft, fields, why) {
    return fields
        .filter((k) => draft[k] !== undefined && !(0, exports.sameValue)(draft[k], stored[k]))
        .map((k) => issue(voucher_types_error_codes_1.VoucherTypeErrorCode.BASE_FIELD_LOCKED, k, `${k} ${why}`));
}
exports.VT_DELIVERY_MODES = ['INSTANT', 'PICKUP', 'DISPATCH'];
exports.VT_DEFAULT_DELIVERY_MODE = 'INSTANT';
function hasDeliveryMode(row, base) {
    if (!row) {
        return false;
    }
    if (row.vchrParentId == null) {
        return row.vchrTypeCode === exports.SALES_BILL_TYPE_CODE;
    }
    return base?.vchrTypeCode === exports.SALES_BILL_TYPE_CODE;
}
function effectiveDeliveryMode(own, baseMode, applies) {
    if (!applies) {
        return null;
    }
    const pick = (own ?? '').trim() || (baseMode ?? '').trim();
    return exports.VT_DELIVERY_MODES.includes(pick)
        ? pick
        : exports.VT_DEFAULT_DELIVERY_MODE;
}
function checkDeliveryMode(sent, resolved, ctx) {
    if (!ctx.applies) {
        return sent !== undefined && sent !== null
            ? [
                issue(voucher_types_error_codes_1.VoucherTypeErrorCode.DELIVERY_MODE_NOT_ALLOWED, 'vchrDeliveryMode', 'Only Sales Bill types have a delivery mode.'),
            ]
            : [];
    }
    void resolved;
    if (sent === null) {
        return [
            issue(voucher_types_error_codes_1.VoucherTypeErrorCode.DELIVERY_MODE_REQUIRED, 'vchrDeliveryMode', 'A Sales Bill type needs a delivery mode: Instant, Pickup or Dispatch.'),
        ];
    }
    return [];
}
//# sourceMappingURL=voucher-types.rules.js.map