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
exports.WidgetConfigQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_transforms_1 = require("../../../../common/dto/dto-transforms");
const widget_master_api_types_1 = require("../types/widget-master-api.types");
class WidgetConfigQueryDto {
    menu_id;
    visibility;
    platform;
}
exports.WidgetConfigQueryDto = WidgetConfigQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        minimum: 1,
        example: 10,
        description: 'Menu/screen id whose widget config is fetched',
    }),
    (0, class_transformer_1.Transform)(({ value }) => (0, dto_transforms_1.toOptionalInteger)(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], WidgetConfigQueryDto.prototype, "menu_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: widget_master_api_types_1.WidgetVisibilityFilter,
        enumName: 'WidgetVisibilityFilter',
        description: '`false` returns only hidden sections (their hidden fields, plus any field that has secondary text); `all` returns both visible and hidden. Omit it to return all.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(widget_master_api_types_1.WidgetVisibilityFilter),
    __metadata("design:type", String)
], WidgetConfigQueryDto.prototype, "visibility", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: widget_master_api_types_1.WidgetPlatform,
        enumName: 'WidgetPlatform',
        description: 'Optional platform filter; returns only sections scoped to this platform.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(widget_master_api_types_1.WidgetPlatform),
    __metadata("design:type", String)
], WidgetConfigQueryDto.prototype, "platform", void 0);
//# sourceMappingURL=widget-config-query.dto.js.map