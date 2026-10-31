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
exports.ItemGroupExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const module_exception_filter_utils_1 = require("../../../common/utils/module-exception-filter.utils");
let ItemGroupExceptionFilter = class ItemGroupExceptionFilter extends module_exception_filter_utils_1.InventoryExceptionFilter {
    constructor() {
        super(/\b(itg_[a-z0-9_]+)\b/i);
    }
};
exports.ItemGroupExceptionFilter = ItemGroupExceptionFilter;
exports.ItemGroupExceptionFilter = ItemGroupExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [])
], ItemGroupExceptionFilter);
//# sourceMappingURL=item-group-exception.filter.js.map