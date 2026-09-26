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
exports.VoucherLookupsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const voucher_facts_1 = require("./voucher-facts");
const voucher_types_service_1 = require("./voucher-types.service");
const vouchers_errors_1 = require("./vouchers.errors");
const GST_GROUPS = new Set([
    'direct expenses',
    'indirect expenses',
    'direct incomes',
    'indirect incomes',
    'purchase accounts',
    'sales accounts',
    'fixed assets',
]);
let VoucherLookupsService = class VoucherLookupsService {
    prisma;
    requestContext;
    types;
    constructor(prisma, requestContext, types) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.types = types;
    }
    get tx() {
        return this.prisma;
    }
    async ledgerPick(q) {
        const type = await this.types.loadTypeByCode(this.tx, q.typeCode);
        if (!type) {
            (0, vouchers_errors_1.throwMissing)(`No active voucher type '${q.typeCode}'`, vouchers_errors_1.VCH.TYPE_NOT_REGISTER, 'typeCode');
        }
        if (!type.inRegister) {
            (0, vouchers_errors_1.throwState)(`${type.typeName} is not a Voucher Register type`, vouchers_errors_1.VCH.TYPE_NOT_REGISTER, 'typeCode');
        }
        const rights = await this.types.rightsFor(this.tx, this.requestContext.getUserId(), type);
        if (!rights.view) {
            (0, vouchers_errors_1.throwRight)('This user may not view on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_VIEW);
        }
        const groups = (q.side === 'DR' ? type.drGroups : type.crGroups).map((g) => g.groupId);
        const instrument = [...(await (0, voucher_facts_1.loadInstrumentLedgers)(this.tx, q.companyId))];
        const term = q.q?.trim() ? `%${q.q.trim()}%` : null;
        const limit = q.limit ?? 50;
        const rows = await this.tx.$queryRaw `
      WITH RECURSIVE allowed AS (
        SELECT acc_group_id FROM accounts.acc_group_master WHERE acc_group_id = ANY(${groups}::uuid[])
        UNION
        SELECT g.acc_group_id FROM accounts.acc_group_master g
          JOIN allowed a ON g.acc_group_parent_id = a.acc_group_id
      )
      SELECT l.led_id
        FROM accounts.acc_ledger_master l
       WHERE (l.led_company_id IS NULL OR l.led_company_id = ${q.companyId}::uuid)
         AND l.led_is_deleted = false AND l.led_is_active = true
         AND (${groups.length === 0} OR l.led_group_id IN (SELECT acc_group_id FROM allowed))
         AND NOT (l.led_id = ANY(${instrument}::uuid[]))
         AND (${term}::text IS NULL OR l.led_name ILIKE ${term} OR l.led_alias ILIKE ${term})
       ORDER BY l.led_name
       LIMIT ${limit}::int`;
        const facts = await (0, voucher_facts_1.loadLedgerFacts)(this.tx, q.companyId, rows.map((r) => r.led_id));
        const ledgers = rows
            .map((r) => facts.get(r.led_id))
            .filter((f) => !!f)
            .map((f) => ({
            ledId: f.ledId,
            name: f.name,
            groupId: f.groupId,
            groupName: f.groupName,
            isParty: f.isParty,
            isBillByBill: f.isBillByBill,
            gstApplicable: f.taxId !== null || f.groupNames.some((n) => GST_GROUPS.has(n.toLowerCase())),
            itcEligibility: (0, voucher_facts_1.itcClassOf)(f.itcEligibility),
            defaultTaxId: f.taxId,
            isTdsApplicable: f.isTdsApplicable,
            tdsSection: f.tdsSection,
        }));
        return { typeCode: type.typeCode, side: q.side, ledgers };
    }
    async ledgerBalance(q) {
        const branch = q.branchId ?? null;
        const [row] = await this.tx.$queryRaw `
      SELECT
        (SELECT COALESCE(SUM(CASE o.op_dr_cr WHEN 'D' THEN o.op_amount ELSE -o.op_amount END), 0)
           FROM accounts.acc_opening_balance o
          WHERE o.op_company_id = ${q.companyId}::uuid AND o.op_ledger_id = ${q.ledgerId}::uuid
            AND o.op_acc_year = ${q.accYear}::char(9) AND o.op_is_deleted = false
            AND (${branch}::uuid IS NULL OR o.op_branch_id = ${branch}::uuid)) AS opening,
        (SELECT COALESCE(SUM(v.av_signed_amount), 0)
           FROM accounts.acc_vouchers v
           JOIN accounts.acc_voucher_header h
             ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
          WHERE v.av_company_id = ${q.companyId}::uuid AND v.av_ledger_id = ${q.ledgerId}::uuid
            AND v.av_acc_year = ${q.accYear}::char(9) AND v.av_voucher_date <= ${q.asOn}::date
            AND v.av_is_deleted = false AND h.avh_is_deleted = false
            AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
            AND (${branch}::uuid IS NULL OR v.av_branch_id = ${branch}::uuid)) AS legs`;
        const opening = new client_1.Prisma.Decimal(row.opening);
        const closing = opening.plus(row.legs);
        return { ledgerId: q.ledgerId, asOn: q.asOn, ...sided(closing), opening: sided(opening) };
    }
    async partyFacts(q) {
        const facts = await (0, voucher_facts_1.loadLedgerFacts)(this.tx, q.companyId, [q.partyId]);
        const p = facts.get(q.partyId);
        if (!p || p.isDeleted) {
            (0, vouchers_errors_1.throwMissing)('No such party ledger is visible to this company', vouchers_errors_1.VCH.PARTY_NOT_FOUND, 'partyId');
        }
        const [creditDays, stateName, rate, sides] = await Promise.all([
            (0, voucher_facts_1.loadPartyCreditDays)(this.tx, p.ledId),
            p.stateName ? Promise.resolve(p.stateName) : (0, voucher_facts_1.loadStateName)(this.tx, p.stateCode),
            p.isTdsApplicable && p.tdsSection
                ? (0, voucher_facts_1.loadTdsRate)(this.tx, q.companyId, p.tdsSection, p.tdsDeducteeType, q.asOn)
                : Promise.resolve(null),
            this.tx.$queryRaw `
        SELECT COALESCE(SUM(abl_pending_amount) FILTER (WHERE abl_dr_cr = 'DR'), 0) AS dr,
               COALESCE(SUM(abl_pending_amount) FILTER (WHERE abl_dr_cr = 'CR'), 0) AS cr
          FROM accounts.acc_bill_balance
         WHERE abl_company_id = ${q.companyId}::uuid AND abl_party_id = ${q.partyId}::uuid
           AND abl_is_deleted = false AND abl_is_active = true AND abl_pending_amount > 0`,
        ]);
        const net = new client_1.Prisma.Decimal(sides[0]?.dr ?? 0).minus(sides[0]?.cr ?? 0);
        return {
            partyId: p.ledId,
            name: p.name,
            gstin: p.gstin,
            gstType: p.gstType,
            stateCode: p.stateCode,
            stateName,
            creditDays,
            isBillByBill: p.isBillByBill,
            pan: p.pan,
            tds: p.isTdsApplicable
                ? {
                    applicable: true,
                    section: p.tdsSection,
                    deducteeType: p.tdsDeducteeType,
                    rate: rate ? Number((p.pan ? rate.rate : rate.noPanRate).toString()) : null,
                    rateSource: rate ? (p.pan ? 'MASTER' : 'NO_PAN') : null,
                    thresholdSingle: rate ? Number(rate.thresholdSingle.toFixed(2)) : null,
                    thresholdAnnual: rate ? Number(rate.thresholdAnnual.toFixed(2)) : null,
                }
                : null,
            outstanding: sided(net),
        };
    }
    async openBills(q) {
        const rows = await this.tx.$queryRaw `
      SELECT abl_id, abl_acc_year, abl_voucher_refno, abl_doc_refno, abl_doc_date, abl_due_date,
             abl_bill_type, abl_dr_cr, abl_bill_amount, abl_pending_amount
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${q.companyId}::uuid AND abl_party_id = ${q.partyId}::uuid
         AND abl_dr_cr = ${q.side}::bpchar
         AND abl_is_deleted = false AND abl_is_active = true AND abl_pending_amount > 0
       ORDER BY abl_doc_date, abl_created_on`;
        return {
            partyId: q.partyId,
            side: q.side,
            bills: rows.map((r) => ({
                ablId: r.abl_id,
                ablAccYear: r.abl_acc_year.trim(),
                refno: r.abl_voucher_refno ?? r.abl_doc_refno,
                docRefno: r.abl_doc_refno,
                date: r.abl_doc_date.toISOString().slice(0, 10),
                dueDate: r.abl_due_date ? r.abl_due_date.toISOString().slice(0, 10) : null,
                billType: r.abl_bill_type,
                side: r.abl_dr_cr.trim(),
                billAmount: Number(new client_1.Prisma.Decimal(r.abl_bill_amount).toFixed(2)),
                pending: Number(new client_1.Prisma.Decimal(r.abl_pending_amount).toFixed(2)),
            })),
        };
    }
    async taxRates(q) {
        const all = q.includeInactive === 'true' || q.includeInactive === '1';
        const rows = await this.tx.$queryRaw `
      SELECT tax_id, tax_name, tax_rate_perc, tax_cgst_perc, tax_sgst_perc, tax_igst_perc,
             tax_cess_perc, tax_is_reverse_charge, tax_taxability
        FROM inventory.tax_rate_master
       WHERE tax_is_deleted = false AND (${all} OR tax_is_active = true)
       ORDER BY tax_sort_order, tax_rate_perc, tax_name`;
        return {
            rates: rows.map((r) => ({
                taxId: r.tax_id,
                name: r.tax_name,
                ratePerc: Number(r.tax_rate_perc.toString()),
                cgst: Number((r.tax_cgst_perc ?? 0).toString()),
                sgst: Number((r.tax_sgst_perc ?? 0).toString()),
                igst: Number((r.tax_igst_perc ?? 0).toString()),
                cess: Number(r.tax_cess_perc.toString()),
                isReverseCharge: r.tax_is_reverse_charge,
                taxability: r.tax_taxability,
            })),
        };
    }
    async adjacent(q) {
        const userId = this.requestContext.getUserId();
        if (q.typeCode) {
            const type = await this.types.loadTypeByCode(this.tx, q.typeCode);
            if (!type) {
                (0, vouchers_errors_1.throwMissing)(`No active voucher type '${q.typeCode}'`, vouchers_errors_1.VCH.TYPE_NOT_REGISTER, 'typeCode');
            }
            if (!type.inRegister) {
                (0, vouchers_errors_1.throwState)(`${type.typeName} is not a Voucher Register type`, vouchers_errors_1.VCH.TYPE_NOT_REGISTER, 'typeCode');
            }
            const rights = await this.types.rightsFor(this.tx, userId, type);
            if (!rights.view) {
                (0, vouchers_errors_1.throwRight)('This user may not view on this voucher type’s menu', vouchers_errors_1.VCH.RIGHT_VIEW);
            }
        }
        if (q.voucherId) {
            const current = await this.prisma.accVoucherHeader.findFirst({
                where: {
                    avhVoucherId: q.voucherId,
                    avhAccYear: q.accYear,
                    avhCompanyId: q.companyId,
                    avhBranchId: q.branchId,
                    avhIsDeleted: false,
                },
                select: { avhVoucherId: true },
            });
            if (!current) {
                (0, vouchers_errors_1.throwMissing)(`No voucher ${q.voucherId} in ${q.accYear} for this company and branch`, vouchers_errors_1.VCH.NOT_FOUND);
            }
        }
        const isPrev = q.direction === 'prev';
        const comparison = client_1.Prisma.raw(isPrev ? '<' : '>');
        const order = client_1.Prisma.raw(isPrev ? 'DESC' : 'ASC');
        const bound = q.voucherId
            ? client_1.Prisma.sql `AND (h.avh_voucher_date, COALESCE(h.avh_voucher_slno, 0),
                        h.avh_created_on, h.avh_voucher_id)
                       ${comparison}
                       (SELECT c.avh_voucher_date, COALESCE(c.avh_voucher_slno, 0),
                               c.avh_created_on, c.avh_voucher_id
                          FROM accounts.acc_voucher_header c
                         WHERE c.avh_voucher_id = ${q.voucherId}::uuid
                           AND c.avh_acc_year   = ${q.accYear}::bpchar)`
            : client_1.Prisma.empty;
        const rows = await this.prisma.$queryRaw `
      SELECT h.avh_voucher_id, h.avh_company_id, h.avh_branch_id, h.avh_acc_year,
             vt.vchr_type_code, h.avh_voucher_refno,
             to_char(h.avh_voucher_date, 'YYYY-MM-DD') AS voucher_date,
             h.avh_voucher_status
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = h.avh_voucher_type_id
        JOIN public.user_menus um ON um.um_menu_id = vt.vchr_menu_id
                                 AND um.um_user_id = ${userId}::uuid
                                 AND um.um_is_deleted = false
                                 AND um.um_can_view = true
       WHERE h.avh_company_id = ${q.companyId}::uuid
         AND h.avh_branch_id  = ${q.branchId}::uuid
         AND h.avh_acc_year   = ${q.accYear}::bpchar
         AND vt.vchr_in_register = true
         AND h.avh_is_deleted = false
         AND (${q.typeCode ?? null}::text IS NULL OR vt.vchr_type_code = ${q.typeCode ?? null}::text)
         AND (${q.status ?? null}::text   IS NULL OR h.avh_voucher_status = ${q.status ?? null}::text)
         AND (${q.fromDate ?? null}::date IS NULL OR h.avh_voucher_date >= ${q.fromDate ?? null}::date)
         AND (${q.toDate ?? null}::date   IS NULL OR h.avh_voucher_date <= ${q.toDate ?? null}::date)
         ${bound}
       ORDER BY h.avh_voucher_date ${order},
                COALESCE(h.avh_voucher_slno, 0) ${order},
                h.avh_created_on ${order},
                h.avh_voucher_id ${order}
       LIMIT 1`;
        const row = rows[0];
        return {
            direction: q.direction,
            fromVoucherId: q.voucherId ?? null,
            voucher: row
                ? {
                    voucherId: row.avh_voucher_id,
                    companyId: row.avh_company_id,
                    branchId: row.avh_branch_id,
                    accYear: row.avh_acc_year.trim(),
                    typeCode: row.vchr_type_code,
                    voucherRefno: row.avh_voucher_refno,
                    date: row.voucher_date,
                    status: row.avh_voucher_status,
                }
                : null,
        };
    }
};
exports.VoucherLookupsService = VoucherLookupsService;
exports.VoucherLookupsService = VoucherLookupsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        voucher_types_service_1.VoucherTypesService])
], VoucherLookupsService);
function sided(v) {
    return { amount: Number(v.abs().toFixed(2)), side: v.isNegative() ? 'CR' : 'DR' };
}
//# sourceMappingURL=voucher-lookups.service.js.map