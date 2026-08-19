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
exports.MasterLookupService = void 0;
const common_1 = require("@nestjs/common");
const module_service_utils_1 = require("../../common/utils/module-service.utils");
const pg_service_1 = require("../../database/pg/pg.service");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const configured_dropdown_lookup_1 = require("./lookups/configured-dropdown.lookup");
const customer_detail_lookup_1 = require("./lookups/customer-detail.lookup");
const document_number_lookup_1 = require("./lookups/document-number.lookup");
const item_price_lookup_1 = require("./lookups/item-price.lookup");
const module_fetchers_1 = require("./lookups/module-fetchers");
const master_lookup_constants_1 = require("./master-lookup.constants");
const master_lookup_api_types_1 = require("./types/master-lookup-api.types");
const lookup_option_utils_1 = require("./utils/lookup-option.utils");
let MasterLookupService = class MasterLookupService {
    prisma;
    moduleFetchers;
    configuredDropdowns;
    customerDetail;
    itemPrice;
    documentNumber;
    constructor(prisma, pg) {
        this.prisma = prisma;
        this.moduleFetchers = (0, module_fetchers_1.buildModuleFetchers)(prisma);
        this.configuredDropdowns = new configured_dropdown_lookup_1.ConfiguredDropdownLookup(prisma, pg);
        this.customerDetail = new customer_detail_lookup_1.CustomerDetailLookup(prisma);
        this.itemPrice = new item_price_lookup_1.ItemPriceLookup(prisma);
        this.documentNumber = new document_number_lookup_1.DocumentNumberLookup(prisma);
    }
    async getAllAccountsAndMasterNameIds(module, id) {
        const configuredDropdowns = await this.configuredDropdowns.loadConfigsByModule();
        if (module) {
            const items = await this.fetchModuleItems(module, configuredDropdowns, id);
            return this.toSingleModulePayload(module, items);
        }
        const byModule = await this.fetchModules(master_lookup_api_types_1.LOOKUP_MODULE_KEYS, configuredDropdowns, id);
        return {
            accounts: pickModules(byModule, master_lookup_api_types_1.ACCOUNT_LOOKUP_MODULE_KEYS),
            masters: pickModules(byModule, master_lookup_api_types_1.MASTER_LOOKUP_MODULE_KEYS),
        };
    }
    async getAllMasters(module, id) {
        const configuredDropdowns = await this.configuredDropdowns.loadConfigsByModule();
        const moduleKeys = module ? [module] : master_lookup_api_types_1.MASTER_LOOKUP_MODULE_KEYS;
        const byModule = await this.fetchModules(moduleKeys, configuredDropdowns, id);
        return Object.values(byModule)
            .flat()
            .map((item) => ({ id: item.id, name: item.name }));
    }
    async getDropdownSqlData(dropdownId) {
        const config = await this.configuredDropdowns.loadConfigById(dropdownId);
        if (!config)
            return [];
        return (await this.configuredDropdowns.fetchItems(config)) ?? [];
    }
    async getBranchesByCompany(companyId) {
        const rows = await this.prisma.branchMaster.findMany({
            where: {
                brCompId: companyId,
                brIsDeleted: false,
                brIsActive: true,
            },
            select: { brId: true, brName: true },
            orderBy: [{ brName: 'asc' }, { brId: 'asc' }],
        });
        return rows.map((row) => (0, lookup_option_utils_1.toOption)(row.brId, row.brName));
    }
    async getFiscalYearsByCompany(companyId) {
        const rows = await this.prisma.fiscalYear.findMany({
            where: {
                compId: companyId,
                isDeleted: false,
            },
            select: {
                fyId: true,
                fyYearName: true,
                fyBeginDate: true,
                fyEndDate: true,
                fyStatus: true,
                fyIsCurrent: true,
            },
            orderBy: [{ fyIsCurrent: 'desc' }, { fyBeginDate: 'desc' }, { fyId: 'desc' }],
        });
        return rows.map((row) => ({
            id: row.fyId,
            name: row.fyYearName.trim(),
            beginDate: (0, lookup_option_utils_1.toDateOnly)(row.fyBeginDate),
            endDate: (0, lookup_option_utils_1.toDateOnly)(row.fyEndDate),
            status: row.fyStatus,
            isCurrent: row.fyIsCurrent,
        }));
    }
    async getFreightChargesForDistance(distance) {
        const rows = await this.prisma.saleFreightCharge.findMany({
            where: {
                frIsDeleted: false,
                frIsActive: true,
                frFromKm: { lte: distance },
                frToKm: { gte: distance },
            },
            orderBy: [{ frFromKm: 'asc' }, { frFromWeight: 'asc' }],
        });
        return rows.map((row) => (0, lookup_option_utils_1.toFreightChargeOption)(row));
    }
    async getItemByBarcode(barcode) {
        const code = barcode.trim();
        const ean = await this.prisma.itemEanCode.findFirst({
            where: {
                eanIsActive: true,
                eanIsDeleted: false,
                eanCode: { equals: code, mode: 'insensitive' },
            },
            select: { eanItemId: true, eanUcUnitId: true },
        });
        if (!ean) {
            (0, module_service_utils_1.throwMasterNotFound)('Barcode not found', 'barcode', `No active item found for barcode ${code}`);
        }
        const item = await this.prisma.itemMaster.findFirst({
            where: { itemId: ean.eanItemId },
            select: {
                itemNameEn: true,
                itemBatchConfig: true,
                itemAllowSales: true,
                itemIsActive: true,
                itemWeighScale: true,
            },
        });
        if (!item) {
            (0, module_service_utils_1.throwMasterNotFound)('Barcode not found', 'barcode', `Barcode ${code} is not linked to a valid item`);
        }
        return {
            itemId: ean.eanItemId,
            unitId: ean.eanUcUnitId,
            itemName: item.itemNameEn,
            batchConfig: item.itemBatchConfig,
            allowSales: item.itemAllowSales,
            itemStatus: item.itemIsActive,
            weighScale: item.itemWeighScale,
        };
    }
    async getUnitsByItem(itemId) {
        const rows = await this.prisma.itemUnitConversion.findMany({
            where: { iucItemId: itemId, iucIsActive: true, iucIsDeleted: false },
            orderBy: [{ iucUnitSlno: 'asc' }],
            select: {
                iucId: true,
                iucUnitId: true,
                unit: { select: { unit_name: true } },
            },
        });
        return rows.map((row) => ({
            itemUnitId: row.iucId,
            unitId: row.iucUnitId,
            unitName: row.unit.unit_name,
        }));
    }
    async getCustomerDetail(query) {
        return this.customerDetail.getCustomerDetail(query);
    }
    async getItemPriceLookup(query) {
        return this.itemPrice.getItemPriceLookup(query);
    }
    async refreshItemPriceLookup(query) {
        return this.itemPrice.refreshItemPriceLookup(query);
    }
    async getDocumentByNumber(query) {
        return this.documentNumber.getDocumentByNumber(query);
    }
    async fetchModules(moduleKeys, configuredDropdowns, id) {
        const entries = await Promise.all(moduleKeys.map(async (key) => [key, await this.fetchModuleItems(key, configuredDropdowns, id)]));
        return Object.fromEntries(entries);
    }
    async fetchModuleItems(module, configuredDropdowns, id) {
        const items = await this.fetchAllModuleItems(module, configuredDropdowns);
        return id === undefined ? items : items.filter((item) => String(item.id) === id);
    }
    async fetchAllModuleItems(module, configuredDropdowns) {
        const items = await this.fetchModuleItemsInSourceOrder(module, configuredDropdowns);
        return master_lookup_constants_1.ID_ORDERED_LOOKUP_MODULES.has(module) ? (0, lookup_option_utils_1.sortOptionsById)(items) : items;
    }
    async fetchModuleItemsInSourceOrder(module, configuredDropdowns) {
        const config = configuredDropdowns.get(module);
        if (config) {
            const configured = await this.configuredDropdowns.fetchItems(config);
            if (configured !== null)
                return configured;
        }
        return this.moduleFetchers[module]();
    }
    toSingleModulePayload(module, items) {
        const scope = master_lookup_api_types_1.ACCOUNT_LOOKUP_MODULE_KEYS.includes(module)
            ? 'accounts'
            : 'masters';
        return { scope, module, items };
    }
};
exports.MasterLookupService = MasterLookupService;
exports.MasterLookupService = MasterLookupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pg_service_1.PgService])
], MasterLookupService);
function pickModules(byModule, moduleKeys) {
    return Object.fromEntries(moduleKeys.map((key) => [key, byModule[key]]));
}
//# sourceMappingURL=master-lookup.service.js.map