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
exports.StockTrackPresetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const preset_merge_1 = require("./preset-merge");
let StockTrackPresetsService = class StockTrackPresetsService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async get(queryDto) {
        const companyId = queryDto.company_id ?? this.requestContextService.getCompanyId();
        if (queryDto.spt_id) {
            const record = await this.prisma.stockTrackPreset.findUnique({
                where: { sptId: queryDto.spt_id },
            });
            if (!record) {
                throw new common_1.NotFoundException(`Stock track preset not found for spt_id ${queryDto.spt_id}`);
            }
            return {
                items: [this.toPayload(record, record.sptCompanyId !== null)],
                meta: { company_id: companyId, spt_id: queryDto.spt_id, count: 1 },
            };
        }
        const rows = await this.prisma.stockTrackPreset.findMany({
            where: {
                ...(0, preset_merge_1.presetScopeFilter)(companyId),
                ...(queryDto.spt_code ? { sptCode: queryDto.spt_code } : {}),
            },
            orderBy: [{ sptSortOrder: 'asc' }, { sptCode: 'asc' }],
        });
        const merged = (0, preset_merge_1.mergePresets)(rows);
        const items = merged.map((record) => this.toPayload(record, record.sptCompanyId !== null));
        return {
            items,
            meta: {
                company_id: companyId,
                spt_code: queryDto.spt_code,
                count: items.length,
            },
        };
    }
    toPayload(record, isCompanyOverride) {
        return {
            spt_id: record.sptId,
            spt_company_id: record.sptCompanyId,
            spt_code: record.sptCode,
            spt_name: record.sptName,
            spt_description: record.sptDescription,
            spt_track_batch: record.sptTrackBatch,
            spt_track_mrp: record.sptTrackMrp,
            spt_track_sale_price: record.sptTrackSalePrice,
            spt_track_expiry: record.sptTrackExpiry,
            spt_track_serial: record.sptTrackSerial,
            spt_track_supplier: record.sptTrackSupplier,
            spt_track_signature: record.sptTrackSignature,
            spt_valuation_method: record.sptValuationMethod,
            spt_issue_strategy: record.sptIssueStrategy,
            spt_allow_negative: record.sptAllowNegative,
            spt_shelf_life_days: record.sptShelfLifeDays,
            spt_near_expiry_days: record.sptNearExpiryDays,
            spt_block_expired_sale: record.sptBlockExpiredSale,
            spt_ageing_basis: record.sptAgeingBasis,
            spt_sort_order: record.sptSortOrder,
            spt_remarks: record.sptRemarks,
            spt_is_company_override: isCompanyOverride,
        };
    }
};
exports.StockTrackPresetsService = StockTrackPresetsService;
exports.StockTrackPresetsService = StockTrackPresetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], StockTrackPresetsService);
//# sourceMappingURL=stock-track-presets.service.js.map