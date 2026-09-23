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
exports.SalesDocBlocksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const statutory_service_1 = require("./statutory.service");
const sales_guards_1 = require("./sales.guards");
const sales_doc_utils_1 = require("./sales-doc.utils");
let SalesDocBlocksService = class SalesDocBlocksService {
    prisma;
    statutory;
    constructor(prisma, statutory) {
        this.prisma = prisma;
        this.statutory = statutory;
    }
    async build(facts, client) {
        const c = client ?? this.prisma;
        const [gst, voucher, dayClosed] = await Promise.all([
            this.gstRows(c, facts.registerId, facts.accYear),
            this.voucher(c, facts.voucherId, facts.accYear),
            (0, sales_guards_1.loadDayClosed)(c, facts.companyId, facts.branchId, facts.docDate),
        ]);
        const irnLive = gst.irn.status === 'GENERATED';
        const ewbLive = gst.ewb.status === 'GENERATED';
        let irnCancelWindowUntil = null;
        if (irnLive && gst.irnGeneratedOn) {
            const w = await this.statutory.withinCancelWindow(facts.companyId, 'IRN', gst.irnGeneratedOn, facts.docDate, new Date(), c);
            irnCancelWindowUntil =
                w.limit?.value != null
                    ? new Date(gst.irnGeneratedOn.getTime() + w.limit.value * 3_600_000).toISOString()
                    : null;
        }
        const posted = facts.status === 'POSTED';
        const declared = irnLive || ewbLive;
        return {
            posting: {
                voucherId: facts.voucherId,
                voucherRefno: voucher?.refno ?? null,
                postedOn: (0, sales_doc_utils_1.isoDateTime)(voucher?.postedOn ?? null),
                registerId: facts.registerId,
                cogsAmt: facts.cogsAmt,
                loyaltyEarned: facts.loyaltyEarned ?? 0,
                loyaltyRedeemed: facts.loyaltyRedeemed ?? 0,
                irn: gst.irn,
                ewb: gst.ewb,
            },
            locks: {
                returns: facts.returns ?? 0,
                allocations: facts.allocations ?? 0,
                dayClosed,
                irnLive,
                ewbLive,
                irnCancelWindowUntil,
                ewbValidUpto: (0, sales_doc_utils_1.isoDateTime)(gst.ewbValidUpto),
                editable: {
                    document: facts.status === 'DRAFT' && facts.amendable !== false,
                    transportBand: (facts.status === 'DRAFT' || posted) && !declared,
                },
            },
        };
    }
    async gstRows(c, gdrId, accYear) {
        const na = {
            irn: { status: 'NA', number: null, ackNo: null, ackOn: null, message: null },
            ewb: {
                status: 'NA',
                number: null,
                generatedOn: null,
                validUpto: null,
                message: null,
                vehicleNo: null,
            },
            irnGeneratedOn: null,
            ewbGeneratedOn: null,
            ewbValidUpto: null,
        };
        if (!gdrId) {
            return na;
        }
        const [row] = await c.$queryRaw `
      SELECT e.gde_status, e.gde_irn, e.gde_ack_no, e.gde_ack_on, e.gde_last_message,
             w.gdw_status, w.gdw_no, w.gdw_generated_on, w.gdw_valid_upto, w.gdw_extended_upto,
             w.gdw_last_message, w.gdw_vehicle_no
        FROM (SELECT 1) x
        LEFT JOIN accounts.acc_voucher_doc_einvoice e
               ON e.gde_gdr_id = ${gdrId}::uuid AND e.gde_acc_year = ${accYear}::char(9)
              AND e.gde_is_deleted = false
        LEFT JOIN accounts.acc_voucher_doc_ewaybill w
               ON w.gdw_gdr_id = ${gdrId}::uuid AND w.gdw_acc_year = ${accYear}::char(9)
              AND w.gdw_is_deleted = false
       LIMIT 1`;
        if (!row) {
            return na;
        }
        const validUpto = row.gdw_extended_upto ?? row.gdw_valid_upto;
        return {
            irn: {
                status: gstStatus(row.gde_status),
                number: row.gde_irn,
                ackNo: row.gde_ack_no,
                ackOn: (0, sales_doc_utils_1.isoDateTime)(row.gde_ack_on),
                message: row.gde_last_message,
            },
            ewb: {
                status: gstStatus(row.gdw_status),
                number: row.gdw_no,
                generatedOn: (0, sales_doc_utils_1.isoDateTime)(row.gdw_generated_on),
                validUpto: (0, sales_doc_utils_1.isoDateTime)(validUpto),
                message: row.gdw_last_message,
                vehicleNo: row.gdw_vehicle_no,
            },
            irnGeneratedOn: row.gde_ack_on,
            ewbGeneratedOn: row.gdw_generated_on,
            ewbValidUpto: validUpto,
        };
    }
    async voucher(c, voucherId, accYear) {
        if (!voucherId) {
            return null;
        }
        const [row] = await c.$queryRaw `
      SELECT avh_voucher_refno, avh_posted_on
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::char(9)`;
        return row ? { refno: row.avh_voucher_refno, postedOn: row.avh_posted_on } : null;
    }
};
exports.SalesDocBlocksService = SalesDocBlocksService;
exports.SalesDocBlocksService = SalesDocBlocksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        statutory_service_1.StatutoryService])
], SalesDocBlocksService);
const GST_STATUSES = [
    'NA',
    'PENDING',
    'GENERATED',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
    'REJECTED',
];
function gstStatus(v) {
    const u = (v ?? 'NA').toUpperCase();
    return GST_STATUSES.includes(u) ? u : 'NA';
}
//# sourceMappingURL=sales-doc-blocks.service.js.map