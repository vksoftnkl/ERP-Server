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
exports.ConfigsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const CONFIGS_TABLE_NAME = 'configs';
const CONFIGS_AUDIT_SCREEN_NAME = 'Configs';
const CONFIGS_OPTIONAL_FIELDS = ['configName', 'configValue', 'configSyncDate'];
const CONFIGS_FIELD_TRANSFORMS = {
    configSyncDate: (value) => (value ? new Date(value) : null),
};
let ConfigsService = class ConfigsService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveConfigsDto) {
        return this.updateConfig(saveConfigsDto);
    }
    async getById(configId) {
        const record = await this.prisma.configs.findUnique({ where: { configId } });
        if (!record) {
            (0, module_service_utils_1.throwSettingsNotFound)('Config not found', 'configId', `No config found with id ${configId}`);
        }
        return this.toPayload(record);
    }
    async updateConfig(saveConfigsDto) {
        const configId = saveConfigsDto.configId;
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.configs.findUnique({ where: { configId } });
            if (!existing) {
                (0, module_service_utils_1.throwSettingsNotFound)('Config not found', 'configId', `No config found with id ${configId}`);
            }
            const data = {
                configModifiedOn: new Date(),
                configModifiedBy: (0, module_service_utils_1.resolveActor)(saveConfigsDto.configModifiedBy, this.requestContextService.getUserId()),
            };
            (0, module_service_utils_1.applyPresentFields)(data, saveConfigsDto, CONFIGS_OPTIONAL_FIELDS, CONFIGS_FIELD_TRANSFORMS);
            const updated = await tx.configs.update({ where: { configId }, data });
            const payload = this.toPayload(updated);
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: CONFIGS_TABLE_NAME,
                screenName: CONFIGS_AUDIT_SCREEN_NAME,
                screenType: 'settings',
                pk: configId,
                displayName: payload.configName,
                originalRecord: this.toPayload(existing),
                modifiedRecord: payload,
                userId: (0, module_service_utils_1.resolveActor)(saveConfigsDto.configModifiedBy, this.requestContextService.getUserId()),
                notes: 'Config updated',
            }, tx);
            return payload;
        });
    }
    toPayload(record) {
        return {
            configId: record.configId,
            configName: record.configName,
            configValue: record.configValue,
            configSyncDate: record.configSyncDate ? record.configSyncDate.toISOString() : null,
            configCreatedOn: record.configCreatedOn ? record.configCreatedOn.toISOString() : null,
            configCreatedBy: record.configCreatedBy,
            configModifiedOn: record.configModifiedOn ? record.configModifiedOn.toISOString() : null,
            configModifiedBy: record.configModifiedBy,
        };
    }
};
exports.ConfigsService = ConfigsService;
exports.ConfigsService = ConfigsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], ConfigsService);
//# sourceMappingURL=configs.service.js.map