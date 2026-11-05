"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OVERSEAS_STATE_CODE = exports.PARTY_GST_TYPES = void 0;
exports.normalizePartyGstType = normalizePartyGstType;
exports.ledgerGstFieldsOf = ledgerGstFieldsOf;
exports.resolvePartyGstType = resolvePartyGstType;
exports.partyGstTypeWord = partyGstTypeWord;
const account_ledger_master_enum_1 = require("../../modules/accountsModule/accountLedgerMasters/types/account-ledger-master-enum");
const party_gstin_1 = require("./party-gstin");
exports.PARTY_GST_TYPES = [
    'REGULAR',
    'COMPOSITION',
    'SEZ',
    'OVERSEAS',
    'UNREGISTERED',
];
exports.OVERSEAS_STATE_CODE = '96';
const GSTIN_TYPES = new Set(['REGULAR', 'COMPOSITION', 'SEZ']);
const LEGACY_KEYS = {
    REGULAR: 'REGULAR',
    COMPOSITION: 'COMPOSITION',
    SEZ: 'SEZ',
    SEZUNIT: 'SEZ',
    OVERSEAS: 'OVERSEAS',
    UNREGISTERED: 'UNREGISTERED',
};
function normalizePartyGstType(raw) {
    if (raw === null || raw === undefined) {
        return null;
    }
    const key = raw.trim().toUpperCase().replace(/[\s_-]+/g, '');
    if (key === '') {
        return null;
    }
    return LEGACY_KEYS[key] ?? 'INVALID';
}
function ledgerGstFieldsOf(type) {
    switch (type) {
        case 'REGULAR':
            return { ledGstPartyRegType: account_ledger_master_enum_1.LedGstPartyRegType.REGULAR, ledIsSez: false };
        case 'COMPOSITION':
            return { ledGstPartyRegType: account_ledger_master_enum_1.LedGstPartyRegType.COMPOSITION, ledIsSez: false };
        case 'SEZ':
            return { ledGstPartyRegType: account_ledger_master_enum_1.LedGstPartyRegType.REGULAR, ledIsSez: true };
        case 'OVERSEAS':
        case 'UNREGISTERED':
            return { ledGstPartyRegType: account_ledger_master_enum_1.LedGstPartyRegType.UNREGISTERED, ledIsSez: false };
    }
}
function resolvePartyGstType(input) {
    const gstin = typeof input.gstin === 'string' && input.gstin.trim() !== '' ? input.gstin.trim() : null;
    const normalized = normalizePartyGstType(input.rawType);
    if (normalized === 'INVALID') {
        return { refusal: { kind: 'TYPE_INVALID', sent: String(input.rawType) } };
    }
    if (normalized === null && gstin !== null) {
        return { refusal: { kind: 'TYPE_REQUIRED' } };
    }
    const type = normalized ?? 'UNREGISTERED';
    if (GSTIN_TYPES.has(type) && gstin === null) {
        return { refusal: { kind: 'GSTIN_REQUIRED', type } };
    }
    if (!GSTIN_TYPES.has(type) && gstin !== null) {
        return { refusal: { kind: 'GSTIN_NOT_ALLOWED', type } };
    }
    if (type === 'OVERSEAS' && input.stateCode !== exports.OVERSEAS_STATE_CODE) {
        return { refusal: { kind: 'OVERSEAS_STATE', stateCode: input.stateCode } };
    }
    if (input.checkGstinState !== false && gstin !== null && (0, party_gstin_1.gstinKindOf)(gstin) === 'NORMAL') {
        const gstinState = gstin.slice(0, 2);
        if (gstinState !== input.stateCode) {
            return {
                refusal: { kind: 'GSTIN_STATE_MISMATCH', gstin, gstinState, stateCode: input.stateCode },
            };
        }
    }
    return { type };
}
function partyGstTypeWord(type) {
    switch (type) {
        case 'REGULAR':
            return 'Regular';
        case 'COMPOSITION':
            return 'Composition';
        case 'SEZ':
            return 'SEZ';
        case 'OVERSEAS':
            return 'Overseas';
        case 'UNREGISTERED':
            return 'Unregistered';
    }
}
//# sourceMappingURL=party-gst-type.js.map