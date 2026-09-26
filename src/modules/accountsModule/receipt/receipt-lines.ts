import { Prisma } from '@prisma/client';
import {
  throwAccountsBadRequest,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import type { ReceiptErrorDetail } from './types/receipt-api.types';
import {
  BillSettlementMode,
  CHEQUE_TENDER_TYPE_ID,
  DrCr,
  FREE_LEDGER_SETTLEMENT_MODE,
  ReceiptLedgerRole,
  ROLE_SETTLEMENT_MODE,
  ROLE_SIDE,
  TcsBasis,
} from './types/receipt-enum';
import type { SaveReceiptOtherLineDto, SaveReceiptTenderDto } from './dto/save-receipt.dto';
import type { ReceiptParty, ReceiptWriteClient } from './receipt.guards';
import type { ReceiptSettings } from './receipt.settings';
import { money, toDateOnly, trimOrNull, ZERO } from './receipt.utils';

/**
 * §5.1 rules 3 and 4 — turning what the client sent into what the module
 * actually posts.
 *
 * Shared by `/receipts/create` and `/receipts/post`, because §5.2 step 2 says
 * the post RE-VALIDATES 5.1. The alternative — a draft path and a post path
 * that each decide what a tender row means — is two definitions of a cheque,
 * and the second one is discovered in production.
 *
 * Nothing here touches the database beyond reading masters. It resolves,
 * validates and normalises; the services write.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Tenders
// ═══════════════════════════════════════════════════════════════════════════

export interface NormalisedTender {
  rowNo: number;
  tenderId: string;
  tenderName: string;
  tenderTypeId: number;
  tenderTypeName: string;
  /** Where the money lands. A snapshot unless `tnd_edit_ledger` says otherwise. */
  tenderLedgerId: string;
  /**
   * The clearing ledger, when the master has one. A card collection sits in
   * "Card Clearing" until the acquirer settles it, and posting it straight to
   * the bank would put money in the bank account days before the bank has it.
   */
  clearingLedgerId: string | null;
  surchargeLedgerId: string | null;
  amount: Prisma.Decimal;
  receivedAmt: Prisma.Decimal;
  changeAmt: Prisma.Decimal;
  mdrAmt: Prisma.Decimal;
  surchargePerc: Prisma.Decimal;
  surchargeAmt: Prisma.Decimal;
  refNo: string | null;
  authCode: string | null;
  cardLast4: string | null;
  bankName: string | null;
  payerVpa: string | null;
  instrumentDate: Date | null;
  isCheque: boolean;
  /** Computed, never sent: an instrument dated after the receipt (ck_td_pdc). */
  isPdc: boolean;
  notes: string | null;
  settlementMode: BillSettlementMode;
  cheque: {
    bankBranch: string | null;
    ifsc: string | null;
    micr: string | null;
    drawerName: string | null;
    bankLedgerId: string | null;
  } | null;
  /** The row's own id when the client is editing an existing draft line. */
  tdId: string | null;
}

/**
 * Every tender row, resolved against its master and checked.
 *
 * The master is the authority on the ledger and the surcharge (§5.1 rule 3):
 * a client may only override them where `tnd_edit_ledger` / `tnd_edit_surcharge`
 * say it may. Otherwise a POS terminal could quietly bank a card collection
 * into petty cash.
 */
export async function normaliseTenders(
  client: ReceiptWriteClient,
  params: {
    tenders: readonly SaveReceiptTenderDto[];
    companyId: string;
    branchId: string;
    receiptDate: Date;
  },
): Promise<NormalisedTender[]> {
  if (params.tenders.length === 0) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
      {
        field: 'tenders',
        message:
          'A receipt with no instruments is a journal, not a receipt. Even a receipt settled ' +
          'entirely from a credit the party holds needs a journal voucher instead.',
      },
    ]);
  }

  const masters = await client.accTenderMaster.findMany({
    where: {
      tndId: { in: [...new Set(params.tenders.map((tender) => tender.tdTenderId))] },
      tndIsDeleted: false,
    },
    select: {
      tndId: true,
      tndName: true,
      tndCompanyId: true,
      tndBranchId: true,
      tndTypeId: true,
      tndLedgerId: true,
      tndSettlementLedgerId: true,
      tndSurchargeLedgerId: true,
      tndSurchargePerc: true,
      tndSurchargeAmount: true,
      tndEditLedger: true,
      tndEditSurcharge: true,
      tndIsActive: true,
      tenderType: { select: { ttmTypeId: true, ttmTypeName: true, ttmIsCash: true } },
    },
  });
  const masterById = new Map(masters.map((master) => [master.tndId, master]));

  const seenRowNos = new Set<number>();
  const normalised: NormalisedTender[] = [];

  params.tenders.forEach((tender, index) => {
    const field = (name: string): string => `tenders.${index}.${name}`;

    if (seenRowNos.has(tender.tdRowNo)) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        { field: field('tdRowNo'), message: `Row number ${tender.tdRowNo} appears twice` },
      ]);
    }
    seenRowNos.add(tender.tdRowNo);

    const master = masterById.get(tender.tdTenderId);
    if (!master) {
      throwAccountsNotFound<ReceiptErrorDetail>(
        'Tender not found',
        field('tdTenderId'),
        `No live tender with id ${tender.tdTenderId}`,
      );
    }
    if (!master.tndIsActive) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        { field: field('tdTenderId'), message: `Tender "${master.tndName}" is inactive` },
      ]);
    }
    // A tender belongs to a company, and optionally to one branch of it. NULL
    // means every branch; a value means that one, and only that one.
    if (master.tndCompanyId !== params.companyId) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: field('tdTenderId'),
          message: `Tender "${master.tndName}" belongs to another company`,
        },
      ]);
    }
    if (master.tndBranchId !== null && master.tndBranchId !== params.branchId) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: field('tdTenderId'),
          message: `Tender "${master.tndName}" is not available at this branch`,
        },
      ]);
    }
    if (master.tndTypeId !== tender.tdTenderTypeId) {
      // Refused rather than corrected: a client that believes this row is a
      // cheque when the master says UPI will have built the rest of the row —
      // the instrument date, the bank — on that belief.
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: field('tdTenderTypeId'),
          message: `Tender "${master.tndName}" is type ${master.tndTypeId}, not ${tender.tdTenderTypeId}`,
        },
      ]);
    }

    const amount = money(tender.tdAmount);
    if (amount.lessThanOrEqualTo(0)) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        { field: field('tdAmount'), message: 'A tender row must carry more than zero' },
      ]);
    }

    const isCheque = master.tndTypeId === CHEQUE_TENDER_TYPE_ID;
    const instrumentDate = tender.tdInstrumentDate ? toDateOnly(tender.tdInstrumentDate) : null;

    if (isCheque) {
      // ck_td_pdc needs the date, ux_apd_instrument needs the number, and a
      // cheque with no bank cannot be deposited. All three are checked here so
      // the operator is told which box is empty.
      const missing: string[] = [];
      if (!instrumentDate) missing.push('tdInstrumentDate');
      if (!trimOrNull(tender.tdRefNo)) missing.push('tdRefNo');
      if (!trimOrNull(tender.tdBankName)) missing.push('tdBankName');
      if (missing.length > 0) {
        throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
          {
            field: field(missing[0]),
            message: `A cheque needs ${missing.join(', ')}`,
          },
        ]);
      }
    }

    const received = money(tender.tdReceivedAmt ?? 0);
    const change = money(tender.tdChangeAmt ?? 0);
    if (received.greaterThan(0) && !received.minus(change).equals(amount)) {
      // The leg for cash is "net of change" (§5.2 step 9), and that net has to
      // BE the amount, or the drawer and the voucher disagree.
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: field('tdReceivedAmt'),
          message:
            `Received ${received.toFixed(2)} less change ${change.toFixed(2)} is ` +
            `${received.minus(change).toFixed(2)}, but the row is for ${amount.toFixed(2)}`,
        },
      ]);
    }

    // The ledger is a snapshot unless the master allows an override. Same for
    // the surcharge: the master decides what a card costs the customer.
    const tenderLedgerId = master.tndEditLedger
      ? (tender.tdTenderLedgerId ?? master.tndLedgerId)
      : master.tndLedgerId;
    if (
      !master.tndEditLedger &&
      tender.tdTenderLedgerId &&
      tender.tdTenderLedgerId !== master.tndLedgerId
    ) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: field('tdTenderLedgerId'),
          message: `Tender "${master.tndName}" does not allow its ledger to be changed`,
        },
      ]);
    }

    const surchargePerc = master.tndEditSurcharge
      ? money(tender.tdSurchargePerc ?? master.tndSurchargePerc)
      : money(master.tndSurchargePerc);
    const surchargeAmt = master.tndEditSurcharge
      ? money(tender.tdSurchargeAmt ?? master.tndSurchargeAmount)
      : money(
          surchargePerc.greaterThan(0)
            ? amount.times(surchargePerc).dividedBy(100)
            : master.tndSurchargeAmount,
        );

    normalised.push({
      rowNo: tender.tdRowNo,
      tenderId: master.tndId,
      tenderName: master.tndName,
      tenderTypeId: master.tndTypeId,
      tenderTypeName: master.tenderType?.ttmTypeName ?? '',
      tenderLedgerId,
      clearingLedgerId: master.tndSettlementLedgerId,
      surchargeLedgerId: master.tndSurchargeLedgerId,
      amount,
      receivedAmt: received,
      changeAmt: change,
      mdrAmt: money(tender.tdMdrAmt ?? 0),
      surchargePerc,
      surchargeAmt,
      refNo: trimOrNull(tender.tdRefNo),
      authCode: trimOrNull(tender.tdAuthCode),
      cardLast4: trimOrNull(tender.tdCardLast4),
      bankName: trimOrNull(tender.tdBankName),
      payerVpa: trimOrNull(tender.tdPayerVpa),
      instrumentDate,
      isCheque,
      // Computed, and this is the ONLY place it is decided. A cheque dated
      // today or earlier is ordinary money and settles now; one dated later
      // gets a voucher of its own (R2).
      isPdc: Boolean(isCheque && instrumentDate && instrumentDate > params.receiptDate),
      notes: trimOrNull(tender.tdNotes),
      settlementMode: settlementModeForTenderType(master.tndTypeId),
      cheque: isCheque
        ? {
            bankBranch: trimOrNull(tender.cheque?.bankBranch),
            ifsc: trimOrNull(tender.cheque?.ifsc),
            micr: trimOrNull(tender.cheque?.micr),
            drawerName: trimOrNull(tender.cheque?.drawerName),
            bankLedgerId: tender.cheque?.bankLedgerId ?? null,
          }
        : null,
      tdId: tender.tdId ?? null,
    });
  });

  return normalised.sort((left, right) => left.rowNo - right.rowNo);
}

/**
 * `ttm_type_id` to `abj_settlement_mode`.
 *
 * Driven by the seeded ids because those ARE the vocabulary — the tender types
 * table is a fixed list, not a master a shop extends. A type this does not know
 * settles as BANK, which is the honest default for "money that arrived
 * electronically and is not one of the named rails".
 */
function settlementModeForTenderType(typeId: number): BillSettlementMode {
  switch (typeId) {
    case 1:
      return BillSettlementMode.CASH;
    case 2:
      return BillSettlementMode.CARD;
    case 3:
      return BillSettlementMode.UPI;
    case 4:
      return BillSettlementMode.WALLET;
    case CHEQUE_TENDER_TYPE_ID:
      return BillSettlementMode.CHEQUE;
    case 10:
      return BillSettlementMode.LOYALTY;
    case 11:
      return BillSettlementMode.VOUCHER;
    default:
      return BillSettlementMode.BANK;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Other-ledger lines
// ═══════════════════════════════════════════════════════════════════════════

export interface NormalisedOtherLine {
  lineNo: number;
  role: string | null;
  ledgerId: string;
  ledgerName: string | null;
  drCr: DrCr;
  amount: Prisma.Decimal;
  settlesBill: boolean;
  narration: string | null;
  settlementMode: BillSettlementMode;
  /** The MDR half of an instrument split — outside the §5.2 step 4 identity. */
  isInstrumentSplit: boolean;
}

/** What the party's own flags say a receipt for them ought to carry. */
export interface ExpectedRoles {
  /** Roles the party's configuration implies, that this payload has no line for. */
  missing: string[];
}

/**
 * The other-ledger band, validated and completed.
 *
 * ── What the server SEEDS ────────────────────────────────────────────────
 * Only the lines whose amount it can actually compute: BANK_CHARGES from
 * `tdMdrAmt`, SURCHARGE_RECOVERED from `tdSurchargeAmt`. Both are splits of an
 * instrument the payload already carries, so seeding them invents nothing.
 *
 * ── What it CANNOT seed, and why ─────────────────────────────────────────
 * §5.1 rule 4 also asks for a TDS_RECEIVABLE line when the party is
 * TDS-applicable and a TCS_PAYABLE line when they are TCS-applicable and
 * `accounts.tcs_basis` is RECEIPT. The flags exist —
 * `led_is_tds_applicable`, `led_tds_deductee_type`, `led_is_tcs_applicable` —
 * but there is NO RATE anywhere in this schema: no TDS rate table, no rate on
 * the ledger, nothing on the company beyond a boolean. There is therefore no
 * amount to seed, and inventing one would be worse than leaving it out.
 *
 * So those two are REPORTED instead: `expectedRoles.missing` names them, the
 * screen prompts for the figure, and the operator keys what the customer
 * actually withheld — which is the number that matters anyway, since it is what
 * will appear on their 26AS. When a rate table exists, seeding them is a change
 * to this function and nothing else.
 */
export async function normaliseOtherLines(
  client: ReceiptWriteClient,
  params: {
    lines: readonly SaveReceiptOtherLineDto[];
    tenders: readonly NormalisedTender[];
    companyId: string;
    branchId: string;
    party: ReceiptParty;
    partyId: string;
    settings: ReceiptSettings;
    /** Resolves a role to a ledger. Null for a role nothing maps yet. */
    ledgerForRole: (role: string) => { ledgerId: string; ledgerName: string } | null;
  },
): Promise<{ lines: NormalisedOtherLine[]; expected: ExpectedRoles }> {
  const lines: NormalisedOtherLine[] = [];
  const freeLedgerIds = params.lines
    .filter((line) => !line.role && line.ledgerId)
    .map((line) => line.ledgerId!);

  const freeLedgers =
    freeLedgerIds.length === 0
      ? []
      : await client.accLedgerMaster.findMany({
          where: {
            ledId: { in: [...new Set(freeLedgerIds)] },
            ledIsDeleted: false,
            OR: [{ ledCompanyId: null }, { ledCompanyId: params.companyId }],
          },
          select: { ledId: true, ledName: true, ledIsActive: true },
        });
  const freeLedgerById = new Map(freeLedgers.map((ledger) => [ledger.ledId, ledger]));

  params.lines.forEach((line, index) => {
    const field = (name: string): string => `otherLines.${index}.${name}`;
    const lineNo = index + 1;
    const amount = money(line.amount);

    if (amount.lessThanOrEqualTo(0)) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        { field: field('amount'), message: 'An other-ledger line must carry more than zero' },
      ]);
    }
    if (Boolean(line.role) === Boolean(line.ledgerId)) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: field('role'),
          message:
            'Give the line either a role — which every report can find again — or a ledger ' +
            'chosen by hand. Not both, and not neither.',
        },
      ]);
    }

    if (line.role) {
      const side = ROLE_SIDE[line.role as ReceiptLedgerRole];
      if (!side) {
        throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
          {
            field: field('role'),
            message:
              `"${line.role}" is not a role a receipt may post to. Use one of ` +
              `${Object.keys(ROLE_SIDE).join(', ')}, or pick a ledger by hand.`,
          },
        ]);
      }
      if (side !== line.drCr) {
        throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
          {
            field: field('drCr'),
            message: `${line.role} posts ${side}, not ${line.drCr}`,
          },
        ]);
      }
      const mapped = params.ledgerForRole(line.role);
      if (!mapped) {
        throwAccountsBadRequest<ReceiptErrorDetail>('Posting ledgers are not configured', [
          {
            field: field('role'),
            message: `Nothing maps "${line.role}" to a ledger — accounts.acc_ledger_map has no row for it`,
          },
        ]);
      }

      const mode = ROLE_SETTLEMENT_MODE[line.role];
      const settles = line.drCr === DrCr.DR && (line.settlesBill ?? Boolean(mode));
      if (settles && !mode) {
        throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
          {
            field: field('settlesBill'),
            message:
              `${line.role} cannot settle a bill — it is not a deduction the customer withheld ` +
              'from what they owe. Leave settlesBill off.',
          },
        ]);
      }

      lines.push({
        lineNo,
        role: line.role,
        ledgerId: mapped.ledgerId,
        ledgerName: mapped.ledgerName,
        drCr: line.drCr,
        amount,
        settlesBill: settles,
        narration: trimOrNull(line.narration),
        settlementMode: mode ?? FREE_LEDGER_SETTLEMENT_MODE,
        isInstrumentSplit: false,
      });
      return;
    }

    const ledger = freeLedgerById.get(line.ledgerId!);
    if (!ledger) {
      throwAccountsNotFound<ReceiptErrorDetail>(
        'Ledger not found',
        field('ledgerId'),
        `No live ledger ${line.ledgerId} is visible to this company`,
      );
    }
    if (!ledger.ledIsActive) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        { field: field('ledgerId'), message: `"${ledger.ledName}" is inactive` },
      ]);
    }
    // A line pointing at the party would settle their bill with their own
    // balance: the voucher would balance, the bill would close, and nothing
    // would have been collected.
    if (ledger.ledId === params.partyId) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: field('ledgerId'),
          message: `"${ledger.ledName}" is the party of this receipt and cannot also be a line on it`,
        },
      ]);
    }

    lines.push({
      lineNo,
      role: null,
      ledgerId: ledger.ledId,
      ledgerName: ledger.ledName,
      drCr: line.drCr,
      amount,
      settlesBill: line.drCr === DrCr.DR && (line.settlesBill ?? false),
      narration: trimOrNull(line.narration),
      settlementMode: FREE_LEDGER_SETTLEMENT_MODE,
      isInstrumentSplit: false,
    });
  });

  // ── The two the server CAN seed ────────────────────────────────────────
  seedInstrumentSplit(lines, params, {
    role: ReceiptLedgerRole.BANK_CHARGES,
    drCr: DrCr.DR,
    total: sumTenders(params.tenders, (tender) => tender.mdrAmt),
    field: 'tenders.tdMdrAmt',
    what: 'bank charges',
  });
  seedInstrumentSplit(lines, params, {
    role: ReceiptLedgerRole.SURCHARGE_RECOVERED,
    drCr: DrCr.CR,
    total: sumTenders(params.tenders, (tender) => tender.surchargeAmt),
    field: 'tenders.tdSurchargeAmt',
    what: 'card surcharge',
  });

  return { lines, expected: { missing: expectedRoles(params, lines) } };
}

/**
 * The BANK_CHARGES / SURCHARGE_RECOVERED line, added when the client left it
 * out and REFUSED when the client sent one that disagrees with the tenders.
 *
 * Disagreeing is not silently corrected: the client computed a number from the
 * same tender rows and got something else, which means one of the two is
 * reading the master differently, and posting either figure would hide that.
 */
function seedInstrumentSplit(
  lines: NormalisedOtherLine[],
  params: Parameters<typeof normaliseOtherLines>[1],
  spec: {
    role: ReceiptLedgerRole;
    drCr: DrCr;
    total: Prisma.Decimal;
    field: string;
    what: string;
  },
): void {
  const existing = lines.filter((line) => line.role === spec.role);
  const supplied = existing.reduce((total, line) => total.plus(line.amount), ZERO);

  if (spec.total.lessThanOrEqualTo(0)) {
    if (supplied.greaterThan(0)) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: spec.field,
          message:
            `The payload carries ${supplied.toFixed(2)} of ${spec.what}, but no tender row has any. ` +
            'Put it on the instrument it came from.',
        },
      ]);
    }
    return;
  }

  if (existing.length > 0) {
    if (!supplied.equals(spec.total)) {
      throwAccountsBadRequest<ReceiptErrorDetail>('Validation failed', [
        {
          field: spec.field,
          message:
            `The tenders carry ${spec.total.toFixed(2)} of ${spec.what} and the ${spec.role} line ` +
            `says ${supplied.toFixed(2)}. They must agree.`,
        },
      ]);
    }
    // Mark the client's own line as the split, so the identity leaves it out.
    for (const line of existing) {
      line.isInstrumentSplit = spec.drCr === DrCr.DR;
    }
    return;
  }

  const mapped = params.ledgerForRole(spec.role);
  if (!mapped) {
    throwAccountsBadRequest<ReceiptErrorDetail>('Posting ledgers are not configured', [
      {
        field: spec.field,
        message:
          `The tenders carry ${spec.total.toFixed(2)} of ${spec.what}, and nothing maps ` +
          `"${spec.role}" to a ledger`,
      },
    ]);
  }

  lines.push({
    lineNo: lines.length + 1,
    role: spec.role,
    ledgerId: mapped.ledgerId,
    ledgerName: mapped.ledgerName,
    drCr: spec.drCr,
    amount: spec.total,
    settlesBill: false,
    narration: null,
    settlementMode: FREE_LEDGER_SETTLEMENT_MODE,
    // A DR split is the other half of an instrument's own amount and must stay
    // out of the identity. A CR one (surcharge) is genuinely extra money the
    // customer paid, so it stays IN.
    isInstrumentSplit: spec.drCr === DrCr.DR,
  });
}

function sumTenders(
  tenders: readonly NormalisedTender[],
  pick: (tender: NormalisedTender) => Prisma.Decimal,
): Prisma.Decimal {
  return tenders.reduce((total, tender) => total.plus(pick(tender)), ZERO).toDecimalPlaces(2);
}

/** §5.1 rule 4 — what the party's flags imply that this payload has not got. */
function expectedRoles(
  params: Parameters<typeof normaliseOtherLines>[1],
  lines: readonly NormalisedOtherLine[],
): string[] {
  const present = new Set(lines.map((line) => line.role));
  const missing: string[] = [];

  if (params.party.ledIsTdsApplicable && !present.has(ReceiptLedgerRole.TDS_RECEIVABLE)) {
    missing.push(ReceiptLedgerRole.TDS_RECEIVABLE);
  }
  // R15 — only when the tax is collected on RECEIPT. Under SALES it was already
  // collected on the invoice, and a second line would charge it twice.
  if (
    params.party.ledIsTcsApplicable &&
    params.settings.tcsBasis === TcsBasis.RECEIPT &&
    !present.has(ReceiptLedgerRole.TCS_PAYABLE)
  ) {
    missing.push(ReceiptLedgerRole.TCS_PAYABLE);
  }

  return missing;
}
