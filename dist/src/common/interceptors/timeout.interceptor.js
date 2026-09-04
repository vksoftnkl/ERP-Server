"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TimeoutInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
let TimeoutInterceptor = class TimeoutInterceptor {
    static { TimeoutInterceptor_1 = this; }
    static REQUEST_TIMEOUT_MS = 15000;
    intercept(_context, next) {
        return next.handle().pipe((0, rxjs_1.timeout)(TimeoutInterceptor_1.REQUEST_TIMEOUT_MS), (0, rxjs_1.catchError)((error) => {
            if (error instanceof rxjs_1.TimeoutError) {
                return (0, rxjs_1.throwError)(() => new common_1.RequestTimeoutException('Request timed out'));
            }
            return (0, rxjs_1.throwError)(() => error);
        }));
    }
};
exports.TimeoutInterceptor = TimeoutInterceptor;
exports.TimeoutInterceptor = TimeoutInterceptor = TimeoutInterceptor_1 = __decorate([
    (0, common_1.Injectable)()
], TimeoutInterceptor);
//# sourceMappingURL=timeout.interceptor.js.map