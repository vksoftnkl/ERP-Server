"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseUnitChange = baseUnitChange;
exports.refuseBaseUnitChange = refuseBaseUnitChange;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const HOW_TO_FIX = 'A saved item keeps its base unit: to count it in another unit, make this item inactive ' +
    'and create a new one.';
function baseUnitChange(base, row) {
    const isBaseRow = row.iuc_id === base.iuc_id;
    if (isBaseRow && row.iuc_unit_id !== undefined && row.iuc_unit_id !== base.iuc_unit_id) {
        return {
            column: 'iuc_unit_id',
            message: `Unit conversion ${base.iuc_id} is the item's base row; its unit stays ${base.iuc_unit_id}.`,
        };
    }
    if (isBaseRow && row.iuc_is_base_unit === false) {
        return {
            column: 'iuc_is_base_unit',
            message: `Unit conversion ${base.iuc_id} is the item's base row and stays marked as base.`,
        };
    }
    if (!isBaseRow && row.iuc_is_base_unit === true) {
        return {
            column: 'iuc_is_base_unit',
            message: `Only the item's base row (${base.iuc_id}, unit ${base.iuc_unit_id}) is marked as base.`,
        };
    }
    if (row.iuc_base_unit_id !== undefined && row.iuc_base_unit_id !== base.iuc_unit_id) {
        return {
            column: 'iuc_base_unit_id',
            message: `iuc_base_unit_id stays ${base.iuc_unit_id}, the item's base unit.`,
        };
    }
    return null;
}
function refuseBaseUnitChange(code, field, message) {
    return (0, module_service_utils_1.throwInventoryConflict)("A saved item's base unit cannot change", [
        { field, code, message: `${message} ${HOW_TO_FIX}` },
    ]);
}
//# sourceMappingURL=item-base-unit.helper.js.map