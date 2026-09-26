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
exports.PriceLevelMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
let PriceLevelMasterService = class PriceLevelMasterService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async get(queryDto) {
        const where = {};
        if (queryDto.priceLvlId !== undefined) {
            where.priceLvlId = queryDto.priceLvlId;
        }
        const records = await this.prisma.priceLevel.findMany({
            where,
            orderBy: [{ priceLvlId: 'asc' }],
            select: {
                priceLvlId: true,
                priceLvlName: true,
                priceLvlShort: true,
                priceLvlIsActive: true,
                priceLvlIsAdmin: true,
                priceLvlIsDeleted: true,
                priceLvlSyncDate: true,
                priceLvlCreatedOn: true,
                priceLvlCreatedBy: true,
                priceLvlModifiedOn: true,
                priceLvlModifiedBy: true,
            },
        });
        if (queryDto.priceLvlId !== undefined && records.length === 0) {
            throw new common_1.NotFoundException(`Price level not found for priceLvlId ${queryDto.priceLvlId}`);
        }
        const items = records.map((record) => this.toPayload(record));
        return {
            items,
            meta: {
                priceLvlId: queryDto.priceLvlId,
                count: items.length,
            },
        };
    }
    async update(updateDto) {
        const ids = updateDto.priceLevels.map((item) => item.priceLvlId);
        const existing = await this.prisma.priceLevel.findMany({
            where: { priceLvlId: { in: ids } },
            select: { priceLvlId: true },
        });
        const foundIds = new Set(existing.map((record) => record.priceLvlId));
        const missing = ids.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
            throw new common_1.NotFoundException(`Price level(s) not found for priceLvlId(s): ${missing.join(', ')}`);
        }
        const actor = this.requestContextService.getUserId() ?? module_shared_utils_1.DEFAULT_ACTOR;
        const records = await this.prisma.$transaction(updateDto.priceLevels.map((item) => {
            const data = {};
            if (item.priceLvlName !== undefined) {
                data.priceLvlName = item.priceLvlName;
            }
            if (item.priceLvlShort !== undefined) {
                data.priceLvlShort = item.priceLvlShort;
            }
            if (item.priceLvlIsActive !== undefined) {
                data.priceLvlIsActive = item.priceLvlIsActive;
            }
            if (item.priceLvlIsAdmin !== undefined) {
                data.priceLvlIsAdmin = item.priceLvlIsAdmin;
            }
            data.priceLvlModifiedOn = new Date();
            data.priceLvlModifiedBy = actor;
            return this.prisma.priceLevel.update({
                where: { priceLvlId: item.priceLvlId },
                data,
                select: {
                    priceLvlId: true,
                    priceLvlName: true,
                    priceLvlShort: true,
                    priceLvlIsActive: true,
                    priceLvlIsAdmin: true,
                    priceLvlIsDeleted: true,
                    priceLvlSyncDate: true,
                    priceLvlCreatedOn: true,
                    priceLvlCreatedBy: true,
                    priceLvlModifiedOn: true,
                    priceLvlModifiedBy: true,
                },
            });
        }));
        return records.map((record) => this.toPayload(record));
    }
    toPayload(record) {
        return {
            priceLvlId: record.priceLvlId,
            priceLvlName: record.priceLvlName,
            priceLvlShort: record.priceLvlShort,
            priceLvlIsActive: record.priceLvlIsActive,
            priceLvlIsAdmin: record.priceLvlIsAdmin,
            priceLvlIsDeleted: record.priceLvlIsDeleted,
            priceLvlSyncDate: record.priceLvlSyncDate?.toISOString() ?? null,
            priceLvlCreatedOn: record.priceLvlCreatedOn.toISOString(),
            priceLvlCreatedBy: record.priceLvlCreatedBy,
            priceLvlModifiedOn: record.priceLvlModifiedOn.toISOString(),
            priceLvlModifiedBy: record.priceLvlModifiedBy,
        };
    }
};
exports.PriceLevelMasterService = PriceLevelMasterService;
exports.PriceLevelMasterService = PriceLevelMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], PriceLevelMasterService);
//# sourceMappingURL=price-level-master.service.js.map