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
exports.LedgerMapService = void 0;
const common_1 = require("@nestjs/common");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const ledger_role_helper_1 = require("../ledgerRole/ledger-role.helper");
const role_usage_1 = require("./role-usage");
const LEDGER_MAP_TABLE_NAME = 'posting ledger map';
const LEDGER_MAP_AUDIT_SCREEN_NAME = 'Posting Ledger Map';
const LEDGER_MAP_WHERE = 'acc_ledger_map';
const SHARED_SCOPE = {
    almCompanyId: null,
    almBranchId: null,
    almSupplyNature: null,
};
const MAPPING_SELECT = {
    almId: true,
    almRole: true,
    almCompanyId: true,
    almBranchId: true,
    almSupplyNature: true,
    almLedgerId: true,
    almIsActive: true,
    almRemarks: true,
    ledger: { select: { ledName: true, ledIsActive: true, ledIsDeleted: true } },
};
let LedgerMapService = class LedgerMapService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async listRoles() {
        const [roles, mappings] = await Promise.all([
            this.prisma.accLedgerRole.findMany({
                orderBy: [{ alrSortOrder: 'asc' }, { alrRole: 'asc' }],
            }),
            this.prisma.accLedgerMap.findMany({
                where: { ...SHARED_SCOPE, almIsDeleted: false },
                select: MAPPING_SELECT,
            }),
        ]);
        const mappingByRole = new Map(mappings.map((mapping) => [mapping.almRole, mapping]));
        return roles.map((role) => this.toPayload(role, mappingByRole.get(role.alrRole) ?? null));
    }
    async save(saveLedgerMapDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const role = await this.requireRole(tx, saveLedgerMapDto.role);
                await this.requireLedgerFitsRole(tx, role.alrRole, saveLedgerMapDto.ledgerId);
                const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
                return saveLedgerMapDto.almId
                    ? this.updateMapping(tx, saveLedgerMapDto, role, actor)
                    : this.createMapping(tx, saveLedgerMapDto, role, actor);
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'That role is already mapped', [
                {
                    field: 'role',
                    message: `${saveLedgerMapDto.role} already has a ledger. Re-point that mapping instead of adding a second one.`,
                },
            ]);
            throw error;
        }
    }
    async softDelete(almId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accLedgerMap.findFirst({
                where: { almId, almIsDeleted: false },
                select: MAPPING_SELECT,
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Posting ledger mapping not found', 'almId', `No active acc_ledger_map row with id ${almId}`);
            }
            this.requireShared(existing);
            const documents = (0, role_usage_1.documentsUsingRole)(existing.almRole);
            if (documents.length > 0) {
                (0, module_service_utils_1.throwAccountsConflict)('Posting role is in use', [
                    {
                        field: 'almId',
                        message: `${existing.almRole} is used by ${(0, role_usage_1.describeDocuments)(documents)}. ` +
                            'Point it at a different ledger instead of removing it.',
                    },
                ]);
            }
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const modifiedOn = new Date();
            await tx.accLedgerMap.update({
                where: { almId: existing.almId },
                data: {
                    almIsDeleted: true,
                    almIsActive: false,
                    almModifiedOn: modifiedOn,
                    almModifiedBy: actor,
                },
            });
            await this.logChange(tx, {
                action: 'cancel',
                almId: existing.almId,
                role: existing.almRole,
                originalRecord: this.toAuditRecord(existing),
                modifiedRecord: { ...this.toAuditRecord(existing), almIsActive: false, almIsDeleted: true },
                actor,
                notes: 'Posting ledger mapping removed',
            });
            return { almId: existing.almId, role: existing.almRole, deleted: true };
        });
    }
    async createMapping(tx, saveLedgerMapDto, role, actor) {
        const duplicate = await tx.accLedgerMap.findFirst({
            where: { ...SHARED_SCOPE, almRole: role.alrRole, almIsDeleted: false },
            select: { almId: true },
        });
        if (duplicate) {
            (0, module_service_utils_1.throwAccountsConflict)('That role is already mapped', [
                {
                    field: 'role',
                    message: `${role.alrRole} already has a ledger (almId ${duplicate.almId}). ` +
                        'Send that almId to re-point it rather than adding a second mapping.',
                },
            ]);
        }
        const data = {
            ...SHARED_SCOPE,
            almRole: role.alrRole,
            almLedgerId: saveLedgerMapDto.ledgerId,
            almRemarks: saveLedgerMapDto.remarks ?? null,
            almCreatedOn: new Date(),
            almCreatedBy: actor,
        };
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerMapDto, 'isActive')) {
            data.almIsActive = saveLedgerMapDto.isActive;
        }
        const created = await tx.accLedgerMap.create({ data, select: MAPPING_SELECT });
        await this.logChange(tx, {
            action: 'New',
            almId: created.almId,
            role: role.alrRole,
            originalRecord: null,
            modifiedRecord: this.toAuditRecord(created),
            actor,
            notes: 'Posting ledger mapped',
        });
        return this.toPayload(role, created);
    }
    async updateMapping(tx, saveLedgerMapDto, role, actor) {
        const almId = saveLedgerMapDto.almId;
        const existing = await tx.accLedgerMap.findFirst({
            where: { almId, almIsDeleted: false },
            select: MAPPING_SELECT,
        });
        if (!existing) {
            (0, module_service_utils_1.throwAccountsNotFound)('Posting ledger mapping not found', 'almId', `No active acc_ledger_map row with id ${almId}`);
        }
        this.requireShared(existing);
        if (existing.almRole !== role.alrRole) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'role',
                    message: `This mapping belongs to ${existing.almRole}, not ${role.alrRole}. ` +
                        `Map ${role.alrRole} with its own request; a mapping never changes role.`,
                },
            ]);
        }
        const data = {
            almLedgerId: saveLedgerMapDto.ledgerId,
            almRemarks: saveLedgerMapDto.remarks ?? null,
            almModifiedOn: new Date(),
            almModifiedBy: actor,
        };
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerMapDto, 'isActive')) {
            data.almIsActive = saveLedgerMapDto.isActive;
        }
        const updated = await tx.accLedgerMap.update({
            where: { almId: existing.almId },
            data,
            select: MAPPING_SELECT,
        });
        await this.logChange(tx, {
            action: 'update',
            almId: updated.almId,
            role: role.alrRole,
            originalRecord: this.toAuditRecord(existing),
            modifiedRecord: this.toAuditRecord(updated),
            actor,
            notes: 'Posting ledger mapping re-pointed',
        });
        return this.toPayload(role, updated);
    }
    async requireRole(tx, role) {
        const found = await tx.accLedgerRole.findUnique({ where: { alrRole: role } });
        if (found) {
            return found;
        }
        const known = await tx.accLedgerRole.findMany({
            orderBy: [{ alrSortOrder: 'asc' }, { alrRole: 'asc' }],
            select: { alrRole: true },
        });
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'role',
                message: `"${role}" is not a posting role. Known roles: ` +
                    `${known.map((row) => row.alrRole).join(', ')}`,
            },
        ]);
    }
    async requireLedgerFitsRole(tx, role, ledgerId) {
        const ledger = await tx.accLedgerMaster.findUnique({
            where: { ledId: ledgerId },
            select: { ledName: true, ledIsActive: true, ledIsDeleted: true },
        });
        const errors = [];
        if (ledger?.ledIsDeleted) {
            errors.push({
                field: 'ledgerId',
                message: `"${ledger.ledName}" is deleted — a mapping must name a live ledger`,
            });
        }
        else if (ledger && !ledger.ledIsActive) {
            errors.push({
                field: 'ledgerId',
                message: `"${ledger.ledName}" is inactive — a mapping must name a live ledger`,
            });
        }
        errors.push(...(await (0, ledger_role_helper_1.collectRoleLedgerErrors)(tx, [{ role, ledgerId, field: 'ledgerId' }], {
            companyId: null,
            where: LEDGER_MAP_WHERE,
        })));
        if (errors.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', errors);
        }
    }
    requireShared(mapping) {
        const scoped = mapping.almCompanyId !== null ||
            mapping.almBranchId !== null ||
            mapping.almSupplyNature !== null;
        if (scoped) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'almId',
                    message: 'That mapping is scoped to a company, a branch or a supply nature. ' +
                        '/ledger-map manages the shared mapping only.',
                },
            ]);
        }
    }
    toPayload(role, mapping) {
        return {
            role: role.alrRole,
            label: role.alrLabel,
            group: role.alrGroup,
            sortOrder: role.alrSortOrder,
            expectedLedgerType: role.alrWantType,
            expectedDutyHead: role.alrWantDuty,
            expectedGroupNature: role.alrWantNature,
            roleIsActive: role.alrIsActive,
            usedBy: [...(0, role_usage_1.documentsUsingRole)(role.alrRole)],
            almId: mapping?.almId ?? null,
            ledgerId: mapping?.almLedgerId ?? null,
            ledgerName: mapping?.ledger?.ledName ?? null,
            ledgerIsActive: mapping?.ledger?.ledIsActive ?? null,
            ledgerIsDeleted: mapping?.ledger?.ledIsDeleted ?? null,
            isActive: mapping?.almIsActive ?? null,
            remarks: mapping?.almRemarks ?? null,
        };
    }
    toAuditRecord(mapping) {
        return {
            almId: mapping.almId,
            almRole: mapping.almRole,
            almLedgerId: mapping.almLedgerId,
            almLedgerName: mapping.ledger?.ledName ?? null,
            almIsActive: mapping.almIsActive,
            almIsDeleted: false,
            almRemarks: mapping.almRemarks,
        };
    }
    logChange(tx, change) {
        return this.auditLogService.logEntityChange({
            action: change.action,
            tableName: LEDGER_MAP_TABLE_NAME,
            screenName: LEDGER_MAP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: change.almId,
            displayName: change.role,
            originalRecord: change.originalRecord,
            modifiedRecord: change.modifiedRecord,
            userId: change.actor,
            notes: change.notes,
        }, tx);
    }
};
exports.LedgerMapService = LedgerMapService;
exports.LedgerMapService = LedgerMapService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], LedgerMapService);
//# sourceMappingURL=ledger-map.service.js.map