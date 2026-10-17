import { Prisma } from '@prisma/client';
import type { VoucherLeg } from 'src/common/posting/voucher-leg.types';
import { roleLedgerKey, type ResolvedRoleLedger } from '../ledgerRole/ledger-map.helper';
import type { NormalisedPaymentTender } from '../payment/payment-lines';
import {
  isMoneyLedger,
  itcClassOf,
  type CompanyFacts,
  type LedgerFacts,
  type TaxRateFacts,
} from '../vouchers/voucher-facts';
import { refuse, type VoucherGuardContext } from '../vouchers/vouchers.errors';
import type {
  ExpenseDerivedPayload,
  ExpenseDraftLines,
  ExpenseLegPayload,
  ExpenseLinePayload,
  ExpenseTenderPayload,
} from './types/expense-api.types';
import { ExpenseErrorCode, ExpenseMoneyFrom } from './types/expense-enum';

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);
const CASH_TENDER_TYPE_ID = 1;
const round2 = (v: Prisma.Decimal): Prisma.Decimal =>
  v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const num = (v: Prisma.Decimal): number => Number(v.toFixed(2));
const GST_COMPONENTS = ['CGST', 'SGST', 'IGST', 'CESS'] as const;
type GstComponent = (typeof GST_COMPONENTS)[number];

/** What the derive reads; the service loads it in a handful of round trips. */
export interface ExpenseFacts {
  company: CompanyFacts;
  /** Every ledger the lines, the party and the tenders name, with their group ancestry. */
  ledgers: Map<string, LedgerFacts>;
  /** The line ledgers that sit under an Expenses group. */
  expenseLedgerIds: ReadonlySet<string>;
  party: LedgerFacts | null;
  taxRates: Map<string, TaxRateFacts>;
  /** INPUT_<component> × rate × nature (resolveRoleLedgerMap). */
  roleLedgers: Map<string, ResolvedRoleLedger | null>;
  tenders: NormalisedPaymentTender[];
  /** Names of the tender ledgers (they are outside `ledgers`: cash, bank, the safe). */
  ledgerNames: Map<string, string>;
  /**
   * Where a CASH row's money comes from (TillSessionService.routeMoneyDoc): the
   * drawer, the default safe (its ledger replaces the tender's), or the tender's
   * own ledger where no till runs.
   */
  cash: { moneyFrom: ExpenseMoneyFrom; ledgerId: string | null };
}

export interface DerivedExpense {
  payload: Omit<ExpenseDerivedPayload, 'session' | 'safeName'>;
  /** For VoucherPostingService.postLegs, in row order: lines, input tax, tenders. */
  legs: VoucherLeg[];
  /** The cost centre of each line leg, by av_row_no. */
  costCentres: { rowNo: number; costCentreId: string }[];
  gst: DerivedExpenseGst | null;
}

export interface DerivedExpenseGstLine {
  rowNo: number;
  ledgerId: string;
  ledgerName: string;
  hsn: string | null;
  isService: boolean;
  taxable: Prisma.Decimal;
  rate: TaxRateFacts;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  cess: Prisma.Decimal;
  itcEligibility: string;
  /** The input-tax ledgers it posted to; null when the tax is part of the cost. */
  taxLedgers: Record<GstComponent, string | null>;
}

export interface DerivedExpenseGst {
  supplyNature: 'INTRA' | 'INTER';
  placeOfSupplyCode: string;
  supplierGstin: string;
  invoiceNo: string;
  invoiceDate: string;
  taxable: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  cess: Prisma.Decimal;
  lines: DerivedExpenseGstLine[];
}

/**
 * Lines → DR legs (+ input tax), tenders → CR legs. Every refusal is collected
 * on `ctx`, so `/validate` shows them all at once and `/post` raises them
 * together. §4.3: lines (with their tax) = tenders, to the paisa, Decimal end
 * to end; no round-off line.
 */
export function deriveExpense(
  draft: ExpenseDraftLines,
  facts: ExpenseFacts,
  ctx: VoucherGuardContext,
): DerivedExpense {
  const bill = draft.gstBill;
  let gstHead: Pick<
    DerivedExpenseGst,
    'supplyNature' | 'placeOfSupplyCode' | 'supplierGstin' | 'invoiceNo' | 'invoiceDate'
  > | null = null;
  if (bill) {
    const gstin = (bill.supplierGstin ?? facts.party?.gstin ?? '').trim().toUpperCase();
    if (!facts.party) {
      refuse(
        ctx,
        ExpenseErrorCode.GST_INCOMPLETE,
        'An expense with a GST bill names its supplier ledger (partyId): GSTR-2 files the bill under it',
        { field: 'partyId' },
      );
    }
    if (!/^\d{2}[A-Z0-9]{13}$/.test(gstin)) {
      refuse(
        ctx,
        ExpenseErrorCode.GST_INCOMPLETE,
        'A GST bill needs the supplier’s GSTIN — type it, or give the supplier ledger one',
        { field: 'gstBill.supplierGstin' },
      );
    }
    const pos = bill.placeOfSupplyCode ?? (gstin.slice(0, 2) || facts.company.stateCode);
    gstHead = {
      supplyNature: pos === facts.company.stateCode ? 'INTRA' : 'INTER',
      placeOfSupplyCode: pos,
      supplierGstin: gstin,
      invoiceNo: bill.invoiceNo,
      invoiceDate: bill.invoiceDate,
    };
  }

  // ── the lines ─────────────────────────────────────────────────────────────
  const lineLegs: VoucherLeg[] = [];
  const costCentres: { rowNo: number; costCentreId: string }[] = [];
  const lines: ExpenseLinePayload[] = [];
  const gstLines: DerivedExpenseGstLine[] = [];
  const taxLegs = new Map<string, { role: string; amount: Prisma.Decimal; rows: number[] }>();
  const unmapped = new Set<string>();
  let total = ZERO;
  let taxable = ZERO;
  const tax = { cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO };

  if (draft.lines.length === 0) {
    refuse(ctx, ExpenseErrorCode.NO_LINES, 'An expense voucher has at least one line', {
      field: 'lines',
    });
  }
  const seenRows = new Set<number>();
  for (const line of draft.lines) {
    const field = `lines.${line.rowNo}`;
    if (seenRows.has(line.rowNo)) {
      refuse(ctx, ExpenseErrorCode.NO_LINES, `Row ${line.rowNo} appears twice`, {
        field,
        line: line.rowNo,
      });
    }
    seenRows.add(line.rowNo);
    const ledger = facts.ledgers.get(line.ledgerId);
    if (!ledger || !ledger.isActive || ledger.isDeleted) {
      refuse(
        ctx,
        ExpenseErrorCode.LEDGER_NOT_EXPENSE,
        `Row ${line.rowNo}: not a live ledger of this company`,
        { field: `${field}.ledgerId`, line: line.rowNo },
      );
    } else if (
      !facts.expenseLedgerIds.has(ledger.ledId) ||
      ledger.isParty ||
      isMoneyLedger(ledger)
    ) {
      refuse(
        ctx,
        ExpenseErrorCode.LEDGER_NOT_EXPENSE,
        `Row ${line.rowNo}: ${ledger.name} is not an expense ledger — a supplier is paid by a bill-wise ` +
          'Payment, money is moved by a contra',
        { field: `${field}.ledgerId`, line: line.rowNo },
      );
    }
    const amount = round2(new Prisma.Decimal(String(line.amount)));
    if (amount.lte(0)) {
      refuse(ctx, ExpenseErrorCode.NO_LINES, `Row ${line.rowNo}: the amount must be above zero`, {
        field: `${field}.amount`,
        line: line.rowNo,
      });
    }

    let lineTax = { cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO };
    let itcEligibility: string | null = null;
    let taxName: string | null = null;
    let costTax = ZERO;
    if (bill && gstHead) {
      const rate = line.taxId ? facts.taxRates.get(line.taxId) : undefined;
      if (!line.taxId) {
        refuse(ctx, ExpenseErrorCode.GST_INCOMPLETE, `Row ${line.rowNo}: pick the GST rate`, {
          field: `${field}.taxId`,
          line: line.rowNo,
        });
      } else if (!rate || !rate.isActive) {
        refuse(
          ctx,
          ExpenseErrorCode.GST_RATE_MISSING,
          `Row ${line.rowNo}: the GST rate named is not an active rate`,
          { field: `${field}.taxId`, line: line.rowNo },
        );
      } else {
        taxName = rate.name;
        // ONE rounded figure, then split — the house's paise rule.
        const whole = round2(amount.mul(rate.ratePerc).div(HUNDRED));
        lineTax =
          gstHead.supplyNature === 'INTER'
            ? { cgst: ZERO, sgst: ZERO, igst: whole, cess: ZERO }
            : {
                cgst: round2(whole.div(2)),
                sgst: whole.minus(round2(whole.div(2))),
                igst: ZERO,
                cess: ZERO,
              };
        lineTax.cess =
          rate.cessBasis === 'PERCENT' || rate.cessBasis === 'BOTH'
            ? round2(amount.mul(rate.cessPerc).div(HUNDRED))
            : ZERO;
        const isService = (line.hsn ?? '').trim().startsWith('99');
        itcEligibility =
          line.itc === false
            ? 'INELIGIBLE'
            : (itcClassOf(ledger?.itcEligibility) ?? (isService ? 'INPUT_SERVICES' : 'INPUTS'));
        const lineTaxTotal = lineTax.cgst.plus(lineTax.sgst).plus(lineTax.igst).plus(lineTax.cess);
        const taxLedgers: Record<GstComponent, string | null> = {
          CGST: null,
          SGST: null,
          IGST: null,
          CESS: null,
        };
        if (itcEligibility === 'INELIGIBLE') {
          // No credit: the tax is what the expense cost.
          costTax = lineTaxTotal;
        } else {
          for (const c of GST_COMPONENTS) {
            const value = lineTax[c.toLowerCase() as Lowercase<GstComponent>];
            if (value.isZero()) {
              continue;
            }
            const role = `INPUT_${c}`;
            const hit =
              facts.roleLedgers.get(
                roleLedgerKey({ role, taxId: rate.taxId, supplyNature: gstHead.supplyNature }),
              ) ?? null;
            if (!hit) {
              if (!unmapped.has(role)) {
                unmapped.add(role);
                refuse(
                  ctx,
                  ExpenseErrorCode.GST_LEDGER_UNMAPPED,
                  `No ledger is mapped for ${role} (${gstHead.supplyNature === 'INTRA' ? 'intra' : 'inter'}-state) — map it in Posting Ledgers (menu 250)`,
                  { field: `${field}.taxId`, line: line.rowNo },
                );
              }
              continue;
            }
            taxLedgers[c] = hit.ledgerId;
            const cur = taxLegs.get(hit.ledgerId);
            if (cur) {
              cur.amount = cur.amount.plus(value);
              cur.rows.push(line.rowNo);
            } else {
              taxLegs.set(hit.ledgerId, { role, amount: value, rows: [line.rowNo] });
            }
          }
        }
        if (ledger) {
          gstLines.push({
            rowNo: line.rowNo,
            ledgerId: ledger.ledId,
            ledgerName: ledger.name,
            hsn: line.hsn,
            isService,
            taxable: amount,
            rate,
            ...lineTax,
            itcEligibility,
            taxLedgers,
          });
        }
      }
    }
    const lineTaxTotal = lineTax.cgst.plus(lineTax.sgst).plus(lineTax.igst).plus(lineTax.cess);
    const lineTotal = amount.plus(lineTaxTotal);
    total = total.plus(lineTotal);
    taxable = taxable.plus(amount);
    tax.cgst = tax.cgst.plus(lineTax.cgst);
    tax.sgst = tax.sgst.plus(lineTax.sgst);
    tax.igst = tax.igst.plus(lineTax.igst);
    tax.cess = tax.cess.plus(lineTax.cess);

    lineLegs.push({
      ledgerId: line.ledgerId,
      drCr: 'DR',
      amount: num(amount.plus(costTax)),
      remarks: line.description,
      field: `${field}.ledgerId`,
    });
    if (line.costCentreId) {
      costCentres.push({ rowNo: lineLegs.length, costCentreId: line.costCentreId });
    }
    lines.push({
      ...line,
      ledgerName: ledger?.name ?? null,
      taxName,
      cgst: num(lineTax.cgst),
      sgst: num(lineTax.sgst),
      igst: num(lineTax.igst),
      cess: num(lineTax.cess),
      total: num(lineTotal),
      itcEligibility,
    });
  }

  // ── the tenders ───────────────────────────────────────────────────────────
  const tenderLegs: VoucherLeg[] = [];
  const tenders: ExpenseTenderPayload[] = [];
  let paid = ZERO;
  for (const t of facts.tenders) {
    const field = `tenders.${t.rowNo}`;
    if (t.isCheque || t.isPdc) {
      refuse(
        ctx,
        ExpenseErrorCode.TENDER_NOT_ALLOWED,
        `Tender ${t.rowNo}: an expense is not paid by cheque here — a cheque goes on a bill-wise Payment, ` +
          'which keeps the issued-cheque register',
        { field: `${field}.tdTenderId` },
      );
    }
    if (t.mdrAmt.gt(0)) {
      refuse(
        ctx,
        ExpenseErrorCode.TENDER_NOT_ALLOWED,
        `Tender ${t.rowNo}: a bank charge is an expense line of its own, not a tender deduction`,
        { field: `${field}.tdMdrAmt` },
      );
    }
    const drawerCash = t.tenderTypeId === CASH_TENDER_TYPE_ID;
    const ledgerId =
      drawerCash && facts.cash.ledgerId
        ? facts.cash.ledgerId
        : (t.clearingLedgerId ?? t.tenderLedgerId);
    paid = paid.plus(t.amount);
    tenderLegs.push({
      ledgerId,
      drCr: 'CR',
      amount: num(t.amount),
      remarks: t.refNo ? `${t.tenderName} ${t.refNo}` : t.tenderName,
      field: `${field}.tdTenderId`,
    });
    tenders.push({
      tdId: t.tdId,
      rowNo: t.rowNo,
      tenderId: t.tenderId,
      tenderName: t.tenderName,
      tenderTypeId: t.tenderTypeId,
      tenderTypeName: t.tenderTypeName,
      amount: num(t.amount),
      refNo: t.refNo,
      ledgerId,
      ledgerName: facts.ledgerNames.get(ledgerId) ?? null,
      moneyFrom: drawerCash ? facts.cash.moneyFrom : ExpenseMoneyFrom.LEDGER,
    });
  }
  if (!paid.equals(total)) {
    refuse(
      ctx,
      ExpenseErrorCode.TOTAL_MISMATCH,
      `The lines come to ${total.toFixed(2)} and the tenders to ${paid.toFixed(2)}: they must be equal`,
      { field: 'tenders' },
    );
  }

  const taxLegList: VoucherLeg[] = [...taxLegs.entries()].map(([ledgerId, t]) => ({
    ledgerId,
    role: t.role,
    drCr: 'DR',
    amount: num(t.amount),
    remarks: `Input ${t.role.replace('INPUT_', '')} on rows ${t.rows.join(', ')}`,
    field: 'gstBill',
  }));
  const legs = [...lineLegs, ...taxLegList, ...tenderLegs];
  const lineOf = (i: number): number | null => (i < lineLegs.length ? draft.lines[i].rowNo : null);
  const legPayload: ExpenseLegPayload[] = legs.map((leg, i) => ({
    rowNo: i + 1,
    drCr: leg.drCr,
    ledgerId: leg.ledgerId ?? null,
    ledgerName:
      (leg.ledgerId &&
        (facts.ledgers.get(leg.ledgerId)?.name ?? facts.ledgerNames.get(leg.ledgerId))) ??
      null,
    role: leg.role ?? null,
    amount: leg.amount,
    remarks: leg.remarks ?? null,
    line: lineOf(i),
  }));

  return {
    payload: {
      total: num(total),
      taxable: num(taxable),
      tax: { cgst: num(tax.cgst), sgst: num(tax.sgst), igst: num(tax.igst), cess: num(tax.cess) },
      supplyNature: gstHead?.supplyNature ?? null,
      placeOfSupplyCode: gstHead?.placeOfSupplyCode ?? null,
      lines,
      tenders,
      legs: legPayload,
    },
    legs,
    costCentres,
    gst: gstHead && gstLines.length > 0 ? { ...gstHead, taxable, ...tax, lines: gstLines } : null,
  };
}
