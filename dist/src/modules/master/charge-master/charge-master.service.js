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
exports.ChargeMasterService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const charge_master_api_types_1 = require("./types/charge-master-api.types");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const CHARGE_MASTER_TABLE_NAME = 'charge master';
const CHARGE_MASTER_AUDIT_SCREEN_NAME = 'Charge Master';
const CHARGE_OPTIONAL_FIELDS = [
    'chgCode',
    'chgRole',
    'chgType',
    'chgDefaultRate',
    'chgLandingCost',
    'chgCostAlloc',
    'chgTaxApl',
    'chgBeforeTax',
    'chgSepPost',
    'chgManParty',
    'chgDispOrder',
    'chgAutoApply',
    'chgIsActive',
];
const CHARGE_LEDGER_SELECT = {
    ledName: true,
    ledHsnSac: true,
    ledGstRate: true,
    ledTaxability: true,
};
let ChargeMasterService = class ChargeMasterService {
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
    async save(saveChargeMasterDto) {
        if (saveChargeMasterDto.chgId) {
            return this.updateCharge(saveChargeMasterDto);
        }
        return this.createCharge(saveChargeMasterDto);
    }
    async get(getChargeMasterQueryDto) {
        const { chgId, chgModule } = getChargeMasterQueryDto;
        if (chgId && chgModule) {
            (0, module_service_utils_1.throwMasterBadRequest)('Ambiguous charge lookup', [
                { field: 'chgId', message: 'Send either chgId or chgModule, not both' },
            ]);
        }
        if (chgId) {
            return this.getById(chgId);
        }
        if (chgModule) {
            return this.getByModule(chgModule);
        }
        (0, module_service_utils_1.throwMasterBadRequest)('Missing charge lookup', [
            { field: 'chgId', message: 'Either chgId or chgModule is required' },
        ]);
    }
    async getById(chgId) {
        const record = await this.prisma.chargeMaster.findFirst({
            where: { chgId, chgIsDeleted: false },
            include: { ledger: { select: CHARGE_LEDGER_SELECT } },
        });
        if (!record) {
            this.throwNotFound(chgId);
        }
        return this.toPayload(record, record.ledger ?? null);
    }
    async getByModule(chgModule) {
        const records = await this.prisma.chargeMaster.findMany({
            where: {
                chgIsDeleted: false,
                chgIsActive: true,
                chgModule: { in: [...(0, charge_master_api_types_1.resolveChargeModules)(chgModule)] },
            },
            include: { ledger: { select: CHARGE_LEDGER_SELECT } },
            orderBy: [{ chgDispOrder: { sort: 'asc', nulls: 'last' } }, { chgName: 'asc' }],
        });
        return records.map((record) => this.toPayload(record, record.ledger ?? null));
    }
    async softDelete(chgId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.chargeMaster.findFirst({
                where: { chgId, chgIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound(chgId);
            }
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const modifiedOn = new Date();
            const result = await tx.chargeMaster.updateMany({
                where: { chgId, chgIsDeleted: false },
                data: {
                    chgIsDeleted: true,
                    chgIsActive: false,
                    chgModifiedOn: modifiedOn,
                    chgModifiedBy: actor,
                },
            });
            if (result.count === 0) {
                this.throwNotFound(chgId);
            }
            const modifiedRecord = this.toPayload({
                ...existing,
                chgIsDeleted: true,
                chgIsActive: false,
                chgModifiedOn: modifiedOn,
                chgModifiedBy: actor,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: CHARGE_MASTER_TABLE_NAME,
                screenName: CHARGE_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: chgId,
                displayName: existing.chgName,
                originalRecord: this.toPayload(existing),
                modifiedRecord,
                userId: actor,
                notes: 'Charge soft deleted',
            }, tx);
            return { chgId, deleted: true };
        });
    }
    async createCharge(saveChargeMasterDto) {
        const now = new Date();
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveChargeMasterDto.chgName, 'chgName');
        const normalizedCode = (0, module_service_utils_1.normalizeNullableString)(saveChargeMasterDto.chgCode) ?? null;
        const role = saveChargeMasterDto.chgRole ?? null;
        const module = saveChargeMasterDto.chgModule;
        this.ensureValuesAreAllowed(this.guardedValues(saveChargeMasterDto));
        const data = {
            chgName: normalizedName,
            chgModule: module,
            chgMethod: saveChargeMasterDto.chgMethod,
            chgApplyOn: saveChargeMasterDto.chgApplyOn,
            chgLedgerCode: saveChargeMasterDto.chgLedgerCode,
            chgCreatedOn: now,
            chgCreatedBy: saveChargeMasterDto.chgCreatedBy ?? actor,
            chgModifiedOn: now,
            chgModifiedBy: saveChargeMasterDto.chgModifiedBy ?? actor,
        };
        this.applyOptionalFields(data, saveChargeMasterDto);
        data.chgCode = normalizedCode;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const ledgerName = await this.ensureLedgerExists(tx, saveChargeMasterDto.chgLedgerCode);
                await this.ensureCodeIsUnique(tx, normalizedCode);
                await this.ensureRoleIsUnique(tx, role, module);
                const created = await tx.chargeMaster.create({ data });
                const payload = this.toPayload(created, ledgerName);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: CHARGE_MASTER_TABLE_NAME,
                    screenName: CHARGE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.chgId,
                    displayName: payload.chgName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'Charge created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateCharge(saveChargeMasterDto) {
        const chgId = saveChargeMasterDto.chgId;
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.chargeMaster.findFirst({
                    where: { chgId, chgIsDeleted: false },
                });
                if (!existing) {
                    this.throwNotFound(chgId);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveChargeMasterDto.chgName, 'chgName');
                const nextModule = saveChargeMasterDto.chgModule;
                const nextCode = (0, module_service_utils_1.hasOwnProperty)(saveChargeMasterDto, 'chgCode')
                    ? ((0, module_service_utils_1.normalizeNullableString)(saveChargeMasterDto.chgCode) ?? null)
                    : existing.chgCode;
                const nextRole = (0, module_service_utils_1.hasOwnProperty)(saveChargeMasterDto, 'chgRole')
                    ? (saveChargeMasterDto.chgRole ?? null)
                    : existing.chgRole;
                this.ensureValuesAreAllowed(this.guardedValues(saveChargeMasterDto, { chgModule: nextModule, chgRole: nextRole }));
                const ledgerName = await this.ensureLedgerExists(tx, saveChargeMasterDto.chgLedgerCode);
                await this.ensureCodeIsUnique(tx, nextCode, chgId);
                await this.ensureRoleIsUnique(tx, nextRole, nextModule, chgId);
                const data = {
                    chgName: normalizedName,
                    chgModule: nextModule,
                    chgMethod: saveChargeMasterDto.chgMethod,
                    chgApplyOn: saveChargeMasterDto.chgApplyOn,
                    chgLedgerCode: saveChargeMasterDto.chgLedgerCode,
                    chgModifiedOn: new Date(),
                    chgModifiedBy: saveChargeMasterDto.chgModifiedBy ?? actor,
                };
                this.applyOptionalFields(data, saveChargeMasterDto);
                data.chgCode = nextCode;
                const updated = await tx.chargeMaster.update({ where: { chgId }, data });
                const payload = this.toPayload(updated, ledgerName);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: CHARGE_MASTER_TABLE_NAME,
                    screenName: CHARGE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: chgId,
                    displayName: payload.chgName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: this.toPayload(updated),
                    userId: actor,
                    notes: 'Charge updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureLedgerExists(tx, ledgerCode) {
        const ledger = await tx.accLedgerMaster.findFirst({
            where: { ledId: ledgerCode, ledIsDeleted: false },
            select: CHARGE_LEDGER_SELECT,
        });
        if (!ledger) {
            (0, module_service_utils_1.throwMasterBadRequest)('Ledger does not exist', [
                { field: 'chgLedgerCode', message: `No active ledger found with id ${ledgerCode}` },
            ]);
        }
        return ledger;
    }
    async ensureCodeIsUnique(tx, chargeCode, excludeId) {
        if (chargeCode === null) {
            return;
        }
        const existing = await tx.chargeMaster.findFirst({
            where: {
                chgIsDeleted: false,
                chgCode: { equals: chargeCode, mode: 'insensitive' },
                ...(excludeId ? { chgId: { not: excludeId } } : {}),
            },
            select: { chgId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwMasterConflict)('Charge code already exists', [
                { field: 'chgCode', message: 'Duplicate charge code is not allowed' },
            ]);
        }
    }
    ensureValuesAreAllowed(values) {
        const details = [];
        for (const guard of charge_master_api_types_1.CHARGE_VALUE_GUARDS) {
            const value = values[guard.field];
            if (value === undefined) {
                continue;
            }
            if (value === null) {
                if (!guard.nullable) {
                    details.push({ field: guard.field, message: `${guard.field} is required` });
                }
                continue;
            }
            if (!guard.allowed.includes(value)) {
                details.push({
                    field: guard.field,
                    message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
                });
            }
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwMasterBadRequest)('Invalid charge value', details);
        }
    }
    guardedValues(saveChargeMasterDto, overrides = {}) {
        return {
            chgModule: saveChargeMasterDto.chgModule,
            chgRole: (0, module_service_utils_1.hasOwnProperty)(saveChargeMasterDto, 'chgRole')
                ? (saveChargeMasterDto.chgRole ?? null)
                : undefined,
            chgMethod: saveChargeMasterDto.chgMethod,
            chgType: (0, module_service_utils_1.hasOwnProperty)(saveChargeMasterDto, 'chgType')
                ? (saveChargeMasterDto.chgType ?? null)
                : undefined,
            chgApplyOn: saveChargeMasterDto.chgApplyOn,
            chgCostAlloc: (0, module_service_utils_1.hasOwnProperty)(saveChargeMasterDto, 'chgCostAlloc')
                ? (saveChargeMasterDto.chgCostAlloc ?? null)
                : undefined,
            ...overrides,
        };
    }
    async ensureRoleIsUnique(tx, role, module, excludeId) {
        if (role === null || !charge_master_api_types_1.CHARGE_UNIQUE_ROLES.includes(role)) {
            return;
        }
        const existing = await tx.chargeMaster.findFirst({
            where: {
                chgIsDeleted: false,
                chgRole: role,
                chgModule: module,
                ...(excludeId ? { chgId: { not: excludeId } } : {}),
            },
            select: { chgId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwMasterConflict)(`A ${role} charge already exists for module ${module}`, [
                {
                    field: 'chgRole',
                    message: `Only one ${role} charge is allowed per module`,
                },
            ]);
        }
    }
    applyOptionalFields(data, saveChargeMasterDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveChargeMasterDto, CHARGE_OPTIONAL_FIELDS);
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Charge already exists', [
            { field: 'chgCode', message: 'Duplicate charge is not allowed' },
        ]);
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwMasterBadRequest)('Invalid relation reference', [
                { field: 'request', message: 'Referenced ledger does not exist' },
            ]);
        }
    }
    throwNotFound(chgId) {
        (0, module_service_utils_1.throwMasterNotFound)('Charge not found', 'chgId', `No active charge found with id ${chgId}`);
    }
    toPayload(record, ledger = null) {
        return {
            chgId: record.chgId,
            chgName: record.chgName,
            chgCode: record.chgCode,
            chgModule: record.chgModule,
            chgRole: record.chgRole,
            chgMethod: record.chgMethod,
            chgType: record.chgType,
            chgApplyOn: record.chgApplyOn,
            chgDefaultRate: (0, module_service_utils_1.toNullableNumber)(record.chgDefaultRate),
            chgLandingCost: record.chgLandingCost,
            chgCostAlloc: record.chgCostAlloc,
            chgLedgerCode: record.chgLedgerCode,
            chgLedgerName: ledger?.ledName ?? null,
            ledHsnSac: ledger?.ledHsnSac ?? null,
            ledGstRate: (0, module_service_utils_1.toNullableNumber)(ledger?.ledGstRate ?? null),
            ledTaxability: ledger?.ledTaxability ?? null,
            chgTaxApl: record.chgTaxApl,
            chgBeforeTax: record.chgBeforeTax,
            chgSepPost: record.chgSepPost,
            chgManParty: record.chgManParty,
            chgDispOrder: record.chgDispOrder,
            chgAutoApply: record.chgAutoApply,
            chgIsActive: record.chgIsActive,
            chgIsDeleted: record.chgIsDeleted,
            chgSyncDate: record.chgSyncDate ? record.chgSyncDate.toISOString() : null,
            chgCreatedOn: record.chgCreatedOn.toISOString(),
            chgCreatedBy: record.chgCreatedBy,
            chgModifiedOn: record.chgModifiedOn ? record.chgModifiedOn.toISOString() : null,
            chgModifiedBy: record.chgModifiedBy,
        };
    }
};
exports.ChargeMasterService = ChargeMasterService;
exports.ChargeMasterService = ChargeMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], ChargeMasterService);
//# sourceMappingURL=charge-master.service.js.map