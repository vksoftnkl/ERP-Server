import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import type { VoucherLeg } from '../../../common/posting/voucher-leg.types';
import { throwTill } from '../till-errors';
import type { TillCaller } from '../till-context.service';
import { TillEventService } from './till-event.service';
import { TillLedgerService, type SafeRef, type TillCashTender } from './till-ledger.service';
import {
  MOVEMENT_VOUCHER_TYPE,
  RECEIPT_MOVEMENTS,
  RECEIVE_VOUCHER_TYPE,
  TillErrorCode,
  TillEventCode,
  TillMovementKind,
  TillReceiptStatus,
  TillRemitMode,
  TillRemitStatus,
  TillVarianceTreatment,
  VARIANCE_VOUCHER_TYPE,
} from '../types/till-enum';

type Tx = Prisma.TransactionClient;

/** What a till voucher needs to know about the session it belongs to. */
export interface PostingSession {
  tssId: string;
  tssAccYear: string;
  tssCompanyId: string;
  tssBranchId: string;
  tssTenantId: string | null;
  tssDayId: string;
  tssCounterId: string;
  tssDeviceId: string;
  /** Printed on an EXCHANGE, which has no voucher number of its own. */
  sessionNo: string;
  /** 'YYYY-MM-DD' — every till document is dated the business date (§5.3). */
  businessDate: string;
}

export interface PostedMovement {
  tcmId: string;
  docNo: string;
  /** Null for an EXCHANGE: notes changed for notes, nothing to book. */
  voucherId: string | null;
}

/** One movement to write, and the voucher behind it. */
export interface MovementInput {
  session: PostingSession;
  kind: TillMovementKind;
  amount: Prisma.Decimal;
  /** The safe side — every kind but PAID_IN (ck_tcm_safe). */
  safe: SafeRef | null;
  /** PAID_IN: the income / party ledger the cash comes from (ck_tcm_ledger). */
  ledgerId?: string | null;
  tillCash: TillCashTender;
  caller: TillCaller;
  /** Drawn up front when a count must name the movement (tct_movement_id). */
  tcmId?: string;
  /** Who handled the cash; the caller when left out. */
  doneBy?: string;
  /** PICKUP: the cashier who signs for it (ck_tcm_pickup_witness). */
  witnessBy?: string | null;
  reasonId?: string | null;
  refNo?: string | null;
  refDate?: string | null;
  partyName?: string | null;
  bagNo?: string | null;
  sealNo?: string | null;
  countId?: string | null;
  approvalId?: string | null;
  /** Notes 108: when the witness's till PIN was checked; null = no witness proven. */
  witnessVerifiedOn?: Date | null;
  notes?: string | null;
  /** The device it was keyed on — a supervisor's pickup may be keyed on their own. */
  deviceId?: string | null;
  /**
   * Notes 113 — a DROP / CLOSE_HANDOVER under till.handover_receipt REQUIRED:
   * the Till cash awaiting receipt ledger takes the debit instead of the safe,
   * and the row waits (tcm_receipt_status AWAITING) for a supervisor's receive.
   * `safe` stays the one the bag is bound for.
   */
  awaitingLedgerId?: string | null;
}

/** Notes 113 — a bag received into its safe: what was counted, and when. */
export interface ReceiveInput {
  movement: {
    tcmId: string;
    tcmAccYear: string;
    tcmKind: string;
    tcmDocNo: string;
    tcmAmount: Prisma.Decimal;
  };
  session: PostingSession;
  safe: SafeRef;
  awaitingLedgerId: string;
  /** What the receiver counted (may be 0: an empty bag posts no TRcv). */
  received: Prisma.Decimal;
  /** The DROP_VERIFY count; null when the cash was approved on the session (notes 114). */
  countId: string | null;
  /** The business date the receive happens on, and its year: the TRcv's date. */
  on: { date: string; accYear: string };
  caller: TillCaller;
  notes?: string | null;
  /** Notes 127 §3 — the session's own cashier approved it (journalled on CASH_RECEIVED). */
  selfApproval?: 'RULE' | 'SINGLE_OPERATOR' | null;
}

/**
 * Notes 118 — where a cash-office document books when it has no session: the
 * branch, the year and date it is dated, the business day it belongs to.
 */
export interface SafeScope {
  companyId: string;
  branchId: string;
  tenantId: string | null;
  /** The document's year and date: the business day's for a remit or a count. */
  accYear: string;
  date: string;
  dayId: string;
}

/** Notes 118 — a remittance to write: CRem Dr Bank (or Cash in transit) / Cr the safe. */
export interface RemitInput {
  scope: SafeScope;
  safe: SafeRef;
  amount: Prisma.Decimal;
  mode: TillRemitMode;
  /** The bank it is bound for (tcm_ledger_id), either way. */
  bankLedgerId: string;
  /** CIT: the Cash in transit ledger the CRem debits now. */
  transitLedgerId: string | null;
  caller: TillCaller;
  tcmId?: string;
  bagNo?: string | null;
  sealNo?: string | null;
  citAgency?: string | null;
  slipNo?: string | null;
  slipDate?: string | null;
  countId?: string | null;
  approvalId?: string | null;
  notes?: string | null;
}

/** Notes 118 — the bank showed a CIT remittance: the Contra and the row CONFIRMED. */
export interface RemitConfirmInput {
  movement: {
    tcmId: string;
    tcmAccYear: string;
    tcmDocNo: string;
    tcmAmount: Prisma.Decimal;
    tcmDayId: string;
    tcmSafeId: string | null;
    tcmLedgerId: string | null;
  };
  scope: Omit<SafeScope, 'dayId'>;
  transitLedgerId: string;
  bankAmount: Prisma.Decimal;
  bankDate: string;
  bankRef: string;
  caller: TillCaller;
  notes?: string | null;
}

/** The ledger the module's own source columns name on every till voucher. */
const SRC_MODULE = 'TILL';
const SRC_MOVEMENT = 'TILL_MOVEMENT';
const SRC_VARIANCE = 'TILL_VARIANCE';
/** A received bag's TRcv names the movement too; ux_avh_src keeps one live voucher per source. */
const SRC_RECEIVE = 'TILL_RECEIVE';
/** Notes 118 — a CIT remittance's Contra on confirmation names the REMIT as well. */
const SRC_REMIT_CONFIRM = 'TILL_REMIT_CONFIRM';
/** Notes 118 — the remittance and its confirmation are both Cash Remittance (Contra) vouchers. */
const REMIT_VOUCHER_TYPE = MOVEMENT_VOUCHER_TYPE[TillMovementKind.REMIT] ?? 'CRem';
/** The role a WITHIN_TOLERANCE / EXPENSE variance posts against (47 §10.1). */
const CASH_SHORT_EXCESS = 'CASH_SHORT_EXCESS';
/** The role a SUSPENSE variance parks in until a journal clears it (49; notes 105). */
const TENDER_SUSPENSE = 'TENDER_SUSPENSE';
/** Into the drawer: the till cash ledger is debited. */
const INTO_TILL: readonly TillMovementKind[] = [
  TillMovementKind.FLOAT_ISSUE,
  TillMovementKind.TOP_UP,
  TillMovementKind.PAID_IN,
];

/**
 * The till's vouchers (§5.7), each through the ONE posting routine
 * (VoucherPostingService.postLegs), inside the caller's transaction, carrying
 * avh_session_id = the session and the business date as its date. The session
 * is the sub-ledger of the branch's CASH tender ledger (D9).
 *
 *   FLOAT_ISSUE / TOP_UP           TFlt   Dr till cash   / Cr safe
 *   PICKUP / DROP / CLOSE_HANDOVER TDrp   Dr safe        / Cr till cash
 *     notes 113, REQUIRED: DROP / CLOSE_HANDOVER Dr awaiting / Cr till cash,
 *     then the receive                 TRcv   Dr safe        / Cr awaiting
 *   PAID_IN                        TPIn   Dr till cash   / Cr income or party
 *   EXCHANGE                       none   notes for notes, counted both ways, logged
 *   REMIT (notes 118, no session)  CRem   Dr bank (BANK_DEPOSIT) or Cash in transit (CIT) / Cr safe
 *     CIT confirmed                CRem   Dr bank / Cr Cash in transit (src TILL_REMIT_CONFIRM)
 *   safe gap (stage SAFE / REMIT)  TVar   as a variance, against the safe / Cash in transit
 *   variance, short                TVar   Dr Cash short & excess / Cr the tender's ledger
 *   variance, excess               TVar   Dr the tender's ledger / Cr Cash short & excess
 *   void                           Rev    the movement's voucher mirrored (reverseLegs)
 *
 * Each movement row and its voucher are written together: the voucher first
 * (its number IS the movement's doc no — "from acc_voucher_seq for the voucher
 * type", 47 §5), under an id drawn up front so the voucher's source columns can
 * name the movement before it exists. A POSTED movement with no voucher is what
 * ix_tcm_unposted exists to find; this order never makes one.
 */
@Injectable()
export class TillPostingService {
  constructor(
    private readonly posting: VoucherPostingService,
    private readonly ledger: TillLedgerService,
    private readonly events: TillEventService,
  ) {}

  async postMovement(tx: Tx, input: MovementInput): Promise<PostedMovement> {
    const { session, kind, amount, safe, tillCash, caller } = input;
    const typeCode = MOVEMENT_VOUCHER_TYPE[kind];
    const tcmId = input.tcmId ?? (await this.newId(tx));
    const awaiting = input.awaitingLedgerId ?? null;
    if (awaiting && !RECEIPT_MOVEMENTS.includes(kind)) {
      throw new Error(`Till movement ${kind} never waits for a receipt`);
    }
    const other =
      kind === TillMovementKind.PAID_IN
        ? (input.ledgerId ?? null)
        : (awaiting ?? safe?.ledgerId ?? null);
    if (typeCode && !other) {
      throw new Error(`Till movement ${kind} has no ledger to post against`);
    }
    const otherLabel =
      kind === TillMovementKind.PAID_IN
        ? 'ledger'
        : awaiting
          ? `awaiting receipt into ${safe?.name ?? 'the safe'}`
          : (safe?.name ?? 'safe');

    let voucherId: string | null = null;
    let docNo: string;
    if (typeCode && other) {
      const size = money(amount);
      const legs: VoucherLeg[] = INTO_TILL.includes(kind)
        ? [
            { ledgerId: tillCash.ledgerId, drCr: 'DR', amount: size, oppLedgerId: other },
            { ledgerId: other, drCr: 'CR', amount: size, oppLedgerId: tillCash.ledgerId },
          ]
        : [
            { ledgerId: other, drCr: 'DR', amount: size, oppLedgerId: tillCash.ledgerId },
            { ledgerId: tillCash.ledgerId, drCr: 'CR', amount: size, oppLedgerId: other },
          ];
      const voucher = await this.posting.postLegs(tx, {
        // Notes 126 §3: a cash leg is labelled CASH by the server; a bank one (CRem,
        // a bank tender's variance) takes that bank's BANK tender.
        money: { bankTender: 'BANK' },
        header: {
          companyId: session.tssCompanyId,
          branchId: session.tssBranchId,
          tenantId: session.tssTenantId,
          accYear: session.tssAccYear,
          voucherTypeId: await this.voucherTypeId(tx, typeCode),
          voucherDate: session.businessDate,
          srcModule: SRC_MODULE,
          srcDocType: SRC_MOVEMENT,
          srcDocId: tcmId,
          docLabel: `Till ${kind.toLowerCase().replace('_', ' ')}`,
          docRefno: input.refNo ?? null,
          docAmount: size,
          partyId: null,
          userId: input.doneBy ?? caller.userId,
          sessionId: session.tssId,
          deviceType: 'POS',
          deviceId: input.deviceId ?? session.tssDeviceId,
          remarks: input.notes ?? `${kind} ${otherLabel}`,
          createdBy: caller.actorName,
        },
        legs,
      });
      voucherId = voucher.voucherId;
      docNo = voucher.voucherRefno ?? voucher.voucherNo ?? tcmId;
    } else {
      // EXCHANGE: no voucher, so a number of its own — the session's, in order.
      const [row] = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM accounts.till_cash_movement
         WHERE tcm_session_id = ${session.tssId}::uuid AND tcm_acc_year = ${session.tssAccYear}::char(9)
           AND tcm_kind = ${kind}`;
      docNo = `${session.sessionNo}/X${(row?.n ?? 0) + 1}`;
    }

    await tx.tillCashMovement.create({
      data: {
        tcmId,
        tcmCompanyId: session.tssCompanyId,
        tcmBranchId: session.tssBranchId,
        tcmTenantId: session.tssTenantId,
        tcmAccYear: session.tssAccYear,
        tcmKind: kind,
        tcmDocNo: docNo,
        tcmDocDate: new Date(`${session.businessDate}T00:00:00.000Z`),
        tcmDayId: session.tssDayId,
        tcmSessionId: session.tssId,
        tcmSafeId: safe?.safeId ?? null,
        tcmAmount: amount,
        tcmLedgerId: kind === TillMovementKind.PAID_IN ? (input.ledgerId ?? null) : null,
        tcmReasonId: input.reasonId ?? null,
        tcmRefNo: input.refNo ?? null,
        tcmRefDate: input.refDate ? new Date(`${input.refDate}T00:00:00.000Z`) : null,
        tcmPartyName: input.partyName ?? null,
        tcmCountId: input.countId ?? null,
        tcmBagNo: input.bagNo ?? null,
        tcmSealNo: input.sealNo ?? null,
        tcmDoneBy: input.doneBy ?? caller.userId,
        tcmWitnessBy: input.witnessBy ?? null,
        tcmWitnessVerifiedOn: input.witnessVerifiedOn ?? null,
        tcmApprovalId: input.approvalId ?? null,
        tcmVoucherId: voucherId,
        tcmVoucherAccYear: voucherId ? session.tssAccYear : null,
        tcmStatus: 'POSTED',
        tcmDeviceId: input.deviceId ?? session.tssDeviceId,
        tcmNotes: input.notes ?? null,
        tcmCreatedBy: caller.actorName,
        tcmReceiptStatus: awaiting ? TillReceiptStatus.AWAITING : null,
      },
    });

    await this.events.log(tx, {
      companyId: session.tssCompanyId,
      branchId: session.tssBranchId,
      accYear: session.tssAccYear,
      code: TillEventCode.MOVEMENT_POSTED,
      sessionId: session.tssId,
      dayId: session.tssDayId,
      counterId: session.tssCounterId,
      deviceId: input.deviceId ?? session.tssDeviceId,
      userId: caller.userId,
      srcDocType: SRC_MOVEMENT,
      srcDocId: tcmId,
      srcRefno: docNo,
      amount,
      reasonId: input.reasonId ?? null,
      payload: {
        kind,
        safeId: safe?.safeId ?? null,
        ledgerId: input.ledgerId ?? null,
        voucherId,
        doneBy: input.doneBy ?? caller.userId,
        witnessBy: input.witnessBy ?? null,
        witnessVerifiedOn: input.witnessVerifiedOn?.toISOString() ?? null,
        receipt: awaiting ? TillReceiptStatus.AWAITING : null,
      },
    });

    return { tcmId, docNo, voucherId };
  }

  /**
   * Notes 118 — a remittance out of the safe, with no session: CRem Dr the bank
   * (BANK_DEPOSIT, DEPOSITED) or Dr Cash in transit (CIT, IN_TRANSIT until
   * remit-confirm) / Cr the safe, dated the business day. Its number is the
   * CRem's; the row and the voucher are written together, as postMovement does.
   */
  async postRemit(tx: Tx, input: RemitInput): Promise<PostedMovement> {
    const { scope, safe, caller } = input;
    const tcmId = input.tcmId ?? (await this.newId(tx));
    const cit = input.mode === TillRemitMode.CIT;
    const debit = cit ? input.transitLedgerId : input.bankLedgerId;
    if (!debit) {
      throw new Error('A CIT remittance posts to Cash in transit, and none was resolved');
    }
    const size = money(input.amount);
    const voucher = await this.posting.postLegs(tx, {
      // Notes 126 §3: a cash leg is labelled CASH by the server; a bank one (CRem,
      // a bank tender's variance) takes that bank's BANK tender.
      money: { bankTender: 'BANK' },
      header: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        tenantId: scope.tenantId,
        accYear: scope.accYear,
        voucherTypeId: await this.voucherTypeId(tx, REMIT_VOUCHER_TYPE),
        voucherDate: scope.date,
        srcModule: SRC_MODULE,
        srcDocType: SRC_MOVEMENT,
        srcDocId: tcmId,
        docLabel: cit ? 'Cash remittance (in transit)' : 'Cash remittance (bank deposit)',
        docRefno: input.slipNo ?? null,
        docAmount: size,
        partyId: null,
        userId: caller.userId,
        sessionId: null,
        deviceType: caller.deviceId ? 'POS' : null,
        deviceId: caller.deviceId,
        remarks:
          input.notes ??
          `Cash from ${safe.name} ${cit ? `to ${input.citAgency ?? 'the CIT agency'}` : 'paid into the bank'}`,
        createdBy: caller.actorName,
      },
      legs: [
        { ledgerId: debit, drCr: 'DR', amount: size, oppLedgerId: safe.ledgerId },
        { ledgerId: safe.ledgerId, drCr: 'CR', amount: size, oppLedgerId: debit },
      ],
    });
    const docNo = voucher.voucherRefno ?? voucher.voucherNo ?? tcmId;
    const status = cit ? TillRemitStatus.IN_TRANSIT : TillRemitStatus.DEPOSITED;

    await tx.tillCashMovement.create({
      data: {
        tcmId,
        tcmCompanyId: scope.companyId,
        tcmBranchId: scope.branchId,
        tcmTenantId: scope.tenantId,
        tcmAccYear: scope.accYear,
        tcmKind: TillMovementKind.REMIT,
        tcmDocNo: docNo,
        tcmDocDate: new Date(`${scope.date}T00:00:00.000Z`),
        tcmDayId: scope.dayId,
        tcmSessionId: null,
        tcmSafeId: safe.safeId,
        tcmAmount: input.amount,
        tcmLedgerId: input.bankLedgerId,
        tcmRefNo: input.slipNo ?? null,
        tcmRefDate: input.slipDate ? new Date(`${input.slipDate}T00:00:00.000Z`) : null,
        tcmCountId: input.countId ?? null,
        tcmBagNo: input.bagNo ?? null,
        tcmSealNo: input.sealNo ?? null,
        tcmCitAgency: input.citAgency ?? null,
        tcmDoneBy: caller.userId,
        tcmApprovalId: input.approvalId ?? null,
        tcmVoucherId: voucher.voucherId,
        tcmVoucherAccYear: scope.accYear,
        tcmStatus: 'POSTED',
        tcmDeviceId: caller.deviceId,
        tcmNotes: input.notes ?? null,
        tcmCreatedBy: caller.actorName,
        tcmRemitMode: input.mode,
        tcmRemitStatus: status,
      },
    });

    await this.events.log(tx, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: scope.accYear,
      code: TillEventCode.MOVEMENT_POSTED,
      dayId: scope.dayId,
      deviceId: caller.deviceId,
      userId: caller.userId,
      srcDocType: SRC_MOVEMENT,
      srcDocId: tcmId,
      srcRefno: docNo,
      amount: input.amount,
      approvalId: input.approvalId ?? null,
      payload: {
        kind: TillMovementKind.REMIT,
        mode: input.mode,
        status,
        safeId: safe.safeId,
        bankLedgerId: input.bankLedgerId,
        voucherId: voucher.voucherId,
        bagNo: input.bagNo ?? null,
        sealNo: input.sealNo ?? null,
        citAgency: input.citAgency ?? null,
        slipNo: input.slipNo ?? null,
      },
    });
    return { tcmId, docNo, voucherId: voucher.voucherId };
  }

  /**
   * Notes 118 — the bank statement shows a CIT remittance: the Contra Dr Bank /
   * Cr Cash in transit for what the bank credited (none for 0), dated the bank
   * date, and the row CONFIRMED. A credit other than what was sent is the
   * caller's to raise as the REMIT-stage variance — it stays on Cash in transit
   * until that is posted.
   */
  async postRemitConfirm(tx: Tx, input: RemitConfirmInput): Promise<string | null> {
    const { movement, scope, caller } = input;
    if (!movement.tcmLedgerId) {
      throw new Error(`Remittance ${movement.tcmDocNo} names no bank`);
    }
    let voucherId: string | null = null;
    if (input.bankAmount.greaterThan(0)) {
      const size = money(input.bankAmount);
      const voucher = await this.posting.postLegs(tx, {
        // Notes 126 §3: a cash leg is labelled CASH by the server; a bank one (CRem,
        // a bank tender's variance) takes that bank's BANK tender.
        money: { bankTender: 'BANK' },
        header: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          tenantId: scope.tenantId,
          accYear: scope.accYear,
          voucherTypeId: await this.voucherTypeId(tx, REMIT_VOUCHER_TYPE),
          voucherDate: scope.date,
          srcModule: SRC_MODULE,
          srcDocType: SRC_REMIT_CONFIRM,
          srcDocId: movement.tcmId,
          docLabel: `Cash remittance confirmed (${movement.tcmDocNo})`,
          docRefno: input.bankRef,
          docAmount: size,
          partyId: null,
          userId: caller.userId,
          sessionId: null,
          deviceType: caller.deviceId ? 'POS' : null,
          deviceId: caller.deviceId,
          remarks: input.notes ?? `${movement.tcmDocNo} credited by the bank, ref ${input.bankRef}`,
          createdBy: caller.actorName,
        },
        legs: [
          {
            ledgerId: movement.tcmLedgerId,
            drCr: 'DR',
            amount: size,
            oppLedgerId: input.transitLedgerId,
          },
          {
            ledgerId: input.transitLedgerId,
            drCr: 'CR',
            amount: size,
            oppLedgerId: movement.tcmLedgerId,
          },
        ],
      });
      voucherId = voucher.voucherId;
    }

    const now = new Date();
    await tx.tillCashMovement.update({
      where: { tcmId_tcmAccYear: { tcmId: movement.tcmId, tcmAccYear: movement.tcmAccYear } },
      data: {
        tcmRemitStatus: TillRemitStatus.CONFIRMED,
        tcmBankDate: new Date(`${input.bankDate}T00:00:00.000Z`),
        tcmBankRef: input.bankRef,
        tcmBankAmount: input.bankAmount,
        tcmConfirmedBy: caller.userId,
        tcmConfirmedOn: now,
        tcmConfirmVoucherId: voucherId,
        tcmConfirmVoucherAccYear: voucherId ? scope.accYear : null,
        tcmModifiedOn: now,
        tcmModifiedBy: caller.actorName,
      },
    });

    await this.events.log(tx, {
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: movement.tcmAccYear,
      code: TillEventCode.REMIT_CONFIRMED,
      dayId: movement.tcmDayId,
      deviceId: caller.deviceId,
      userId: caller.userId,
      srcDocType: SRC_MOVEMENT,
      srcDocId: movement.tcmId,
      srcRefno: movement.tcmDocNo,
      amount: input.bankAmount,
      payload: {
        sent: movement.tcmAmount.toFixed(2),
        credited: input.bankAmount.toFixed(2),
        difference: input.bankAmount.minus(movement.tcmAmount).toFixed(2),
        bankDate: input.bankDate,
        bankRef: input.bankRef,
        safeId: movement.tcmSafeId,
        voucherId,
      },
    });
    return voucherId;
  }

  /**
   * Notes 113 — a supervisor received a bag: TRcv Dr the safe / Cr Till cash
   * awaiting receipt for what they counted (nothing for an empty bag), dated
   * the day it is received, carrying the bag's session; the row RECEIVED. A
   * difference from what was handed over is the caller's to raise as the
   * session's RECEIVE-stage variance — it stays on the awaiting ledger until
   * that is posted.
   */
  async postReceive(tx: Tx, input: ReceiveInput): Promise<string | null> {
    const { movement, session, safe, caller } = input;
    let voucherId: string | null = null;
    if (input.received.greaterThan(0)) {
      const size = money(input.received);
      const voucher = await this.posting.postLegs(tx, {
        // Notes 126 §3: a cash leg is labelled CASH by the server; a bank one (CRem,
        // a bank tender's variance) takes that bank's BANK tender.
        money: { bankTender: 'BANK' },
        header: {
          companyId: session.tssCompanyId,
          branchId: session.tssBranchId,
          tenantId: session.tssTenantId,
          accYear: input.on.accYear,
          voucherTypeId: await this.voucherTypeId(tx, RECEIVE_VOUCHER_TYPE),
          voucherDate: input.on.date,
          srcModule: SRC_MODULE,
          srcDocType: SRC_RECEIVE,
          srcDocId: movement.tcmId,
          docLabel: `Till cash received (${movement.tcmDocNo})`,
          docRefno: movement.tcmDocNo,
          docAmount: size,
          partyId: null,
          userId: caller.userId,
          sessionId: session.tssId,
          deviceType: 'POS',
          deviceId: caller.deviceId ?? session.tssDeviceId,
          remarks:
            input.notes ??
            `${movement.tcmKind} ${movement.tcmDocNo} (${session.sessionNo}) received into ${safe.name}`,
          createdBy: caller.actorName,
        },
        legs: [
          {
            ledgerId: safe.ledgerId,
            drCr: 'DR',
            amount: size,
            oppLedgerId: input.awaitingLedgerId,
          },
          {
            ledgerId: input.awaitingLedgerId,
            drCr: 'CR',
            amount: size,
            oppLedgerId: safe.ledgerId,
          },
        ],
      });
      voucherId = voucher.voucherId;
    }

    const now = new Date();
    await tx.tillCashMovement.update({
      where: { tcmId_tcmAccYear: { tcmId: movement.tcmId, tcmAccYear: movement.tcmAccYear } },
      data: {
        tcmReceiptStatus: TillReceiptStatus.RECEIVED,
        tcmReceivedBy: caller.userId,
        tcmReceivedOn: now,
        tcmReceivedAmount: input.received,
        tcmReceiveCountId: input.countId,
        tcmReceiveVoucherId: voucherId,
        tcmReceiveVoucherAccYear: voucherId ? input.on.accYear : null,
        tcmModifiedOn: now,
        tcmModifiedBy: caller.actorName,
      },
    });

    await this.events.log(tx, {
      companyId: session.tssCompanyId,
      branchId: session.tssBranchId,
      accYear: session.tssAccYear,
      code: TillEventCode.CASH_RECEIVED,
      sessionId: session.tssId,
      dayId: session.tssDayId,
      counterId: session.tssCounterId,
      deviceId: caller.deviceId ?? session.tssDeviceId,
      userId: caller.userId,
      srcDocType: SRC_MOVEMENT,
      srcDocId: movement.tcmId,
      srcRefno: movement.tcmDocNo,
      amount: input.received,
      payload: {
        kind: movement.tcmKind,
        handedOver: movement.tcmAmount.toFixed(2),
        received: input.received.toFixed(2),
        difference: input.received.minus(movement.tcmAmount).toFixed(2),
        safeId: safe.safeId,
        countId: input.countId,
        voucherId,
        receivedOn: input.on.date,
        // notes 127 §3: "approved by own cashier", and on what footing
        selfApproved: !!input.selfApproval,
        selfApproval: input.selfApproval ?? null,
      },
    });
    return voucherId;
  }

  /**
   * MOVEMENT_VOID: the movement's voucher mirrored (reverseLegs — the original
   * CANCELLED, a Rev voucher of its own dated the original's date, both
   * carrying the session), the row marked VOIDED. Never an edit, never a delete.
   */
  async voidMovement(
    tx: Tx,
    input: {
      movement: {
        tcmId: string;
        tcmAccYear: string;
        tcmKind: string;
        tcmDocNo: string;
        tcmAmount: Prisma.Decimal;
        tcmVoucherId: string | null;
        tcmVoucherAccYear: string | null;
      };
      /** Null for a cash-office movement (a REMIT, notes 118): the event takes `dayId` then. */
      session: PostingSession | null;
      dayId?: string | null;
      companyId?: string;
      branchId?: string;
      reasonId: string;
      reasonText: string;
      caller: TillCaller;
      approvalId?: string | null;
    },
  ): Promise<string | null> {
    const { movement, session, caller } = input;
    let reversalId: string | null = null;
    if (movement.tcmVoucherId && movement.tcmVoucherAccYear) {
      const reversed = await this.posting.reverseLegs(
        tx,
        movement.tcmVoucherId,
        movement.tcmVoucherAccYear,
        `Till ${movement.tcmKind} ${movement.tcmDocNo} voided: ${input.reasonText}`,
        caller.actorName,
      );
      reversalId = reversed?.voucherId ?? null;
    }
    await tx.tillCashMovement.update({
      where: { tcmId_tcmAccYear: { tcmId: movement.tcmId, tcmAccYear: movement.tcmAccYear } },
      data: {
        tcmStatus: 'VOIDED',
        tcmVoidReasonId: input.reasonId,
        tcmVoidedOn: new Date(),
        tcmVoidedBy: caller.userId,
        tcmVoidApprovalId: input.approvalId ?? null,
        tcmModifiedOn: new Date(),
        tcmModifiedBy: caller.actorName,
      },
    });
    await this.events.log(tx, {
      companyId: session?.tssCompanyId ?? input.companyId!,
      branchId: session?.tssBranchId ?? input.branchId!,
      accYear: movement.tcmAccYear,
      code: TillEventCode.MOVEMENT_VOIDED,
      sessionId: session?.tssId ?? null,
      dayId: session?.tssDayId ?? input.dayId ?? null,
      counterId: session?.tssCounterId ?? null,
      deviceId: caller.deviceId ?? session?.tssDeviceId ?? null,
      userId: caller.userId,
      srcDocType: SRC_MOVEMENT,
      srcDocId: movement.tcmId,
      srcRefno: movement.tcmDocNo,
      amount: movement.tcmAmount,
      reasonId: input.reasonId,
      payload: { kind: movement.tcmKind, reversalVoucherId: reversalId },
    });
    return reversalId;
  }

  /**
   * Notes 117 — a session reopened: one posted variance's TVar mirrored
   * (reverseLegs: the original CANCELLED, a Rev voucher of its own), the row
   * REVERSED. A zero variance posted no voucher and is only marked. Never an
   * edit, never a delete.
   */
  async reverseVariance(
    tx: Tx,
    input: {
      variance: {
        tvrId: string;
        tvrAccYear: string;
        tvrVoucherId: string | null;
        tvrVoucherAccYear: string | null;
      };
      reasonText: string;
      caller: TillCaller;
    },
  ): Promise<string | null> {
    const { variance, caller } = input;
    let reversalId: string | null = null;
    if (variance.tvrVoucherId && variance.tvrVoucherAccYear) {
      const reversed = await this.posting.reverseLegs(
        tx,
        variance.tvrVoucherId,
        variance.tvrVoucherAccYear,
        `Till variance reversed: ${input.reasonText}`,
        caller.actorName,
      );
      reversalId = reversed?.voucherId ?? null;
    }
    await tx.tillVariance.update({
      where: { tvrId_tvrAccYear: { tvrId: variance.tvrId, tvrAccYear: variance.tvrAccYear } },
      data: {
        tvrStatus: 'REVERSED',
        tvrModifiedOn: new Date(),
        tvrModifiedBy: caller.actorName,
      },
    });
    return reversalId;
  }

  /**
   * One variance row's TVar. The row must already exist (its id is the
   * voucher's source); this posts it and marks it POSTED. A zero variance
   * posts nothing and is marked POSTED all the same — "decided, nothing to book".
   */
  async postVariance(
    tx: Tx,
    input: {
      session: PostingSession;
      tvrId: string;
      /** The ledger the tender's money sits in: till cash for CASH, the tender's own otherwise. */
      tenderLedgerId: string;
      tenderLabel: string;
      variance: Prisma.Decimal;
      /** PENDING and RETENDERED never post: the close skips them. */
      treatment: PostedTreatment;
      /** RECOVER: the cashier's staff advance ledger (tvr_recovery_ledger_id). */
      recoveryLedgerId?: string | null;
      caller: TillCaller;
      /**
       * Notes 113 — a RECEIVE-stage variance is posted when the bag is received
       * or decided, not on the session's business date: the TVar's date and
       * year. Left out = the session's.
       */
      on?: { date: string; accYear: string } | null;
    },
  ): Promise<string | null> {
    const { session } = input;
    const on = input.on ?? { date: session.businessDate, accYear: session.tssAccYear };
    const voucherId = await this.postVarianceVoucher(tx, {
      companyId: session.tssCompanyId,
      branchId: session.tssBranchId,
      tenantId: session.tssTenantId,
      on,
      sessionId: session.tssId,
      deviceId: session.tssDeviceId,
      tvrId: input.tvrId,
      tenderLedgerId: input.tenderLedgerId,
      tenderLabel: input.tenderLabel,
      variance: input.variance,
      treatment: input.treatment,
      recoveryLedgerId: input.recoveryLedgerId ?? null,
      caller: input.caller,
    });
    await this.markVariancePosted(tx, input.tvrId, session.tssAccYear, voucherId, on, input.caller);
    return voucherId;
  }

  /**
   * Notes 118 — a safe gap's TVar, with no session: a SAFE-stage row against
   * the safe's ledger, a REMIT-stage row against Cash in transit. EXPENSE →
   * Cash Short & Excess, SUSPENSE → Tender suspense; a short safe debits the
   * counter leg, an excess credits it. A zero gap posts nothing.
   */
  async postSafeVariance(
    tx: Tx,
    input: {
      scope: Omit<SafeScope, 'dayId'>;
      tvrId: string;
      tvrAccYear: string;
      /** The safe's ledger (stage SAFE) or Cash in transit (stage REMIT). */
      ledgerId: string;
      label: string;
      variance: Prisma.Decimal;
      treatment: PostedTreatment;
      caller: TillCaller;
    },
  ): Promise<string | null> {
    const on = { date: input.scope.date, accYear: input.scope.accYear };
    const voucherId = await this.postVarianceVoucher(tx, {
      companyId: input.scope.companyId,
      branchId: input.scope.branchId,
      tenantId: input.scope.tenantId,
      on,
      sessionId: null,
      deviceId: input.caller.deviceId,
      tvrId: input.tvrId,
      tenderLedgerId: input.ledgerId,
      tenderLabel: input.label,
      variance: input.variance,
      treatment: input.treatment,
      recoveryLedgerId: null,
      caller: input.caller,
    });
    await this.markVariancePosted(tx, input.tvrId, input.tvrAccYear, voucherId, on, input.caller);
    return voucherId;
  }

  /**
   * One variance row's TVar. The row must already exist (its id is the
   * voucher's source). A zero variance posts nothing — "decided, nothing to book".
   */
  private async postVarianceVoucher(
    tx: Tx,
    input: {
      companyId: string;
      branchId: string;
      tenantId: string | null;
      on: { date: string; accYear: string };
      sessionId: string | null;
      deviceId: string | null;
      tvrId: string;
      tenderLedgerId: string;
      tenderLabel: string;
      variance: Prisma.Decimal;
      treatment: PostedTreatment;
      recoveryLedgerId: string | null;
      caller: TillCaller;
    },
  ): Promise<string | null> {
    const { variance, caller, on } = input;
    if (variance.isZero()) {
      return null;
    }
    // The counter leg: Cash Short & Excess for a WITHIN_TOLERANCE / EXPENSE
    // gap; the cashier's staff advance ledger when the approver chose
    // RECOVER; Tender suspense under SUSPENSE, cleared later by a journal
    // (notes 105 A1). A short drawer debits it, an excess credits it.
    const counter = await this.varianceCounterLedger(
      tx,
      { companyId: input.companyId, branchId: input.branchId },
      input.treatment,
      input.recoveryLedgerId,
    );
    const size = money(variance.abs());
    const short = variance.isNegative();
    const legs: VoucherLeg[] = short
      ? [
          {
            ledgerId: counter.ledgerId,
            drCr: 'DR',
            amount: size,
            roleTag: counter.roleTag,
            oppLedgerId: input.tenderLedgerId,
          },
          {
            ledgerId: input.tenderLedgerId,
            drCr: 'CR',
            amount: size,
            oppLedgerId: counter.ledgerId,
          },
        ]
      : [
          {
            ledgerId: input.tenderLedgerId,
            drCr: 'DR',
            amount: size,
            oppLedgerId: counter.ledgerId,
          },
          {
            ledgerId: counter.ledgerId,
            drCr: 'CR',
            amount: size,
            roleTag: counter.roleTag,
            oppLedgerId: input.tenderLedgerId,
          },
        ];
    const voucher = await this.posting.postLegs(tx, {
      // Notes 126 §3: a cash leg is labelled CASH by the server; a bank one (CRem,
      // a bank tender's variance) takes that bank's BANK tender.
      money: { bankTender: 'BANK' },
      header: {
        companyId: input.companyId,
        branchId: input.branchId,
        tenantId: input.tenantId,
        accYear: on.accYear,
        voucherTypeId: await this.voucherTypeId(tx, VARIANCE_VOUCHER_TYPE),
        voucherDate: on.date,
        srcModule: SRC_MODULE,
        srcDocType: SRC_VARIANCE,
        srcDocId: input.tvrId,
        docLabel: `Till variance (${input.tenderLabel})`,
        docAmount: size,
        partyId: null,
        userId: caller.userId,
        sessionId: input.sessionId,
        deviceType: input.deviceId ? 'POS' : null,
        deviceId: input.deviceId,
        remarks: `${input.tenderLabel} ${short ? 'short' : 'excess'} ${size.toFixed(2)} (${input.treatment})`,
        createdBy: caller.actorName,
      },
      legs,
    });
    return voucher.voucherId;
  }

  private async markVariancePosted(
    tx: Tx,
    tvrId: string,
    tvrAccYear: string,
    voucherId: string | null,
    on: { date: string; accYear: string },
    caller: TillCaller,
  ): Promise<void> {
    await tx.tillVariance.update({
      where: { tvrId_tvrAccYear: { tvrId, tvrAccYear } },
      data: {
        tvrStatus: 'POSTED',
        tvrVoucherId: voucherId,
        tvrVoucherAccYear: voucherId ? on.accYear : null,
        tvrModifiedOn: new Date(),
        tvrModifiedBy: caller.actorName,
      },
    });
  }

  /** The ledger a variance's counter leg goes to, by treatment (notes 105 A1). */
  private async varianceCounterLedger(
    tx: Tx,
    scope: { companyId: string; branchId: string },
    treatment: TillVarianceTreatment,
    recoveryLedgerId: string | null,
  ): Promise<{ ledgerId: string; roleTag: string | null }> {
    switch (treatment) {
      case TillVarianceTreatment.RECOVER:
        if (!recoveryLedgerId) {
          throwTill(
            TillErrorCode.LEDGER_UNMAPPED,
            'RECOVER posts to the cashier’s staff advance ledger, and this variance names none',
            'treatment',
            { treatment },
          );
        }
        return { ledgerId: recoveryLedgerId, roleTag: null };
      case TillVarianceTreatment.SUSPENSE:
        return {
          ledgerId: await this.ledger.roleLedger(
            tx,
            TENDER_SUSPENSE,
            scope.companyId,
            scope.branchId,
          ),
          roleTag: TENDER_SUSPENSE,
        };
      default:
        return {
          ledgerId: await this.ledger.roleLedger(
            tx,
            CASH_SHORT_EXCESS,
            scope.companyId,
            scope.branchId,
          ),
          roleTag: CASH_SHORT_EXCESS,
        };
    }
  }

  /** An ACTIVE voucher type's id by code; the till types are resolved by code, never pinned. */
  async voucherTypeId(tx: Tx, code: string): Promise<number> {
    const type = await tx.accVoucherType.findFirst({
      where: { vchrTypeCode: code, vchrIsActive: true },
      select: { vchrTypeId: true },
    });
    if (!type) {
      throwTill(
        TillErrorCode.LEDGER_UNMAPPED,
        `Voucher type ${code} is missing or inactive (migration 20261008100000 creates it)`,
        'voucherType',
        { voucherType: code },
      );
    }
    return type.vchrTypeId;
  }

  private async newId(tx: Tx): Promise<string> {
    const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`;
    return row.id;
  }
}

/** What a posted variance may be: PENDING and RETENDERED never post. */
type PostedTreatment = Exclude<
  TillVarianceTreatment,
  TillVarianceTreatment.PENDING | TillVarianceTreatment.RETENDERED
>;

/** The posting service takes number legs (voucher-leg.types); two places, from the Decimal. */
function money(value: Prisma.Decimal): number {
  return Number(value.toFixed(2));
}
