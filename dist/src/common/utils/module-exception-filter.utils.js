"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsExceptionFilter = exports.SalesExceptionFilter = exports.PurchaseExceptionFilter = exports.InventoryExceptionFilter = exports.FixedExceptionFilter = exports.AccountsExceptionFilter = void 0;
const module_shared_utils_1 = require("./module-shared.utils");
class AccountsExceptionFilter extends module_shared_utils_1.ModuleExceptionFilter {
}
exports.AccountsExceptionFilter = AccountsExceptionFilter;
class FixedExceptionFilter extends module_shared_utils_1.ModuleExceptionFilter {
}
exports.FixedExceptionFilter = FixedExceptionFilter;
class InventoryExceptionFilter extends module_shared_utils_1.ModuleExceptionFilter {
}
exports.InventoryExceptionFilter = InventoryExceptionFilter;
class PurchaseExceptionFilter extends module_shared_utils_1.ModuleExceptionFilter {
}
exports.PurchaseExceptionFilter = PurchaseExceptionFilter;
class SalesExceptionFilter extends module_shared_utils_1.ModuleExceptionFilter {
}
exports.SalesExceptionFilter = SalesExceptionFilter;
class SettingsExceptionFilter extends module_shared_utils_1.ModuleExceptionFilter {
}
exports.SettingsExceptionFilter = SettingsExceptionFilter;
//# sourceMappingURL=module-exception-filter.utils.js.map