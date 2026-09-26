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
exports.HsnCodeMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
let HsnCodeMasterService = class HsnCodeMasterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(queryDto) {
        const activeOnly = queryDto.activeOnly ?? true;
        const normalizedHsnCode = queryDto.hsnCode?.trim();
        const where = {};
        if (queryDto.hsnId !== undefined) {
            where.hsnId = queryDto.hsnId;
        }
        if (normalizedHsnCode) {
            where.hsnCode = {
                equals: normalizedHsnCode,
                mode: 'insensitive',
            };
        }
        if (activeOnly) {
            where.hsnIsActive = true;
        }
        const records = await this.prisma.hsnMaster.findMany({
            where,
            orderBy: [{ hsnCode: 'asc' }, { hsnId: 'asc' }],
            select: {
                hsnId: true,
                hsnCode: true,
                hsnName: true,
                hsnDescription: true,
                hsnIsService: true,
                hsnUqc: true,
                hsnIsActive: true,
                hsnRateOfTax: true,
            },
        });
        if ((queryDto.hsnId !== undefined || normalizedHsnCode) && records.length === 0) {
            throw new common_1.NotFoundException(`HSN code not found for filters hsnId=${queryDto.hsnId ?? 'NA'}, hsnCode=${normalizedHsnCode ?? 'NA'}`);
        }
        const items = records.map((record) => this.toPayload(record));
        return {
            items,
            meta: {
                hsnId: queryDto.hsnId,
                hsnCode: normalizedHsnCode,
                activeOnly,
                count: items.length,
            },
        };
    }
    toPayload(record) {
        return {
            hsnId: record.hsnId,
            hsnCode: record.hsnCode,
            hsnName: record.hsnName,
            hsnDescription: record.hsnDescription,
            hsnIsService: record.hsnIsService,
            hsnUqc: record.hsnUqc,
            hsnIsActive: record.hsnIsActive,
            hsnRateOfTax: Number(record.hsnRateOfTax),
        };
    }
};
exports.HsnCodeMasterService = HsnCodeMasterService;
exports.HsnCodeMasterService = HsnCodeMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HsnCodeMasterService);
//# sourceMappingURL=hsn-code-master.service.js.map