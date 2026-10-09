"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TILL_SETTING_DEFAULTS = void 0;
exports.readTillSettings = readTillSettings;
const client_1 = require("@prisma/client");
const till_enum_1 = require("./types/till-enum");
exports.TILL_SETTING_DEFAULTS = {
    requireSession: true,
    dayCutoff: '04:00',
    dayAutoOpen: true,
    floatMode: till_enum_1.TillFloatMode.ISSUED,
    blindClose: true,
    maxRecounts: 1,
    countPlace: 'COUNTER',
    cashTolerance: new client_1.Prisma.Decimal(10),
    noncashTolerance: new client_1.Prisma.Decimal(0),
    closeWithHolds: 'RELEASE',
    sessionMaxHours: 14,
    singleOperator: false,
    moneyDocsInSession: true,
    backofficeCashFrom: 'SAFE',
    closeByTerminal: true,
};
function readTillSettings(effective) {
    const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));
    const d = exports.TILL_SETTING_DEFAULTS;
    return {
        requireSession: pickBoolean(byKey.get(till_enum_1.TillSettingKey.REQUIRE_SESSION), d.requireSession),
        dayCutoff: pickClock(byKey.get(till_enum_1.TillSettingKey.DAY_CUTOFF), d.dayCutoff),
        dayAutoOpen: pickBoolean(byKey.get(till_enum_1.TillSettingKey.DAY_AUTO_OPEN), d.dayAutoOpen),
        floatMode: pickEnum(byKey.get(till_enum_1.TillSettingKey.FLOAT_MODE), [till_enum_1.TillFloatMode.ISSUED, till_enum_1.TillFloatMode.CARRIED], d.floatMode),
        blindClose: pickBoolean(byKey.get(till_enum_1.TillSettingKey.BLIND_CLOSE), d.blindClose),
        maxRecounts: pickInt(byKey.get(till_enum_1.TillSettingKey.MAX_RECOUNTS), d.maxRecounts),
        countPlace: pickEnum(byKey.get(till_enum_1.TillSettingKey.COUNT_PLACE), ['COUNTER', 'CASH_OFFICE'], d.countPlace),
        cashTolerance: pickDecimal(byKey.get(till_enum_1.TillSettingKey.CASH_TOLERANCE), d.cashTolerance),
        noncashTolerance: pickDecimal(byKey.get(till_enum_1.TillSettingKey.NONCASH_TOLERANCE), d.noncashTolerance),
        closeWithHolds: pickEnum(byKey.get(till_enum_1.TillSettingKey.CLOSE_WITH_HOLDS), ['BLOCK', 'RELEASE'], d.closeWithHolds),
        sessionMaxHours: pickInt(byKey.get(till_enum_1.TillSettingKey.SESSION_MAX_HOURS), d.sessionMaxHours),
        singleOperator: pickBoolean(byKey.get(till_enum_1.TillSettingKey.SINGLE_OPERATOR), d.singleOperator),
        moneyDocsInSession: pickBoolean(byKey.get(till_enum_1.TillSettingKey.MONEY_DOCS_IN_SESSION), d.moneyDocsInSession),
        backofficeCashFrom: pickEnum(byKey.get(till_enum_1.TillSettingKey.BACKOFFICE_CASH_FROM), ['SAFE', 'REFUSE'], d.backofficeCashFrom),
        closeByTerminal: pickBoolean(byKey.get(till_enum_1.TillSettingKey.CLOSE_BY_TERMINAL), d.closeByTerminal),
    };
}
function pickEnum(value, allowed, fallback) {
    const token = value?.trim().toUpperCase();
    return token && allowed.includes(token) ? token : fallback;
}
function pickBoolean(value, fallback) {
    const token = value?.trim().toLowerCase();
    if (token === undefined || token === '') {
        return fallback;
    }
    if (['true', '1', 'yes', 'y', 'on'].includes(token)) {
        return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(token)) {
        return false;
    }
    return fallback;
}
function pickInt(value, fallback) {
    const parsed = Number.parseInt(value?.trim() ?? '', 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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
function pickClock(value, fallback) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? '');
    if (!match) {
        return fallback;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
        return fallback;
    }
    return `${String(hours).padStart(2, '0')}:${match[2]}`;
}
//# sourceMappingURL=till.settings.js.map