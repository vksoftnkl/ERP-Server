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
exports.ItemMasterUpdateService = void 0;
const common_1 = require("@nestjs/common");
const item_unit_conversion_service_1 = require("../item-unit-conversion/item-unit-conversion.service");
const items_price_master_service_1 = require("../items-price-master/items-price-master.service");
const items_ean_code_master_service_1 = require("../items-ean-code-master/items-ean-code-master.service");
const items_reorder_master_service_1 = require("../items-reorder-master/items-reorder-master.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const EAN_IGNORED_FIELDS = new Set(['ean_id', 'ean_item_id', 'ean_created_by', 'ean_modified_by']);
const IUC_IGNORED_FIELDS = new Set([
    'iuc_id',
    'iuc_item_id',
    'iuc_created_by',
    'iuc_updated_by',
    'iul_unit_factor',
]);
const IPM_IGNORED_FIELDS = new Set(['ipm_id', 'ipm_item_id', 'ipm_created_by', 'ipm_updated_by']);
const IR_IGNORED_FIELDS = new Set(['ir_id', 'ir_item_id', 'ir_created_by', 'ir_modified_by']);
let ItemMasterUpdateService = class ItemMasterUpdateService {
    itemUnitConversionService;
    itemsPriceMasterService;
    itemsEanCodeMasterService;
    itemsReorderMasterService;
    constructor(itemUnitConversionService, itemsPriceMasterService, itemsEanCodeMasterService, itemsReorderMasterService) {
        this.itemUnitConversionService = itemUnitConversionService;
        this.itemsPriceMasterService = itemsPriceMasterService;
        this.itemsEanCodeMasterService = itemsEanCodeMasterService;
        this.itemsReorderMasterService = itemsReorderMasterService;
    }
    async syncChildren(itemId, dto, tx) {
        const unit_conversions = await this.syncUnitConversions(itemId, dto.unit_conversions, tx);
        const conversions = await this.indexUnitConversions(itemId, dto, unit_conversions, tx);
        const prices = await this.syncPrices(itemId, dto.prices, conversions, tx);
        const ean_codes = await this.syncEanCodes(itemId, dto.ean_codes, conversions, tx);
        const reorders = await this.syncReorders(itemId, dto.reorders, conversions, tx);
        return { unit_conversions, prices, ean_codes, reorders };
    }
    async indexUnitConversions(itemId, dto, syncedUnitConversions, tx) {
        const needed = dto.prices !== undefined || dto.ean_codes !== undefined || dto.reorders !== undefined;
        const rows = !needed
            ? []
            : dto.unit_conversions !== undefined
                ? syncedUnitConversions
                : await this.itemUnitConversionService.findByItemId(itemId, tx);
        return {
            iucIdByUnitId: new Map(rows.map((row) => [row.iuc_unit_id, row.iuc_id])),
            iucIds: new Set(rows.map((row) => row.iuc_id)),
        };
    }
    resolveUnitConversionId(unitId, field, conversions) {
        const iucId = conversions.iucIdByUnitId.get(unitId);
        if (iucId) {
            return iucId;
        }
        if (conversions.iucIds.has(unitId)) {
            return unitId;
        }
        (0, module_service_utils_1.throwInventoryBadRequest)('Unit not found in unit conversion for this item', [{ field, message: `Unit ${unitId} has no unit conversion row for this item` }]);
    }
    async syncUnitConversions(itemId, children, tx) {
        if (children === undefined) {
            return [];
        }
        const existing = await this.itemUnitConversionService.findByItemId(itemId, tx);
        const existingByKey = new Map(existing.map((row) => [row.iuc_unit_id, row]));
        const toSave = [];
        const claimedIds = new Set();
        for (const child of children) {
            const match = child.iuc_id
                ? existing.find((row) => row.iuc_id === child.iuc_id)
                : existingByKey.get(child.iuc_unit_id);
            if (match) {
                claimedIds.add(match.iuc_id);
                if (!this.rowChanged(child, match, IUC_IGNORED_FIELDS)) {
                    continue;
                }
            }
            toSave.push({ ...child, iuc_item_id: itemId, iuc_id: child.iuc_id ?? match?.iuc_id });
        }
        const staleIds = existing
            .filter((row) => !claimedIds.has(row.iuc_id))
            .map((row) => row.iuc_id);
        if (staleIds.length > 0) {
            await this.itemUnitConversionService.toggleDelete(staleIds, tx);
        }
        if (toSave.length > 0) {
            await this.itemUnitConversionService.save(toSave, tx);
        }
        return this.itemUnitConversionService.findByItemId(itemId, tx);
    }
    async syncPrices(itemId, children, conversions, tx) {
        if (children === undefined) {
            return [];
        }
        const existing = await this.itemsPriceMasterService.findByItemId(itemId, tx);
        const existingByKey = new Map(existing.map((row) => [this.pairKey(row.ipm_uc_unit_id, row.ipm_godown_id), row]));
        const toSave = [];
        const claimedIds = new Set();
        for (const child of children) {
            const resolved = {
                ...child,
                ipm_uc_unit_id: this.resolveUnitConversionId(child.ipm_uc_unit_id, 'ipm_uc_unit_id', conversions),
            };
            const match = resolved.ipm_id
                ? existing.find((row) => row.ipm_id === resolved.ipm_id)
                : existingByKey.get(this.pairKey(resolved.ipm_uc_unit_id, resolved.ipm_godown_id));
            if (match) {
                claimedIds.add(match.ipm_id);
                if (!this.rowChanged(resolved, match, IPM_IGNORED_FIELDS)) {
                    continue;
                }
            }
            toSave.push({ ...resolved, ipm_item_id: itemId, ipm_id: resolved.ipm_id ?? match?.ipm_id });
        }
        const staleIds = existing
            .filter((row) => !claimedIds.has(row.ipm_id))
            .map((row) => row.ipm_id);
        if (staleIds.length > 0) {
            await this.itemsPriceMasterService.toggleDelete(staleIds, tx);
        }
        if (toSave.length > 0) {
            await this.itemsPriceMasterService.save(toSave, tx);
        }
        return this.itemsPriceMasterService.findByItemId(itemId, tx);
    }
    async syncEanCodes(itemId, children, conversions, tx) {
        if (children === undefined) {
            return [];
        }
        const existing = await this.itemsEanCodeMasterService.findByItemId(itemId, tx);
        const existingByKey = new Map(existing.map((row) => [row.ean_code, row]));
        const toSave = [];
        const claimedIds = new Set();
        for (const child of children) {
            const resolved = {
                ...child,
                ean_unit_id: this.resolveUnitConversionId(child.ean_unit_id, 'ean_unit_id', conversions),
            };
            const match = resolved.ean_id
                ? existing.find((row) => row.ean_id === resolved.ean_id)
                : existingByKey.get(resolved.ean_code);
            if (match) {
                claimedIds.add(match.ean_id);
                if (!this.rowChanged(resolved, match, EAN_IGNORED_FIELDS)) {
                    continue;
                }
            }
            toSave.push({ ...resolved, ean_item_id: itemId, ean_id: resolved.ean_id ?? match?.ean_id });
        }
        const staleIds = existing
            .filter((row) => !claimedIds.has(row.ean_id))
            .map((row) => row.ean_id);
        if (staleIds.length > 0) {
            await this.itemsEanCodeMasterService.toggleDelete(staleIds, tx);
        }
        if (toSave.length > 0) {
            await this.itemsEanCodeMasterService.save(toSave, tx);
        }
        return this.itemsEanCodeMasterService.findByItemId(itemId, tx);
    }
    async syncReorders(itemId, children, conversions, tx) {
        if (children === undefined) {
            return [];
        }
        const existing = await this.itemsReorderMasterService.findByItemId(itemId, tx);
        const existingByKey = new Map(existing.map((row) => [this.pairKey(row.ir_unit_id, row.ir_godown_id), row]));
        const toSave = [];
        const claimedIds = new Set();
        for (const child of children) {
            const resolved = {
                ...child,
                ir_unit_id: child.ir_unit_id == null
                    ? child.ir_unit_id
                    : this.resolveUnitConversionId(child.ir_unit_id, 'ir_unit_id', conversions),
            };
            const match = resolved.ir_id
                ? existing.find((row) => row.ir_id === resolved.ir_id)
                : existingByKey.get(this.pairKey(resolved.ir_unit_id ?? null, resolved.ir_godown_id ?? null));
            if (match) {
                claimedIds.add(match.ir_id);
                if (!this.rowChanged(resolved, match, IR_IGNORED_FIELDS)) {
                    continue;
                }
            }
            toSave.push({ ...resolved, ir_item_id: itemId, ir_id: resolved.ir_id ?? match?.ir_id });
        }
        const staleIds = existing
            .filter((row) => !claimedIds.has(row.ir_id))
            .map((row) => row.ir_id);
        if (staleIds.length > 0) {
            await this.itemsReorderMasterService.toggleDelete(staleIds, tx);
        }
        if (toSave.length > 0) {
            await this.itemsReorderMasterService.save(toSave, tx);
        }
        return this.itemsReorderMasterService.findByItemId(itemId, tx);
    }
    rowChanged(child, existingRow, ignoredFields) {
        const existingFields = existingRow;
        for (const [field, value] of Object.entries(child)) {
            if (value === undefined || ignoredFields.has(field)) {
                continue;
            }
            const current = existingFields[field];
            if (typeof value === 'number' && typeof current === 'number') {
                if (value !== current) {
                    return true;
                }
            }
            else if (current !== value) {
                return true;
            }
        }
        return false;
    }
    pairKey(left, right) {
        return `${left ?? ''}::${right ?? ''}`;
    }
};
exports.ItemMasterUpdateService = ItemMasterUpdateService;
exports.ItemMasterUpdateService = ItemMasterUpdateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [item_unit_conversion_service_1.ItemUnitConversionService,
        items_price_master_service_1.ItemsPriceMasterService,
        items_ean_code_master_service_1.ItemsEanCodeMasterService,
        items_reorder_master_service_1.ItemsReorderMasterService])
], ItemMasterUpdateService);
//# sourceMappingURL=item-master-update.service.js.map