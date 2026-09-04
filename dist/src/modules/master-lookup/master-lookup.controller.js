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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterLookupController = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_error_response_dto_1 = require("../../common/dto/http-error-response.dto");
const master_lookup_api_types_1 = require("./types/master-lookup-api.types");
const master_lookup_response_dto_1 = require("./dto/master-lookup-response.dto");
const bill_balance_service_1 = require("../accountsModule/billBalance/bill-balance.service");
const get_party_credit_summary_dto_1 = require("../accountsModule/billBalance/dto/get-party-credit-summary.dto");
const party_credit_summary_response_dto_1 = require("../accountsModule/billBalance/dto/party-credit-summary-response.dto");
const master_lookup_service_1 = require("./master-lookup.service");
const master_lookup_query_dto_1 = require("./dto/master-lookup-query.dto");
const customer_detail_query_dto_1 = require("./dto/customer-detail-query.dto");
const document_number_query_dto_1 = require("./dto/document-number-query.dto");
const freight_charge_query_dto_1 = require("./dto/freight-charge-query.dto");
const barcode_lookup_query_dto_1 = require("./dto/barcode-lookup-query.dto");
const item_price_lookup_query_dto_1 = require("./dto/item-price-lookup-query.dto");
const item_price_refresh_query_dto_1 = require("./dto/item-price-refresh-query.dto");
const api_version_1 = require("../../common/constants/api-version");
let MasterLookupController = class MasterLookupController {
    masterLookupService;
    billBalanceService;
    constructor(masterLookupService, billBalanceService) {
        this.masterLookupService = masterLookupService;
        this.billBalanceService = billBalanceService;
    }
    async getAllAccountsAndMasterNameIds(queryDto) {
        const data = await this.masterLookupService.getAllAccountsAndMasterNameIds(queryDto.module, queryDto.id);
        const scope = [
            queryDto.module ? `module ${queryDto.module}` : null,
            queryDto.id ? `id ${queryDto.id}` : null,
        ]
            .filter(Boolean)
            .join(' and ');
        const message = scope
            ? `Name-id data fetched successfully for ${scope}`
            : 'Name-id data fetched successfully';
        return { success: true, message, data };
    }
    async getAllMasters(queryDto) {
        const data = await this.masterLookupService.getAllMasters(queryDto.module, queryDto.id);
        const message = 'Data fetched successfully';
        return { success: true, message, data };
    }
    async getBranchesByCompany(companyId) {
        const data = await this.masterLookupService.getBranchesByCompany(companyId);
        return { success: true, message: `Branches fetched for company ${companyId}`, data };
    }
    async getFiscalYearsByCompany(companyId) {
        const data = await this.masterLookupService.getFiscalYearsByCompany(companyId);
        return { success: true, message: `Fiscal years fetched for company ${companyId}`, data };
    }
    async getCustomerDetail(query) {
        const data = await this.masterLookupService.getCustomerDetail(query);
        return { success: true, message: 'Customer detail fetched successfully', data };
    }
    async getFreightChargesForDistance(query) {
        const data = await this.masterLookupService.getFreightChargesForDistance(query.distance);
        return {
            success: true,
            message: `Freight charges fetched for distance ${query.distance} km`,
            data,
        };
    }
    async getItemByBarcode(query) {
        const data = await this.masterLookupService.getItemByBarcode(query.barcode);
        return {
            success: true,
            message: `Item fetched successfully for barcode ${query.barcode}`,
            data,
        };
    }
    async getUnitsByItem(itemId) {
        const data = await this.masterLookupService.getUnitsByItem(itemId);
        return { success: true, message: `Units fetched for item ${itemId}`, data };
    }
    async getItemPriceLookup(query) {
        const data = await this.masterLookupService.getItemPriceLookup(query);
        return {
            success: true,
            message: 'Item price lookup fetched successfully',
            data,
        };
    }
    async refreshItemPriceLookup(query) {
        const data = await this.masterLookupService.refreshItemPriceLookup(query);
        return {
            success: true,
            message: 'Next item unit fetched successfully',
            data,
        };
    }
    async getDocumentByNumber(query) {
        const data = await this.masterLookupService.getDocumentByNumber(query);
        return { success: true, message: 'Document fetched successfully', data };
    }
    async getPartyCredit(query) {
        const data = await this.billBalanceService.getCreditSummary(query);
        return { success: true, message: 'Party credit summary fetched successfully', data };
    }
    async getDropdownSqlData(dropdownId) {
        const data = await this.masterLookupService.getDropdownSqlData(dropdownId);
        return { success: true, message: `Dropdown ${dropdownId} data fetched successfully`, data };
    }
};
exports.MasterLookupController = MasterLookupController;
__decorate([
    (0, common_1.Get)('name-id/all-accounts-and-masters'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get id-name lookup data for all accounts/master modules, or one module via query parameter',
    }),
    (0, swagger_1.ApiQuery)({ name: 'module', required: false, enum: master_lookup_api_types_1.LOOKUP_MODULE_KEYS }),
    (0, swagger_1.ApiQuery)({
        name: 'id',
        required: false,
        description: "Narrows the result to the row carrying this id in the module's own table. With `module` it reads that one master by id; without one, every module is searched. Nothing matching is an empty list, not a 404.",
        schema: { type: 'string' },
    }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.MasterLookupSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_lookup_query_dto_1.MasterLookupQueryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getAllAccountsAndMasterNameIds", null);
__decorate([
    (0, common_1.Get)('name-id/all-masters'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get id-name lookup data for all master modules as a flat array',
    }),
    (0, swagger_1.ApiQuery)({ name: 'module', required: false, enum: master_lookup_api_types_1.LOOKUP_MODULE_KEYS }),
    (0, swagger_1.ApiQuery)({
        name: 'id',
        required: false,
        description: "Narrows the result to the row carrying this id in the module's own table — e.g. ?module=companyGroups&id=<cog_group_id>. Without `module`, every master module is searched. Nothing matching is an empty list, not a 404.",
        schema: { type: 'string' },
    }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.NameIdOptionListSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [master_lookup_query_dto_1.MasterLookupQueryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getAllMasters", null);
__decorate([
    (0, common_1.Get)('branches/by-company/:companyId'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get branches for a specific company' }),
    (0, swagger_1.ApiParam)({ name: 'companyId', type: String, description: 'UUID of the company' }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.NameIdOptionListSuccessDto }),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getBranchesByCompany", null);
__decorate([
    (0, common_1.Get)('fiscal-years/by-company/:companyId'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Get fiscal years for a specific company' }),
    (0, swagger_1.ApiParam)({ name: 'companyId', type: String, description: 'UUID of the company' }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.FiscalYearOptionListSuccessDto }),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getFiscalYearsByCompany", null);
__decorate([
    (0, common_1.Get)('customer-detail'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Resolve a customer into a single detail row (legacy iflag=7 customer-detail cursor): identity, address, GST, credit-control flags, price level and billed-date summary. salesman_id is cus_default_salesman and salesman_name is joined from employee_master; tcs_company/local_sales are derived against the requested company; regional returns the regional-language name/address.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'cus_id', required: true, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'company_id', required: true, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'branch_id', required: true, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({
        name: 'regional',
        required: false,
        description: 'When true, name/address use the regional-language fields, else English.',
        schema: { type: 'boolean' },
    }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.CustomerDetailSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [customer_detail_query_dto_1.CustomerDetailQueryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getCustomerDetail", null);
__decorate([
    (0, common_1.Get)('freight-charges/charge'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Get the freight-charge slabs matching a distance (legacy iflag=9): distance BETWEEN fr_from_km AND fr_to_km.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'distance', required: true, schema: { type: 'integer', minimum: 0 } }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.FreightChargeListSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [freight_charge_query_dto_1.FreightChargeQueryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getFreightChargesForDistance", null);
__decorate([
    (0, common_1.Get)('item-by-barcode'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: 'Resolve a scanned barcode into its item and selling unit (legacy iflag=10). Matches item_ean_codes.ean_code case-insensitively; returns allow_sales, item_status, batch_config and weigh_scale flags.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'barcode', required: true, schema: { type: 'string', maxLength: 64 } }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.BarcodeItemLookupSuccessDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [barcode_lookup_query_dto_1.BarcodeLookupQueryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getItemByBarcode", null);
__decorate([
    (0, common_1.Get)('units/by-item/:itemId'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({
        summary: "Get an item's units from item_unit_conversion joined to item_unit_master. Returns itemUnitId (iuc_id), unitId (unit_id) and unitName (unit_name) for each active, non-deleted conversion, in unit-slno order (base unit first).",
    }),
    (0, swagger_1.ApiParam)({ name: 'itemId', type: String, description: 'UUID of the item' }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.ItemUnitOptionListSuccessDto }),
    __param(0, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getUnitsByItem", null);
__decorate([
    (0, common_1.Get)('item-price'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(60),
    (0, swagger_1.ApiOperation)({
        summary: 'Resolve an item into a single sale-lookup row: effective price for the requested price level, tax block, stock, reorder and quantity-wise rates. unit_id selects the unit rate, else the unit-slno rule applies (retail item → highest unit, else base unit); customer_id applies a customer rate to price levels 1–4; godown_id overrides the sale godown; regional returns the local-language name; acccyear scopes stock.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'item_id', required: true, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({
        name: 'company_id',
        required: false,
        description: 'Scopes GST applicability, the negative-stock rule and stock. Omitted → the item resolves without a company scope.',
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'branch_id',
        required: false,
        description: 'Scopes the item and its price rows to a branch. Omitted → the item resolves across all branches.',
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'unit_id',
        required: false,
        description: 'Selects the unit rate. When omitted, the unit-slno rule applies: retail item → highest unit, else base unit (slno 0).',
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'customer_id',
        required: false,
        description: 'Applies the customer rate discount to price levels 1–4 only (A/B/C/D).',
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'godown_id',
        required: false,
        description: "Sale godown override. Resolves the godown row and scopes stock to this godown instead of the rate's own godown.",
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiQuery)({ name: 'acccyear', required: false, schema: { type: 'string', maxLength: 9 } }),
    (0, swagger_1.ApiQuery)({
        name: 'loading_type',
        required: false,
        description: "How loading_charge is resolved. manual = not resolved, the user types it in; item_basis = the item price row's own charge; auto = the sale_loading_charges weight slab matched on the resolved unit's iuc_uom_weight, which additionally requires company_id and branch_id. Omitted is manual.",
        schema: { type: 'string', enum: ['manual', 'item_basis', 'auto'], default: 'manual' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'freight_type',
        required: false,
        description: "How freight_charge is resolved. manual = not resolved, the user types it in; item_basis = the item price row's own ipm_freight_charge. Omitted is manual. No auto: freight slabs are distance-matched, which this lookup has no distance for — use /freight-charges/charge.",
        schema: { type: 'string', enum: ['manual', 'item_basis'], default: 'manual' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'regional',
        required: false,
        description: 'When true, item_name is the regional name (item_name_ta), else the English name.',
        schema: { type: 'boolean' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'price_level',
        required: false,
        description: '1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost (defaults to 1)',
        schema: { type: 'integer', minimum: 1, maximum: 7, default: 1 },
    }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.ItemPriceLookupSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_price_lookup_query_dto_1.ItemPriceLookupQueryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getItemPriceLookup", null);
__decorate([
    (0, common_1.Get)('item-switch-uom'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: "Cycle an item's unit. Resolves the conversion after iuc_id in the item's item_unit_conversion list — ordered by iuc_unit_slno, the item's own unit order, wrapping around after the last unit — and returns that iuc_id only; no price row is read, so the screen re-reads /item-price itself if it needs one. A stale iuc_id the item does not carry falls back to its first conversion; an item with no conversion rows falls back to the requested iuc_id. Never cached.",
    }),
    (0, swagger_1.ApiQuery)({ name: 'item_id', required: true, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({
        name: 'iuc_id',
        required: true,
        description: 'The item_unit_conversion (iuc_id) currently on screen. The response returns the NEXT one.',
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.ItemUnitCycleSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [item_price_refresh_query_dto_1.ItemPriceRefreshQueryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "refreshItemPriceLookup", null);
__decorate([
    (0, common_1.Get)('document-by-number'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, swagger_1.ApiOperation)({
        summary: 'Resolve a printed sales-document number into the key its row is addressed by. sale_bill, sale_order and sale_quotation are LIST-partitioned by accounting year and keyed on (id, acc_year), so a screen holding only the number the user typed cannot open the document without first learning the year — that is what this returns. orderNo is matched exactly against the refno column (sb_bill_refno / so_order_refno / sq_quote_refno), and an all-digits value is matched against the serial (sb_bill_slno / so_order_slno / sq_quote_slno) as well. Deleted documents are skipped; where a number repeats — the same serial in a new year, the same quotation number across revisions — the newest accounting year, and then the newest revision, wins. Nothing matching is a 404, never a blank 200. Never cached.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'module',
        required: true,
        enum: master_lookup_api_types_1.DOCUMENT_LOOKUP_MODULE_KEYS,
        description: 'Which document table to read: saleBill → sales.sale_bill, saleOrder → sales.sale_order, saleQuotation → sales.sale_quotation. Display aliases such as sale-bill, invoice, order and quotation are accepted.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'orderNo',
        required: true,
        description: 'The document number as printed on it, or its bare running serial.',
        schema: { type: 'string', maxLength: 100, example: 'quo00042' },
    }),
    (0, swagger_1.ApiQuery)({ name: 'companyId', required: true, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', required: true, schema: { type: 'string', format: 'uuid' } }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.DocumentNumberSuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [document_number_query_dto_1.DocumentNumberQueryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getDocumentByNumber", null);
__decorate([
    (0, common_1.Get)('party-credit'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(0),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, swagger_1.ApiOperation)({
        summary: 'A party\'s outstanding position joined to their credit ceilings, for the credit check on sale bill / sales order entry. partyId is the only required parameter; companyId and branchId narrow the read and accYear narrows nothing. Overdue is always measured against the database server date, which comes back as asOnDate. pendingAmount is NET: open receivables (DR) less advances and credit notes (CR), so a customer who has paid ahead is not billed as if they owed it. Counts cover receivables only. Outstanding spans ALL accounting years — a bill stays open in the partition of the year it was raised in and is never carried forward, so accYear is echoed back but does not scope the figures. The available* fields are not clamped at zero; the negative is what the screen renders as "exceeded by". Never cached.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'partyId',
        required: true,
        description: "customers.cus_id, and the only required parameter. Unknown, soft-deleted or (when companyId is given) another company's customer → 404, never a zeroed 200.",
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'companyId',
        required: false,
        description: "Tenant scope for both the bills and the customer. Omitted → the party is resolved and aggregated across EVERY company, which is not any one tenant's position; entry screens know their company and should always send it.",
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'branchId',
        required: false,
        description: 'Omit for the company-wide credit position, which is the usual credit check. Supplied → only bills RAISED at that branch are counted.',
        schema: { type: 'string', format: 'uuid' },
    }),
    (0, swagger_1.ApiQuery)({
        name: 'accYear',
        required: false,
        description: "The screen's accounting year, echoed on the response (null when omitted). Does not scope the outstanding figures.",
        schema: { type: 'string', pattern: '^\\d{4}-\\d{4}$', example: '2025-2026' },
    }),
    (0, swagger_1.ApiOkResponse)({ type: party_credit_summary_response_dto_1.PartyCreditSummarySuccessDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_party_credit_summary_dto_1.GetPartyCreditSummaryDto]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getPartyCredit", null);
__decorate([
    (0, common_1.Get)('dropdown/:dropdownId'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Run dropdown SQL query by dropdown ID and return results' }),
    (0, swagger_1.ApiParam)({ name: 'dropdownId', type: Number, description: 'ID of the dropdown to execute' }),
    (0, swagger_1.ApiOkResponse)({ type: master_lookup_response_dto_1.NameIdOptionListSuccessDto }),
    __param(0, (0, common_1.Param)('dropdownId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MasterLookupController.prototype, "getDropdownSqlData", null);
exports.MasterLookupController = MasterLookupController = __decorate([
    (0, swagger_1.ApiTags)('Master Lookup'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiExtraModels)(master_lookup_response_dto_1.ItemPriceLookupPayloadDto),
    (0, cache_manager_1.CacheTTL)(1),
    (0, common_1.Controller)('master-lookups'),
    __metadata("design:paramtypes", [master_lookup_service_1.MasterLookupService,
        bill_balance_service_1.BillBalanceService])
], MasterLookupController);
//# sourceMappingURL=master-lookup.controller.js.map