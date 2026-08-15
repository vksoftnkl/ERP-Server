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
exports.AppSettingValueService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const app_settings_validation_1 = require("./app-settings.validation");
const app_settings_api_types_1 = require("./types/app-settings-api.types");
const APP_SETTING_VALUE_TABLE_NAME = 'app setting value';
const APP_SETTING_VALUE_AUDIT_SCREEN_NAME = 'App Settings';
const APP_SETTING_VALUE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
const SCOPE_ID_LABEL = {
    asvCompanyId: 'company',
    asvBranchId: 'branch',
    asvDeviceId: 'device',
    asvUserId: 'user',
};
let AppSettingValueService = class AppSettingValueService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveDtos) {
        return this.prisma.$transaction(async (tx) => {
            const payloads = [];
            for (const [index, saveDto] of saveDtos.entries()) {
                payloads.push(await this.saveOne(tx, saveDto, index));
            }
            return payloads;
        }, APP_SETTING_VALUE_TRANSACTION_OPTIONS);
    }
    async saveOne(tx, saveDto, index) {
        try {
            return saveDto.asvId
                ? await this.updateValue(tx, saveDto, index)
                : await this.upsertValue(tx, saveDto, index);
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Override already exists', [
                {
                    field: this.fieldPath(index, 'asvScope'),
                    message: `An override for "${saveDto.asvSettingKey}" already exists on this ` +
                        `${saveDto.asvScope} target`,
                },
            ]);
            throw error;
        }
    }
    async softDelete(asvId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.appSettingValue.findFirst({
                where: { asvId, asvIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound(asvId);
            }
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const deleted = await tx.appSettingValue.update({
                where: { asvId },
                data: { asvIsDeleted: true, asvModifiedOn: new Date(), asvModifiedBy: actor },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: APP_SETTING_VALUE_TABLE_NAME,
                screenName: APP_SETTING_VALUE_AUDIT_SCREEN_NAME,
                screenType: 'settings',
                pk: asvId,
                displayName: this.displayName(existing),
                originalRecord: this.toPayload(existing),
                modifiedRecord: this.toPayload(deleted),
                userId: actor,
                ...(existing.asvBranchId ? { branchId: existing.asvBranchId } : {}),
                notes: `Override reset to the ${existing.asvScope} layer above`,
            }, tx);
            return { asvId, asvSettingKey: existing.asvSettingKey, deleted: true };
        });
    }
    async resolveEffective(scope) {
        const rows = await this.prisma.$queryRaw `
      SELECT *
      FROM public.fn_app_settings_effective(
        ${scope.companyId ?? null}::uuid,
        ${scope.branchId ?? null}::uuid,
        ${scope.deviceId ?? null}::uuid,
        ${scope.userId ?? null}::uuid)`;
        return rows.map((row) => this.toEffectiveItem(row));
    }
    toEffectiveItem(row) {
        return {
            asdId: row.out_asd_id,
            asdKey: row.out_asd_key,
            asdModule: row.out_asd_module,
            asdGroup: row.out_asd_group,
            asdLabel: row.out_asd_label,
            asdDescription: row.out_asd_description,
            asdDataType: row.out_asd_data_type,
            asdDefaultValue: row.out_asd_default_value,
            asdAllowedValues: (0, app_settings_validation_1.toAllowedValues)(row.out_asd_allowed_values),
            asdMinValue: (0, module_service_utils_1.toNullableNumber)(row.out_asd_min_value),
            asdMaxValue: (0, module_service_utils_1.toNullableNumber)(row.out_asd_max_value),
            asdMaxScope: row.out_asd_max_scope,
            asdSortOrder: row.out_asd_sort_order,
            asdNeedsRelogin: row.out_asd_needs_relogin,
            source: row.out_source,
            value: row.out_effective_value,
            override: row.out_asv_id === null
                ? null
                : {
                    asvId: row.out_asv_id,
                    asvScope: row.out_asv_scope,
                    asvCompanyId: row.out_asv_company_id,
                    asvBranchId: row.out_asv_branch_id,
                    asvDeviceId: row.out_asv_device_id,
                    asvUserId: row.out_asv_user_id,
                    asvValue: row.out_asv_value,
                    asvRemarks: row.out_asv_remarks,
                    asvSyncDate: row.out_asv_sync_date ? row.out_asv_sync_date.toISOString() : null,
                    asvCreatedOn: row.out_asv_created_on.toISOString(),
                    asvCreatedBy: row.out_asv_created_by,
                    asvModifiedOn: row.out_asv_modified_on ? row.out_asv_modified_on.toISOString() : null,
                    asvModifiedBy: row.out_asv_modified_by,
                },
        };
    }
    async upsertValue(tx, saveDto, index) {
        const asvSettingKey = this.requireField(saveDto.asvSettingKey, 'asvSettingKey', index);
        const asvScope = this.requireScope(saveDto.asvScope, index);
        const target = this.resolveTarget(asvScope, saveDto, index);
        const now = new Date();
        const actor = (0, module_service_utils_1.resolveActor)(saveDto.asvCreatedBy, this.requestContextService.getUserId());
        const def = await this.loadWritableDef(tx, asvSettingKey, index);
        this.ensureScopeIsPermitted(asvScope, def, index);
        await this.ensureTargetExists(tx, target, index);
        const value = (0, module_service_utils_1.normalizeNullableString)(saveDto.asvValue) ?? null;
        this.ensureValueIsAllowed(value, def, index);
        const existing = await tx.appSettingValue.findFirst({
            where: { asvSettingKey, asvIsDeleted: false, ...target },
        });
        if (existing) {
            return this.applyUpdate(tx, existing, saveDto, value, actor, 'Override updated');
        }
        const created = await tx.appSettingValue.create({
            data: {
                asvSettingKey,
                asvScope,
                ...target,
                asvValue: value,
                asvRemarks: (0, module_service_utils_1.normalizeNullableString)(saveDto.asvRemarks) ?? null,
                asvCreatedOn: now,
                asvCreatedBy: actor,
                ...(saveDto.asvSyncDate !== undefined && { asvSyncDate: saveDto.asvSyncDate }),
            },
        });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange({
            action: 'New',
            tableName: APP_SETTING_VALUE_TABLE_NAME,
            screenName: APP_SETTING_VALUE_AUDIT_SCREEN_NAME,
            screenType: 'settings',
            pk: payload.asvId,
            displayName: this.displayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            ...(created.asvBranchId ? { branchId: created.asvBranchId } : {}),
            notes: `${asvScope} override set`,
        }, tx);
        return payload;
    }
    async updateValue(tx, saveDto, index) {
        const asvId = saveDto.asvId;
        const actor = (0, module_service_utils_1.resolveActor)(saveDto.asvModifiedBy, this.requestContextService.getUserId());
        const existing = await tx.appSettingValue.findFirst({
            where: { asvId, asvIsDeleted: false },
        });
        if (!existing) {
            this.throwNotFound(asvId, index);
        }
        this.ensureTargetIsUnchanged(saveDto, existing, index);
        const def = await this.loadWritableDef(tx, existing.asvSettingKey, index);
        this.ensureScopeIsPermitted(existing.asvScope, def, index);
        const value = saveDto.asvValue !== undefined
            ? ((0, module_service_utils_1.normalizeNullableString)(saveDto.asvValue) ?? null)
            : existing.asvValue;
        this.ensureValueIsAllowed(value, def, index);
        return this.applyUpdate(tx, existing, saveDto, value, actor, 'Override updated');
    }
    async applyUpdate(tx, existing, saveDto, value, actor, notes) {
        const data = {
            asvValue: value,
            asvModifiedOn: new Date(),
            asvModifiedBy: actor,
            ...(saveDto.asvRemarks !== undefined && {
                asvRemarks: (0, module_service_utils_1.normalizeNullableString)(saveDto.asvRemarks) ?? null,
            }),
            ...(saveDto.asvSyncDate !== undefined && { asvSyncDate: saveDto.asvSyncDate }),
        };
        const updated = await tx.appSettingValue.update({ where: { asvId: existing.asvId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: APP_SETTING_VALUE_TABLE_NAME,
            screenName: APP_SETTING_VALUE_AUDIT_SCREEN_NAME,
            screenType: 'settings',
            pk: existing.asvId,
            displayName: this.displayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: actor,
            ...(updated.asvBranchId ? { branchId: updated.asvBranchId } : {}),
            notes,
        }, tx);
        return payload;
    }
    async loadWritableDef(tx, asvSettingKey, index) {
        const def = await tx.appSettingDef.findFirst({
            where: { asdKey: asvSettingKey, asdIsDeleted: false },
        });
        if (!def) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Unknown setting', [
                {
                    field: this.fieldPath(index, 'asvSettingKey'),
                    message: `No setting exists with key "${asvSettingKey}"`,
                },
            ]);
        }
        if (!def.asdIsActive) {
            (0, module_service_utils_1.throwSettingsConflict)('Setting is retired', [
                {
                    field: this.fieldPath(index, 'asvSettingKey'),
                    message: `"${asvSettingKey}" has been retired and can no longer be overridden`,
                },
            ]);
        }
        return def;
    }
    ensureScopeIsPermitted(asvScope, def, index) {
        if (!(0, app_settings_validation_1.isScopeWithinMax)(asvScope, def.asdMaxScope)) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Scope is too deep', [
                {
                    field: this.fieldPath(index, 'asvScope'),
                    message: `"${def.asdKey}" may not be overridden below ${def.asdMaxScope} scope ` +
                        `(asked for ${asvScope})`,
                },
            ]);
        }
    }
    ensureValueIsAllowed(value, def, index) {
        const details = (0, app_settings_validation_1.validateSettingValue)(value, {
            asdKey: def.asdKey,
            asdDataType: def.asdDataType,
            asdAllowedValues: (0, app_settings_validation_1.toAllowedValues)(def.asdAllowedValues),
            asdMinValue: (0, module_service_utils_1.toNullableNumber)(def.asdMinValue),
            asdMaxValue: (0, module_service_utils_1.toNullableNumber)(def.asdMaxValue),
        }, this.fieldPath(index, 'asvValue'));
        if (details.length > 0) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid setting value', details);
        }
    }
    resolveTarget(asvScope, saveDto, index) {
        const required = app_settings_api_types_1.APP_SETTING_SCOPE_ID_FIELD[asvScope];
        const target = {
            asvCompanyId: null,
            asvBranchId: null,
            asvDeviceId: null,
            asvUserId: null,
        };
        const details = [];
        for (const field of app_settings_api_types_1.APP_SETTING_SCOPE_ID_FIELDS) {
            const supplied = saveDto[field] ?? null;
            if (field === required) {
                if (!supplied) {
                    details.push({
                        field: this.fieldPath(index, field),
                        message: `${field} is required when asvScope is ${asvScope}`,
                    });
                    continue;
                }
                target[field] = supplied;
                continue;
            }
            if (supplied) {
                details.push({
                    field: this.fieldPath(index, field),
                    message: `${field} must be omitted when asvScope is ${asvScope} — an override carries the id ` +
                        'its scope names and nothing else',
                });
            }
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid scope target', details);
        }
        return target;
    }
    ensureTargetIsUnchanged(saveDto, existing, index) {
        const details = [];
        if (saveDto.asvSettingKey && saveDto.asvSettingKey !== existing.asvSettingKey) {
            details.push({
                field: this.fieldPath(index, 'asvSettingKey'),
                message: `asvSettingKey cannot be changed (stored value is "${existing.asvSettingKey}")`,
            });
        }
        if (saveDto.asvScope && saveDto.asvScope !== existing.asvScope) {
            details.push({
                field: this.fieldPath(index, 'asvScope'),
                message: `asvScope cannot be changed (stored value is ${existing.asvScope})`,
            });
        }
        for (const field of app_settings_api_types_1.APP_SETTING_SCOPE_ID_FIELDS) {
            const supplied = saveDto[field];
            if (supplied !== undefined && (supplied ?? null) !== existing[field]) {
                details.push({
                    field: this.fieldPath(index, field),
                    message: `${field} cannot be changed. Point an override somewhere else by resetting this one ` +
                        'and setting the new target',
                });
            }
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Override target is immutable', details);
        }
    }
    async ensureTargetExists(tx, target, index) {
        if (target.asvCompanyId) {
            const company = await tx.company.findFirst({
                where: { compId: target.asvCompanyId, compIsDeleted: false },
                select: { compId: true },
            });
            if (!company)
                this.throwMissingTarget('asvCompanyId', target.asvCompanyId, index);
        }
        if (target.asvBranchId) {
            const branch = await tx.branchMaster.findFirst({
                where: { brId: target.asvBranchId, brIsDeleted: false },
                select: { brId: true },
            });
            if (!branch)
                this.throwMissingTarget('asvBranchId', target.asvBranchId, index);
        }
        if (target.asvDeviceId) {
            const device = await tx.deviceMaster.findFirst({
                where: { devId: target.asvDeviceId, devIsDeleted: false },
                select: { devId: true },
            });
            if (!device)
                this.throwMissingTarget('asvDeviceId', target.asvDeviceId, index);
        }
        if (target.asvUserId) {
            const user = await tx.userMaster.findFirst({
                where: { usrId: target.asvUserId, usrIsDeleted: false },
                select: { usrId: true },
            });
            if (!user)
                this.throwMissingTarget('asvUserId', target.asvUserId, index);
        }
    }
    throwMissingTarget(field, id, index) {
        (0, module_service_utils_1.throwSettingsBadRequest)('Scope target does not exist', [
            {
                field: this.fieldPath(index, field),
                message: `No active ${SCOPE_ID_LABEL[field]} found with id ${id}`,
            },
        ]);
    }
    requireScope(asvScope, index) {
        if (!asvScope) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', [
                {
                    field: this.fieldPath(index, 'asvScope'),
                    message: 'asvScope must be provided when setting an override',
                },
            ]);
        }
        return asvScope;
    }
    requireField(value, field, index) {
        const trimmed = value?.trim();
        if (!trimmed) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', [
                {
                    field: this.fieldPath(index, field),
                    message: `${field} must be provided when setting an override`,
                },
            ]);
        }
        return trimmed;
    }
    fieldPath(index, field) {
        return `data[${index}].${field}`;
    }
    displayName(record) {
        const targetId = record.asvCompanyId ?? record.asvBranchId ?? record.asvDeviceId ?? record.asvUserId;
        return targetId
            ? `${record.asvSettingKey} @ ${record.asvScope} ${targetId}`
            : `${record.asvSettingKey} @ ${record.asvScope}`;
    }
    throwNotFound(asvId, index) {
        (0, module_service_utils_1.throwSettingsNotFound)('Override not found', index === undefined ? 'asvId' : this.fieldPath(index, 'asvId'), `No override found with id ${asvId}`);
    }
    toPayload(record) {
        return {
            asvId: record.asvId,
            asvSettingKey: record.asvSettingKey,
            asvScope: record.asvScope,
            asvCompanyId: record.asvCompanyId,
            asvBranchId: record.asvBranchId,
            asvDeviceId: record.asvDeviceId,
            asvUserId: record.asvUserId,
            asvValue: record.asvValue,
            asvRemarks: record.asvRemarks,
            asvIsDeleted: record.asvIsDeleted,
            asvSyncDate: record.asvSyncDate ? record.asvSyncDate.toISOString() : null,
            asvCreatedOn: record.asvCreatedOn.toISOString(),
            asvCreatedBy: record.asvCreatedBy,
            asvModifiedOn: record.asvModifiedOn ? record.asvModifiedOn.toISOString() : null,
            asvModifiedBy: record.asvModifiedBy,
        };
    }
};
exports.AppSettingValueService = AppSettingValueService;
exports.AppSettingValueService = AppSettingValueService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], AppSettingValueService);
//# sourceMappingURL=app-setting-value.service.js.map