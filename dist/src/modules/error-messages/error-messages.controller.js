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
exports.ErrorMessagesController = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../common/constants/api-version");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const error_wording_1 = require("../../common/error-wording/error-wording");
const error_messages_query_dto_1 = require("./dto/error-messages-query.dto");
const error_messages_service_1 = require("./error-messages.service");
let ErrorMessagesController = class ErrorMessagesController {
    messages;
    constructor(messages) {
        this.messages = messages;
    }
    async catalogue(query, request) {
        const lang = (0, error_wording_1.wordingLangOf)({
            query: { lang: query.lang ?? undefined },
            headers: request.headers,
        });
        const data = await this.messages.catalogue(lang, query.since ?? null);
        return {
            success: true,
            message: data.unchanged
                ? `Error messages ${data.version ?? ''} unchanged`
                : `${data.rows.length} error message(s), version ${data.version ?? 'none'}`,
            data,
        };
    }
};
exports.ErrorMessagesController = ErrorMessagesController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'The plain error wording catalogue (notes 120)',
        description: 'Every active row of one language — `{ code, variant, lang, title, line, todo }` — and the catalogue ' +
            'version. `code` is an error code, or a prefix row ending in * (HOLD_*) for every code of it with no row ' +
            "of its own; `variant` is '' (plain), field=<name>, <key>=<value> or <key>=* — field= first, then " +
            '<key>=<value>, then <key>=*, then the plain row; the exact code before a prefix row. `lang` from the ' +
            'query, else Accept-Language, else en (a language with no rows answers en). `since` = the version held: ' +
            'the same answers `unchanged: true` and no rows. Login only.',
    }),
    (0, swagger_1.ApiOkResponse)({
        description: '{ success, message, data: { version, lang, unchanged, rows[] } }',
    }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [error_messages_query_dto_1.ErrorMessagesQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ErrorMessagesController.prototype, "catalogue", null);
exports.ErrorMessagesController = ErrorMessagesController = __decorate([
    (0, swagger_1.ApiTags)('Error messages'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('error-messages'),
    __metadata("design:paramtypes", [error_messages_service_1.ErrorMessageService])
], ErrorMessagesController);
//# sourceMappingURL=error-messages.controller.js.map