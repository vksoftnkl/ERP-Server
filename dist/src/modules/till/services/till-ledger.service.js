"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TillLedgerService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ledger_map_helper_1 = require("../../accountsModule/ledgerRole/ledger-map.helper");
const till_errors_1 = require("../till-errors");
const till_enum_1 = require("../types/till-enum");
const ZERO = new client_1.Prisma.Decimal(0);
let TillLedgerService = class TillLedgerService {
    async expected(tx, session) {
        const cashTender = await this.tillCashTender(tx, session.tssCompanyId, session.tssBranchId);
        const types = await tx.$queryRaw `SELECT ttm_type_id, ttm_type_name, ttm_close_mode FROM accounts.acc_tender_types`;
        const typeById = new Map(types.map((t) => [t.ttm_type_id, t]));
        const rows = await tx.$queryRaw `
      SELECT t.td_tender_type_id AS type_id,
             t.td_tender_id      AS tender_id,
             max(m.tnd_name)     AS tender_name,
             max(m.tnd_ledger_id::text)::uuid AS ledger_id,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'DR'
                      AND t.td_src_doc_type IN ('SALE_BILL','SALES_ORDER','SALE_RETURN','OTHER')), 0) AS sales,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'CR'
                      AND t.td_src_doc_type IN ('SALE_BILL','SALES_ORDER','SALE_RETURN','OTHER')), 0) AS refund,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'DR'
                      AND t.td_src_doc_type IN ('RECEIPT','PAYMENT','EXPENSE')), 0)                 AS receipt,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'CR'
                      AND t.td_src_doc_type IN ('RECEIPT','PAYMENT')), 0)                          AS payment,
             COALESCE(sum(t.td_total_amt) FILTER (WHERE t.td_dr_cr = 'CR'
                      AND t.td_src_doc_type = 'EXPENSE'), 0)                                       AS expense,
             count(*)::int AS txn_count,
             count(*) FILTER (WHERE t.td_dr_cr = 'DR' AND NULLIF(btrim(t.td_ref_no), '') IS NULL)::int AS no_ref_count
        FROM accounts.acc_tender_detail t
        LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = t.td_tender_id
        LEFT JOIN sales.sale_bill b
               ON t.td_src_doc_type = 'SALE_BILL'
              AND b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
        LEFT JOIN sales.sale_return r
               ON t.td_src_doc_type = 'SALE_RETURN'
              AND r.sr_id = t.td_src_doc_id AND r.sr_acc_year = t.td_acc_year
        LEFT JOIN accounts.acc_voucher_header h
               ON t.td_voucher_id IS NOT NULL AND h.avh_voucher_id = t.td_voucher_id
       WHERE t.td_session_id = ${session.tssId}::uuid
         AND t.td_acc_year   = ${session.tssAccYear}::char(9)
         AND t.td_is_deleted = false
         AND (t.td_is_voided = false
              OR (${session.tssClosedOn ?? null}::timestamptz IS NOT NULL
                  AND t.td_voided_on > ${session.tssClosedOn ?? null}::timestamptz))
         AND CASE t.td_src_doc_type
               WHEN 'SALE_BILL'   THEN b.sb_status = 'POSTED'
               WHEN 'SALE_RETURN' THEN r.sr_status = 'POSTED'
               ELSE h.avh_voucher_status = 'POSTED' AND h.avh_is_deleted = false
             END
       GROUP BY t.td_tender_type_id, t.td_tender_id`;
        const moved = await this.movementTotals(tx, session);
        const out = [];
        const cashType = typeById.get(till_enum_1.CASH_TENDER_TYPE_ID);
        const cash = {
            tenderTypeId: till_enum_1.CASH_TENDER_TYPE_ID,
            tenderTypeName: cashType?.ttm_type_name ?? 'CASH',
            closeMode: till_enum_1.TenderCloseMode.DENOM,
            tenderId: cashTender.tenderId,
            tenderName: cashTender.tenderName,
            ledgerId: cashTender.ledgerId,
            open: session.tssFloatCounted,
            sales: ZERO,
            refund: ZERO,
            receipt: ZERO,
            payment: ZERO,
            expense: ZERO,
            movedIn: moved.in,
            movedOut: moved.out,
            paidFromBank: ZERO,
            txnCount: 0,
            noRefCount: 0,
            expected: ZERO,
        };
        out.push(cash);
        for (const row of rows) {
            if (row.type_id === till_enum_1.CASH_TENDER_TYPE_ID) {
                cash.sales = cash.sales.plus(row.sales);
                cash.refund = cash.refund.plus(row.refund);
                cash.receipt = cash.receipt.plus(row.receipt);
                cash.payment = cash.payment.plus(row.payment);
                cash.expense = cash.expense.plus(row.expense);
                cash.txnCount += row.txn_count;
                continue;
            }
            const type = typeById.get(row.type_id);
            out.push({
                tenderTypeId: row.type_id,
                tenderTypeName: type?.ttm_type_name ?? String(row.type_id),
                closeMode: type?.ttm_close_mode ?? till_enum_1.TenderCloseMode.NONE,
                tenderId: row.tender_id,
                tenderName: row.tender_name,
                ledgerId: row.ledger_id,
                open: ZERO,
                sales: new client_1.Prisma.Decimal(row.sales),
                refund: new client_1.Prisma.Decimal(row.refund),
                receipt: new client_1.Prisma.Decimal(row.receipt),
                payment: ZERO,
                expense: ZERO,
                movedIn: ZERO,
                movedOut: ZERO,
                paidFromBank: new client_1.Prisma.Decimal(row.payment).plus(row.expense),
                txnCount: row.txn_count,
                noRefCount: row.no_ref_count,
                expected: ZERO,
            });
        }
        for (const t of out) {
            t.expected = t.open
                .plus(t.sales)
                .minus(t.refund)
                .plus(t.receipt)
                .minus(t.payment)
                .minus(t.expense)
                .plus(t.movedIn)
                .minus(t.movedOut);
        }
        return out;
    }
    async movementTotals(tx, session) {
        const [row] = await tx.$queryRaw `
      SELECT COALESCE(sum(tcm_amount) FILTER (WHERE tcm_kind IN (${till_enum_1.TillMovementKind.TOP_UP}, ${till_enum_1.TillMovementKind.PAID_IN})), 0) AS moved_in,
             COALESCE(sum(tcm_amount) FILTER (WHERE tcm_kind IN (${till_enum_1.TillMovementKind.PICKUP}, ${till_enum_1.TillMovementKind.DROP})), 0)      AS moved_out
        FROM accounts.till_cash_movement
       WHERE tcm_session_id = ${session.tssId}::uuid
         AND tcm_acc_year   = ${session.tssAccYear}::char(9)
         AND tcm_status     = 'POSTED'
         AND tcm_is_deleted = false`;
        return { in: new client_1.Prisma.Decimal(row.moved_in), out: new client_1.Prisma.Decimal(row.moved_out) };
    }
    async tillCashTender(tx, companyId, branchId) {
        const [row] = await tx.$queryRaw `
      SELECT tnd_id, tnd_name, tnd_ledger_id
        FROM accounts.acc_tender_master
       WHERE tnd_type_id    = ${till_enum_1.CASH_TENDER_TYPE_ID}::int
         AND tnd_company_id = ${companyId}::uuid
         AND (tnd_branch_id = ${branchId}::uuid OR tnd_branch_id IS NULL)
         AND tnd_is_active  = true
         AND tnd_is_deleted = false
       ORDER BY (tnd_branch_id IS NULL), tnd_is_default DESC, tnd_display_position, tnd_created_on
       LIMIT 1`;
        if (!row) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, 'This branch has no active CASH tender: the till cash ledger is the CASH tender’s ledger (Tender Master, menu 95)', 'branchId', { role: 'TILL_CASH' });
        }
        return { tenderId: row.tnd_id, tenderName: row.tnd_name, ledgerId: row.tnd_ledger_id };
    }
    async safeFor(tx, scope) {
        const rows = await tx.$queryRaw `
      SELECT tsf_id, tsf_ledger_id, tsf_name, tsf_is_default
        FROM accounts.till_safe
       WHERE tsf_company_id = ${scope.companyId}::uuid
         AND tsf_branch_id  = ${scope.branchId}::uuid
         AND tsf_is_active  = true
         AND tsf_is_deleted = false
       ORDER BY tsf_created_on`;
        const own = scope.counterSafeId
            ? rows.find((r) => r.tsf_id === scope.counterSafeId)
            : undefined;
        const pick = own ?? rows.find((r) => r.tsf_is_default) ?? (rows.length === 1 ? rows[0] : undefined);
        return pick ? { safeId: pick.tsf_id, ledgerId: pick.tsf_ledger_id, name: pick.tsf_name } : null;
    }
    async roleLedger(tx, role, companyId, branchId) {
        const resolved = await (0, ledger_map_helper_1.resolveRoleLedgers)(tx, [{ role }], {
            companyId,
            branchId,
            where: 'till',
        });
        const hit = [...resolved.values()][0];
        if (!hit) {
            (0, till_errors_1.throwTill)(till_enum_1.TillErrorCode.LEDGER_UNMAPPED, `The till role ${role} has no ledger. Map it on the Ledger Map screen (menu 250).`, 'role', { role });
        }
        return hit.ledgerId;
    }
};
exports.TillLedgerService = TillLedgerService;
exports.TillLedgerService = TillLedgerService = __decorate([
    (0, common_1.Injectable)()
], TillLedgerService);
//# sourceMappingURL=till-ledger.service.js.map