import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  allocateVoucherNumber,
  allocateVoucherSlno,
} from '../../../common/Sequence/voucher-sequence.helper';
import {
  requireRoleLedgers,
  roleLedgerKey,
  type RoleLedgerRequest,
} from '../../accountsModule/ledgerRole/ledger-map.helper';
import type {
  SalesLeg,
  SalesLegSource,
  SalesPostingResult,
  SalesVoucherHeader,
} from './types/sales-leg.types';

/** `ck_avh_device_type` accepts these; anything else becomes NULL. */
const DEVICE_TYPES = new Set(['PC', 'WEB', 'MOBILE', 'POS', 'DESKTOP']);

/**
 * §3.2 — every sales document's legs, written once, in one order.
 *
 * ── Why the write order is FIXED ───────────────────────────────────────────
 *
 * party, sales, taxes, charges, discount, round-off, TCS, COGS pair, tenders,
 * set-offs. `av_row_no` follows that order, so an amend can diff two versions
 * of a voucher row by row instead of by content. Shuffle the order and every
 * amend looks like a total rewrite.
 *
 * ── Σ DR = Σ CR is asserted HERE as well as in the database ────────────────
 *
 * `ck_avh_balanced` already refuses an unbalanced POSTED voucher. It refuses
 * it with a 23514 naming a constraint, which tells an operator nothing. The
 * service checks first and says which side is short and by how much.
 *
 * The totals themselves are NOT written: `tr_av_refresh_totals` on
 * `acc_vouchers` maintains `avh_total_debit` / `avh_total_credit`. That trigger
 * stays because `accounts` is not a schema an offline till writes — the offline
 * rider applies to the tables a device pushes, and vouchers are raised on the
 * server from documents that were pushed.
 */
@Injectable()
export class SalesPostingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write the voucher and its legs, and return the voucher id.
   *
   * Runs inside the CALLER's transaction: a document that says POSTED with no
   * voucher behind it is exactly the inconsistency this prevents.
   */
  async postLegs(tx: Prisma.TransactionClient, doc: SalesLegSource): Promise<SalesPostingResult> {
    const legs = doc.legs.filter((l) => round2(l.amount) !== 0);
    if (legs.length === 0) {
      throw new Error(`${doc.header.srcDocType} ${doc.header.srcDocId} produced no voucher legs`);
    }

    const ledgerByLeg = await this.resolveLegLedgers(tx, doc.header, legs);
    this.assertBalanced(doc.header, legs);

    if (doc.header.restateVoucherId) {
      return this.restateLegs(tx, doc, legs, ledgerByLeg, doc.header.restateVoucherId);
    }

    // The number first: it takes an advisory lock, and taking it before any
    // row is written keeps the lock window as short as it can be.
    const slno = await allocateVoucherSlno(tx, doc.header.companyId, doc.header.accYear);
    const number = doc.header.presetRefno
      ? { refno: doc.header.presetRefno, lastNo: doc.header.presetNo ?? slno }
      : await allocateVoucherNumber(tx, {
          vchrTypeId: doc.header.voucherTypeId,
          companyId: doc.header.companyId,
          branchId: doc.header.branchId,
          accYear: doc.header.accYear,
          // POS numbers per device; WHOLESALE shares the 'MAIN' counter.
          deviceCode: doc.header.deviceCode ?? null,
          documentDate: new Date(`${doc.header.voucherDate}T00:00:00Z`),
        });

    const postedOn = new Date();
    const [header] = await tx.$queryRaw<{ avh_voucher_id: string }[]>`
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
    await this.insertLegs(tx, doc, legs, ledgerByLeg, voucherId, number);

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

  /**
   * Amend, step one: take a POSTED voucher back to DRAFT and retire its legs,
   * so `postLegs` with `restateVoucherId` can write the new legs into the SAME
   * header. The receipt amend's precedent (receipt-amend.service.ts), for the
   * same reasons:
   *
   *  * `ux_avh_voucher_no` keeps a CANCELLED voucher's number taken, so an
   *    amend that mirrored the original and re-posted under the bill's number
   *    answered 23505 — every amend of a posted bill was a 500. A mirror would
   *    also draw a number of its own from the BILL series, leaving a gap in the
   *    numbers a GST return lists for every amendment.
   *  * The header goes to DRAFT FIRST: `ck_avh_balanced` binds a POSTED header
   *    only, so the legs can leave and arrive in any number of statements.
   *  * Soft delete, never delete: `ux_av_voucher_row` is partial on the flag,
   *    so the new legs number from 1 again, and the old ones stay readable for
   *    the audit trail. `avh_revision_no` carries the change.
   *
   * Returns false when there is no live POSTED voucher to restate.
   */
  async retireForRestate(
    tx: Prisma.TransactionClient,
    voucherId: string,
    accYear: string,
    actor = 'SYSTEM',
  ): Promise<boolean> {
    const moved = await tx.$executeRaw`
      UPDATE accounts.acc_voucher_header
         SET avh_voucher_status = 'DRAFT',
             avh_status_on      = now(),
             avh_modified_on    = now(),
             avh_modified_by    = ${actor}
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)
         AND avh_is_deleted = false
         AND avh_voucher_status = 'POSTED'`;
    if (moved === 0) {
      return false;
    }
    await tx.$executeRaw`
      UPDATE accounts.acc_vouchers
         SET av_is_deleted   = true,
             av_modified_on  = now(),
             av_modified_by  = ${actor}
       WHERE av_voucher_id = ${voucherId}::uuid
         AND av_acc_year   = ${accYear}::char(9)
         AND av_is_deleted = false`;
    return true;
  }

  /**
   * Amend, step two: the new legs into the header `retireForRestate` left in
   * DRAFT. Its number, refno and slno stand; everything the document may have
   * changed is re-stated; POSTED again once the legs are in and balance.
   */
  private async restateLegs(
    tx: Prisma.TransactionClient,
    doc: SalesLegSource,
    legs: SalesLeg[],
    ledgerByLeg: (string | null)[],
    voucherId: string,
  ): Promise<SalesPostingResult> {
    const accYear = doc.header.accYear;
    const [kept] = await tx.$queryRaw<
      { avh_voucher_no: bigint; avh_voucher_slno: bigint; avh_voucher_refno: string }[]
    >`
      SELECT avh_voucher_no, avh_voucher_slno, avh_voucher_refno
        FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)
         AND avh_is_deleted = false
         AND avh_voucher_status = 'DRAFT'
         FOR UPDATE`;
    if (!kept) {
      throw new Error(
        `${doc.header.srcDocType} ${doc.header.srcDocId}: voucher ${voucherId} is not in DRAFT — retireForRestate must run first`,
      );
    }
    const number = { refno: kept.avh_voucher_refno, lastNo: kept.avh_voucher_no };

    await tx.$executeRaw`
      UPDATE accounts.acc_voucher_header
         SET avh_voucher_date = ${doc.header.voucherDate}::date,
             avh_usr_refno    = ${doc.header.usrRefno ?? null},
             avh_doc_refno    = ${doc.header.docRefno ?? null},
             avh_doc_date     = ${doc.header.docDate ?? doc.header.voucherDate}::date,
             avh_doc_amount   = ${money(doc.header.docAmount)}::numeric,
             avh_round_off    = ${money(doc.header.roundOff ?? 0)}::numeric,
             avh_party_id     = ${doc.header.partyId}::uuid,
             avh_remarks      = ${doc.header.remarks ?? null},
             avh_user_id      = ${doc.header.userId}::uuid,
             avh_session_id   = ${doc.header.sessionId ?? null}::uuid,
             avh_revision_no  = avh_revision_no + 1,
             avh_modified_on  = now(),
             avh_modified_by  = ${doc.header.createdBy ?? 'SYSTEM'}
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)`;

    await this.insertLegs(tx, doc, legs, ledgerByLeg, voucherId, number);

    const postedOn = new Date();
    await tx.$executeRaw`
      UPDATE accounts.acc_voucher_header
         SET avh_voucher_status = 'POSTED',
             avh_status_on      = now(),
             avh_status_by      = ${doc.header.userId}::uuid,
             avh_posted_on      = now()
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)`;

    const totals = sumSides(legs);
    return {
      voucherId,
      voucherNo: number.refno,
      voucherRefno: number.refno,
      voucherSlno: kept.avh_voucher_slno,
      voucherLastNo: number.lastNo,
      postedOn,
      totalDebit: totals.dr,
      totalCredit: totals.cr,
      legCount: legs.length,
    };
  }

  /** The legs, in the fixed order, numbered from 1. */
  private async insertLegs(
    tx: Prisma.TransactionClient,
    doc: SalesLegSource,
    legs: SalesLeg[],
    ledgerByLeg: (string | null)[],
    voucherId: string,
    number: { refno: string; lastNo: bigint },
  ): Promise<void> {
    const values = legs.map(
      (leg, i) => Prisma.sql`(
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
      )`,
    );

    await tx.$executeRaw`
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
      VALUES ${Prisma.join(values)}`;
  }

  /**
   * Cancel: write the MIRROR voucher, same type, and mark the original.
   *
   * Never a delete and never an edit. The original keeps its number, its legs
   * and its audit trail; `avh_reversal_voucher_id` links the pair, so a
   * statement shows both and a total nets to zero.
   *
   * Three things the database dictates, all learned from the receipt module's
   * reversal (`receipt-cancel.service.ts`), which is the house precedent:
   *
   *  * the mirror takes a NUMBER OF ITS OWN. `ux_avh_voucher_no` keeps a
   *    CANCELLED voucher's number taken (it excludes only DRAFT and deleted
   *    rows), so "same number" is a 23505;
   *  * the original is marked CANCELLED BEFORE the mirror is written.
   *    `ux_avh_src` and `ux_avh_doc_refno` admit one live voucher per source
   *    document / per party+refno, and they exclude CANCELLED rows only;
   *  * the mirror carries NO `avh_src_*` and no `avh_doc_refno` of its own —
   *    it answers the original through `avh_against_voucher_id`. A POSTED
   *    mirror that still pointed at the document would block the re-post an
   *    amend makes moments later, on those same two indexes.
   *
   * Dated the ORIGINAL, not today: a reversal dated today leaves the original
   * month overstated and this month understated.
   */
  async reverseLegs(
    tx: Prisma.TransactionClient,
    voucherId: string,
    accYear: string,
    reason: string,
    actor = 'SYSTEM',
  ): Promise<{ voucherId: string; legCount: number } | null> {
    const [original] = await tx.$queryRaw<
      {
        avh_voucher_id: string;
        avh_company_id: string;
        avh_branch_id: string;
        avh_voucher_type_id: number;
        avh_acc_year: string;
        avh_voucher_refno: string | null;
        avh_voucher_date: Date;
        avh_voucher_status: string;
        avh_reversal_voucher_id: string | null;
      }[]
    >`
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
    // Already reversed: a repeated cancel is a no-op, not a second mirror.
    if (original.avh_reversal_voucher_id || original.avh_voucher_status === 'CANCELLED') {
      return null;
    }

    // 1 · the original leaves the live set first (see the class note).
    await tx.$executeRaw`
      UPDATE accounts.acc_voucher_header
         SET avh_voucher_status = 'CANCELLED',
             -- ck_avh_cancel: a cancellation must always carry a reason.
             avh_cancel_reason  = ${reason},
             avh_status_on      = now(),
             avh_modified_on    = now(),
             avh_modified_by    = ${actor}
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)`;

    // 2 · a number of its own, in the original's series and on the original's date.
    const number = await allocateVoucherNumber(tx, {
      vchrTypeId: original.avh_voucher_type_id,
      companyId: original.avh_company_id,
      branchId: original.avh_branch_id,
      accYear: original.avh_acc_year.trim(),
      deviceCode: null,
      documentDate: original.avh_voucher_date,
    });
    const slno = await allocateVoucherSlno(
      tx,
      original.avh_company_id,
      original.avh_acc_year.trim(),
    );
    const remarks = `Reversal of ${original.avh_voucher_refno ?? voucherId}: ${reason}`;

    const [mirror] = await tx.$queryRaw<{ avh_voucher_id: string }[]>`
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

    // 3 · every leg mirrored: same ledger, same amount, the other side.
    const legCount = await tx.$executeRaw`
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

    // 4 · the link, both ways readable.
    await tx.$executeRaw`
      UPDATE accounts.acc_voucher_header
         SET avh_reversal_voucher_id = ${mirror.avh_voucher_id}::uuid,
             avh_reversal_acc_year   = ${accYear}::char(9)
       WHERE avh_voucher_id = ${voucherId}::uuid
         AND avh_acc_year   = ${accYear}::char(9)`;

    return { voucherId: mirror.avh_voucher_id, legCount };
  }

  /**
   * Every role in the leg list, resolved in ONE round trip.
   *
   * Throws a 400 listing every unmapped role, not one per round trip: a
   * company that has never configured its sales ledgers is missing five or six
   * at once, and telling the operator about them one at a time is six visits
   * to the same screen.
   */
  private async resolveLegLedgers(
    tx: Prisma.TransactionClient,
    header: SalesVoucherHeader,
    legs: SalesLeg[],
  ): Promise<(string | null)[]> {
    const requests: RoleLedgerRequest[] = [];
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

    const resolved =
      requests.length === 0
        ? new Map<string, { ledgerId: string | null }>()
        : await requireRoleLedgers(tx, requests, {
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
      return (
        resolved.get(
          roleLedgerKey({
            role: leg.role,
            taxId: leg.taxId ?? null,
            supplyNature: leg.supplyNature ?? null,
          }),
        )?.ledgerId ?? null
      );
    });
  }

  /** The readable half of `ck_avh_balanced`. */
  private assertBalanced(header: SalesVoucherHeader, legs: SalesLeg[]): void {
    const { dr, cr } = sumSides(legs);
    if (round2(dr) !== round2(cr)) {
      const diff = round2(dr - cr);
      throw new Error(
        `${header.srcDocType} ${header.docRefno ?? header.srcDocId} does not balance: ` +
          `debits ${round2(dr)}, credits ${round2(cr)}, ` +
          `${diff > 0 ? 'debit' : 'credit'} heavy by ${Math.abs(diff)}`,
      );
    }
  }
}

function sumSides(legs: SalesLeg[]): { dr: number; cr: number } {
  let dr = 0;
  let cr = 0;
  for (const leg of legs) {
    if (leg.drCr === 'DR') {
      dr += Math.abs(leg.amount);
    } else {
      cr += Math.abs(leg.amount);
    }
  }
  return { dr: round2(dr), cr: round2(cr) };
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}

function money(v: number): string {
  return round2(v).toFixed(2);
}

function normaliseDeviceType(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const upper = value.trim().toUpperCase();
  // Unmapped becomes NULL rather than failing the whole post: the device is
  // already recorded on the document itself.
  return DEVICE_TYPES.has(upper) ? upper : null;
}
