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
exports.StateService = void 0;
const common_1 = require("@nestjs/common");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const state_utils_1 = require("./utils/state.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
let StateService = class StateService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveStateDto) {
        if (saveStateDto.stmId) {
            return this.updateState(saveStateDto);
        }
        const userId = this.requestContextService.getUserId() ?? state_utils_1.DEFAULT_ACTOR;
        const { stateMaster } = await this.createStateMaster(saveStateDto, userId);
        return stateMaster;
    }
    async createStateMaster(dto, userId, parentId = state_utils_1.STATES_ACCOUNT_GROUP_ID) {
        const normalizedName = (0, state_utils_1.normalizeRequiredStateName)(dto.stmName);
        const actor = (0, state_utils_1.resolveStateActor)(userId);
        const now = new Date();
        const isDeleted = dto.stmIsActive === false;
        const order = dto.stmOrder ?? 0;
        try {
            return await this.prisma.$transaction(async (tx) => {
                await (0, state_utils_1.ensureStateNameIsUnique)(tx, normalizedName);
                const parent = await tx.accountGroup.findFirst({
                    where: {
                        accGroupId: parentId,
                        accGroupIsDeleted: false,
                    },
                    select: {
                        accGroupCompanyId: true,
                        accGroupType: true,
                        accLedgerProfile: true,
                        accGroupNature: true,
                    },
                });
                if (!parent) {
                    (0, state_utils_1.throwStateBadRequest)('Parent account group does not exist', [
                        {
                            field: 'parentId',
                            message: `No active account group found with id ${parentId}`,
                        },
                    ]);
                }
                const accountGroupData = {
                    accGroupName: normalizedName,
                    accGroupShort: dto.stmShort ?? null,
                    accGroupDescription: dto.stmDescription?.slice(0, 250) ?? null,
                    accGroupSort: Math.trunc(order),
                    accGroupParentId: parentId,
                    accGroupCompanyId: parent.accGroupCompanyId,
                    accGroupType: parent.accGroupType,
                    accLedgerProfile: parent.accLedgerProfile,
                    accGroupNature: parent.accGroupNature,
                    accGroupChildIds: [],
                    accGroupIsActive: !isDeleted,
                    accGroupIsDeleted: isDeleted,
                    accGroupCreatedOn: now,
                    accGroupCreatedBy: actor,
                    accGroupModifiedOn: now,
                    accGroupModifiedBy: actor,
                };
                const accountGroup = await tx.accountGroup.create({ data: accountGroupData });
                const accGroupId = accountGroup.accGroupId;
                const stateMasterData = {
                    stmId: accGroupId,
                    stmName: normalizedName,
                    stmAlias: dto.stmAlias ?? null,
                    stmShort: dto.stmShort ?? null,
                    stmOrder: order,
                    stmDescription: dto.stmDescription ?? null,
                    stmIsActive: !isDeleted,
                    stmIsDeleted: isDeleted,
                    stmCreatedOn: now,
                    stmCreatedBy: actor,
                    stmModifiedOn: now,
                    stmModifiedBy: actor,
                };
                const created = await tx.stateMaster.create({ data: stateMasterData });
                const payload = (0, state_utils_1.toStatePayload)(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: state_utils_1.STATE_TABLE_NAME,
                    screenName: state_utils_1.STATE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.stmId,
                    displayName: payload.stmName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'State created with linked account group',
                }, tx);
                return { stateMaster: payload, accGroupId };
            });
        }
        catch (error) {
            (0, state_utils_1.handleStateWriteError)(error);
            throw error;
        }
    }
    async getById(stmId) {
        const record = await this.prisma.stateMaster.findFirst({
            where: {
                stmId,
                stmIsDeleted: false,
            },
        });
        if (!record) {
            (0, state_utils_1.throwStateNotFound)(stmId);
        }
        return (0, state_utils_1.toStatePayload)(record);
    }
    async softDelete(stmId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.stateMaster.findFirst({
                where: {
                    stmId,
                    stmIsDeleted: false,
                },
            });
            if (!existing) {
                (0, state_utils_1.throwStateNotFound)(stmId);
            }
            const cityCount = await tx.cityMaster.count({
                where: {
                    ctmStateId: stmId,
                    ctmIsDeleted: false,
                },
            });
            if (cityCount > 0) {
                (0, state_utils_1.throwStateBadRequest)('Cannot delete state with active cities', [
                    {
                        field: 'stmId',
                        message: `State ${stmId} is used by ${cityCount} city(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.stateMaster.updateMany({
                where: {
                    stmId,
                    stmIsDeleted: false,
                },
                data: {
                    stmIsDeleted: true,
                    stmIsActive: false,
                    stmModifiedOn: modifiedOn,
                    stmModifiedBy: this.requestContextService.getUserId() ?? state_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, state_utils_1.throwStateNotFound)(stmId);
            }
            await tx.accountGroup.updateMany({
                where: { accGroupId: stmId },
                data: {
                    accGroupIsActive: false,
                    accGroupIsDeleted: true,
                    accGroupModifiedOn: modifiedOn,
                    accGroupModifiedBy: this.requestContextService.getUserId() ?? state_utils_1.DEFAULT_ACTOR,
                },
            });
            const originalRecord = (0, state_utils_1.toStatePayload)(existing);
            const modifiedRecord = (0, state_utils_1.toStatePayload)({
                ...existing,
                stmIsDeleted: true,
                stmIsActive: false,
                stmModifiedOn: modifiedOn,
                stmModifiedBy: this.requestContextService.getUserId() ?? state_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: state_utils_1.STATE_TABLE_NAME,
                screenName: state_utils_1.STATE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: stmId,
                displayName: existing.stmName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? state_utils_1.DEFAULT_ACTOR,
                notes: 'State soft deleted',
            }, tx);
            return {
                stmId,
                deleted: true,
            };
        });
    }
    async updateState(saveStateDto) {
        const stmId = saveStateDto.stmId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.stateMaster.findFirst({
                    where: {
                        stmId,
                        stmIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, state_utils_1.throwStateNotFound)(stmId);
                }
                const normalizedName = (0, state_utils_1.normalizeRequiredStateName)(saveStateDto.stmName);
                await (0, state_utils_1.ensureStateNameIsUnique)(tx, normalizedName, stmId);
                const data = {
                    stmName: normalizedName,
                    stmModifiedOn: new Date(),
                    stmModifiedBy: (0, state_utils_1.resolveStateActor)(saveStateDto.stmModifiedBy),
                };
                (0, state_utils_1.applyStateOptionalFields)(data, saveStateDto);
                const updated = await tx.stateMaster.update({
                    where: {
                        stmId,
                    },
                    data,
                });
                await tx.accountGroup.updateMany({
                    where: { accGroupId: stmId },
                    data: {
                        accGroupName: updated.stmName,
                        accGroupShort: updated.stmShort,
                        accGroupDescription: updated.stmDescription?.slice(0, 250) ?? null,
                        accGroupSort: Math.trunc((0, module_service_utils_1.toNumber)(updated.stmOrder)),
                        accGroupIsActive: updated.stmIsActive,
                        accGroupIsDeleted: updated.stmIsDeleted,
                        accGroupModifiedOn: updated.stmModifiedOn,
                        accGroupModifiedBy: updated.stmModifiedBy,
                    },
                });
                const payload = (0, state_utils_1.toStatePayload)(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: state_utils_1.STATE_TABLE_NAME,
                    screenName: state_utils_1.STATE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: stmId,
                    displayName: payload.stmName,
                    originalRecord: (0, state_utils_1.toStatePayload)(existing),
                    modifiedRecord: payload,
                    userId: payload.stmModifiedBy,
                    notes: 'State updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, state_utils_1.handleStateWriteError)(error);
            throw error;
        }
    }
};
exports.StateService = StateService;
exports.StateService = StateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], StateService);
//# sourceMappingURL=state.service.js.map