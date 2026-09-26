"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESET_VISIBLE = void 0;
exports.presetScopeFilter = presetScopeFilter;
exports.mergePresets = mergePresets;
exports.PRESET_VISIBLE = {
    sptIsActive: true,
    sptIsDeleted: false,
};
function presetScopeFilter(companyId) {
    return {
        ...exports.PRESET_VISIBLE,
        OR: [{ sptCompanyId: companyId }, { sptCompanyId: null }],
    };
}
function mergePresets(rows) {
    const byCode = new Map();
    for (const row of rows) {
        const held = byCode.get(row.sptCode);
        if (!held || row.sptCompanyId !== null) {
            byCode.set(row.sptCode, row);
        }
    }
    return [...byCode.values()];
}
//# sourceMappingURL=preset-merge.js.map