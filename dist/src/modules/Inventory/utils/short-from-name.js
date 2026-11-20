"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmptyShortName = isEmptyShortName;
exports.shortNameFromName = shortNameFromName;
const code_from_name_1 = require("../../settings/shared/code-from-name");
const code_series_lock_1 = require("../../settings/shared/code-series-lock");
function isEmptyShortName(value) {
    return value === null || (typeof value === 'string' && value.trim() === '');
}
async function shortNameFromName(tx, series, name, takenStartingWith) {
    const base = (0, code_from_name_1.initialsCode)(name, code_from_name_1.MASTER_SHORT_NAME_RULE);
    if (!base) {
        return null;
    }
    await (0, code_series_lock_1.lockCodeSeries)(tx, series);
    return (0, code_from_name_1.nextFreeCode)(base, takenStartingWith);
}
//# sourceMappingURL=short-from-name.js.map