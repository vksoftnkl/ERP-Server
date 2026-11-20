"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WaPostHook_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaPostHookModule = exports.WaPostHook = void 0;
const common_1 = require("@nestjs/common");
let WaPostHook = WaPostHook_1 = class WaPostHook {
    logger = new common_1.Logger(WaPostHook_1.name);
    handler = null;
    register(handler) {
        this.handler = handler;
    }
    async fire(event) {
        if (!this.handler)
            return null;
        try {
            return await this.handler(event);
        }
        catch (error) {
            this.logger.error(`WhatsApp on post for ${event.docType} ${event.docId} failed (the post stands): ${error instanceof Error ? error.stack : String(error)}`);
            return null;
        }
    }
};
exports.WaPostHook = WaPostHook;
exports.WaPostHook = WaPostHook = WaPostHook_1 = __decorate([
    (0, common_1.Injectable)()
], WaPostHook);
let WaPostHookModule = class WaPostHookModule {
};
exports.WaPostHookModule = WaPostHookModule;
exports.WaPostHookModule = WaPostHookModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({ providers: [WaPostHook], exports: [WaPostHook] })
], WaPostHookModule);
//# sourceMappingURL=wa-post-hook.js.map