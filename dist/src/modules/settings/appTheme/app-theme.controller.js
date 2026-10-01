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
exports.AppThemeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const app_theme_exception_filter_1 = require("./app-theme-exception.filter");
const app_theme_service_1 = require("./app-theme.service");
const app_theme_query_dto_1 = require("./dto/app-theme-query.dto");
const app_theme_response_dto_1 = require("./dto/app-theme-response.dto");
const save_app_theme_dto_1 = require("./dto/save-app-theme.dto");
const save_app_theme_template_dto_1 = require("./dto/save-app-theme-template.dto");
function answerConditionally(res, etag, ifNoneMatch) {
    res.setHeader('Cache-Control', 'private, max-age=0');
    res.setHeader('ETag', etag);
    if (ifNoneMatch === etag) {
        res.status(304);
        return 'not-modified';
    }
    return 'send';
}
let AppThemeController = class AppThemeController {
    appThemeService;
    constructor(appThemeService) {
        this.appThemeService = appThemeService;
    }
    async getById(query) {
        const data = await this.appThemeService.getById(query.thmId);
        return { success: true, message: 'App theme fetched successfully', data };
    }
    async effective(query, ifNoneMatch, res) {
        const data = await this.appThemeService.effective(query.companyId);
        const etag = `"${data.thmId}:${data.thmModifiedOn ?? ''}:${data.resolvedFrom}` +
            `:${data.template?.tplId ?? ''}:${data.template?.tplModifiedOn ?? ''}"`;
        if (answerConditionally(res, etag, ifNoneMatch) === 'not-modified') {
            return undefined;
        }
        return { success: true, message: 'Effective app theme fetched successfully', data };
    }
    async bootstrap(ifNoneMatch, res) {
        const data = await this.appThemeService.bootstrap();
        const etag = `"${data.thmModifiedOn ?? ''}:${data.template?.tplId ?? ''}:${data.template?.tplModifiedOn ?? ''}"`;
        if (answerConditionally(res, etag, ifNoneMatch) === 'not-modified') {
            return undefined;
        }
        return { success: true, message: 'App theme bootstrap fetched successfully', data };
    }
    async template() {
        const data = await this.appThemeService.template();
        return { success: true, message: 'App theme template fetched successfully', data };
    }
    async saveTemplate(dto) {
        const data = await this.appThemeService.saveTemplate(dto);
        return { success: true, message: 'App theme template saved successfully', data };
    }
    async save(dto) {
        const data = await this.appThemeService.save(dto);
        return {
            success: true,
            message: dto.thmId ? 'App theme updated successfully' : 'App theme created successfully',
            data,
        };
    }
    async remove(query) {
        const data = await this.appThemeService.softDelete(query.thmId);
        return { success: true, message: 'App theme deleted successfully', data };
    }
    async restore(query) {
        const data = await this.appThemeService.restore(query.thmId);
        return { success: true, message: 'App theme restored successfully', data };
    }
};
exports.AppThemeController = AppThemeController;
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'One app theme by thmId — deleted ones too, so the screen can restore them',
    }),
    (0, swagger_1.ApiOkResponse)({ type: app_theme_response_dto_1.AppThemeSuccessSingleDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [app_theme_query_dto_1.AppThemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], AppThemeController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('effective'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The theme a company is painted in — called at login and on every company switch',
        description: "The company's comp_stylesheet_id when that theme is active and not deleted " +
            '(resolvedFrom COMPANY), else the default theme (DEFAULT), with the active stylesheet ' +
            'template (template: tplId, tplQss, tplModifiedOn) so a login is one call. Sends an ETag ' +
            'of thmId:thmModifiedOn:resolvedFrom:tplId:tplModifiedOn; a request carrying it in ' +
            'If-None-Match gets a bare 304. Compare thmModifiedOn / tplModifiedOn with a cached copy ' +
            'to skip a repaint.',
    }),
    (0, swagger_1.ApiHeader)({ name: 'If-None-Match', required: false }),
    (0, swagger_1.ApiOkResponse)({ type: app_theme_response_dto_1.AppThemeSuccessEffectiveDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)('if-none-match')),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [app_theme_query_dto_1.AppThemeEffectiveQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AppThemeController.prototype, "effective", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('bootstrap'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'NO TOKEN — the default theme’s tokens and the active template, for the login window',
        description: 'The login window is painted before anyone has logged in, so this answers without a ' +
            'token: tokens (the default theme), thmModifiedOn and template (tplId, tplQss, ' +
            'tplModifiedOn) — colours and layout rules, nothing else. Never a 404: what is missing ' +
            'comes back empty / null. ETag thmModifiedOn:tplId:tplModifiedOn, 304 on a match.',
    }),
    (0, swagger_1.ApiHeader)({ name: 'If-None-Match', required: false }),
    (0, swagger_1.ApiOkResponse)({ type: app_theme_response_dto_1.AppThemeSuccessBootstrapDto }),
    __param(0, (0, common_1.Headers)('if-none-match')),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AppThemeController.prototype, "bootstrap", null);
__decorate([
    (0, common_1.Get)('template'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'The active stylesheet template — the rules every client fills with its tokens',
        description: 'tplQss is QSS with {{key}} placeholders; placeholders lists the distinct keys it uses. ' +
            'Echo tplModifiedOn on /template/save. 404 only while no live, active template exists.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: app_theme_response_dto_1.AppThemeSuccessTemplateDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppThemeController.prototype, "template", null);
__decorate([
    (0, common_1.Post)('template/save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Replace the stylesheet template’s rules',
        description: 'Needs edit on the App Themes menu. 400 on tplQss for each unknown placeholder, ' +
            'unbalanced brace, url() that is not a :/ resource, or a text over 512 KB — all checked ' +
            'before anything is written. 409 when tplModifiedOn is not the row’s (someone saved since ' +
            'it was loaded) or the template is not the active one. Audited with the text before and ' +
            'after.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: app_theme_response_dto_1.AppThemeSuccessTemplateDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_app_theme_template_dto_1.SaveAppThemeTemplateDto]),
    __metadata("design:returntype", Promise)
], AppThemeController.prototype, "saveTemplate", null);
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Create (no thmId) or update an app theme',
        description: 'Needs create / edit on the App Themes menu. tokens replaces the stored object: every key ' +
            'must be a token (APP_THEME_TOKEN_KEYS, v1 + v2) and every value #rrggbb or #rrggbbaa — 400 ' +
            'names each bad key as tokens.<key>. thmIsDefault = true moves the default here in the same ' +
            'transaction; the default cannot be un-set or deactivated. 409 on a live name clash.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: app_theme_response_dto_1.AppThemeSuccessSingleDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_app_theme_dto_1.SaveAppThemeDto]),
    __metadata("design:returntype", Promise)
], AppThemeController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft delete an app theme',
        description: 'Needs delete on the App Themes menu. 409 when it is already deleted, when it is the ' +
            'default, or while a live company uses it (usedByCount).',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: app_theme_response_dto_1.AppThemeSuccessDeleteDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [app_theme_query_dto_1.AppThemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], AppThemeController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('restore'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Restore a soft-deleted app theme',
        description: 'Needs edit on the App Themes menu. 409 when it is not deleted, or when a live theme now ' +
            'has its name.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: app_theme_response_dto_1.AppThemeSuccessDeleteDto }),
    (0, swagger_1.ApiForbiddenResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: app_theme_response_dto_1.AppThemeErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [app_theme_query_dto_1.AppThemeIdQueryDto]),
    __metadata("design:returntype", Promise)
], AppThemeController.prototype, "restore", null);
exports.AppThemeController = AppThemeController = __decorate([
    (0, swagger_1.ApiTags)('App Themes'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('app-themes'),
    (0, common_1.UseFilters)(app_theme_exception_filter_1.AppThemeExceptionFilter),
    __metadata("design:paramtypes", [app_theme_service_1.AppThemeService])
], AppThemeController);
//# sourceMappingURL=app-theme.controller.js.map