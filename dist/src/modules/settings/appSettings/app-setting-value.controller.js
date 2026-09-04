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
exports.AppSettingValueController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../../common/dto/http-error-response.dto");
const api_version_1 = require("../../../common/constants/api-version");
const app_settings_exception_filter_1 = require("./app-settings-exception.filter");
const app_setting_value_service_1 = require("./app-setting-value.service");
const resolve_app_settings_query_dto_1 = require("./dto/resolve-app-settings-query.dto");
const save_bulk_app_setting_value_dto_1 = require("./dto/save-bulk-app-setting-value.dto");
const app_settings_response_dto_1 = require("./dto/app-settings-response.dto");
let AppSettingValueController = class AppSettingValueController {
    appSettingValueService;
    constructor(appSettingValueService) {
        this.appSettingValueService = appSettingValueService;
    }
    async save(saveDto) {
        const data = await this.appSettingValueService.save(saveDto.data);
        return {
            success: true,
            message: 'Overrides saved successfully',
            data,
        };
    }
    async effective(queryDto) {
        const data = await this.appSettingValueService.resolveEffective(queryDto);
        return {
            success: true,
            message: 'Settings fetched successfully',
            data,
        };
    }
    async remove(asvId) {
        const data = await this.appSettingValueService.softDelete(asvId);
        return {
            success: true,
            message: 'Override reset successfully',
            data,
        };
    }
};
exports.AppSettingValueController = AppSettingValueController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Set overrides — an array, upserted on each entry’s scope target',
        description: 'The payload is always `{ "data": [ … ] }`, one entry per override, because a settings ' +
            'screen saves a page of boxes rather than one box. The whole array is ONE transaction: if ' +
            'any entry is refused, none of them are written, and the errors name the entry — ' +
            '`data[2].asvValue` — so the screen can put each message on the box that caused it.\n\n' +
            'Per entry: send asvSettingKey, asvScope and the id that scope names — the other id ' +
            'columns must be absent. Posting the same target twice MOVES the existing override rather ' +
            'than answering 409, which is what a settings screen means by Save. Sending asvId edits ' +
            'that row in place; the key and the target are immutable there. The value is checked ' +
            'against the catalog (asdDataType, asdAllowedValues, min/max) and the scope against ' +
            'asdMaxScope, so a bad value is a 400 naming the field rather than a raw constraint ' +
            'violation. asvValue = null is legal and means "explicitly nothing" — it BLANKS the ' +
            'setting for this layer instead of inheriting the one above. To go back to inheriting, ' +
            'delete the override.',
    }),
    (0, swagger_1.ApiCreatedResponse)({ type: app_settings_response_dto_1.AppSettingValueSuccessSaveDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: app_settings_response_dto_1.AppSettingsErrorResponseDto }),
    (0, swagger_1.ApiConflictResponse)({ type: app_settings_response_dto_1.AppSettingsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_settings_response_dto_1.AppSettingsErrorResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_bulk_app_setting_value_dto_1.SaveBulkAppSettingValueDto]),
    __metadata("design:returntype", Promise)
], AppSettingValueController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('effective'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Every setting as it stands for one caller — override where one matched, catalog where none did',
        description: 'One row per LIVE setting: the catalog row, the override row that won (null when the ' +
            'default stands), and the value the two come to. GLOBAL < COMPANY < BRANCH < DEVICE < ' +
            'USER over whichever of companyId / branchId / deviceId / userId are sent — every id is ' +
            'optional and additive, and a layer whose id is not sent simply never matches. This is ' +
            'the one endpoint the client should read settings from: it is ' +
            'public.fn_app_settings_effective, which the server-side resolver is itself built on.\n\n' +
            'It answers what to APPLY and what to DRAW at once: the value, plus the label, type and ' +
            'bounds to render a control, `override.asvId` to edit or reset it, and `override.asvScope` ' +
            'so the screen can say "set on this branch". Values come back as RAW TEXT with ' +
            'asdDataType beside them — the caller casts. `source` is read from the override ROW, not ' +
            'its value, so an override that deliberately blanks a setting still reads OVERRIDE and can ' +
            'still be reset; such a setting is returned with value null. Unpaged: the catalog is small ' +
            'and a settings screen wants all of it.',
    }),
    (0, swagger_1.ApiOkResponse)({ type: app_settings_response_dto_1.AppSettingsEffectiveSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: app_settings_response_dto_1.AppSettingsErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resolve_app_settings_query_dto_1.ResolveAppSettingsQueryDto]),
    __metadata("design:returntype", Promise)
], AppSettingValueController.prototype, "effective", null);
__decorate([
    (0, common_1.Delete)('delete'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Reset one override by id',
        description: 'The override goes away and the layer above takes over again. A soft delete IS the reset: ' +
            'ux_asv_scope_target is partial on asv_is_deleted, so the slot is free for a new override ' +
            'immediately, and the row stays as the record of what somebody once set. Resetting is ' +
            'never a write of the default value — that would freeze today’s default into a permanent ' +
            'override that stops tracking it.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'asvId', schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: app_settings_response_dto_1.AppSettingValueSuccessDeleteDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: app_settings_response_dto_1.AppSettingsErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: app_settings_response_dto_1.AppSettingsErrorResponseDto }),
    __param(0, (0, common_1.Query)('asvId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppSettingValueController.prototype, "remove", null);
exports.AppSettingValueController = AppSettingValueController = __decorate([
    (0, swagger_1.ApiTags)('App Setting Values'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('app-setting-values'),
    (0, common_1.UseFilters)(app_settings_exception_filter_1.AppSettingsExceptionFilter),
    __metadata("design:paramtypes", [app_setting_value_service_1.AppSettingValueService])
], AppSettingValueController);
//# sourceMappingURL=app-setting-value.controller.js.map