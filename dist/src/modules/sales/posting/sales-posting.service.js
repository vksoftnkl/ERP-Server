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
exports.SalesPostingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const ledger_map_helper_1 = require("../../accountsModule/ledgerRole/ledger-map.helper");
const DEVICE_TYPES = new Set(['PC', 'WEB', 'MOBILE', 'POS', 'DESKTOP']);
let SalesPostingService = class SalesPostingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async postLegs(tx, doc) {
        const legs = doc.legs.filter((l) => round2(l.amount) !== 0);
        if (legs.length === 0) {
            throw new Error(`${doc.header.srcDocType} ${doc.header.srcDocId} produced no voucher legs`);
        }
        const ledgerByLeg = await this.resolveLegLedgers(tx, doc.header, legs);
        this.assertBalanced(doc.header, legs);
        const slno = await (0, voucher_sequence_helper_1.allocateVoucherSlno)(tx, doc.header.companyId, doc.header.accYear);
        const number = doc.header.presetRefno
            ? { refno: doc.header.presetRefno, lastNo: doc.header.presetNo ?? slno }
            : await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
                vchrTypeId: doc.header.voucherTypeId,
                companyId: doc.header.companyId,
                branchId: doc.header.branchId,
                accYear: doc.header.accYear,
                deviceCode: doc.header.deviceCode ?? null,
                documentDate: new Date(`${doc.header.voucherDate}T00:00:00Z`),
            });
        const postedOn = new Date();
        const [header] = await tx.$queryRaw `
      INSERT INTO accounts.acc_voucher_header (
        avh_company_id, avh_branch_id, avh_tenant_id, avh_acc_year,
        avh_voucher_type_id, avh_voucher_no, avh_voucher_slno, avh_voucher_refno,
        avh_voucher_date,
        avh_src_module, avh_src_doc_type, avh_src_doc_id,
        avh_usr_refno, avh_doc_refno, avh_doc_date,
        avh_doc_amount, avh_round_off,
        avh_party_id, avh_remarks,
        avh_voucher_status, avh_status_on, avh_status_by, avh_posted_on,
        avh_user_id, avh_session_id, avh_device_type, avh_device_id,
        avh_created_by
      ) VALUES (
        ${doc.header.companyId}::uuid, ${doc.header.branchId}::uuid,
        ${doc.header.tenantId ?? null}::uuid, ${doc.header.accYear}::char(9),
        ${doc.header.voucherTypeId}::int, ${number.lastNo}::bigint, ${slno}::bigint, ${number.refno},
        ${doc.header.voucherDate}::date,
        'SALES', ${doc.header.srcDocType}, ${doc.header.srcDocId}::uuid,
        ${doc.header.usrRefno ?? null}, ${doc.header.docRefno ?? null},
        ${doc.header.docDate ?? doc.header.voucherDate}::date,
        ${money(doc.header.docAmount)}::numeric, ${money(doc.header.roundOff ?? 0)}::numeric,
        ${doc.header.partyId}::uuid, ${doc.header.remarks ?? null},
        -- ck_avh_status_on: anything but DRAFT must say when and by whom.
        'POSTED', now(), ${doc.header.userId}::uuid, now(),
        ${doc.header.userId}::uuid, ${doc.header.sessionId ?? null}::uuid,
        ${normaliseDeviceType(doc.header.deviceType)}, ${doc.header.deviceId ?? null}::uuid,
        ${doc.header.createdBy ?? 'SYSTEM'}
      )
      RETURNING avh_voucher_id`;
        const voucherId = header.avh_voucher_id;
        const values = legs.map((leg, i) => client_1.Prisma.sql `(
        ${voucherId}::uuid, ${doc.header.companyId}::uuid, ${doc.header.branchId}::uuid,
        ${doc.header.tenantId ?? null}::uuid, ${doc.header.accYear}::char(9),
        ${doc.header.voucherTypeId}::int, ${number.lastNo}::bigint, ${i + 1}::int,
        ${doc.header.voucherDate}::date, ${number.refno},
        ${doc.header.docDate ?? doc.header.voucherDate}::date,
        ${leg.drCr}::bpchar, ${ledgerByLeg[i]}::uuid,
        ${money(Math.abs(leg.amount))}::numeric,
        ${leg.remarks ?? null}, ${doc.header.sessionId ?? null}::uuid,
        ${doc.header.userId}::uuid,
        ${leg.docId ?? null}::uuid, ${leg.docRefno ?? null},
        ${leg.docAccYear ?? null}::char(9),
        ${leg.roleTag ?? leg.role ?? null},
        ${doc.header.createdBy ?? 'SYSTEM'}
      )`);
        await tx.$executeRaw `
      INSERT INTO accounts.acc_vouchers (
        av_voucher_id, av_company_id, av_branch_id,
        av_tenant_id, av_acc_year,
        av_voucher_type_id, av_voucher_no, av_row_no,
        av_voucher_date, av_voucher_refno,
        av_doc_date,
        av_dr_cr, av_ledger_id,
        av_amount,
        av_remarks, av_session_id,
        av_user_id,
        av_doc_id, av_doc_refno,
        av_doc_acc_year,
        av_role,
        av_created_by
      )
      VALUES ${client_1.Prisma.join(values)}`;
        const totals = sumSides(legs);
        return {
            voucherId,
            voucherNo: number.refno,
            voucherRefno: number.refno,
            voucherSlno: slno,
            voucherLastNo: number.lastNo,
            postedOn,
            totalDebit: totals.dr,
            totalCredit: totals.cr,
            legCount: legs.length,
        };
    }
    async reverseLegs(tx, voucherId, accYear, reason, actor = 'SYSTEM') {
        const [original] = await tx.$queryRaw `
      SELECT avh_voucher_id, avh_company_id, avh_branch_id, avh_voucher_type_id, avh_acc_year,
             avh_voucher_refno, avh_voucher_date, avh_voucher_status, avh_reversal_voucher_id
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)
         AND avh_is_deleted = false
         FOR UPDATE`;
        if (!original) {
            return null;
        }
        if (original.avh_reversal_voucher_id || original.avh_voucher_status === 'CANCELLED') {
            return null;
        }
        await tx.$executeRaw `
      UPDATE accounts.acc_voucher_header
         SET avh_voucher_status = 'CANCELLED',
             -- ck_avh_cancel: a cancellation must always carry a reason.
             avh_cancel_reason  = ${reason},
             avh_status_on      = now(),
             avh_modified_on    = now(),
             avh_modified_by    = ${actor}
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)`;
        const number = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
            vchrTypeId: original.avh_voucher_type_id,
            companyId: original.avh_company_id,
            branchId: original.avh_branch_id,
            accYear: original.avh_acc_year.trim(),
            deviceCode: null,
            documentDate: original.avh_voucher_date,
        });
        const slno = await (0, voucher_sequence_helper_1.allocateVoucherSlno)(tx, original.avh_company_id, original.avh_acc_year.trim());
        const remarks = `Reversal of ${original.avh_voucher_refno ?? voucherId}: ${reason}`;
        const [mirror] = await tx.$queryRaw `
      INSERT INTO accounts.acc_voucher_header (
        avh_company_id, avh_branch_id, avh_tenant_id, avh_acc_year,
        avh_voucher_type_id, avh_voucher_no, avh_voucher_slno, avh_voucher_refno,
        avh_voucher_date, avh_doc_date,
        avh_doc_amount, avh_round_off, avh_party_id,
        avh_remarks, avh_against_voucher_id, avh_against_acc_year,
        avh_voucher_status, avh_status_on, avh_status_by, avh_posted_on,
        avh_user_id, avh_session_id, avh_device_type, avh_device_id, avh_created_by
      )
      SELECT o.avh_company_id, o.avh_branch_id, o.avh_tenant_id, o.avh_acc_year,
             o.avh_voucher_type_id, ${number.lastNo}::bigint, ${slno}::bigint, ${number.refno},
             o.avh_voucher_date, o.avh_doc_date,
             o.avh_doc_amount, o.avh_round_off, o.avh_party_id,
             ${remarks}, o.avh_voucher_id, o.avh_acc_year,
             'POSTED', now(), o.avh_user_id, now(),
             o.avh_user_id, o.avh_session_id, o.avh_device_type, o.avh_device_id, ${actor}
        FROM accounts.acc_voucher_header o
       WHERE o.avh_voucher_id = ${voucherId}::uuid
         AND o.avh_acc_year   = ${accYear}::char(9)
      RETURNING avh_voucher_id`;
        const legCount = await tx.$executeRaw `
      INSERT INTO accounts.acc_vouchers (
        av_voucher_id, av_company_id, av_branch_id, av_tenant_id, av_acc_year,
        av_voucher_type_id, av_voucher_no, av_row_no, av_voucher_date,
        av_voucher_refno, av_doc_date, av_dr_cr, av_ledger_id, av_opp_ledger_id,
        av_amount, av_cost_centre_id, av_remarks, av_session_id, av_user_id,
        av_doc_id, av_doc_refno, av_doc_acc_year, av_role, av_created_by
      )
      SELECT ${mirror.avh_voucher_id}::uuid, o.av_company_id, o.av_branch_id,
             o.av_tenant_id, o.av_acc_year,
             o.av_voucher_type_id, ${number.lastNo}::bigint, o.av_row_no, o.av_voucher_date,
             ${number.refno}, o.av_doc_date,
             CASE WHEN o.av_dr_cr = 'DR' THEN 'CR'::bpchar ELSE 'DR'::bpchar END,
             o.av_ledger_id, o.av_opp_ledger_id,
             o.av_amount, o.av_cost_centre_id, ${remarks}, o.av_session_id, o.av_user_id,
             o.av_doc_id, o.av_doc_refno, o.av_doc_acc_year, o.av_role, ${actor}
        FROM accounts.acc_vouchers o
       WHERE o.av_voucher_id = ${voucherId}::uuid
         AND o.av_acc_year   = ${accYear}::char(9)
         AND o.av_is_deleted = false
       ORDER BY o.av_row_no`;
        await tx.$executeRaw `
      UPDATE accounts.acc_voucher_header
         SET avh_reversal_voucher_id = ${mirror.avh_voucher_id}::uuid,
             avh_reversal_acc_year   = ${accYear}::char(9)
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)`;
        return { voucherId: mirror.avh_voucher_id, legCount };
    }
    async resolveLegLedgers(tx, header, legs) {
        const requests = [];
        for (const leg of legs) {
            if (leg.role && !leg.ledgerId) {
                requests.push({
                    role: leg.role,
                    taxId: leg.taxId ?? null,
                    supplyNature: leg.supplyNature ?? null,
                    field: leg.field ?? leg.role,
                });
            }
        }
        const resolved = requests.length === 0
            ? new Map()
            : await (0, ledger_map_helper_1.requireRoleLedgers)(tx, requests, {
                companyId: header.companyId,
                branchId: header.branchId,
                where: header.srcDocType,
                message: 'Bill cannot be posted',
            });
        return legs.map((leg) => {
            if (leg.ledgerId) {
                return leg.ledgerId;
            }
            if (!leg.role) {
                throw new Error(`A voucher leg names neither a role nor a ledger (${leg.field ?? '?'})`);
            }
            return (resolved.get((0, ledger_map_helper_1.roleLedgerKey)({
                role: leg.role,
                taxId: leg.taxId ?? null,
                supplyNature: leg.supplyNature ?? null,
            }))?.ledgerId ?? null);
        });
    }
    assertBalanced(header, legs) {
        const { dr, cr } = sumSides(legs);
        if (round2(dr) !== round2(cr)) {
            const diff = round2(dr - cr);
            throw new Error(`${header.srcDocType} ${header.docRefno ?? header.srcDocId} does not balance: ` +
                `debits ${round2(dr)}, credits ${round2(cr)}, ` +
                `${diff > 0 ? 'debit' : 'credit'} heavy by ${Math.abs(diff)}`);
        }
    }
};
exports.SalesPostingService = SalesPostingService;
exports.SalesPostingService = SalesPostingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SalesPostingService);
function sumSides(legs) {
    let dr = 0;
    let cr = 0;
    for (const leg of legs) {
        if (leg.drCr === 'DR') {
            dr += Math.abs(leg.amount);
        }
        else {
            cr += Math.abs(leg.amount);
        }
    }
    return { dr: round2(dr), cr: round2(cr) };
}
function round2(v) {
    return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}
function money(v) {
    return round2(v).toFixed(2);
}
function normaliseDeviceType(value) {
    if (!value) {
        return null;
    }
    const upper = value.trim().toUpperCase();
    return DEVICE_TYPES.has(upper) ? upper : null;
}
//# sourceMappingURL=sales-posting.service.js.map