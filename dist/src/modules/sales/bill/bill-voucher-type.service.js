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
exports.BillVoucherTypeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const offline_site_1 = require("../../../config/offline-site");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const bill_voucher_type_helper_1 = require("./bill-voucher-type.helper");
let BillVoucherTypeService = class BillVoucherTypeService {
    prisma;
    salesContext;
    requestContext;
    config;
    constructor(prisma, salesContext, requestContext, config) {
        this.prisma = prisma;
        this.salesContext = salesContext;
        this.requestContext = requestContext;
        this.config = config;
    }
    async choices(q) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId() ?? null,
            menuId: sales_doc_utils_1.SALES_MENU_ID.SALE_BILL,
            right: 'view',
            codePrefix: 'SALES',
            action: 'open sales bills',
        });
        const { offered, defaultVchrTypeId, offerBase } = await (0, bill_voucher_type_helper_1.billTypeChoices)(this.prisma, (companyId, branchId, deviceId, keys) => this.salesContext.values(companyId, branchId, deviceId, keys), {
            companyId: q.companyId,
            branchId: q.branchId,
            deviceId: q.deviceId ?? null,
            offlineSite: (0, offline_site_1.isOfflineSite)(this.config),
        });
        const settings = await this.salesContext.settings(q.companyId, q.branchId);
        const today = new Date();
        const baseMode = await this.baseDeliveryMode(offered);
        const choices = await Promise.all(offered.map(async (t) => {
            const isBase = t.vchrTypeId === bill_voucher_type_helper_1.BILL_BASE_VCHR_TYPE_ID;
            const next = await (0, voucher_sequence_helper_1.previewNextVoucherNumber)(this.prisma, {
                vchrTypeId: t.vchrTypeId,
                companyId: q.companyId,
                branchId: q.branchId,
                accYear: q.accYear,
                deviceCode: (0, bill_voucher_type_helper_1.billSeriesDeviceCode)({
                    vchrTypeId: t.vchrTypeId,
                    billMode: q.billMode,
                    posSeriesPerDevice: settings.posSeriesPerDevice,
                    deviceId: q.deviceId,
                }),
                documentDate: today,
            });
            return {
                vchrTypeId: t.vchrTypeId,
                vchrTypeCode: t.vchrTypeCode,
                vchrTypeName: t.vchrTypeName,
                vchrTypeShort: t.vchrTypeShort,
                vchrNoPrefix: t.vchrNoPrefix,
                isBase,
                nextRefno: next.refno,
                nextRefnoCode: next.code,
                deliveryMode: (0, bill_voucher_type_helper_1.billTypeDeliveryMode)(t.vchrDeliveryMode, baseMode, q.billMode),
            };
        }));
        return {
            choices,
            defaultVchrTypeId,
            offerBase,
            hasChildTypes: offered.some((t) => t.vchrParentId === bill_voucher_type_helper_1.BILL_BASE_VCHR_TYPE_ID),
        };
    }
    async baseDeliveryMode(offered) {
        const base = offered.find((t) => t.vchrTypeId === bill_voucher_type_helper_1.BILL_BASE_VCHR_TYPE_ID);
        if (base) {
            return base.vchrDeliveryMode;
        }
        const [row] = await this.prisma.$queryRaw `
      SELECT vchr_delivery_mode FROM accounts.acc_voucher_types
       WHERE vchr_type_id = ${bill_voucher_type_helper_1.BILL_BASE_VCHR_TYPE_ID}::int`;
        return row?.vchr_delivery_mode ?? null;
    }
};
exports.BillVoucherTypeService = BillVoucherTypeService;
exports.BillVoucherTypeService = BillVoucherTypeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_context_service_1.SalesContextService,
        request_context_service_1.RequestContextService,
        config_1.ConfigService])
], BillVoucherTypeService);
//# sourceMappingURL=bill-voucher-type.service.js.map