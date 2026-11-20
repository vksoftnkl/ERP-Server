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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaMessagesController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const wa_dto_1 = require("../dto/wa.dto");
const wa_exception_filter_1 = require("../wa-exception.filter");
const wa_messages_service_1 = require("../wa-messages.service");
const ok = (message, data) => ({ success: true, message, data });
let WaMessagesController = class WaMessagesController {
    messages;
    constructor(messages) {
        this.messages = messages;
    }
    async send(dto) {
        return ok('WhatsApp send done', await this.messages.send(dto));
    }
    async retry(dto) {
        return ok('WhatsApp message sent again', await this.messages.retry(dto));
    }
};
exports.WaMessagesController = WaMessagesController;
__decorate([
    (0, common_1.Post)('messages/send'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Send a confirmed Sales Order by hand (Print on menu 11), synchronously → { wmlId, accYear, status, phone, phoneSource, ' +
            'templateName, lang, langNote, errorCode, errorText }. SKIPPED / FAILED rows answer 200 with their code; 403 WA_RIGHT_PRINT; ' +
            '404 WA_DOC_NOT_FOUND; 409 WA_DOC_NOT_POSTED / WA_DOC_CANCELLED / WA_NOT_CONNECTED / WA_NOT_ACTIVATED / WA_OPTED_OUT / ' +
            'WA_SITE_OFFLINE; 400 WA_BAD_NUMBER.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaSendDto]),
    __metadata("design:returntype", Promise)
], WaMessagesController.prototype, "send", null);
__decorate([
    (0, common_1.Post)('messages/retry'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'A new try of a logged message (309 Post): the order as it now stands (a popup-typed number goes first again), or the ' +
            'test again → as /messages/send. Judged on the LATEST try of the chain: 409 WA_RETRY_NOT_ALLOWED while it is SENDING; ' +
            '409 WA_ALREADY_DELIVERED (extra status, latestWmlId, latestAccYear) when it is DELIVERED / READ unless confirmResend; ' +
            '400 VALIDATION_IS_IN for a kind this build does not send; 404 WA_DOC_NOT_FOUND. status SENDING in the answer = ' +
            'the relay has not confirmed yet (RELAY_SEND_UNCONFIRMED): the WhatsApp Log settles it.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [wa_dto_1.WaRetryDto]),
    __metadata("design:returntype", Promise)
], WaMessagesController.prototype, "retry", null);
exports.WaMessagesController = WaMessagesController = __decorate([
    (0, swagger_1.ApiTags)('WhatsApp'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('whatsapp'),
    (0, common_1.UseFilters)(wa_exception_filter_1.WaExceptionFilter),
    __metadata("design:paramtypes", [wa_messages_service_1.WaMessagesService])
], WaMessagesController);
//# sourceMappingURL=wa-messages.controller.js.map