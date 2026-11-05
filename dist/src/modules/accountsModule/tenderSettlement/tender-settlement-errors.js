"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwSettlement = throwSettlement;
exports.throwSettlementDetails = throwSettlementDetails;
const common_1 = require("@nestjs/common");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const tender_settlement_enum_1 = require("./types/tender-settlement-enum");
function throwSettlement(code, message, field, extra = {}) {
    throwSettlementDetails(code, message, [{ field, message, code, ...extra }]);
}
function throwSettlementDetails(code, message, details) {
    throw new common_1.HttpException((0, module_shared_utils_1.buildErrorResponse)(message, details.map((d) => ({ ...d, code: d.code ?? code }))), tender_settlement_enum_1.SETTLEMENT_ERROR_STATUS[code]);
}
//# sourceMappingURL=tender-settlement-errors.js.map