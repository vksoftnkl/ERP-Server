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
  TillErrorCode,
  TillEventCode,
  TillMovementKind,
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
  notes?: string | null;
  /** The device it was keyed on — a supervisor's pickup may be keyed on their own. */
  deviceId?: string | null;
}

/** The ledger the module's own source columns name on every till voucher. */
const SRC_MODULE = 'TILL';
const SRC_MOVEMENT = 'TILL_MOVEMENT';
const SRC_VARIANCE = 'TILL_VARIANCE';
/** The role a WITHIN_TOLERANCE / EXPENSE variance posts against (47 §10.1). */
const CASH_SHORT_EXCESS = 'CASH_SHORT_EXCESS';
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
 *   PAID_IN                        TPIn   Dr till cash   / Cr income or party
 *   EXCHANGE                       none   notes for notes, counted both ways, logged
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
    const other =
      kind === TillMovementKind.PAID_IN ? (input.ledgerId ?? null) : (safe?.ledgerId ?? null);
    if (typeCode && !other) {
      throw new Error(`Till movement ${kind} has no ledger to post against`);
    }
    const otherLabel = kind === TillMovementKind.PAID_IN ? 'ledger' : (safe?.name ?? 'safe');

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
        tcmApprovalId: input.approvalId ?? null,
        tcmVoucherId: voucherId,
        tcmVoucherAccYear: voucherId ? session.tssAccYear : null,
        tcmStatus: 'POSTED',
        tcmDeviceId: input.deviceId ?? session.tssDeviceId,
        tcmNotes: input.notes ?? null,
        tcmCreatedBy: caller.actorName,
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
      },
    });

    return { tcmId, docNo, voucherId };
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
      session: PostingSession;
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
      companyId: session.tssCompanyId,
      branchId: session.tssBranchId,
      accYear: session.tssAccYear,
      code: TillEventCode.MOVEMENT_VOIDED,
      sessionId: session.tssId,
      dayId: session.tssDayId,
      counterId: session.tssCounterId,
      deviceId: caller.deviceId ?? session.tssDeviceId,
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
      treatment: TillVarianceTreatment.WITHIN_TOLERANCE | TillVarianceTreatment.EXPENSE;
      caller: TillCaller;
    },
  ): Promise<string | null> {
    const { session, variance, caller } = input;
    let voucherId: string | null = null;
    if (!variance.isZero()) {
      const shortExcess = await this.ledger.roleLedger(
        tx,
        CASH_SHORT_EXCESS,
        session.tssCompanyId,
        session.tssBranchId,
      );
      const size = money(variance.abs());
      const short = variance.isNegative();
      const legs: VoucherLeg[] = short
        ? [
            {
              ledgerId: shortExcess,
              drCr: 'DR',
              amount: size,
              roleTag: CASH_SHORT_EXCESS,
              oppLedgerId: input.tenderLedgerId,
            },
            { ledgerId: input.tenderLedgerId, drCr: 'CR', amount: size, oppLedgerId: shortExcess },
          ]
        : [
            { ledgerId: input.tenderLedgerId, drCr: 'DR', amount: size, oppLedgerId: shortExcess },
            {
              ledgerId: shortExcess,
              drCr: 'CR',
              amount: size,
              roleTag: CASH_SHORT_EXCESS,
              oppLedgerId: input.tenderLedgerId,
            },
          ];
      const voucher = await this.posting.postLegs(tx, {
        header: {
          companyId: session.tssCompanyId,
          branchId: session.tssBranchId,
          tenantId: session.tssTenantId,
          accYear: session.tssAccYear,
          voucherTypeId: await this.voucherTypeId(tx, VARIANCE_VOUCHER_TYPE),
          voucherDate: session.businessDate,
          srcModule: SRC_MODULE,
          srcDocType: SRC_VARIANCE,
          srcDocId: input.tvrId,
          docLabel: `Till variance (${input.tenderLabel})`,
          docAmount: size,
          partyId: null,
          userId: caller.userId,
          sessionId: session.tssId,
          deviceType: 'POS',
          deviceId: session.tssDeviceId,
          remarks: `${input.tenderLabel} ${short ? 'short' : 'excess'} ${size.toFixed(2)} (${input.treatment})`,
          createdBy: caller.actorName,
        },
        legs,
      });
      voucherId = voucher.voucherId;
    }

    await tx.tillVariance.update({
      where: { tvrId_tvrAccYear: { tvrId: input.tvrId, tvrAccYear: session.tssAccYear } },
      data: {
        tvrStatus: 'POSTED',
        tvrVoucherId: voucherId,
        tvrVoucherAccYear: voucherId ? session.tssAccYear : null,
        tvrModifiedOn: new Date(),
        tvrModifiedBy: caller.actorName,
      },
    });
    return voucherId;
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

/** The posting service takes number legs (voucher-leg.types); two places, from the Decimal. */
function money(value: Prisma.Decimal): number {
  return Number(value.toFixed(2));
}
