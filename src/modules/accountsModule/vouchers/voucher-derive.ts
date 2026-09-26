import { Prisma } from '@prisma/client';
import type { ResolvedRoleLedger, SupplyNature } from '../ledgerRole/ledger-map.helper';
import type {
  DerivedAllocation,
  DerivedBill,
  DerivedLeg,
  DerivedParty,
  DerivedVoucher,
  DrCr,
  GstSummary,
  LegSource,
  TdsLineSummary,
  TdsSummary,
  VoucherTypeRules,
} from './types/vouchers-api.types';
import { billKey, isMoneyLedger, itcClassOf } from './voucher-facts';
import type {
  BillFacts,
  CompanyFacts,
  LedgerFacts,
  TaxRateFacts,
  TdsRateFacts,
} from './voucher-facts';
import { refuse, throwState, VCH, warn, type VoucherGuardContext } from './vouchers.errors';

/**
 * §7.3 steps 3 – 7 and 10 – 12, as ONE pure function of the facts.
 *
 * `/validate` and `/post` run exactly this; the only difference is what the
 * guard context does with a refusal (collect on a dry run, and the post then
 * refuses the whole list at once). Nothing here reads the database: every fact
 * arrives in `DeriveInput`, which is what makes the arithmetic unit-testable
 * and what guarantees §11.1 #19 — the legs `/validate` shows are the legs
 * `/post` writes.
 *
 * Money is Prisma.Decimal end to end and rounded ONCE, at 2 dp HALF_UP, where
 * a figure is born (a tax, a TDS deduction). Nothing is multiplied in float.
 */

// ─── input ───────────────────────────────────────────────────────────────────

export interface TypedLineInput {
  rowNo: number;
  drCr: DrCr;
  ledgerId: string;
  amount: Prisma.Decimal;
  remarks: string | null;
  gst: { taxId: string; hsn: string | null; itcEligibility: string | null } | null;
  /** null = the ledger's led_is_tds_applicable decides */
  tdsBase: boolean | null;
}

export interface AllocationInput {
  index: number;
  lineRowNo: number;
  billId: string;
  billAccYear: string;
  amount: Prisma.Decimal;
}

export interface DeriveInput {
  type: VoucherTypeRules;
  header: {
    date: string;
    partyId: string | null;
    posStcd: string | null;
    reverseCharge: boolean;
    docRefno: string | null;
  };
  lines: TypedLineInput[];
  allocations: AllocationInput[];
  newBill: { dueDays: number | null } | null;
  company: CompanyFacts;
  ledgers: ReadonlyMap<string, LedgerFacts>;
  instrumentLedgers: ReadonlySet<string>;
  generatedRoleLedgers: ReadonlySet<string>;
  taxRates: ReadonlyMap<string, TaxRateFacts>;
  /** keyed by roleLedgerKey — see resolveRoleLedgerMap */
  roleLedgers: ReadonlyMap<string, ResolvedRoleLedger | null>;
  party: LedgerFacts | null;
  creditDaysByLedger: ReadonlyMap<string, number>;
  tds: { rate: TdsRateFacts | null; annualBaseSoFar: Prisma.Decimal } | null;
  /**
   * notes (53): party mode MANY — the same facts per TDS-applicable party
   * ledger on the lines, keyed by ledger id. Absent = none loaded.
   */
  tdsByParty?: ReadonlyMap<string, { rate: TdsRateFacts | null; annualBaseSoFar: Prisma.Decimal }>;
  bills: ReadonlyMap<string, BillFacts>;
  /** INDEX = the exact ux_avh_doc_refno / ux_abl_doc_refno collision; OTHER = seen on another type */
  docRefnoClash: 'INDEX' | 'OTHER' | null;
  backdateMode: 'OFF' | 'WARN' | 'REFUSE';
  today: string;
  ctx: VoucherGuardContext;
}

// ─── output ──────────────────────────────────────────────────────────────────

export interface InternalLeg {
  rowNo: number;
  lineRowNo: number | null;
  drCr: DrCr;
  ledger: LedgerFacts | { ledId: string; name: string; groupName: string | null };
  amount: Prisma.Decimal;
  generated: boolean;
  source: LegSource;
  role: string | null;
  remarks: string | null;
  fromRows: number[];
  gst: { taxId: string; hsn: string | null; itcEligibility: string | null } | null;
  isTdsBase: boolean;
  oppLedgerId: string | null;
}

export interface InternalGstLine {
  rowNo: number;
  lineRowNo: number;
  taxableLedgerId: string;
  rate: TaxRateFacts;
  hsn: string | null;
  isService: boolean;
  itcEligibility: string | null;
  taxable: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  cess: Prisma.Decimal;
  cgstLedgerId: string | null;
  sgstLedgerId: string | null;
  igstLedgerId: string | null;
  cessLedgerId: string | null;
}

export interface InternalGst {
  register: string;
  side: 'INPUT' | 'OUTPUT';
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'OTHER';
  tranNature: 'PURCHASE' | 'SALE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'OTHER';
  docFlow: 'INWARD' | 'OUTWARD' | 'INTERNAL';
  docSign: 1 | -1;
  supplyNature: SupplyNature;
  posStcd: string;
  reverseCharge: boolean;
  taxable: Prisma.Decimal;
  cgst: Prisma.Decimal;
  sgst: Prisma.Decimal;
  igst: Prisma.Decimal;
  cess: Prisma.Decimal;
  lines: InternalGstLine[];
}

export interface InternalTds {
  section: string;
  sectionName: string;
  deducteeType: string;
  registerDeductee: 'COMPANY' | 'NON_COMPANY';
  rate: Prisma.Decimal;
  rateSource: 'MASTER' | 'NO_PAN' | 'BELOW_THRESHOLD';
  base: Prisma.Decimal;
  tax: Prisma.Decimal;
  deducted: boolean;
  reason: string | null;
  fromRows: number[];
  ledgerId: string | null;
  /** notes (53): the deductee. The header party on ONE; the line's party on MANY. */
  party: LedgerFacts;
  /** The first typed line of that party on MANY; null on ONE (the generated party leg). */
  lineRowNo: number | null;
}

export interface InternalBill {
  lineRowNo: number;
  legRowNo: number;
  party: LedgerFacts;
  billType: string;
  side: DrCr;
  amount: Prisma.Decimal;
  docRefno: string | null;
  dueDays: number;
  dueDate: string;
}

export interface InternalAllocation {
  index: number;
  lineRowNo: number;
  legRowNo: number;
  party: LedgerFacts;
  bill: BillFacts;
  amount: Prisma.Decimal;
  adjType: 'ALLOCATION' | 'ADVANCE_ADJUST' | 'NOTE_ADJUST' | 'TRANSFER';
  settlementMode: string;
}

export interface DerivedInternal {
  legs: InternalLeg[];
  totals: { debit: Prisma.Decimal; credit: Prisma.Decimal; difference: Prisma.Decimal };
  party: { ledger: LedgerFacts; side: DrCr; amount: Prisma.Decimal; rowNo: number } | null;
  gst: InternalGst | null;
  tds: InternalTds | null;
  /**
   * notes (53): one entry per deductee — the ONE-mode `tds` when there is one,
   * else one per TDS-applicable party on a MANY voucher. /post writes one
   * acc_tds_register row per entry (26Q is per deductee).
   */
  tdsLines: InternalTds[];
  bills: InternalBill[];
  allocations: InternalAllocation[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

export function round2(v: Prisma.Decimal): Prisma.Decimal {
  return v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function opposite(side: DrCr): DrCr {
  return side === 'DR' ? 'CR' : 'DR';
}

/** roleLedgerKey's shape, repeated here so the derive stays free of the helper's client. */
export function roleKey(role: string, taxId: string | null, supplyNature: string | null): string {
  return `${role}|${taxId ?? '*'}|${supplyNature ?? '*'}`;
}

/**
 * §5.2 "a child counts": a ledger is legal on a side when the type lists no
 * group for that side, or its group or ANY ancestor is listed.
 */
export function legalOnSide(type: VoucherTypeRules, side: DrCr, ledger: LedgerFacts): boolean {
  const groups = side === 'DR' ? type.drGroups : type.crGroups;
  if (groups.length === 0) {
    return true;
  }
  const allowed = new Set(groups.map((g) => g.groupId));
  return ledger.groupPath.some((g) => allowed.has(g));
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function money(v: Prisma.Decimal): string {
  return v.toFixed(2);
}

function gstDoc(
  type: VoucherTypeRules,
): Pick<InternalGst, 'docType' | 'tranNature' | 'docFlow' | 'docSign'> {
  switch (type.nature) {
    case 'PURCHASE':
      return { docType: 'INVOICE', tranNature: 'PURCHASE', docFlow: 'INWARD', docSign: 1 };
    case 'SALES':
      return { docType: 'INVOICE', tranNature: 'SALE', docFlow: 'OUTWARD', docSign: 1 };
    case 'CREDIT_NOTE':
      return { docType: 'CREDIT_NOTE', tranNature: 'CREDIT_NOTE', docFlow: 'OUTWARD', docSign: -1 };
    case 'DEBIT_NOTE':
      return { docType: 'DEBIT_NOTE', tranNature: 'DEBIT_NOTE', docFlow: 'OUTWARD', docSign: 1 };
    default:
      return { docType: 'OTHER', tranNature: 'OTHER', docFlow: 'INTERNAL', docSign: 1 };
  }
}

// ─── the derivation ──────────────────────────────────────────────────────────

export function derive(input: DeriveInput): DerivedInternal {
  const { type, ctx, header } = input;
  const legs: InternalLeg[] = [];
  const typed: InternalLeg[] = [];

  // ── calendar WARNs the service could not answer without the date ──────────
  if (header.date < input.today && input.backdateMode !== 'OFF') {
    const msg = `${header.date} is before today (${input.today})`;
    if (input.backdateMode === 'REFUSE') {
      refuse(ctx, VCH.BACKDATED, msg, { field: 'header.date' });
    } else {
      warn(ctx, VCH.BACKDATED, msg, { field: 'header.date' });
    }
  }
  if (input.docRefnoClash === 'INDEX') {
    refuse(
      ctx,
      VCH.DUP_DOC_REFNO,
      `${header.docRefno ?? ''} is already on a live ${type.typeName} for this party in this year`,
      { field: 'header.docRefno' },
    );
  } else if (input.docRefnoClash === 'OTHER') {
    warn(
      ctx,
      VCH.DUP_DOC_REFNO,
      `${header.docRefno ?? ''} is already on another live voucher for this party`,
      { field: 'header.docRefno' },
    );
  }

  // ── 3 · typed lines ───────────────────────────────────────────────────────
  if (input.lines.length === 0) {
    refuse(ctx, VCH.NO_LINES, 'Type at least one line', { field: 'lines' });
  }
  const seenRows = new Set<number>();
  const sorted = [...input.lines].sort((a, b) => a.rowNo - b.rowNo);
  for (const line of sorted) {
    const field = `lines.${line.rowNo}`;
    if (seenRows.has(line.rowNo)) {
      refuse(ctx, VCH.INVALID, `Row ${line.rowNo} appears twice`, { field, line: line.rowNo });
      continue;
    }
    seenRows.add(line.rowNo);
    if (line.amount.lessThanOrEqualTo(0)) {
      refuse(ctx, VCH.LINE_AMOUNT, `Row ${line.rowNo}: the amount must be above zero`, {
        field: `${field}.amount`,
        line: line.rowNo,
      });
    }
    const ledger = input.ledgers.get(line.ledgerId);
    if (!ledger) {
      refuse(
        ctx,
        VCH.LEDGER_NOT_FOUND,
        `Row ${line.rowNo}: no such ledger is visible to this company`,
        {
          field: `${field}.ledgerId`,
          line: line.rowNo,
        },
      );
      continue;
    }
    if (!ledger.isActive || ledger.isDeleted) {
      refuse(ctx, VCH.LEDGER_INACTIVE, `Row ${line.rowNo}: ${ledger.name} is inactive`, {
        field: `${field}.ledgerId`,
        line: line.rowNo,
      });
    }
    if (!legalOnSide(type, line.drCr, ledger)) {
      const groups = (line.drCr === 'DR' ? type.drGroups : type.crGroups).map((g) => g.name);
      refuse(
        ctx,
        VCH.LEDGER_SIDE,
        `Row ${line.rowNo}: ${ledger.name} (${ledger.groupName}) may not be ${line.drCr === 'DR' ? 'debited' : 'credited'} on a ${type.typeName}` +
          (groups.length ? ` — the ${line.drCr} side takes ${groups.join(', ')}` : ''),
        { field: `${field}.ledgerId`, line: line.rowNo },
      );
    }
    if (input.instrumentLedgers.has(ledger.ledId)) {
      refuse(
        ctx,
        VCH.INSTRUMENT_LEDGER,
        `Row ${line.rowNo}: ${ledger.name} is an instrument-controlled ledger — use Received / Issued Cheques (menu 51 / 52)`,
        { field: `${field}.ledgerId`, line: line.rowNo },
      );
    }
    if (type.gstRegister && input.generatedRoleLedgers.has(ledger.ledId)) {
      refuse(
        ctx,
        VCH.GST_LEDGER_TYPED,
        `Row ${line.rowNo}: ${ledger.name} is a tax ledger the GST band generates — type the taxable line with its rate instead`,
        { field: `${field}.ledgerId`, line: line.rowNo },
      );
    }
    if (!type.gstRegister && line.gst) {
      refuse(
        ctx,
        VCH.GST_NOT_ALLOWED,
        `Row ${line.rowNo}: a ${type.typeName} feeds no GST register, so a line carries no rate`,
        { field: `${field}.gst`, line: line.rowNo },
      );
    }
    const isTdsBase = line.tdsBase ?? ledger.isTdsApplicable;
    typed.push({
      rowNo: typed.length + 1,
      lineRowNo: line.rowNo,
      drCr: line.drCr,
      ledger,
      amount: round2(line.amount),
      generated: false,
      source: 'TYPED',
      role: null,
      remarks: line.remarks,
      fromRows: [],
      gst: line.gst,
      isTdsBase,
      oppLedgerId: null,
    });
  }
  legs.push(...typed);

  // ── the party (step 6's identity, needed before the GST band) ─────────────
  let party: LedgerFacts | null = null;
  let partySide: DrCr | null = null;
  if (type.partyMode === 'ONE') {
    if (!header.partyId) {
      refuse(ctx, VCH.PARTY_MODE, `A ${type.typeName} needs one party`, {
        field: 'header.partyId',
      });
    } else if (!input.party) {
      refuse(ctx, VCH.PARTY_NOT_FOUND, 'No such party ledger is visible to this company', {
        field: 'header.partyId',
      });
    } else {
      party = input.party;
      if (!party.isActive || party.isDeleted) {
        refuse(ctx, VCH.LEDGER_INACTIVE, `${party.name} is inactive`, { field: 'header.partyId' });
      }
      if (type.partySide !== 'DR' && type.partySide !== 'CR') {
        refuse(ctx, VCH.INVALID, `${type.typeName} names no party side (vchr_party_side)`, {
          field: 'header.typeCode',
        });
      } else {
        partySide = type.partySide;
        if (!legalOnSide(type, partySide, party)) {
          const groups = (partySide === 'DR' ? type.drGroups : type.crGroups).map((g) => g.name);
          refuse(
            ctx,
            VCH.LEDGER_SIDE,
            `${party.name} (${party.groupName}) cannot be the party of a ${type.typeName}` +
              (groups.length ? ` — it takes ${groups.join(', ')}` : ''),
            { field: 'header.partyId' },
          );
        }
      }
    }
  } else if (header.partyId) {
    refuse(
      ctx,
      VCH.PARTY_MODE,
      type.partyMode === 'NONE'
        ? `A ${type.typeName} carries no party`
        : `A ${type.typeName} names its parties on the lines, not on the header`,
      { field: 'header.partyId' },
    );
  }
  const taxSide: DrCr | null = partySide ? opposite(partySide) : null;

  // ── 4 · the GST band ──────────────────────────────────────────────────────
  let gst: InternalGst | null = null;
  const gstTyped = type.gstRegister ? typed.filter((l) => l.gst) : [];
  if (gstTyped.length > 0 && type.gstSide && taxSide && partySide) {
    const rcm = header.reverseCharge && type.gstSide === 'INPUT';
    const posStcd =
      header.posStcd ??
      (type.gstSide === 'OUTPUT' && !rcm
        ? (party?.stateCode ?? input.company.stateCode)
        : input.company.stateCode);
    const supplyNature: SupplyNature = posStcd === input.company.stateCode ? 'INTRA' : 'INTER';
    const prefix = type.gstSide === 'INPUT' ? 'INPUT_' : 'OUTPUT_';
    const byLedger = new Map<
      string,
      {
        ledgerId: string;
        name: string;
        role: string;
        drCr: DrCr;
        amount: Prisma.Decimal;
        rows: number[];
      }
    >();
    const unmapped = new Set<string>();
    const askLedger = (
      role: string,
      taxId: string,
      lineRowNo: number,
    ): ResolvedRoleLedger | null => {
      const hit =
        input.roleLedgers.get(roleKey(role, taxId, supplyNature)) ??
        input.roleLedgers.get(roleKey(role, null, supplyNature)) ??
        input.roleLedgers.get(roleKey(role, taxId, null)) ??
        input.roleLedgers.get(roleKey(role, null, null)) ??
        null;
      if (!hit && !unmapped.has(role)) {
        unmapped.add(role);
        refuse(
          ctx,
          VCH.GST_LEDGER_UNMAPPED,
          `No ledger is mapped for ${role} (${supplyNature === 'INTRA' ? 'intra' : 'inter'}-state) — map it in Posting Ledgers (menu 250)`,
          { field: `lines.${lineRowNo}.gst.taxId`, line: lineRowNo },
        );
      }
      return hit;
    };
    const post = (
      role: string,
      drCr: DrCr,
      amount: Prisma.Decimal,
      taxId: string,
      lineRowNo: number,
    ): string | null => {
      if (amount.isZero()) {
        return null;
      }
      const led = askLedger(role, taxId, lineRowNo);
      if (!led) {
        return null;
      }
      const key = `${led.ledgerId}|${drCr}`;
      const cur = byLedger.get(key);
      if (cur) {
        cur.amount = cur.amount.plus(amount);
        cur.rows.push(lineRowNo);
      } else {
        byLedger.set(key, {
          ledgerId: led.ledgerId,
          name: led.ledgerName,
          role,
          drCr,
          amount,
          rows: [lineRowNo],
        });
      }
      return led.ledgerId;
    };

    const lines: InternalGstLine[] = [];
    let tTaxable = ZERO;
    let tCgst = ZERO;
    let tSgst = ZERO;
    let tIgst = ZERO;
    let tCess = ZERO;
    for (const leg of gstTyped) {
      const g = leg.gst!;
      const lineRowNo = leg.lineRowNo!;
      const rate = input.taxRates.get(g.taxId);
      if (!rate || !rate.isActive) {
        refuse(
          ctx,
          VCH.GST_RATE_MISSING,
          `Row ${lineRowNo}: the GST rate named is not an active rate`,
          {
            field: `lines.${lineRowNo}.gst.taxId`,
            line: lineRowNo,
          },
        );
        continue;
      }
      const ledger = leg.ledger as LedgerFacts;
      const taxable = leg.amount;
      // ONE rounded figure, then split — the sale bill's paise rule.
      const total = round2(taxable.mul(rate.ratePerc).div(HUNDRED));
      let cgst = ZERO;
      let sgst = ZERO;
      let igst = ZERO;
      if (supplyNature === 'INTER') {
        igst = total;
      } else {
        cgst = round2(total.div(2));
        sgst = total.minus(cgst);
      }
      const cess =
        rate.cessBasis === 'PERCENT' || rate.cessBasis === 'BOTH'
          ? round2(taxable.mul(rate.cessPerc).div(HUNDRED))
          : ZERO;
      const isService = (g.hsn ?? '').trim().startsWith('99');
      const itc =
        g.itcEligibility ??
        itcClassOf(ledger.itcEligibility) ??
        (type.gstSide === 'INPUT' ? (isService ? 'INPUT_SERVICES' : 'INPUTS') : null);

      // The tax legs sit OPPOSITE the party (a credit note puts output tax on
      // DR). Under reverse charge the input tax is still ours (DR) and the
      // matching payable goes on the party's side (CR) instead of to the party.
      const cgstLedgerId = post(`${prefix}CGST`, taxSide, cgst, g.taxId, lineRowNo);
      const sgstLedgerId = post(`${prefix}SGST`, taxSide, sgst, g.taxId, lineRowNo);
      const igstLedgerId = post(`${prefix}IGST`, taxSide, igst, g.taxId, lineRowNo);
      const cessLedgerId = post(`${prefix}CESS`, taxSide, cess, g.taxId, lineRowNo);
      if (rcm) {
        post('RCM_CGST_PAYABLE', partySide, cgst, g.taxId, lineRowNo);
        post('RCM_SGST_PAYABLE', partySide, sgst, g.taxId, lineRowNo);
        post('RCM_IGST_PAYABLE', partySide, igst, g.taxId, lineRowNo);
        if (!cess.isZero()) {
          refuse(
            ctx,
            VCH.GST_LEDGER_UNMAPPED,
            `Row ${lineRowNo}: cess under reverse charge has no RCM payable role`,
            { field: `lines.${lineRowNo}.gst.taxId`, line: lineRowNo },
          );
        }
      }
      lines.push({
        rowNo: leg.rowNo,
        lineRowNo,
        taxableLedgerId: ledger.ledId,
        rate,
        hsn: g.hsn?.trim() || null,
        isService,
        itcEligibility: itc,
        taxable,
        cgst,
        sgst,
        igst,
        cess,
        cgstLedgerId,
        sgstLedgerId,
        igstLedgerId,
        cessLedgerId,
      });
      tTaxable = tTaxable.plus(taxable);
      tCgst = tCgst.plus(cgst);
      tSgst = tSgst.plus(sgst);
      tIgst = tIgst.plus(igst);
      tCess = tCess.plus(cess);
    }

    for (const entry of byLedger.values()) {
      const isRcm = entry.role.startsWith('RCM_');
      legs.push({
        rowNo: legs.length + 1,
        lineRowNo: null,
        drCr: entry.drCr,
        ledger: { ledId: entry.ledgerId, name: entry.name, groupName: null },
        amount: round2(entry.amount),
        generated: true,
        source: isRcm ? 'RCM' : 'GST',
        role: entry.role,
        remarks: isRcm ? 'Reverse charge payable' : 'From the GST band',
        fromRows: [...new Set(entry.rows)],
        gst: null,
        isTdsBase: false,
        oppLedgerId: null,
      });
    }
    gst = {
      register: type.gstRegister!,
      side: type.gstSide,
      ...gstDoc(type),
      supplyNature,
      posStcd,
      reverseCharge: rcm,
      taxable: tTaxable,
      cgst: tCgst,
      sgst: tSgst,
      igst: tIgst,
      cess: tCess,
      lines,
    };
  }

  // ── 5 · TDS ───────────────────────────────────────────────────────────────
  let tds: InternalTds | null = null;
  if (type.tdsMode === 'DEDUCT' && party && party.isTdsApplicable && partySide && taxSide) {
    const section = party.tdsSection?.trim() ?? '';
    const rate = input.tds?.rate ?? null;
    if (!section) {
      refuse(ctx, VCH.TDS_RATE_MISSING, `${party.name} is TDS-applicable but names no section`, {
        field: 'header.partyId',
      });
    } else if (!rate) {
      refuse(
        ctx,
        VCH.TDS_RATE_MISSING,
        `No TDS rate is in force for section ${section} (${party.tdsDeducteeType ?? 'ANY'}) on ${header.date}`,
        { field: 'header.partyId' },
      );
    } else {
      const baseLegs = typed.filter((l) => l.isTdsBase && l.drCr === taxSide);
      const net = baseLegs.reduce((s, l) => s.plus(l.amount), ZERO);
      const pct = party.pan ? rate.rate : rate.noPanRate;
      const rateSource: InternalTds['rateSource'] = party.pan ? 'MASTER' : 'NO_PAN';
      // A payment-shaped type (party DR, bills demanded) types the NET the bank
      // pays; the deduction is on the gross, so the base is grossed up.
      const paymentShaped = type.billwiseMode === 'DEMAND' && partySide === 'DR';
      let base: Prisma.Decimal;
      let tax: Prisma.Decimal;
      if (paymentShaped && !pct.isZero()) {
        base = round2(net.div(new Prisma.Decimal(1).minus(pct.div(HUNDRED))));
        tax = base.minus(net);
      } else {
        base = net;
        tax = round2(base.mul(pct).div(HUNDRED));
      }
      const cumulative = input.tds!.annualBaseSoFar.plus(base);
      const single = rate.thresholdSingle;
      const annual = rate.thresholdAnnual;
      const deduct = crossesTdsThreshold(base, cumulative, rate);
      const fromRows = baseLegs.map((l) => l.lineRowNo!);
      if (!deduct) {
        // Nothing ticked is a choice, not a threshold: it passes silently.
        // A base under the section's threshold is the WARN §7.4 names.
        const reason = base.isZero()
          ? 'no line counts toward the TDS base'
          : `${money(base)} is within the ${section} threshold (single ${money(single)}, annual ${money(annual)}; ${money(cumulative)} so far this year)`;
        if (!base.isZero()) {
          warn(ctx, VCH.TDS_BELOW_THRESHOLD, `No TDS deducted: ${reason}`, { field: 'lines' });
        }
        tds = {
          section,
          sectionName: rate.sectionName,
          deducteeType: party.tdsDeducteeType ?? rate.deducteeType,
          registerDeductee: registerDeductee(party.tdsDeducteeType),
          rate: pct,
          rateSource: 'BELOW_THRESHOLD',
          base,
          tax: ZERO,
          deducted: false,
          reason,
          fromRows,
          ledgerId: null,
          party,
          lineRowNo: null,
        };
      } else {
        const led = input.roleLedgers.get(roleKey('TDS_PAYABLE', null, null)) ?? null;
        if (!led) {
          refuse(
            ctx,
            VCH.TDS_UNMAPPED,
            'No ledger is mapped for TDS_PAYABLE — map it in Posting Ledgers (menu 250)',
            {
              field: 'lines',
            },
          );
        } else if (tax.greaterThan(0)) {
          legs.push({
            rowNo: legs.length + 1,
            lineRowNo: null,
            drCr: 'CR',
            ledger: { ledId: led.ledgerId, name: led.ledgerName, groupName: null },
            amount: tax,
            generated: true,
            source: 'TDS',
            role: 'TDS_PAYABLE',
            remarks: `TDS ${section} @ ${pct.toString()}% on ${money(base)}`,
            fromRows,
            gst: null,
            isTdsBase: false,
            oppLedgerId: null,
          });
        }
        tds = {
          section,
          sectionName: rate.sectionName,
          deducteeType: party.tdsDeducteeType ?? rate.deducteeType,
          registerDeductee: registerDeductee(party.tdsDeducteeType),
          rate: pct,
          rateSource,
          base,
          tax,
          deducted: tax.greaterThan(0),
          reason: null,
          fromRows,
          ledgerId: led?.ledgerId ?? null,
          party,
          lineRowNo: null,
        };
      }
    }
  }

  // ── 5 (MANY) · TDS per party line — notes (53) ────────────────────────────
  // With parties on the lines there is no header party, so the deduction is
  // worked out per deductee: every typed line on the type's party side whose
  // ledger is a TDS-applicable party (and whose TDS tick is not cleared). A
  // payment types the NET each party is paid; the deduction is on the gross,
  // so each such line is grossed up to it (the party is discharged of the
  // gross) and one CR TDS Payable leg per party carries the difference.
  const tdsLines: InternalTds[] = tds ? [tds] : [];
  if (type.tdsMode === 'DEDUCT' && type.partyMode === 'MANY') {
    const side = type.partySide === 'DR' || type.partySide === 'CR' ? type.partySide : null;
    const byParty = new Map<string, InternalLeg[]>();
    for (const leg of typed) {
      const l = leg.ledger as LedgerFacts;
      if (!(l.isParty || l.isBillByBill) || !l.isTdsApplicable || !leg.isTdsBase) continue;
      if (side && leg.drCr !== side) continue;
      byParty.set(l.ledId, [...(byParty.get(l.ledId) ?? []), leg]);
    }
    const paymentShaped = type.billwiseMode === 'DEMAND' && side === 'DR';
    let unmappedTold = false;
    for (const partyLines of byParty.values()) {
      const p = partyLines[0].ledger as LedgerFacts;
      const first = partyLines[0].lineRowNo!;
      const field = `lines.${first}.ledgerId`;
      const fromRows = partyLines.map((l) => l.lineRowNo!);
      if (!paymentShaped) {
        refuse(
          ctx,
          VCH.INVALID,
          `Row ${first}: TDS on a multi-party ${type.typeName} is worked out only when it pays parties (party side DR, bills demanded)`,
          { field, line: first },
        );
        continue;
      }
      const section = p.tdsSection?.trim() ?? '';
      const facts = input.tdsByParty?.get(p.ledId) ?? null;
      const rate = facts?.rate ?? null;
      if (!section) {
        refuse(ctx, VCH.TDS_RATE_MISSING, `${p.name} is TDS-applicable but names no section`, {
          field,
          line: first,
        });
        continue;
      }
      if (!rate || !facts) {
        refuse(
          ctx,
          VCH.TDS_RATE_MISSING,
          `No TDS rate is in force for section ${section} (${p.tdsDeducteeType ?? 'ANY'}) on ${header.date} — ${p.name}`,
          { field, line: first },
        );
        continue;
      }
      const pct = p.pan ? rate.rate : rate.noPanRate;
      const rateSource: InternalTds['rateSource'] = p.pan ? 'MASTER' : 'NO_PAN';
      // Grossed up line by line, so each line's own share of the tax is known.
      const perLine = partyLines.map((leg) => {
        const gross = pct.isZero()
          ? leg.amount
          : round2(leg.amount.div(new Prisma.Decimal(1).minus(pct.div(HUNDRED))));
        return { leg, gross, tax: gross.minus(leg.amount) };
      });
      const base = perLine.reduce((acc, x) => acc.plus(x.gross), ZERO);
      const tax = perLine.reduce((acc, x) => acc.plus(x.tax), ZERO);
      const cumulative = facts.annualBaseSoFar.plus(base);
      const common = {
        section,
        sectionName: rate.sectionName,
        deducteeType: p.tdsDeducteeType ?? rate.deducteeType,
        registerDeductee: registerDeductee(p.tdsDeducteeType),
        rate: pct,
        fromRows,
        party: p,
        lineRowNo: first,
      };
      if (!crossesTdsThreshold(base, cumulative, rate)) {
        // Nothing is deducted, so the lines stay the net typed: the base
        // recorded (what the annual threshold counts) is what was paid.
        const paid = partyLines.reduce((acc, l) => acc.plus(l.amount), ZERO);
        const reason = `${money(paid)} to ${p.name} is within the ${section} threshold (single ${money(rate.thresholdSingle)}, annual ${money(rate.thresholdAnnual)}; ${money(facts.annualBaseSoFar.plus(paid))} so far this year)`;
        warn(ctx, VCH.TDS_BELOW_THRESHOLD, `No TDS deducted: ${reason}`, { field, line: first });
        tdsLines.push({
          ...common,
          base: paid,
          rateSource: 'BELOW_THRESHOLD',
          tax: ZERO,
          deducted: false,
          reason,
          ledgerId: null,
        });
        continue;
      }
      const led = input.roleLedgers.get(roleKey('TDS_PAYABLE', null, null)) ?? null;
      if (!led) {
        if (!unmappedTold) {
          unmappedTold = true;
          refuse(
            ctx,
            VCH.TDS_UNMAPPED,
            'No ledger is mapped for TDS_PAYABLE — map it in Posting Ledgers (menu 250)',
            { field: 'lines' },
          );
        }
        continue;
      }
      if (tax.greaterThan(0)) {
        for (const x of perLine) {
          x.leg.amount = x.gross;
        }
        legs.push({
          rowNo: legs.length + 1,
          lineRowNo: null,
          drCr: 'CR',
          ledger: { ledId: led.ledgerId, name: led.ledgerName, groupName: null },
          amount: tax,
          generated: true,
          source: 'TDS',
          role: 'TDS_PAYABLE',
          remarks: `TDS ${section} @ ${pct.toString()}% on ${money(base)} — ${p.name}`,
          fromRows,
          gst: null,
          isTdsBase: false,
          oppLedgerId: null,
        });
      }
      tdsLines.push({
        ...common,
        base,
        rateSource,
        tax,
        deducted: tax.greaterThan(0),
        reason: null,
        ledgerId: led.ledgerId,
      });
    }
  }

  // ── 6 · the party leg ─────────────────────────────────────────────────────
  let partyLeg: DerivedInternal['party'] = null;
  if (type.partyMode === 'ONE' && party && partySide) {
    const dr = legs.filter((l) => l.drCr === 'DR').reduce((s, l) => s.plus(l.amount), ZERO);
    const cr = legs.filter((l) => l.drCr === 'CR').reduce((s, l) => s.plus(l.amount), ZERO);
    const amount = partySide === 'CR' ? dr.minus(cr) : cr.minus(dr);
    if (amount.lessThanOrEqualTo(0)) {
      refuse(
        ctx,
        VCH.UNBALANCED,
        `The lines leave nothing for the party: ${partySide === 'CR' ? 'debits' : 'credits'} ${money(partySide === 'CR' ? dr : cr)} against ${money(partySide === 'CR' ? cr : dr)} on the party's own side`,
        { field: 'lines' },
      );
    } else {
      const rowNo = legs.length + 1;
      legs.push({
        rowNo,
        lineRowNo: null,
        drCr: partySide,
        ledger: party,
        amount: round2(amount),
        generated: true,
        source: 'PARTY',
        role: null,
        remarks: 'Balances the voucher',
        fromRows: typed.map((l) => l.lineRowNo!),
        gst: null,
        isTdsBase: false,
        oppLedgerId: null,
      });
      partyLeg = { ledger: party, side: partySide, amount: round2(amount), rowNo };
    }
  }

  // av_opp_ledger_id: the party on every other leg, when there is exactly one.
  const partyLedgerIds = new Set<string>();
  if (partyLeg) {
    partyLedgerIds.add(partyLeg.ledger.ledId);
  } else if (type.partyMode === 'MANY') {
    typed
      .filter((l) => (l.ledger as LedgerFacts).isParty)
      .forEach((l) => partyLedgerIds.add(l.ledger.ledId));
  }
  if (partyLedgerIds.size === 1) {
    const [only] = [...partyLedgerIds];
    for (const leg of legs) {
      leg.oppLedgerId = leg.ledger.ledId === only ? null : only;
    }
  }

  // ── 7 · Σ DR = Σ CR ───────────────────────────────────────────────────────
  const debit = round2(
    legs.filter((l) => l.drCr === 'DR').reduce((s, l) => s.plus(l.amount), ZERO),
  );
  const credit = round2(
    legs.filter((l) => l.drCr === 'CR').reduce((s, l) => s.plus(l.amount), ZERO),
  );
  const difference = debit.minus(credit);
  if (!difference.isZero() && typed.length > 0 && type.partyMode !== 'ONE') {
    refuse(
      ctx,
      VCH.UNBALANCED,
      `The voucher does not balance: debits ${money(debit)}, credits ${money(credit)}, ${difference.greaterThan(0) ? 'debit' : 'credit'} heavy by ${money(difference.abs())}`,
      { field: 'lines' },
    );
  }

  // ── 10 · bills and allocations ────────────────────────────────────────────
  const bills: InternalBill[] = [];
  const allocations: InternalAllocation[] = [];
  const partyLegs: {
    lineRowNo: number;
    legRowNo: number;
    ledger: LedgerFacts;
    side: DrCr;
    amount: Prisma.Decimal;
  }[] = [];
  if (partyLeg) {
    partyLegs.push({
      lineRowNo: 0,
      legRowNo: partyLeg.rowNo,
      ledger: partyLeg.ledger,
      side: partyLeg.side,
      amount: partyLeg.amount,
    });
  } else if (type.partyMode === 'MANY') {
    for (const leg of typed) {
      const l = leg.ledger as LedgerFacts;
      if (l.isParty || l.isBillByBill) {
        partyLegs.push({
          lineRowNo: leg.lineRowNo!,
          legRowNo: leg.rowNo,
          ledger: l,
          side: leg.drCr,
          amount: leg.amount,
        });
      }
    }
  }

  if (type.billwiseMode === 'OFF') {
    if (input.allocations.length > 0) {
      refuse(ctx, VCH.ALLOCATION_LINE, `A ${type.typeName} carries no bill-wise allocation`, {
        field: 'allocations',
      });
    }
  } else {
    const moneyMode = settlementModeOf(typed, partyLedgerIds);
    const perBill = new Map<string, Prisma.Decimal>();
    for (const a of input.allocations) {
      const field = `allocations.${a.index}`;
      const leg = partyLegs.find((p) => p.lineRowNo === a.lineRowNo);
      if (!leg) {
        refuse(
          ctx,
          VCH.ALLOCATION_LINE,
          `allocations[${a.index}] names line ${a.lineRowNo}, which is not a party line`,
          { field: `${field}.lineRowNo` },
        );
        continue;
      }
      if (a.amount.lessThanOrEqualTo(0)) {
        refuse(ctx, VCH.LINE_AMOUNT, `allocations[${a.index}]: the amount must be above zero`, {
          field: `${field}.amount`,
        });
        continue;
      }
      const bill = input.bills.get(billKey(a.billId, a.billAccYear));
      if (!bill || bill.isDeleted || !bill.isActive || bill.companyId !== input.company.companyId) {
        refuse(
          ctx,
          VCH.BILL_NOT_FOUND,
          `allocations[${a.index}]: no live bill ${a.billId} in ${a.billAccYear}`,
          {
            field: `${field}.billId`,
          },
        );
        continue;
      }
      if (bill.partyId !== leg.ledger.ledId) {
        refuse(
          ctx,
          VCH.BILL_WRONG_PARTY,
          `allocations[${a.index}]: bill ${bill.docRefno} belongs to another party`,
          {
            field: `${field}.billId`,
          },
        );
        continue;
      }
      if (bill.side === leg.side) {
        refuse(
          ctx,
          VCH.BILL_WRONG_SIDE,
          `allocations[${a.index}]: bill ${bill.docRefno} sits on the ${bill.side} side, and a ${leg.side} party leg settles ${opposite(leg.side)} bills`,
          { field: `${field}.billId` },
        );
        continue;
      }
      const key = billKey(bill.ablId, bill.ablAccYear);
      const used = (perBill.get(key) ?? ZERO).plus(a.amount);
      perBill.set(key, used);
      if (used.greaterThan(bill.pendingAmount)) {
        // 409 on a post (another counter may have spent it first — refresh and
        // retry); on a dry run it joins the list, and the allocation still
        // counts below so the shortfall is not reported a second time.
        const msg = `Bill ${bill.docRefno} has only ${money(bill.pendingAmount)} pending, but ${money(used)} is allocated against it`;
        if (ctx.dryRun) {
          refuse(ctx, VCH.BILL_OVERSPENT, msg, { field: `${field}.amount` });
        } else {
          throwState(msg, VCH.BILL_OVERSPENT, `${field}.amount`);
        }
      }
      const adjType: InternalAllocation['adjType'] =
        type.billwiseMode === 'DEMAND' ||
        (type.billwiseMode === 'OPTIONAL' && !leg.ledger.isBillByBill)
          ? 'ALLOCATION'
          : bill.billType === 'ADVANCE'
            ? 'ADVANCE_ADJUST'
            : type.nature === 'JOURNAL'
              ? 'TRANSFER'
              : 'NOTE_ADJUST';
      const settlementMode =
        adjType === 'ALLOCATION'
          ? type.billwiseMode === 'DEMAND'
            ? moneyMode
            : 'JOURNAL'
          : adjType === 'ADVANCE_ADJUST'
            ? 'ADVANCE'
            : adjType === 'TRANSFER'
              ? 'JOURNAL'
              : 'CREDIT_NOTE';
      allocations.push({
        index: a.index,
        lineRowNo: a.lineRowNo,
        legRowNo: leg.legRowNo,
        party: leg.ledger,
        bill,
        amount: round2(a.amount),
        adjType,
        settlementMode,
      });
    }

    for (const leg of partyLegs) {
      const allocated = allocations
        .filter((x) => x.lineRowNo === leg.lineRowNo)
        .reduce((s, x) => s.plus(x.amount), ZERO);
      if (type.billwiseMode === 'DEMAND') {
        if (!allocated.equals(leg.amount)) {
          refuse(
            ctx,
            VCH.BILLWISE_SHORT,
            `${leg.ledger.name}: ${money(leg.amount)} must be allocated bill by bill — ${money(allocated)} is`,
            { field: 'allocations' },
          );
        }
        continue;
      }
      if (allocated.greaterThan(leg.amount)) {
        refuse(
          ctx,
          VCH.BILLWISE_SHORT,
          `${leg.ledger.name}: ${money(allocated)} is allocated against a party amount of ${money(leg.amount)}`,
          { field: 'allocations' },
        );
        continue;
      }
      const raise =
        type.billwiseMode === 'RAISE' ||
        (type.billwiseMode === 'OPTIONAL' && leg.ledger.isBillByBill);
      if (!raise || !type.raiseBillType) {
        continue;
      }
      if (
        (type.raiseBillType === 'PURCHASE' || type.raiseBillType === 'SALES') &&
        !header.docRefno
      ) {
        refuse(
          ctx,
          VCH.DOC_REFNO_REQUIRED,
          `A ${type.typeName} raises a ${type.raiseBillType} bill and needs the ${type.raiseBillType === 'PURCHASE' ? "supplier's bill number" : "customer's reference"}`,
          { field: 'header.docRefno' },
        );
      }
      const dueDays = Math.max(
        0,
        input.newBill?.dueDays ?? input.creditDaysByLedger.get(leg.ledger.ledId) ?? 0,
      );
      bills.push({
        lineRowNo: leg.lineRowNo,
        legRowNo: leg.legRowNo,
        party: leg.ledger,
        billType: type.raiseBillType,
        side: leg.side,
        amount: leg.amount,
        docRefno: header.docRefno,
        dueDays,
        dueDate: addDays(header.date, dueDays),
      });
    }
  }

  return {
    legs,
    totals: { debit, credit, difference },
    party: partyLeg,
    gst,
    tds,
    tdsLines,
    bills,
    allocations,
  };
}

/**
 * Whether a TDS base crosses the section's threshold: no threshold at all,
 * above the single-payment one, or the year's running total above the annual.
 */
function crossesTdsThreshold(
  base: Prisma.Decimal,
  cumulative: Prisma.Decimal,
  rate: TdsRateFacts,
): boolean {
  const single = rate.thresholdSingle;
  const annual = rate.thresholdAnnual;
  return (
    base.greaterThan(0) &&
    ((single.isZero() && annual.isZero()) ||
      (single.greaterThan(0) && base.greaterThan(single)) ||
      (annual.greaterThan(0) && cumulative.greaterThan(annual)))
  );
}

/** acc_tds_register's closed deductee list: COMPANY, or everyone else. */
export function registerDeductee(ledgerType: string | null | undefined): 'COMPANY' | 'NON_COMPANY' {
  return (ledgerType ?? '').trim().toUpperCase() === 'COMPANY' ? 'COMPANY' : 'NON_COMPANY';
}

/** ck_abj_settlement_mode: what the money legs say — CASH, BANK, MIXED, else VOUCHER. */
function settlementModeOf(
  typed: readonly InternalLeg[],
  partyLedgerIds: ReadonlySet<string>,
): string {
  const kinds = new Set<string>();
  for (const leg of typed) {
    if (partyLedgerIds.has(leg.ledger.ledId)) {
      continue;
    }
    const l = leg.ledger as LedgerFacts;
    if (!isMoneyLedger(l)) {
      continue;
    }
    kinds.add(l.groupNames.some((n) => n.toLowerCase() === 'cash-in-hand') ? 'CASH' : 'BANK');
  }
  if (kinds.size === 0) {
    return 'VOUCHER';
  }
  return kinds.size === 1 ? [...kinds][0] : 'MIXED';
}

// ─── to the wire ─────────────────────────────────────────────────────────────

export function toWire(typeCode: string, date: string, d: DerivedInternal): DerivedVoucher {
  const n = (v: Prisma.Decimal): number => Number(v.toFixed(2));
  const legs: DerivedLeg[] = d.legs.map((l) => ({
    rowNo: l.rowNo,
    lineRowNo: l.lineRowNo,
    drCr: l.drCr,
    ledgerId: l.ledger.ledId,
    ledgerName: l.ledger.name,
    groupName: l.ledger.groupName ?? null,
    amount: n(l.amount),
    generated: l.generated,
    source: l.source,
    role: l.role,
    remarks: l.remarks,
    fromRows: l.fromRows,
    gst: l.gst ? { ...l.gst, isTdsBase: l.isTdsBase } : null,
    isTdsBase: l.isTdsBase,
  }));
  const party: DerivedParty | null = d.party
    ? {
        ledgerId: d.party.ledger.ledId,
        name: d.party.ledger.name,
        side: d.party.side,
        amount: n(d.party.amount),
        rowNo: d.party.rowNo,
      }
    : null;
  let gst: GstSummary | null = null;
  if (d.gst) {
    const rows = new Map<string, GstSummary['rows'][number]>();
    for (const l of d.gst.lines) {
      const cur = rows.get(l.rate.taxId);
      if (cur) {
        cur.taxable = n(new Prisma.Decimal(cur.taxable).plus(l.taxable));
        cur.cgst = n(new Prisma.Decimal(cur.cgst).plus(l.cgst));
        cur.sgst = n(new Prisma.Decimal(cur.sgst).plus(l.sgst));
        cur.igst = n(new Prisma.Decimal(cur.igst).plus(l.igst));
        cur.cess = n(new Prisma.Decimal(cur.cess).plus(l.cess));
        cur.lines.push(l.lineRowNo);
      } else {
        rows.set(l.rate.taxId, {
          taxId: l.rate.taxId,
          taxName: l.rate.name,
          ratePerc: Number(l.rate.ratePerc.toString()),
          taxable: n(l.taxable),
          cgst: n(l.cgst),
          sgst: n(l.sgst),
          igst: n(l.igst),
          cess: n(l.cess),
          lines: [l.lineRowNo],
        });
      }
    }
    gst = {
      register: d.gst.register,
      side: d.gst.side,
      docType: d.gst.docType,
      supplyNature: d.gst.supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      placeOfSupply: d.gst.posStcd,
      reverseCharge: d.gst.reverseCharge,
      taxable: n(d.gst.taxable),
      cgst: n(d.gst.cgst),
      sgst: n(d.gst.sgst),
      igst: n(d.gst.igst),
      cess: n(d.gst.cess),
      total: n(d.gst.cgst.plus(d.gst.sgst).plus(d.gst.igst).plus(d.gst.cess)),
      rows: [...rows.values()],
    };
  }
  const tdsOf = (t: InternalTds): TdsSummary => ({
    section: t.section,
    deducteeType: t.deducteeType,
    rate: Number(t.rate.toString()),
    rateSource: t.rateSource,
    base: n(t.base),
    tax: n(t.tax),
    deducted: t.deducted,
    reason: t.reason,
    fromRows: t.fromRows,
  });
  const tds: TdsSummary | null = d.tds ? tdsOf(d.tds) : null;
  const tdsLines: TdsLineSummary[] = d.tdsLines.map((t) => ({
    ...tdsOf(t),
    lineRowNo: t.lineRowNo,
    partyId: t.party.ledId,
    partyName: t.party.name,
  }));
  const bills: DerivedBill[] = d.bills.map((b) => ({
    lineRowNo: b.lineRowNo,
    partyId: b.party.ledId,
    partyName: b.party.name,
    billType: b.billType,
    side: b.side,
    amount: n(b.amount),
    docRefno: b.docRefno,
    dueDays: b.dueDays,
    dueDate: b.dueDate,
  }));
  const allocations: DerivedAllocation[] = d.allocations.map((a) => ({
    lineRowNo: a.lineRowNo,
    billId: a.bill.ablId,
    billAccYear: a.bill.ablAccYear,
    billRefno: a.bill.docRefno,
    billType: a.bill.billType,
    amount: n(a.amount),
    pendingBefore: n(a.bill.pendingAmount),
    adjType: a.adjType,
  }));
  return {
    typeCode,
    date,
    legs,
    totals: {
      debit: n(d.totals.debit),
      credit: n(d.totals.credit),
      difference: n(d.totals.difference),
    },
    party,
    gst,
    tds,
    tdsLines,
    bills,
    allocations,
  };
}
