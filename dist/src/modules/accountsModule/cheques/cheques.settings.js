"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHEQUE_SETTING_DEFAULTS = void 0;
exports.readChequeSettings = readChequeSettings;
const client_1 = require("@prisma/client");
const cheque_enum_1 = require("./types/cheque-enum");
exports.CHEQUE_SETTING_DEFAULTS = {
    bounceChargeToParty: new client_1.Prisma.Decimal(0),
    bounceReasons: [...cheque_enum_1.DEFAULT_BOUNCE_REASONS],
};
function readChequeSettings(effective) {
    const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));
    return {
        bounceChargeToParty: pickDecimal(byKey.get(cheque_enum_1.ChequeSettingKey.BOUNCE_CHARGE_TO_PARTY), exports.CHEQUE_SETTING_DEFAULTS.bounceChargeToParty),
        bounceReasons: pickStringList(byKey.get(cheque_enum_1.ChequeSettingKey.BOUNCE_REASONS), exports.CHEQUE_SETTING_DEFAULTS.bounceReasons),
    };
}
function pickDecimal(value, fallback) {
    const token = value?.trim();
    if (!token) {
        return fallback;
    }
    try {
        const parsed = new client_1.Prisma.Decimal(token);
        return parsed.isNegative() || !parsed.isFinite() ? fallback : parsed;
    }
    catch {
        return fallback;
    }
}
function pickStringList(value, fallback) {
    const token = value?.trim();
    if (!token) {
        return [...fallback];
    }
    try {
        const parsed = JSON.parse(token);
        if (!Array.isArray(parsed)) {
            return [...fallback];
        }
        const reasons = parsed
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        return reasons.length > 0 ? reasons : [...fallback];
    }
    catch {
        return [...fallback];
    }
}
//# sourceMappingURL=cheques.settings.js.map