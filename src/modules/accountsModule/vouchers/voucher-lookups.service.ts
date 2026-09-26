import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import type {
  LedgerBalancePayload,
  LedgerPickPayload,
  LedgerPickRow,
  OpenBillsPayload,
  PartyFactsPayload,
  SidedAmount,
  TaxRatesPayload,
} from './types/vouchers-api.types';
import type {
  LedgerBalanceQueryDto,
  LedgerPickQueryDto,
  OpenBillsQueryDto,
  PartyFactsQueryDto,
  TaxRatesQueryDto,
} from './dto/voucher-query.dto';
import {
  itcClassOf,
  loadInstrumentLedgers,
  loadLedgerFacts,
  loadPartyCreditDays,
  loadStateName,
  loadTdsRate,
} from './voucher-facts';
import { VoucherTypesService } from './voucher-types.service';
import { throwMissing, throwRight, throwState, VCH } from './vouchers.errors';

const GST_GROUPS = new Set([
  'direct expenses',
  'indirect expenses',
  'direct incomes',
  'indirect incomes',
  'purchase accounts',
  'sales accounts',
  'fixed assets',
]);

/**
 * §6.2 – §6.6 — the register's own pickers and facts. Routes, not grids (the
 * user's own-URLs rule): nothing here shares a URL with another module.
 */
@Injectable()
export class VoucherLookupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly types: VoucherTypesService,
  ) {}

  private get tx(): Prisma.TransactionClient {
    return this.prisma as unknown as Prisma.TransactionClient;
  }

  /** §6.2 — ledgers legal on that side for that type, minus instrument-controlled ledgers. */
  async ledgerPick(q: LedgerPickQueryDto): Promise<LedgerPickPayload> {
    const type = await this.types.loadTypeByCode(this.tx, q.typeCode);
    if (!type) {
      throwMissing(`No active voucher type '${q.typeCode}'`, VCH.TYPE_NOT_REGISTER, 'typeCode');
    }
    if (!type.inRegister) {
      throwState(
        `${type.typeName} is not a Voucher Register type`,
        VCH.TYPE_NOT_REGISTER,
        'typeCode',
      );
    }
    const rights = await this.types.rightsFor(this.tx, this.requestContext.getUserId(), type);
    if (!rights.view) {
      throwRight('This user may not view on this voucher type’s menu', VCH.RIGHT_VIEW);
    }
    const groups = (q.side === 'DR' ? type.drGroups : type.crGroups).map((g) => g.groupId);
    const instrument = [...(await loadInstrumentLedgers(this.tx, q.companyId))];
    const term = q.q?.trim() ? `%${q.q.trim()}%` : null;
    const limit = q.limit ?? 50;
    const rows = await this.tx.$queryRaw<{ led_id: string }[]>`
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
    const facts = await loadLedgerFacts(
      this.tx,
      q.companyId,
      rows.map((r) => r.led_id),
    );
    const ledgers: LedgerPickRow[] = rows
      .map((r) => facts.get(r.led_id))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((f) => ({
        ledId: f.ledId,
        name: f.name,
        groupId: f.groupId,
        groupName: f.groupName,
        isParty: f.isParty,
        isBillByBill: f.isBillByBill,
        gstApplicable:
          f.taxId !== null || f.groupNames.some((n) => GST_GROUPS.has(n.toLowerCase())),
        itcEligibility: itcClassOf(f.itcEligibility),
        defaultTaxId: f.taxId,
        isTdsApplicable: f.isTdsApplicable,
        tdsSection: f.tdsSection,
      }));
    return { typeCode: type.typeCode, side: q.side, ledgers };
  }

  /**
   * §6.3 — opening (acc_opening_balance, 'D' +) + Σ av_signed_amount of POSTED
   * and CANCELLED headers ≤ asOn. The Ledger Statement's definition of a
   * balance, never led_total_*.
   */
  async ledgerBalance(q: LedgerBalanceQueryDto): Promise<LedgerBalancePayload> {
    const branch = q.branchId ?? null;
    const [row] = await this.tx.$queryRaw<{ opening: Prisma.Decimal; legs: Prisma.Decimal }[]>`
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
    const opening = new Prisma.Decimal(row.opening);
    const closing = opening.plus(row.legs);
    return { ledgerId: q.ledgerId, asOn: q.asOn, ...sided(closing), opening: sided(opening) };
  }

  /** §6.4 */
  async partyFacts(q: PartyFactsQueryDto): Promise<PartyFactsPayload> {
    const facts = await loadLedgerFacts(this.tx, q.companyId, [q.partyId]);
    const p = facts.get(q.partyId);
    if (!p || p.isDeleted) {
      throwMissing(
        'No such party ledger is visible to this company',
        VCH.PARTY_NOT_FOUND,
        'partyId',
      );
    }
    const [creditDays, stateName, rate, sides] = await Promise.all([
      loadPartyCreditDays(this.tx, p.ledId),
      p.stateName ? Promise.resolve(p.stateName) : loadStateName(this.tx, p.stateCode),
      p.isTdsApplicable && p.tdsSection
        ? loadTdsRate(this.tx, q.companyId, p.tdsSection, p.tdsDeducteeType, q.asOn)
        : Promise.resolve(null),
      this.tx.$queryRaw<{ dr: Prisma.Decimal; cr: Prisma.Decimal }[]>`
        SELECT COALESCE(SUM(abl_pending_amount) FILTER (WHERE abl_dr_cr = 'DR'), 0) AS dr,
               COALESCE(SUM(abl_pending_amount) FILTER (WHERE abl_dr_cr = 'CR'), 0) AS cr
          FROM accounts.acc_bill_balance
         WHERE abl_company_id = ${q.companyId}::uuid AND abl_party_id = ${q.partyId}::uuid
           AND abl_is_deleted = false AND abl_is_active = true AND abl_pending_amount > 0`,
    ]);
    const net = new Prisma.Decimal(sides[0]?.dr ?? 0).minus(sides[0]?.cr ?? 0);
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

  /** §6.5 — the party's open bills on one side, oldest first. */
  async openBills(q: OpenBillsQueryDto): Promise<OpenBillsPayload> {
    const rows = await this.tx.$queryRaw<
      {
        abl_id: string;
        abl_acc_year: string;
        abl_voucher_refno: string | null;
        abl_doc_refno: string;
        abl_doc_date: Date;
        abl_due_date: Date | null;
        abl_bill_type: string;
        abl_dr_cr: string;
        abl_bill_amount: Prisma.Decimal;
        abl_pending_amount: Prisma.Decimal;
      }[]
    >`
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
        side: r.abl_dr_cr.trim() as 'DR' | 'CR',
        billAmount: Number(new Prisma.Decimal(r.abl_bill_amount).toFixed(2)),
        pending: Number(new Prisma.Decimal(r.abl_pending_amount).toFixed(2)),
      })),
    };
  }

  /** §6.6 — the rates, so the client can preview; the server recomputes regardless. */
  async taxRates(q: TaxRatesQueryDto): Promise<TaxRatesPayload> {
    const all = q.includeInactive === 'true' || q.includeInactive === '1';
    const rows = await this.tx.$queryRaw<
      {
        tax_id: string;
        tax_name: string;
        tax_rate_perc: Prisma.Decimal;
        tax_cgst_perc: Prisma.Decimal | null;
        tax_sgst_perc: Prisma.Decimal | null;
        tax_igst_perc: Prisma.Decimal | null;
        tax_cess_perc: Prisma.Decimal;
        tax_is_reverse_charge: boolean;
        tax_taxability: string;
      }[]
    >`
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
}

function sided(v: Prisma.Decimal): SidedAmount {
  return { amount: Number(v.abs().toFixed(2)), side: v.isNegative() ? 'CR' : 'DR' };
}
