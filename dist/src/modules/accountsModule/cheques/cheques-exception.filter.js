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
exports.ChequesExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const module_exception_filter_utils_1 = require("../../../common/utils/module-exception-filter.utils");
let ChequesExceptionFilter = class ChequesExceptionFilter extends module_exception_filter_utils_1.AccountsExceptionFilter {
    constructor() {
        super(/\b(apd[A-Z][a-zA-Z0-9]*|abl[A-Z][a-zA-Z0-9]*|abj[A-Z][a-zA-Z0-9]*|cheques(\.\d+)?(\.[a-zA-Z]+)?|allocations(\.\d+)?(\.[a-zA-Z]+)?|newCheque(\.[a-zA-Z]+)?|bankLedgerId|depositDate|slipNo|clearDate|bankDate|bounceDate|bankCharge|partyCharge|reason|reasonText|action|remarks|status|from|to|partyId|search|limit|offset)\b/);
    }
};
exports.ChequesExceptionFilter = ChequesExceptionFilter;
exports.ChequesExceptionFilter = ChequesExceptionFilter = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [])
], ChequesExceptionFilter);
//# sourceMappingURL=cheques-exception.filter.js.map