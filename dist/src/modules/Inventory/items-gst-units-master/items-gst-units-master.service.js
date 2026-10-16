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
exports.ItemsGstUnitsMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
let ItemsGstUnitsMasterService = class ItemsGstUnitsMasterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(queryDto) {
        const where = {};
        const search = queryDto.search?.trim();
        if (search) {
            where.OR = [
                { itemGstUnitCode: { contains: search, mode: 'insensitive' } },
                { itemGstUnitName: { contains: search, mode: 'insensitive' } },
            ];
        }
        const records = await this.prisma.itemGstUnits.findMany({
            where,
            orderBy: [{ itemGstUnitName: 'asc' }, { itemGstUnitId: 'asc' }],
        });
        return records.map((record) => this.toPayload(record));
    }
    toPayload(record) {
        return {
            item_gst_unit_id: record.itemGstUnitId,
            item_gst_unit_code: record.itemGstUnitCode,
            item_gst_unit_name: record.itemGstUnitName,
            item_gst_unit_created_on: record.itemGstUnitCreatedOn.toISOString(),
            item_gst_unit_created_by: record.itemGstUnitCreatedBy,
            item_gst_unit_modified_on: record.itemGstUnitModifiedOn.toISOString(),
            item_gst_unit_modified_by: record.itemGstUnitModifiedBy,
            item_gst_unit_sync_date: record.itemGstUnitSyncDate
                ? record.itemGstUnitSyncDate.toISOString()
                : null,
        };
    }
};
exports.ItemsGstUnitsMasterService = ItemsGstUnitsMasterService;
exports.ItemsGstUnitsMasterService = ItemsGstUnitsMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ItemsGstUnitsMasterService);
//# sourceMappingURL=items-gst-units-master.service.js.map