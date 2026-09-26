"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARGE_DETAIL_VALUE_GUARDS = exports.CHARGE_DOC_TYPES = exports.CHARGE_VALUE_GUARDS = exports.CHARGE_UNIQUE_ROLES = exports.CHARGE_MODULE_LOOKUP = exports.CHARGE_COST_ALLOCS = exports.CHARGE_APPLY_ONS = exports.CHARGE_TYPES = exports.CHARGE_METHODS = exports.CHARGE_ROLES = exports.CHARGE_MODULES = exports.ChargeType = exports.ChargeRole = exports.ChargeMethod = exports.ChargeDocType = exports.ChargeCostAlloc = exports.ChargeApplyOn = void 0;
exports.resolveChargeModules = resolveChargeModules;
const charge_enum_1 = require("./charge-enum");
var charge_enum_2 = require("./charge-enum");
Object.defineProperty(exports, "ChargeApplyOn", { enumerable: true, get: function () { return charge_enum_2.ChargeApplyOn; } });
Object.defineProperty(exports, "ChargeCostAlloc", { enumerable: true, get: function () { return charge_enum_2.ChargeCostAlloc; } });
Object.defineProperty(exports, "ChargeDocType", { enumerable: true, get: function () { return charge_enum_2.ChargeDocType; } });
Object.defineProperty(exports, "ChargeMethod", { enumerable: true, get: function () { return charge_enum_2.ChargeMethod; } });
Object.defineProperty(exports, "ChargeRole", { enumerable: true, get: function () { return charge_enum_2.ChargeRole; } });
Object.defineProperty(exports, "ChargeType", { enumerable: true, get: function () { return charge_enum_2.ChargeType; } });
exports.CHARGE_MODULES = ['P', 'S', 'B'];
exports.CHARGE_ROLES = Object.values(charge_enum_1.ChargeRole);
exports.CHARGE_METHODS = Object.values(charge_enum_1.ChargeMethod);
exports.CHARGE_TYPES = Object.values(charge_enum_1.ChargeType);
exports.CHARGE_APPLY_ONS = Object.values(charge_enum_1.ChargeApplyOn);
exports.CHARGE_COST_ALLOCS = Object.values(charge_enum_1.ChargeCostAlloc);
exports.CHARGE_MODULE_LOOKUP = {
    P: ['P', 'B'],
    S: ['S', 'B'],
    B: ['B'],
};
function resolveChargeModules(module) {
    return exports.CHARGE_MODULE_LOOKUP[module] ?? [module];
}
exports.CHARGE_UNIQUE_ROLES = [
    'FREIGHT',
    'LOADING',
    'UNLOADING',
    'CASH_DISC',
    'OTHERS',
];
exports.CHARGE_VALUE_GUARDS = [
    { field: 'chgModule', allowed: exports.CHARGE_MODULES, nullable: false },
    { field: 'chgRole', allowed: exports.CHARGE_ROLES, nullable: true },
    { field: 'chgMethod', allowed: exports.CHARGE_METHODS, nullable: false },
    { field: 'chgType', allowed: exports.CHARGE_TYPES, nullable: false },
    { field: 'chgApplyOn', allowed: exports.CHARGE_APPLY_ONS, nullable: false },
    { field: 'chgCostAlloc', allowed: exports.CHARGE_COST_ALLOCS, nullable: true },
];
exports.CHARGE_DOC_TYPES = Object.values(charge_enum_1.ChargeDocType);
exports.CHARGE_DETAIL_VALUE_GUARDS = [
    { field: 'cdDocType', allowed: exports.CHARGE_DOC_TYPES, nullable: false },
    { field: 'cdRole', allowed: exports.CHARGE_ROLES, nullable: true },
    { field: 'cdMethod', allowed: exports.CHARGE_METHODS, nullable: true },
    { field: 'cdType', allowed: exports.CHARGE_TYPES, nullable: false },
    { field: 'cdApplyOn', allowed: exports.CHARGE_APPLY_ONS, nullable: true },
    { field: 'cdCostAlloc', allowed: exports.CHARGE_COST_ALLOCS, nullable: true },
];
//# sourceMappingURL=charge-master-api.types.js.map