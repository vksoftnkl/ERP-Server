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
exports.StockAdjReasonsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
let StockAdjReasonsService = class StockAdjReasonsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(queryDto) {
        const activeOnly = queryDto.activeOnly ?? true;
        const includeDeleted = queryDto.includeDeleted ?? false;
        const where = {};
        if (queryDto.sarId !== undefined) {
            where.sarId = queryDto.sarId;
        }
        if (queryDto.sarCode !== undefined) {
            where.sarCode = { equals: queryDto.sarCode, mode: 'insensitive' };
        }
        if (queryDto.sarReasonKind !== undefined) {
            where.sarReasonKind = { equals: queryDto.sarReasonKind, mode: 'insensitive' };
        }
        if (activeOnly) {
            where.sarIsActive = true;
        }
        if (!includeDeleted) {
            where.sarIsDeleted = false;
        }
        const records = await this.prisma.stockAdjReason.findMany({
            where,
            orderBy: [{ sarCode: 'asc' }, { sarId: 'asc' }],
            select: {
                sarId: true,
                sarCode: true,
                sarName: true,
                sarReasonKind: true,
                sarDefaultResolution: true,
                sarAffectsAccounts: true,
                sarIsActive: true,
                sarIsDeleted: true,
                sarCreatedOn: true,
                sarCreatedBy: true,
                sarModifiedOn: true,
                sarModifiedBy: true,
            },
        });
        if (queryDto.sarId !== undefined && records.length === 0) {
            throw new common_1.NotFoundException(`Stock adjustment reason not found for sarId ${queryDto.sarId}`);
        }
        const items = records.map((record) => this.toPayload(record));
        return {
            items,
            meta: {
                sarId: queryDto.sarId,
                sarCode: queryDto.sarCode,
                sarReasonKind: queryDto.sarReasonKind,
                activeOnly,
                includeDeleted,
                count: items.length,
            },
        };
    }
    toPayload(record) {
        return {
            sarId: record.sarId,
            sarCode: record.sarCode,
            sarName: record.sarName,
            sarReasonKind: record.sarReasonKind,
            sarDefaultResolution: record.sarDefaultResolution,
            sarAffectsAccounts: record.sarAffectsAccounts,
            sarIsActive: record.sarIsActive,
            sarIsDeleted: record.sarIsDeleted,
            sarCreatedOn: record.sarCreatedOn.toISOString(),
            sarCreatedBy: record.sarCreatedBy ?? null,
            sarModifiedOn: record.sarModifiedOn?.toISOString() ?? null,
            sarModifiedBy: record.sarModifiedBy ?? null,
        };
    }
};
exports.StockAdjReasonsService = StockAdjReasonsService;
exports.StockAdjReasonsService = StockAdjReasonsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockAdjReasonsService);
//# sourceMappingURL=stock-adj-reasons.service.js.map