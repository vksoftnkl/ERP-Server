"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPIRY_GRACE_SETTING_KEY = exports.RELOT_IN_CODE = exports.RELOT_OUT_CODE = exports.STOCK_ADJUSTMENT_RULES = exports.STOCK_ADJUSTMENT_KINDS = void 0;
exports.isStockAdjustmentKind = isStockAdjustmentKind;
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
exports.STOCK_ADJUSTMENT_KINDS = ['ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF'];
function isStockAdjustmentKind(value) {
    return typeof value === 'string' && exports.STOCK_ADJUSTMENT_KINDS.includes(value);
}
const EVERY_OTHER_TYPE = [
    'OPENING',
    'RECEIPT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'PHYSICAL',
    'REPACK_IN',
    'REPACK_OUT',
];
function rules(voucherType, overrides) {
    return {
        voucherType,
        requiresToGodown: false,
        requiresFromGodown: true,
        isInward: false,
        quantityMode: 'QTY',
        defaultRateSource: 'AVG_COST',
        allowsRepeatHolding: true,
        allowsCount: false,
        allowsToBranch: false,
        postShape: 'SIMPLE',
        lineDirection: 'REASON',
        allowsLot: true,
        blockNegative: true,
        auditScreenName: 'Stock Adjustment',
        statusDocType: txn_status_log_helper_1.TxnStatusDocType.STOCK_ADJUSTMENT,
        refuseTypes: EVERY_OTHER_TYPE,
        ...overrides,
    };
}
exports.STOCK_ADJUSTMENT_RULES = {
    ADJUSTMENT: rules('ADJUSTMENT', {
        typeCode: 'ADJ',
        displayName: 'Stock adjustment',
        ledgerTxnTypes: ['ADJUST_PLUS', 'ADJUST_MINUS'],
        requiresFromGodown: false,
    }),
    ISSUE: rules('ISSUE', {
        typeCode: 'ISS',
        displayName: 'Stock issue',
        ledgerTxnTypes: ['ADJUST_MINUS', 'SAMPLE_ISSUE', 'GIFT_ISSUE'],
    }),
    DAMAGE: rules('DAMAGE', {
        typeCode: 'DMG',
        displayName: 'Damage write-off',
        ledgerTxnTypes: ['DAMAGE'],
    }),
    EXPIRY_WRITEOFF: rules('EXPIRY_WRITEOFF', {
        typeCode: 'EXP',
        displayName: 'Expiry write-off',
        ledgerTxnTypes: ['EXPIRY_WRITEOFF'],
    }),
};
exports.RELOT_OUT_CODE = 'RELOT_OUT';
exports.RELOT_IN_CODE = 'RELOT_IN';
exports.EXPIRY_GRACE_SETTING_KEY = 'stock.expiry_writeoff_grace_days';
//# sourceMappingURL=stock-adjustment.rules.js.map