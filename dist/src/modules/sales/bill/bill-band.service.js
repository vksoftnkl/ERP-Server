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
exports.BillBandService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const sales_context_service_1 = require("../posting/sales-context.service");
const transport_band_service_1 = require("../posting/transport-band.service");
const sales_guards_1 = require("../posting/sales.guards");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const bill_service_1 = require("./bill.service");
const bill_api_types_1 = require("./types/bill-api.types");
const DELIVERY_ORDER = [
    'NA',
    'PENDING',
    'VERIFIED',
    'PACKED',
    'DISPATCHED',
    'DELIVERED',
];
let BillBandService = class BillBandService {
    prisma;
    bills;
    salesContext;
    transportBand;
    audit;
    constructor(prisma, bills, salesContext, transportBand, audit) {
        this.prisma = prisma;
        this.bills = bills;
        this.salesContext = salesContext;
        this.transportBand = transportBand;
        this.audit = audit;
    }
    async deliveryStatus(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const bill = await this.bills.lockHeader(tx, dto);
            this.assertPosted(bill);
            await this.assertDayOpen(tx, bill);
            const settings = await this.salesContext.settings(bill.sbCompanyId, bill.sbBranchId);
            const requireVerify = await this.requireVerification(bill.sbCompanyId, bill.sbBranchId);
            void settings;
            const current = bill.sbDeliveryStatus === 'NA' ? 'PENDING' : bill.sbDeliveryStatus;
            const next = dto.event;
            const from = DELIVERY_ORDER.indexOf(current);
            const to = DELIVERY_ORDER.indexOf(next);
            const expectedPrev = next === 'PACKED' && requireVerify ? 'VERIFIED' : DELIVERY_ORDER[to - 1];
            const allowed = to > from &&
                (next === 'VERIFIED' || (next === 'PACKED' && !requireVerify)
                    ? true
                    : current === expectedPrev);
            if (!allowed) {
                (0, sales_errors_1.throwSalesLocked)(`Delivery is ${current}; ${next} is not the next step${requireVerify ? ' (this branch verifies before dispatch)' : ''}`, posting_types_1.SALES_ERROR_CODES.DELIVERY_ORDER, 'event');
            }
            const actor = this.salesContext.actor();
            await tx.saleBill.update({
                where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
                data: {
                    sbDeliveryStatus: next,
                    sbDeliveredOn: next === 'DELIVERED' ? now : bill.sbDeliveredOn,
                    sbVehicleNo: dto.vehicleNo ?? bill.sbVehicleNo,
                    sbModifiedOn: now,
                    sbModifiedBy: actor,
                },
            });
            if (dto.lrNo) {
                const band = await this.transportBand.read({ docType: 'SALE_BILL', docId: bill.sbId, accYear: bill.sbAccYear }, tx);
                if (!band || band.lrNo !== dto.lrNo) {
                    await this.transportBand.write(tx, this.ref(bill), { ...(band ?? { direction: 'OUTWARD' }), lrNo: dto.lrNo }, actor, { gdrId: bill.sbDocRegisterId, now });
                }
            }
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
                srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
                srcDocId: bill.sbId,
                srcDocRefno: bill.sbBillRefno,
                event: next,
                fromStatus: current,
                toStatus: next,
                changedOn: now,
                changedBy: actor,
                remarks: dto.remarks ?? null,
                deviceId: bill.sbDeviceId,
                sessionId: bill.sbSessionId,
            });
            return { sbDeliveryStatus: next };
        });
    }
    async updateRemarks(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const bill = await this.bills.lockHeader(tx, dto);
            this.assertPosted(bill);
            const actor = this.salesContext.actor();
            await tx.saleBill.update({
                where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
                data: { sbRemarks: dto.sbRemarks ?? null, sbModifiedOn: now, sbModifiedBy: actor },
            });
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
                srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
                srcDocId: bill.sbId,
                srcDocRefno: bill.sbBillRefno,
                event: 'REMARKS_EDITED',
                fromStatus: bill.sbStatus,
                toStatus: bill.sbStatus,
                changedOn: now,
                changedBy: actor,
                remarks: dto.editRemark,
                deviceId: bill.sbDeviceId,
                sessionId: bill.sbSessionId,
            });
            await this.audit.logEntityChange({
                action: 'update',
                tableName: 'sale_bill',
                screenName: 'Sale Bill',
                screenType: 'transaction',
                pk: bill.sbId,
                displayName: bill.sbBillRefno || bill.sbId,
                originalRecord: { sbRemarks: bill.sbRemarks },
                modifiedRecord: { sbRemarks: dto.sbRemarks ?? null },
                userId: actor,
                notes: `Remarks edited: ${dto.editRemark}`,
            }, tx);
            return { sbRemarks: dto.sbRemarks ?? null };
        });
    }
    async transport(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const bill = await this.bills.lockHeader(tx, dto);
            if (bill.sbStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This bill is CANCELLED', posting_types_1.SALES_ERROR_CODES.BILL_CANCELLED, 'sbId');
            }
            await this.assertDayOpen(tx, bill);
            const actor = this.salesContext.actor();
            const row = await this.transportBand.write(tx, this.ref(bill), dto.transport, actor, {
                gdrId: bill.sbDocRegisterId,
                now,
            });
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
                srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
                srcDocId: bill.sbId,
                srcDocRefno: bill.sbBillRefno,
                event: 'TRANSPORT_EDITED',
                fromStatus: bill.sbStatus,
                toStatus: bill.sbStatus,
                changedOn: now,
                changedBy: actor,
                deviceId: bill.sbDeviceId,
                sessionId: bill.sbSessionId,
            });
            return row;
        });
    }
    ref(bill) {
        return {
            docType: 'SALE_BILL',
            docId: bill.sbId,
            accYear: bill.sbAccYear,
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            tenantId: bill.sbTenantId,
            docRefno: bill.sbBillRefno,
        };
    }
    assertPosted(bill) {
        if (bill.sbStatus !== bill_api_types_1.BILL_STATUS_POSTED) {
            (0, sales_errors_1.throwSalesLocked)(`This verb needs a POSTED bill (it is ${bill.sbStatus})`, bill.sbStatus === 'CANCELLED'
                ? posting_types_1.SALES_ERROR_CODES.BILL_CANCELLED
                : posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'sbId');
        }
    }
    async assertDayOpen(tx, bill) {
        const d = (0, sales_doc_utils_1.isoDate)(bill.sbBillDate) ?? (0, sales_doc_utils_1.isoToday)();
        if (await (0, sales_guards_1.loadDayClosed)(tx, bill.sbCompanyId, bill.sbBranchId, d)) {
            (0, sales_errors_1.throwSalesLocked)(`The books for ${d} are closed at this branch`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, 'sbBillDate');
        }
    }
    async requireVerification(companyId, branchId) {
        const v = ((await this.salesContext.setting(companyId, branchId, 'sales.require_verification_before_dispatch')) ?? '')
            .trim()
            .toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }
};
exports.BillBandService = BillBandService;
exports.BillBandService = BillBandService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bill_service_1.BillService,
        sales_context_service_1.SalesContextService,
        transport_band_service_1.TransportBandService,
        audit_log_service_1.AuditLogService])
], BillBandService);
//# sourceMappingURL=bill-band.service.js.map