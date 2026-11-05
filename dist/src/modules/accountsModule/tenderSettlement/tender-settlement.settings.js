"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENDER_SETTING_DEFAULTS = void 0;
exports.readTenderSettings = readTenderSettings;
const client_1 = require("@prisma/client");
const tender_settlement_enum_1 = require("./types/tender-settlement-enum");
exports.TENDER_SETTING_DEFAULTS = {
    duplicateRef: 'BLOCK',
    closeByTerminal: true,
    matchWindowMinutes: 30,
    matchAmountTolerance: new client_1.Prisma.Decimal(0),
    settleGraceDays: 2,
};
function readTenderSettings(effective) {
    const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));
    const d = exports.TENDER_SETTING_DEFAULTS;
    const duplicate = byKey.get(tender_settlement_enum_1.TenderSettingKey.DUPLICATE_REF)?.trim().toUpperCase();
    const bool = byKey.get(tender_settlement_enum_1.TenderSettingKey.CLOSE_BY_TERMINAL)?.trim().toLowerCase();
    return {
        duplicateRef: duplicate === 'WARN' || duplicate === 'BLOCK' ? duplicate : d.duplicateRef,
        closeByTerminal: bool === undefined || bool === ''
            ? d.closeByTerminal
            : ['true', '1', 'yes', 'y', 'on'].includes(bool),
        matchWindowMinutes: int(byKey.get(tender_settlement_enum_1.TenderSettingKey.MATCH_WINDOW_MINUTES), d.matchWindowMinutes),
        matchAmountTolerance: decimal(byKey.get(tender_settlement_enum_1.TenderSettingKey.MATCH_AMOUNT_TOLERANCE), d.matchAmountTolerance),
        settleGraceDays: int(byKey.get(tender_settlement_enum_1.TenderSettingKey.SETTLE_GRACE_DAYS), d.settleGraceDays),
    };
}
function int(value, fallback) {
    const parsed = Number.parseInt(value?.trim() ?? '', 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function decimal(value, fallback) {
    const token = value?.trim();
    if (!token)
        return fallback;
    try {
        const parsed = new client_1.Prisma.Decimal(token);
        return parsed.isNegative() || !parsed.isFinite() ? fallback : parsed;
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=tender-settlement.settings.js.map