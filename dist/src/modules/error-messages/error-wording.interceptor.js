"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorWordingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const error_wording_1 = require("../../common/error-wording/error-wording");
let ErrorWordingInterceptor = class ErrorWordingInterceptor {
    intercept(context, next) {
        if (context.getType() !== 'http') {
            return next.handle();
        }
        const lang = (0, error_wording_1.wordingLangOf)(context.switchToHttp().getRequest());
        return next.handle().pipe((0, rxjs_1.map)((body) => (0, error_wording_1.withUserWordingOnNotes)(body, lang)));
    }
};
exports.ErrorWordingInterceptor = ErrorWordingInterceptor;
exports.ErrorWordingInterceptor = ErrorWordingInterceptor = __decorate([
    (0, common_1.Injectable)()
], ErrorWordingInterceptor);
//# sourceMappingURL=error-wording.interceptor.js.map