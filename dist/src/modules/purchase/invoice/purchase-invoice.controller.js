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
exports.PurchaseInvoiceController = exports.PURCHASE_INVOICE_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const purchase_invoice_service_1 = require("./purchase-invoice.service");
const save_purchase_invoice_dto_1 = require("./dto/save-purchase-invoice.dto");
exports.PURCHASE_INVOICE_MENU_ID = 24;
let PurchaseInvoiceController = class PurchaseInvoiceController {
    service;
    prisma;
    requestContext;
    constructor(service, prisma, requestContext) {
        this.service = service;
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async save(dto) {
        await this.right(dto.header.piId ? 'edit' : 'create', 'save a purchase invoice');
        if (dto.header.post)
            await this.right('post', 'post a purchase invoice');
        const data = await this.service.save(dto);
        return { success: true, message: dto.header.post ? `Purchase ${data.header.piRefno} posted` : `Purchase ${data.header.piRefno} saved as draft`, data };
    }
    async validate(dto) {
        await this.right('view', 'calculate a purchase invoice');
        return { success: true, message: 'Purchase invoice calculated', data: await this.service.preview(dto) };
    }
    async post(dto) {
        await this.right('post', 'post a purchase invoice');
        const data = await this.service.post(dto.piId, dto.accYear);
        return { success: true, message: `Purchase ${data.header.piRefno} posted`, data };
    }
    async get(q) {
        await this.right('view', 'open a purchase invoice');
        return { success: true, message: 'Purchase invoice fetched', data: await this.service.get(q.piId, q.accYear) };
    }
    async grnLines(q) {
        await this.right('view', 'list GRN lines to bill');
        return { success: true, message: 'GRN lines to bill', data: await this.service.grnLines(q) };
    }
    async cancel(dto) {
        await this.right('cancel', 'cancel a purchase invoice');
        const data = await this.service.cancel(dto);
        return { success: true, message: `Purchase ${data.header.piRefno} cancelled`, data };
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.requestContext.getUserId(), menuId: exports.PURCHASE_INVOICE_MENU_ID, right, codePrefix: 'PUR', action });
    }
};
exports.PurchaseInvoiceController = PurchaseInvoiceController;
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Save a purchase invoice draft; header.post = true saves and posts in one transaction (stock in, books, bill-wise, shortage).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_purchase_invoice_dto_1.SavePurchaseInvoiceDto]),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The server calculation of a bill (lines, charges, ITC, short, landed cost, net payable) — nothing is written.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_purchase_invoice_dto_1.SavePurchaseInvoiceDto]),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)('post'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Post a saved draft.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_purchase_invoice_dto_1.GetPurchaseInvoiceQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "post", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'A purchase invoice: header, printed lines with their allocation rows, charges.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_purchase_invoice_dto_1.GetPurchaseInvoiceQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('grn-lines'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: "A supplier's posted GRN lines at the branch not yet billed (R4) — what a bill from GRN picks. `blocked` says why a line cannot be billed yet." }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_purchase_invoice_dto_1.GrnLinesQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "grnLines", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a posted bill nothing has paid or adjusted: stock out, voucher reversed, bill-wise and shortage rows withdrawn.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_purchase_invoice_dto_1.CancelPurchaseInvoiceDto]),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "cancel", null);
exports.PurchaseInvoiceController = PurchaseInvoiceController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Invoice'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/invoices'),
    __metadata("design:paramtypes", [purchase_invoice_service_1.PurchaseInvoiceService,
        prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], PurchaseInvoiceController);
//# sourceMappingURL=purchase-invoice.controller.js.map