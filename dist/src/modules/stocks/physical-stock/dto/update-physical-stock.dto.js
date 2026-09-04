"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePhysicalStockDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_physical_stock_dto_1 = require("./create-physical-stock.dto");
class UpdatePhysicalStockDto extends (0, mapped_types_1.PartialType)(create_physical_stock_dto_1.CreatePhysicalStockDto) {
}
exports.UpdatePhysicalStockDto = UpdatePhysicalStockDto;
//# sourceMappingURL=update-physical-stock.dto.js.map