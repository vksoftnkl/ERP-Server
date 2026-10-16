"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorMessagesModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const error_messages_controller_1 = require("./error-messages.controller");
const error_messages_service_1 = require("./error-messages.service");
const error_wording_interceptor_1 = require("./error-wording.interceptor");
let ErrorMessagesModule = class ErrorMessagesModule {
};
exports.ErrorMessagesModule = ErrorMessagesModule;
exports.ErrorMessagesModule = ErrorMessagesModule = __decorate([
    (0, common_1.Module)({
        controllers: [error_messages_controller_1.ErrorMessagesController],
        providers: [error_messages_service_1.ErrorMessageService, { provide: core_1.APP_INTERCEPTOR, useClass: error_wording_interceptor_1.ErrorWordingInterceptor }],
        exports: [error_messages_service_1.ErrorMessageService],
    })
], ErrorMessagesModule);
//# sourceMappingURL=error-messages.module.js.map