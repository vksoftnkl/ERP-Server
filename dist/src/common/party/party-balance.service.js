"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartyBalanceService = void 0;
exports.withFigures = withFigures;
exports.formatRupees = formatRupees;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const error_wording_1 = require("../error-wording/error-wording");
const voucher_books_sql_1 = require("../../modules/reports/common/voucher-books.sql");
const FAR_FUTURE = '9999-12-31';
const ROLE_WORD = { CUSTOMER: 'customer', SUPPLIER: 'supplier' };
let PartyBalanceService = class PartyBalanceService {
    async lockLedger(tx, ledId) {
        const rows = await tx.$queryRaw `
      SELECT led_company_id, led_is_deleted
        FROM accounts.acc_ledger_master
       WHERE led_id = ${ledId}::uuid
       FOR UPDATE`;
        const row = rows[0];
        return row ? { ledCompanyId: row.led_company_id, ledIsDeleted: row.led_is_deleted } : undefined;
    }
    async balances(tx, ledId) {
        await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
        const pairs = await tx.$queryRaw `
      SELECT av_company_id AS company_id, av_acc_year::text AS acc_year
        FROM accounts.acc_vouchers
       WHERE av_ledger_id = ${ledId}::uuid AND av_is_deleted = false AND av_company_id IS NOT NULL
      UNION
      SELECT op_company_id, op_acc_year::text
        FROM accounts.acc_opening_balance
       WHERE op_ledger_id = ${ledId}::uuid AND op_is_deleted = false AND op_company_id IS NOT NULL
       ORDER BY 1, 2`;
        const byCompany = new Map();
        for (const p of pairs) {
            byCompany.set(p.company_id, [...(byCompany.get(p.company_id) ?? []), p.acc_year]);
        }
        const out = [];
        for (const [companyId, years] of byCompany) {
            let running = new client_1.Prisma.Decimal(0);
            let first = true;
            for (const accYear of years.sort()) {
                const scope = { companyId, accYear, branchId: null };
                const ledgers = { ledgerId: ledId };
                const [row] = await tx.$queryRaw `
          SELECT (SELECT COALESCE(SUM(l.av_signed_amount), 0)
                    FROM (${(0, voucher_books_sql_1.countedLegsSql)(scope, { upTo: FAR_FUTURE, ledgers })}) l) AS legs,
                 (SELECT o.amt FROM (${(0, voucher_books_sql_1.openingSetSql)(scope, ledgers)}) o)          AS opening,
                 (SELECT count(*)::int
                    FROM accounts.acc_opening_balance s
                   WHERE s.op_company_id = ${companyId}::uuid AND s.op_ledger_id = ${ledId}::uuid
                     AND s.op_acc_year = ${accYear}::char(9) AND s.op_is_deleted = false) AS rows,
                 COALESCE((SELECT bool_or(s.op_is_stale)
                    FROM accounts.acc_opening_balance s
                   WHERE s.op_company_id = ${companyId}::uuid AND s.op_ledger_id = ${ledId}::uuid
                     AND s.op_acc_year = ${accYear}::char(9) AND s.op_is_deleted = false), false) AS stale`;
                if (row.rows > 0 && (!row.stale || first)) {
                    running = new client_1.Prisma.Decimal(row.opening ?? 0);
                }
                running = running.plus(new client_1.Prisma.Decimal(row.legs ?? 0));
                first = false;
            }
            if (!running.isZero()) {
                out.push({ companyId, companyName: null, amount: running });
            }
        }
        if (out.length > 0) {
            const companies = await tx.company.findMany({
                where: { compId: { in: out.map((b) => b.companyId) } },
                select: { compId: true, compName: true },
            });
            const names = new Map(companies.map((c) => [c.compId, c.compName]));
            for (const b of out) {
                b.companyName = names.get(b.companyId) ?? null;
            }
        }
        return out;
    }
    async chequesInHand(tx, ledId) {
        const [row] = await tx.$queryRaw `
      SELECT count(*)::int AS n
        FROM accounts.acc_pdc_register
       WHERE apd_party_id = ${ledId}::uuid
         AND apd_is_deleted = false
         AND apd_status IN ('HELD', 'DEPOSITED')
         AND apd_posting_mode = 'ON_CLEARING'`;
        return Number(row?.n ?? 0);
    }
    async warnings(tx, ledId) {
        const [row] = await tx.$queryRaw `
      SELECT (
               (SELECT count(*) FROM sales.sale_bill      WHERE sb_cust_id  = ${ledId}::uuid AND sb_status  = 'DRAFT' AND sb_is_deleted  = false)
             + (SELECT count(*) FROM sales.sale_order     WHERE so_cust_id  = ${ledId}::uuid AND so_status  = 'DRAFT' AND so_is_deleted  = false)
             + (SELECT count(*) FROM sales.sale_quotation WHERE sq_cust_id  = ${ledId}::uuid AND sq_status  = 'DRAFT' AND sq_is_deleted  = false)
             + (SELECT count(*) FROM sales.sale_return    WHERE sr_cust_id  = ${ledId}::uuid AND sr_status  = 'DRAFT' AND sr_is_deleted  = false)
             + (SELECT count(*) FROM sales.sale_dc        WHERE sdc_cust_id = ${ledId}::uuid AND sdc_status = 'DRAFT' AND sdc_is_deleted = false)
             + (SELECT count(*) FROM accounts.acc_voucher_header WHERE avh_party_id = ${ledId}::uuid AND avh_voucher_status = 'DRAFT' AND avh_is_deleted = false)
             + (SELECT count(*) FROM purchase.pur_invoice WHERE pi_supplier_id  = ${ledId}::uuid AND pi_status  = 'DRAFT' AND pi_is_deleted  = false)
             + (SELECT count(*) FROM purchase.pur_order   WHERE po_supplier_id  = ${ledId}::uuid AND po_status  = 'DRAFT' AND po_is_deleted  = false)
             + (SELECT count(*) FROM purchase.pur_grn     WHERE grn_supplier_id = ${ledId}::uuid AND grn_status = 'DRAFT' AND grn_is_deleted = false)
             + (SELECT count(*) FROM purchase.pur_return  WHERE pr_supplier_id  = ${ledId}::uuid AND pr_status  = 'DRAFT' AND pr_is_deleted  = false)
             )::int AS drafts,
             (SELECT count(*)::int FROM accounts.acc_bill_balance
               WHERE abl_party_id = ${ledId}::uuid AND abl_is_deleted = false AND abl_pending_amount <> 0) AS open_bills`;
        return { draftDocs: Number(row?.drafts ?? 0), openBills: Number(row?.open_bills ?? 0) };
    }
    async companyWithBooks(tx, ledId, currentCompanyId, nextCompanyId) {
        if (currentCompanyId === nextCompanyId) {
            return null;
        }
        const rows = await tx.$queryRaw `
      SELECT company_id FROM (
        SELECT av_company_id AS company_id FROM accounts.acc_vouchers
         WHERE av_ledger_id = ${ledId}::uuid AND av_is_deleted = false
        UNION
        SELECT op_company_id FROM accounts.acc_opening_balance
         WHERE op_ledger_id = ${ledId}::uuid AND op_is_deleted = false
      ) b
      WHERE company_id IS NOT NULL
        AND CASE WHEN ${currentCompanyId}::uuid IS NOT NULL
                 THEN company_id = ${currentCompanyId}::uuid
                 ELSE company_id IS DISTINCT FROM ${nextCompanyId}::uuid END
      LIMIT 1`;
        const hit = rows[0];
        if (!hit) {
            return null;
        }
        const company = await tx.company.findFirst({
            where: { compId: hit.company_id },
            select: { compName: true },
        });
        return { companyId: hit.company_id, companyName: company?.compName ?? null };
    }
    async deleteCheck(tx, input) {
        const { partyId, role, otherRoleLive, codes } = input;
        const [balances, chequesInHand, warnings] = await Promise.all([
            otherRoleLive ? Promise.resolve([]) : this.balances(tx, partyId),
            this.chequesInHand(tx, partyId),
            this.warnings(tx, partyId),
        ]);
        const refusals = [];
        if (!otherRoleLive && balances.length > 0) {
            const first = balances[0];
            const amount = formatRupees(first.amount.abs());
            const side = first.amount.isNegative() ? 'Cr' : 'Dr';
            const where = first.companyName ?? 'a company';
            refusals.push(withFigures({
                field: role === 'CUSTOMER' ? 'cusId' : 'supId',
                code: codes.hasBalance,
                message: `The ${ROLE_WORD[role]}'s ledger balance is ${first.amount.abs().toFixed(2)} ${side.toUpperCase()} in company ${first.companyId}; a party is deleted only at a zero balance`,
            }, `This ${ROLE_WORD[role]} still has ₹${amount} ${side} in ${where}.`));
        }
        if (!otherRoleLive && chequesInHand > 0) {
            refusals.push(withFigures({
                field: role === 'CUSTOMER' ? 'cusId' : 'supId',
                code: codes.hasChequeInHand,
                message: `${chequesInHand} cheque(s) of this party are HELD / DEPOSITED and post only on clearing`,
            }, null));
        }
        return {
            partyId,
            role,
            otherRoleLive,
            ledgerWouldBeDeleted: !otherRoleLive,
            canDelete: refusals.length === 0,
            refusalCode: refusals[0]?.code ?? null,
            balances: balances.map((b) => ({
                companyId: b.companyId,
                companyName: b.companyName,
                amount: b.amount.abs().toFixed(2),
                drCr: b.amount.isNegative() ? 'CR' : 'DR',
            })),
            warnings: { ...warnings, chequesInHand },
            refusals,
        };
    }
};
exports.PartyBalanceService = PartyBalanceService;
exports.PartyBalanceService = PartyBalanceService = __decorate([
    (0, common_1.Injectable)()
], PartyBalanceService);
function withFigures(refusal, line) {
    const words = (0, error_wording_1.wordingFor)({ code: refusal.code, field: refusal.field });
    if (!words) {
        return refusal;
    }
    return { ...refusal, user: line ? { ...words, line } : words };
}
function formatRupees(value) {
    const [whole, fraction] = value.toFixed(2).split('.');
    const negative = whole.startsWith('-');
    const digits = negative ? whole.slice(1) : whole;
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
    return `${negative ? '-' : ''}${grouped}.${fraction}`;
}
//# sourceMappingURL=party-balance.service.js.map