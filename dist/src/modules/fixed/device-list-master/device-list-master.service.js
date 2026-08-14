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
exports.DeviceListMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const device_list_master_enum_1 = require("./types/device-list-master-enum");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const DEVICE_LIST_MASTER_TABLE_NAME = 'erp device master';
const DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME = 'Device List Master';
const DEVICE_TYPE_VALUES = Object.values(device_list_master_enum_1.DeviceType);
const DEVICE_PLATFORM_VALUES = Object.values(device_list_master_enum_1.DevicePlatform);
const DEVICE_LIST_MASTER_OPTIONAL_FIELDS = [
    'devCompanyId',
    'devBranchId',
    'devUserId',
    'devDeviceName',
    'devDeviceType',
    'devPlatform',
    'devMacAddress',
    'devIsBlocked',
    'devBlockReason',
    'devLastIp',
    'devIsActive',
];
const DEVICE_LIST_MASTER_OPTIONAL_FIELD_TRANSFORMS = {
    devDeviceType: normalizeDeviceType,
    devPlatform: normalizeDevicePlatform,
};
function isDeviceUidRequired(deviceType) {
    return deviceType === device_list_master_enum_1.DeviceType.DESKTOP;
}
function normalizeDeviceType(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [{ field: 'devDeviceType', message: 'devDeviceType must be a string' }]);
    }
    const normalized = value.trim();
    if (!normalized) {
        return undefined;
    }
    if (!DEVICE_TYPE_VALUES.includes(normalized)) {
        (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [
            {
                field: 'devDeviceType',
                message: `devDeviceType must be one of: ${DEVICE_TYPE_VALUES.join(', ')}`,
            },
        ]);
    }
    return normalized;
}
function buildGeneratedDeviceUid(deviceType) {
    return `${deviceType.toUpperCase()}-${(0, crypto_1.randomUUID)()}`;
}
function normalizeDeviceUid(value, deviceType) {
    if (isDeviceUidRequired(deviceType)) {
        return (0, module_service_utils_1.normalizeRequiredText)(value ?? '', 'devDeviceUid', 'devDeviceUid is required when devDeviceType is Desktop');
    }
    const trimmed = value?.trim();
    return trimmed || undefined;
}
function normalizeDevicePlatform(value) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [{ field: 'devPlatform', message: 'devPlatform must be a string' }]);
    }
    const normalized = value.trim();
    if (!normalized) {
        return null;
    }
    if (!DEVICE_PLATFORM_VALUES.includes(normalized)) {
        (0, module_service_utils_1.throwFixedBadRequest)('Validation failed', [
            {
                field: 'devPlatform',
                message: `devPlatform must be one of: ${DEVICE_PLATFORM_VALUES.join(', ')}`,
            },
        ]);
    }
    return normalized;
}
function toDeviceType(value) {
    return value;
}
function toDevicePlatform(value) {
    return value === null ? null : value;
}
let DeviceListMasterService = class DeviceListMasterService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    requestContextService;
    constructor(prisma, auditLogService, configuredGridSqlService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
        this.requestContextService = requestContextService;
    }
    async save(saveDeviceListMasterDto) {
        if (saveDeviceListMasterDto.devId) {
            return this.updateDevice(saveDeviceListMasterDto);
        }
        return this.createDevice(saveDeviceListMasterDto);
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const result = await (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, { tableName: DEVICE_LIST_MASTER_TABLE_NAME, alias: 'device_list_master_grid', search: queryDto.search, page, limit, skip });
        if (!result) {
            (0, module_service_utils_1.throwFixedBadRequest)('No configured grid found for device list master', []);
        }
        return result;
    }
    async getById(devId) {
        const record = await this.prisma.deviceMaster.findFirst({
            where: { devId, devIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwFixedNotFound)('Device not found', 'devId', `No active device found with id ${devId}`);
        }
        const payload = this.toPayload(record);
        const relatedNames = await this.resolveRelatedNames(this.prisma, record);
        return { ...payload, ...relatedNames };
    }
    async resolveRelatedNames(client, record) {
        const [company, branch, user] = await Promise.all([
            record.devCompanyId
                ? client.company.findFirst({
                    where: { compId: record.devCompanyId },
                    select: { compName: true },
                })
                : null,
            record.devBranchId
                ? client.branchMaster.findFirst({
                    where: { brId: record.devBranchId },
                    select: { brName: true },
                })
                : null,
            record.devUserId
                ? client.userMaster.findFirst({
                    where: { usrId: record.devUserId },
                    select: { usrDisplayName: true },
                })
                : null,
        ]);
        return {
            devCompanyName: company?.compName ?? null,
            devBranchName: branch?.brName ?? null,
            devUserName: user?.usrDisplayName ?? null,
        };
    }
    async softDelete(devId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.deviceMaster.findFirst({
                where: { devId, devIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('Device not found', 'devId', `No active device found with id ${devId}`);
            }
            const sessionCount = await tx.userLoginSession.count({
                where: { ulsDeviceId: devId, ulsIsDeleted: false },
            });
            if (sessionCount > 0) {
                (0, module_service_utils_1.throwFixedBadRequest)('Cannot delete device with active login sessions', [{ field: 'devId', message: `Device ${devId} is used in ${sessionCount} login session(s).` }]);
            }
            const modifiedOn = new Date();
            const result = await tx.deviceMaster.updateMany({
                where: { devId, devIsDeleted: false },
                data: {
                    devIsDeleted: true,
                    devIsActive: false,
                    devModifiedOn: modifiedOn,
                    devModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwFixedNotFound)('Device not found', 'devId', `No active device found with id ${devId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                devIsDeleted: true,
                devIsActive: false,
                devModifiedOn: modifiedOn,
                devModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: DEVICE_LIST_MASTER_TABLE_NAME,
                screenName: DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: devId,
                displayName: existing.devDeviceUid,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Device soft deleted',
            }, tx);
            return { devId, deleted: true };
        });
    }
    async createDevice(saveDeviceListMasterDto) {
        const normalizedDeviceType = normalizeDeviceType(saveDeviceListMasterDto.devDeviceType) ?? device_list_master_enum_1.DeviceType.DESKTOP;
        const normalizedDeviceUid = normalizeDeviceUid(saveDeviceListMasterDto.devDeviceUid, normalizedDeviceType) ??
            buildGeneratedDeviceUid(normalizedDeviceType);
        const companyId = (0, module_service_utils_1.hasOwnProperty)(saveDeviceListMasterDto, 'devCompanyId')
            ? (saveDeviceListMasterDto.devCompanyId ?? null)
            : null;
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveDeviceListMasterDto.devEntryBy, this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR);
        const data = {
            devDeviceUid: normalizedDeviceUid,
            devCreatedOn: now,
            devCreatedBy: createdBy,
            devModifiedOn: null,
            devModifiedBy: null,
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveDeviceListMasterDto, DEVICE_LIST_MASTER_OPTIONAL_FIELDS, DEVICE_LIST_MASTER_OPTIONAL_FIELD_TRANSFORMS);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureDeviceUidIsUnique(tx, normalizedDeviceUid, companyId);
                const created = await tx.deviceMaster.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: DEVICE_LIST_MASTER_TABLE_NAME,
                    screenName: DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.devId,
                    displayName: payload.devDeviceUid,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Device created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Device already exists', [{ field: 'devDeviceUid', message: 'Duplicate devDeviceUid is not allowed' }]);
            throw error;
        }
    }
    async updateDevice(saveDeviceListMasterDto) {
        const devId = saveDeviceListMasterDto.devId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.deviceMaster.findFirst({
                    where: { devId, devIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('Device not found', 'devId', `No active device found with id ${devId}`);
                }
                const normalizedDeviceType = normalizeDeviceType(saveDeviceListMasterDto.devDeviceType) ?? toDeviceType(existing.devDeviceType);
                const normalizedDeviceUid = normalizeDeviceUid(saveDeviceListMasterDto.devDeviceUid, normalizedDeviceType);
                const nextDeviceUid = normalizedDeviceUid ?? existing.devDeviceUid;
                const nextCompanyId = (0, module_service_utils_1.hasOwnProperty)(saveDeviceListMasterDto, 'devCompanyId')
                    ? (saveDeviceListMasterDto.devCompanyId ?? null)
                    : existing.devCompanyId;
                await this.ensureDeviceUidIsUnique(tx, nextDeviceUid, nextCompanyId, devId);
                const data = {
                    devModifiedOn: new Date(),
                    devModifiedBy: (0, module_service_utils_1.resolveActor)(saveDeviceListMasterDto.devEntryBy, this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR),
                };
                if (normalizedDeviceUid !== undefined) {
                    data.devDeviceUid = normalizedDeviceUid;
                }
                (0, module_service_utils_1.applyPresentFields)(data, saveDeviceListMasterDto, DEVICE_LIST_MASTER_OPTIONAL_FIELDS, DEVICE_LIST_MASTER_OPTIONAL_FIELD_TRANSFORMS);
                const updated = await tx.deviceMaster.update({ where: { devId }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: DEVICE_LIST_MASTER_TABLE_NAME,
                    screenName: DEVICE_LIST_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: devId,
                    displayName: payload.devDeviceUid,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: (0, module_service_utils_1.resolveActor)(saveDeviceListMasterDto.devEntryBy, this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR),
                    notes: 'Device updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Device already exists', [{ field: 'devDeviceUid', message: 'Duplicate devDeviceUid is not allowed' }]);
            throw error;
        }
    }
    async ensureDeviceUidIsUnique(tx, deviceUid, companyId, excludeId) {
        const existing = await tx.deviceMaster.findFirst({
            where: {
                devIsDeleted: false,
                devCompanyId: companyId,
                devDeviceUid: { equals: deviceUid, mode: 'insensitive' },
                ...(excludeId ? { devId: { not: excludeId } } : {}),
            },
            select: { devId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwFixedConflict)('Device UID already exists', [{ field: 'devDeviceUid', message: 'Duplicate devDeviceUid is not allowed' }]);
        }
    }
    toPayload(record) {
        return {
            devId: record.devId,
            devCompanyId: record.devCompanyId,
            devBranchId: record.devBranchId,
            devUserId: record.devUserId,
            devDeviceUid: record.devDeviceUid,
            devDeviceName: record.devDeviceName,
            devDeviceType: toDeviceType(record.devDeviceType),
            devPlatform: toDevicePlatform(record.devPlatform),
            devMacAddress: record.devMacAddress,
            devIsBlocked: record.devIsBlocked,
            devBlockReason: record.devBlockReason,
            devLastIp: record.devLastIp,
            devIsActive: record.devIsActive,
            devIsDeleted: record.devIsDeleted,
            devSyncDate: record.devSyncDate ? record.devSyncDate.toISOString() : null,
            devCreatedOn: record.devCreatedOn.toISOString(),
            devCreatedBy: record.devCreatedBy,
            devModifiedOn: record.devModifiedOn ? record.devModifiedOn.toISOString() : null,
            devModifiedBy: record.devModifiedBy,
        };
    }
};
exports.DeviceListMasterService = DeviceListMasterService;
exports.DeviceListMasterService = DeviceListMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], DeviceListMasterService);
//# sourceMappingURL=device-list-master.service.js.map