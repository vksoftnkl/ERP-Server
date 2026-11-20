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
exports.MobileReceiptStatusService = exports.MOBILE_RECEIPT_STATUS_OVERLAP_MINUTES = void 0;
exports.phoneChequeStatus = phoneChequeStatus;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const receipt_enum_1 = require("../../modules/accountsModule/receipt/types/receipt-enum");
const mobile_scope_1 = require("../common/mobile-scope");
const mobile_receipt_dto_1 = require("./dto/mobile-receipt.dto");
exports.MOBILE_RECEIPT_STATUS_OVERLAP_MINUTES = 5;
function phoneChequeStatus(houseStatus) {
    switch (houseStatus) {
        case receipt_enum_1.PdcStatus.HELD:
        case receipt_enum_1.PdcStatus.DEPOSITED:
            return receipt_enum_1.PdcStatus.HELD;
        case receipt_enum_1.PdcStatus.CLEARED:
            return receipt_enum_1.PdcStatus.CLEARED;
        case receipt_enum_1.PdcStatus.BOUNCED:
            return receipt_enum_1.PdcStatus.BOUNCED;
        default:
            return receipt_enum_1.PdcStatus.CANCELLED;
    }
}
let MobileReceiptStatusService = class MobileReceiptStatusService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async status(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? mobile_receipt_dto_1.MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE;
        await (0, mobile_scope_1.assertMobileCompany)(this.prisma, query.companyId);
        const device = await (0, mobile_scope_1.resolveMobileDevice)(this.prisma, query.deviceUid);
        const [clock] = await this.prisma.$queryRaw `
      SELECT clock_timestamp() - make_interval(mins => ${exports.MOBILE_RECEIPT_STATUS_OVERLAP_MINUTES}::int) AS "asOf"`;
        const rows = await this.rowsOf(query, device.devId, pageSize, (page - 1) * pageSize);
        const total = rows[0]?.total ??
            (page > 1 ? ((await this.rowsOf(query, device.devId, 1, 0))[0]?.total ?? 0) : 0);
        return {
            items: rows.map((row) => ({
                avhClientUuid: row.avhClientUuid,
                avhVoucherId: row.avhVoucherId,
                avhAccYear: row.avhAccYear,
                avhVoucherRefno: row.avhVoucherRefno,
                avhVoucherStatus: row.avhVoucherStatus,
                cancelledOn: row.avhVoucherStatus === receipt_enum_1.VoucherStatus.CANCELLED && row.statusOn
                    ? row.statusOn.toISOString()
                    : null,
                cancelReason: row.avhVoucherStatus === receipt_enum_1.VoucherStatus.CANCELLED ? row.cancelReason : null,
                pdc: row.pdc.map((cheque) => ({
                    voucherId: cheque.voucherId,
                    voucherRefno: cheque.voucherRefno,
                    instrumentNo: cheque.instrumentNo,
                    chequeDate: cheque.chequeDate,
                    amount: cheque.amount,
                    status: phoneChequeStatus(cheque.houseStatus),
                    houseStatus: cheque.houseStatus,
                    isPostDated: cheque.isPostDated,
                })),
                updatedOn: row.updatedOn.toISOString(),
            })),
            total,
            page,
            pageSize,
            hasMore: (page - 1) * pageSize + rows.length < total,
            companyId: query.companyId,
            asOf: clock.asOf.toISOString(),
        };
    }
    rowsOf(query, devId, limit, offset) {
        const since = query.since
            ? client_1.Prisma.sql `WHERE x.updated_on >= ${query.since}::timestamptz`
            : client_1.Prisma.empty;
        return this.prisma.$queryRaw `
      WITH mine AS (
        SELECT h.avh_voucher_id, h.avh_acc_year, h.avh_voucher_type_id, h.avh_voucher_date,
               h.avh_client_uuid, h.avh_voucher_refno, h.avh_voucher_status, h.avh_status_on,
               h.avh_cancel_reason, h.avh_created_on, h.avh_modified_on
          FROM accounts.acc_voucher_header h
         WHERE h.avh_company_id = ${query.companyId}::uuid
           AND h.avh_client_uuid IS NOT NULL
           AND h.avh_device_id = ${devId}
      ),
      cheques AS (
        SELECT m.avh_voucher_id AS receipt_id, p.apd_id, p.apd_voucher_id,
               p.apd_instrument_no, p.apd_instrument_date, p.apd_amount, p.apd_status,
               (p.apd_instrument_date > m.avh_voucher_date) AS is_post_dated,
               GREATEST(p.apd_created_on, p.apd_modified_on, p.apd_status_on) AS changed_on,
               v.avh_voucher_refno AS voucher_refno
          FROM mine m
          JOIN accounts.acc_pdc_register p
            ON p.apd_is_deleted = false
           AND p.apd_tra_type = ${receipt_enum_1.PdcTraType.RECEIVED}
           AND (p.apd_voucher_id = m.avh_voucher_id
                OR p.apd_voucher_id IN (
                     SELECT c.avh_voucher_id
                       FROM accounts.acc_voucher_header c
                      WHERE c.avh_against_voucher_id = m.avh_voucher_id
                        AND c.avh_voucher_type_id = m.avh_voucher_type_id
                        AND c.avh_is_deleted = false)
                OR p.apd_tender_id IN (
                     SELECT t.td_id
                       FROM accounts.acc_tender_detail t
                      WHERE t.td_src_doc_id = m.avh_voucher_id))
          LEFT JOIN accounts.acc_voucher_header v
            ON v.avh_voucher_id = p.apd_voucher_id AND v.avh_acc_year = p.apd_voucher_acc_year
      ),
      x AS (
        SELECT m.*,
               GREATEST(m.avh_created_on, m.avh_modified_on, m.avh_status_on,
                        (SELECT max(c.changed_on) FROM cheques c
                          WHERE c.receipt_id = m.avh_voucher_id)) AS updated_on
          FROM mine m
      )
      SELECT x.avh_client_uuid::text AS "avhClientUuid",
             x.avh_voucher_id::text AS "avhVoucherId",
             btrim(x.avh_acc_year::text) AS "avhAccYear",
             x.avh_voucher_refno AS "avhVoucherRefno",
             x.avh_voucher_status AS "avhVoucherStatus",
             x.avh_status_on AS "statusOn",
             x.avh_cancel_reason AS "cancelReason",
             x.updated_on AS "updatedOn",
             count(*) OVER ()::int AS total,
             COALESCE((
               SELECT json_agg(json_build_object(
                        'voucherId', c.apd_voucher_id::text,
                        'voucherRefno', c.voucher_refno,
                        'instrumentNo', c.apd_instrument_no,
                        'chequeDate', c.apd_instrument_date::text,
                        'amount', to_char(c.apd_amount, 'FM9999999999990.00'),
                        'houseStatus', c.apd_status,
                        'isPostDated', c.is_post_dated)
                      ORDER BY c.apd_instrument_date, c.apd_id)
                 FROM cheques c
                WHERE c.receipt_id = x.avh_voucher_id), '[]'::json) AS pdc
        FROM x
        ${since}
       ORDER BY x.updated_on, x.avh_voucher_id
       LIMIT ${limit}::int OFFSET ${offset}::int`;
    }
};
exports.MobileReceiptStatusService = MobileReceiptStatusService;
exports.MobileReceiptStatusService = MobileReceiptStatusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MobileReceiptStatusService);
//# sourceMappingURL=mobile-receipt-status.service.js.map