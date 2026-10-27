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
exports.valuationFor = valuationFor;
exports.presetRuleErrors = presetRuleErrors;
exports.lockedFieldErrors = lockedFieldErrors;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_error_codes_1 = require("../types/stock-error-codes");
const save_stock_track_preset_dto_1 = require("./dto/save-stock-track-preset.dto");
const preset_merge_1 = require("./preset-merge");
const NO_USAGE = { items: 0, groups: 0, activeItems: 0, activeGroups: 0 };
const TRACK_COLUMN = {
    trackBatch: 'sptTrackBatch',
    trackMrp: 'sptTrackMrp',
    trackSalePrice: 'sptTrackSalePrice',
    trackExpiry: 'sptTrackExpiry',
    trackSerial: 'sptTrackSerial',
    trackSupplier: 'sptTrackSupplier',
};
const TRACK_WORDS = {
    trackBatch: 'batch',
    trackMrp: 'MRP',
    trackSalePrice: 'sale price',
    trackExpiry: 'expiry',
    trackSerial: 'serial',
    trackSupplier: 'supplier',
};
function valuationFor(values) {
    return save_stock_track_preset_dto_1.PRESET_TRACK_FIELDS.some((f) => values[f]) ? 'LOT_ACTUAL' : 'WAVG';
}
function presetRuleErrors(values) {
    const errors = [];
    if (values.trackExpiry && !values.trackBatch) {
        errors.push({
            field: 'trackExpiry',
            code: stock_error_codes_1.StockErrorCode.PRESET_EXPIRY_NEEDS_BATCH,
            message: 'Expiry is kept per batch: track batches too, or stop tracking expiry.',
        });
    }
    if (values.issueStrategy === 'FEFO' && values.trackBatch && !values.trackExpiry) {
        errors.push({
            field: 'issueStrategy',
            code: stock_error_codes_1.StockErrorCode.PRESET_FEFO_NEEDS_EXPIRY,
            message: 'First-expiry-first-out needs expiry dates: track expiry, or issue FIFO, LIFO or by hand.',
        });
    }
    const valuation = valuationFor(values);
    if (values.valuationMethod !== valuation) {
        errors.push({
            field: 'valuationMethod',
            code: stock_error_codes_1.StockErrorCode.PRESET_VALUATION_MISMATCH,
            message: valuation === 'LOT_ACTUAL'
                ? `A preset that tracks lots is valued at each lot's own cost (LOT_ACTUAL), not ${values.valuationMethod}.`
                : `A preset that tracks nothing is valued at the weighted average (WAVG), not ${values.valuationMethod}.`,
        });
    }
    return errors;
}
function lockedFieldErrors(existing, next, usage) {
    if (usage.items + usage.groups === 0) {
        return [];
    }
    const users = usedByWords(usage.items, usage.groups);
    const errors = [];
    if (next.code !== existing.sptCode) {
        errors.push({
            field: 'code',
            code: stock_error_codes_1.StockErrorCode.PRESET_IN_USE,
            message: `${existing.sptCode} is used by ${users}; its code cannot change. Create another preset instead.`,
        });
    }
    for (const field of save_stock_track_preset_dto_1.PRESET_TRACK_FIELDS) {
        if (next[field] !== existing[TRACK_COLUMN[field]]) {
            errors.push({
                field,
                code: stock_error_codes_1.StockErrorCode.PRESET_IN_USE,
                message: `${existing.sptCode} is used by ${users}; ${next[field] ? 'starting' : 'stopping'} ${TRACK_WORDS[field]} tracking would re-split the stock they hold into different lots. Create another preset instead.`,
            });
        }
    }
    if (next.valuationMethod !== existing.sptValuationMethod) {
        errors.push({
            field: 'valuationMethod',
            code: stock_error_codes_1.StockErrorCode.PRESET_IN_USE,
            message: `${existing.sptCode} is used by ${users}; its valuation (${existing.sptValuationMethod}) cannot change.`,
        });
    }
    return errors;
}
function usedByWords(items, groups, adjective = '') {
    const parts = [
        items ? `${items} ${adjective}item${items === 1 ? '' : 's'}` : null,
        groups ? `${groups} ${adjective}item group${groups === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    return parts.join(' and ');
}
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
                (0, module_shared_utils_1.throwNotFound)(`Stock track preset not found for spt_id ${queryDto.spt_id}`, 'spt_id', `Stock track preset not found for spt_id ${queryDto.spt_id}`, stock_error_codes_1.StockErrorCode.PRESET_NOT_FOUND);
            }
            const usage = await this.usageOf([record.sptId]);
            return {
                items: [this.toPayload(record, record.sptCompanyId !== null, usage.get(record.sptId))],
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
        const usage = await this.usageOf(merged.map((r) => r.sptId));
        const items = merged.map((record) => this.toPayload(record, record.sptCompanyId !== null, usage.get(record.sptId)));
        return {
            items,
            meta: {
                company_id: companyId,
                spt_code: queryDto.spt_code,
                count: items.length,
            },
        };
    }
    toPayload(record, isCompanyOverride, usage = NO_USAGE) {
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
            spt_is_active: record.sptIsActive,
            usedByItems: usage.items,
            usedByGroups: usage.groups,
        };
    }
    async save(dto) {
        const existing = dto.sptId ? await this.ownPreset(dto.companyId, dto.sptId, 'save') : null;
        if (!existing) {
            const missing = [];
            if (!dto.code) {
                missing.push({ field: 'code', code: stock_error_codes_1.StockErrorCode.PRESET_FIELD_REQUIRED, message: 'A new preset needs a code.' });
            }
            if (!dto.name) {
                missing.push({ field: 'name', code: stock_error_codes_1.StockErrorCode.PRESET_FIELD_REQUIRED, message: 'A new preset needs a name.' });
            }
            if (missing.length) {
                (0, module_service_utils_1.throwStockUnprocessable)('Stock track preset cannot be saved', missing);
            }
        }
        const next = this.nextValues(dto, existing);
        const usage = existing ? (await this.usageOf([existing.sptId])).get(existing.sptId) ?? NO_USAGE : NO_USAGE;
        const locked = existing ? lockedFieldErrors(existing, next, usage) : [];
        if (locked.length) {
            (0, module_service_utils_1.throwStockConflict)('Stock track preset is in use', locked);
        }
        const ruleErrors = presetRuleErrors(next);
        if (ruleErrors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('Stock track preset cannot be saved', ruleErrors);
        }
        await this.assertCodeFree(dto.companyId, next.code, existing?.sptId ?? null);
        const author = this.author();
        const now = new Date();
        const data = {
            sptCode: next.code,
            sptName: next.name,
            sptDescription: next.description,
            sptTrackBatch: next.trackBatch,
            sptTrackMrp: next.trackMrp,
            sptTrackSalePrice: next.trackSalePrice,
            sptTrackExpiry: next.trackExpiry,
            sptTrackSerial: next.trackSerial,
            sptTrackSupplier: next.trackSupplier,
            sptValuationMethod: next.valuationMethod,
            sptIssueStrategy: next.issueStrategy,
            sptAllowNegative: next.allowNegative,
            sptShelfLifeDays: next.shelfLifeDays,
            sptNearExpiryDays: next.nearExpiryDays,
            sptBlockExpiredSale: next.blockExpiredSale,
            sptAgeingBasis: next.ageingBasis,
            sptSortOrder: next.sortOrder,
            sptRemarks: next.remarks,
        };
        let saved;
        try {
            saved = existing
                ? await this.prisma.stockTrackPreset.update({
                    where: { sptId: existing.sptId },
                    data: { ...data, sptModifiedOn: now, sptModifiedBy: author },
                })
                : await this.prisma.stockTrackPreset.create({
                    data: { ...data, sptCompanyId: dto.companyId, sptCreatedOn: now, sptCreatedBy: author },
                });
        }
        catch (error) {
            if ((0, module_service_utils_1.isUniqueConstraintError)(error)) {
                this.throwCodeTaken(next.code);
            }
            throw error;
        }
        return this.toPayload(saved, true, usage);
    }
    async deactivate(dto) {
        const existing = await this.ownPreset(dto.companyId, dto.sptId, dto.reactivate ? 'reactivate' : 'deactivate');
        const usage = (await this.usageOf([existing.sptId])).get(existing.sptId) ?? NO_USAGE;
        if (!dto.reactivate && usage.activeItems + usage.activeGroups > 0) {
            (0, module_service_utils_1.throwStockConflict)('Stock track preset is in use', [
                {
                    field: 'sptId',
                    code: stock_error_codes_1.StockErrorCode.PRESET_IN_USE,
                    message: `${existing.sptCode} is used by ${usedByWords(usage.activeItems, usage.activeGroups, 'active ')}; move them to another preset, or deactivate them, first.`,
                },
            ]);
        }
        const saved = await this.prisma.stockTrackPreset.update({
            where: { sptId: existing.sptId },
            data: { sptIsActive: dto.reactivate === true, sptModifiedOn: new Date(), sptModifiedBy: this.author() },
        });
        return this.toPayload(saved, true, usage);
    }
    async ownPreset(companyId, sptId, verb) {
        const record = await this.prisma.stockTrackPreset.findUnique({ where: { sptId } });
        if (!record || record.sptIsDeleted || (record.sptCompanyId !== null && record.sptCompanyId !== companyId)) {
            (0, module_service_utils_1.throwStockNotFound)('Stock track preset not found', 'sptId', `No stock track preset ${sptId} for this company.`, stock_error_codes_1.StockErrorCode.PRESET_NOT_FOUND);
        }
        if (record.sptCompanyId === null) {
            (0, module_service_utils_1.throwStockConflict)('Shared presets are read-only', [
                {
                    field: 'sptId',
                    code: stock_error_codes_1.StockErrorCode.PRESET_SHARED_READ_ONLY,
                    message: verb === 'save'
                        ? `${record.sptCode} is shared with every company. To change it for this company, create the company's own preset with the same code; it then replaces the shared one.`
                        : `${record.sptCode} is shared with every company and cannot be ${verb}d here.`,
                },
            ]);
        }
        return record;
    }
    nextValues(dto, existing) {
        const flags = {
            trackBatch: dto.trackBatch ?? existing?.sptTrackBatch ?? false,
            trackMrp: dto.trackMrp ?? existing?.sptTrackMrp ?? false,
            trackSalePrice: dto.trackSalePrice ?? existing?.sptTrackSalePrice ?? false,
            trackExpiry: dto.trackExpiry ?? existing?.sptTrackExpiry ?? false,
            trackSerial: dto.trackSerial ?? existing?.sptTrackSerial ?? false,
            trackSupplier: dto.trackSupplier ?? existing?.sptTrackSupplier ?? false,
        };
        return {
            code: dto.code ?? existing?.sptCode ?? '',
            name: dto.name ?? existing?.sptName ?? '',
            description: dto.description !== undefined ? dto.description : existing?.sptDescription ?? null,
            ...flags,
            valuationMethod: dto.valuationMethod ?? valuationFor(flags),
            issueStrategy: dto.issueStrategy ??
                existing?.sptIssueStrategy ??
                (flags.trackBatch && !flags.trackExpiry ? 'FIFO' : 'FEFO'),
            allowNegative: dto.allowNegative ?? existing?.sptAllowNegative ?? 'ALLOW',
            shelfLifeDays: dto.shelfLifeDays !== undefined ? dto.shelfLifeDays : existing?.sptShelfLifeDays ?? null,
            nearExpiryDays: dto.nearExpiryDays ?? existing?.sptNearExpiryDays ?? 30,
            blockExpiredSale: dto.blockExpiredSale ?? existing?.sptBlockExpiredSale ?? false,
            ageingBasis: dto.ageingBasis ?? existing?.sptAgeingBasis ?? 'INWARD_DATE',
            sortOrder: dto.sortOrder ?? existing?.sptSortOrder ?? 0,
            remarks: dto.remarks !== undefined ? dto.remarks : existing?.sptRemarks ?? null,
        };
    }
    async usageOf(sptIds) {
        const usage = new Map();
        if (!sptIds.length) {
            return usage;
        }
        const rows = await this.prisma.$queryRaw `
      SELECT p.spt_id,
             (SELECT count(*) FROM inventory.item_master i
               WHERE i.item_track_preset_id = p.spt_id AND NOT i.item_is_deleted)::int                       AS items,
             (SELECT count(*) FROM inventory.item_group_master g
               WHERE g.itg_track_preset_id = p.spt_id AND NOT g.itg_is_deleted)::int                         AS groups,
             (SELECT count(*) FROM inventory.item_master i
               WHERE i.item_track_preset_id = p.spt_id AND NOT i.item_is_deleted AND i.item_is_active)::int  AS active_items,
             (SELECT count(*) FROM inventory.item_group_master g
               WHERE g.itg_track_preset_id = p.spt_id AND NOT g.itg_is_deleted AND g.itg_is_active)::int     AS active_groups
        FROM unnest(${sptIds}::uuid[]) AS p(spt_id)
    `;
        for (const r of rows) {
            usage.set(r.spt_id, {
                items: r.items,
                groups: r.groups,
                activeItems: r.active_items,
                activeGroups: r.active_groups,
            });
        }
        return usage;
    }
    async assertCodeFree(companyId, code, exceptId) {
        const clash = await this.prisma.stockTrackPreset.findFirst({
            where: {
                sptCompanyId: companyId,
                sptCode: code,
                sptIsDeleted: false,
                ...(exceptId ? { NOT: { sptId: exceptId } } : {}),
            },
            select: { sptId: true },
        });
        if (clash) {
            this.throwCodeTaken(code);
        }
    }
    throwCodeTaken(code) {
        (0, module_service_utils_1.throwStockConflict)('Code already in use', [
            { field: 'code', code: stock_error_codes_1.StockErrorCode.PRESET_CODE_TAKEN, message: `This company already has a preset coded ${code}.` },
        ]);
    }
    author() {
        const actor = (0, module_service_utils_1.resolveActor)(null, this.requestContextService.getUserId());
        return actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor;
    }
};
exports.StockTrackPresetsService = StockTrackPresetsService;
exports.StockTrackPresetsService = StockTrackPresetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], StockTrackPresetsService);
//# sourceMappingURL=stock-track-presets.service.js.map