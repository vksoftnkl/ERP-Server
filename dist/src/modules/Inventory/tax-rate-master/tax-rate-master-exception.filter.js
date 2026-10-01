"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxRateMasterExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const module_exception_filter_utils_1 = require("../../../common/utils/module-exception-filter.utils");
let TaxRateMasterExceptionFilter = class TaxRateMasterExceptionFilter extends module_exception_filter_utils_1.InventoryExceptionFilter {
    constructor() {
        super(/\b((?:lines\.\d+\.)?(?:tax|trl)_[a-z0-9_]+)\b/i);
    }
};
exports.TaxRateMasterExceptionFilter = TaxRateMasterExceptionFilter;
exports.TaxRateMasterExceptionFilter = TaxRateMasterExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [])
], TaxRateMasterExceptionFilter);
//# sourceMappingURL=tax-rate-master-exception.filter.js.map