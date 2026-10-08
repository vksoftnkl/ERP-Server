import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMenuRight, type MenuRight } from '../../../../common/posting/rights';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../../common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import {
  throwBadRequest,
  throwNotFound,
  throwUnprocessable,
} from 'src/common/utils/module-service.utils';
import { LoyaltyLedgerService } from '../../posting/loyalty-ledger.service';
import type { LoyaltyAdjustResult } from '../../posting/types/loyalty.types';
import type {
  LoyaltyMemberAdjustDto,
  LoyaltyMemberHistoryDto,
  LoyaltyMemberStatusDto,
} from './dto/loyalty-member-action.dto';

/**
 * The two write actions of the Loyalty Status screen (plan 2026-10-05 §7),
 * under their own URLs and not under /reports. Both are judged on menu 79.
 *
 * Every ledger movement goes through `LoyaltyLedgerService` — `adjust()` for
 * the screen's Adjust points, `drain()` for a forced close — because that
 * service's private writer is the only code allowed to insert the ledger
 * (test/sales/loyalty-single-writer.e2e-spec.ts). A status change writes the
 * member row and a `txn_status_log` step, and no ledger row.
 */
export const LOYALTY_STATUS_MENU_ID = 79;
const CODE_PREFIX = 'LST';

export const LOYALTY_MEMBER_ERROR = {
  NOT_FOUND: 'LOYALTY_MEMBER_NOT_FOUND',
  MERGED: 'LOYALTY_MEMBER_MERGED',
  NO_CHANGE: 'LOYALTY_MEMBER_NO_CHANGE',
  HAS_BALANCE: 'LOYALTY_MEMBER_HAS_BALANCE',
  REASON_REQUIRED: 'LOYALTY_MEMBER_REASON_REQUIRED',
  APPROVER_REQUIRED: 'LOYALTY_MEMBER_APPROVER_REQUIRED',
  YEAR_UNKNOWN: 'LOYALTY_MEMBER_YEAR_UNKNOWN',
  BRANCH_NOT_IN_COMPANY: 'LOYALTY_MEMBER_BRANCH_NOT_IN_COMPANY',
} as const;

export interface StatusChangeResult {
  memberId: string;
  fromStatus: string;
  toStatus: string;
  balance: number;
  /** The forced-close drain, when one was written. */
  drained: LoyaltyAdjustResult | null;
}

export interface HistoryStep {
  seqNo: number;
  event: string;
  fromStatus: string | null;
  toStatus: string;
  changedOn: Date;
  changedBy: string;
  changedByName: string | null;
  remarks: string | null;
}

interface MemberRow {
  lmb_comp_id: string;
  lmb_branch_id: string | null;
  lmb_cust_id: string;
  lmb_card_no: string | null;
  lmb_mobile: string | null;
  lmb_status: string;
  lmb_balance_points: Prisma.Decimal | null;
  lmb_is_deleted: boolean;
}

@Injectable()
export class LoyaltyMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly ledger: LoyaltyLedgerService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  §7.1 — Suspend / reactivate / close
  // ═════════════════════════════════════════════════════════════════════════

  async setStatus(dto: LoyaltyMemberStatusDto): Promise<StatusChangeResult> {
    await this.assertRight('edit', 'change a loyalty member’s status');
    if (dto.force) {
      await this.assertRight('delete', 'close a wallet that still holds points');
    }
    if (dto.status !== 'ACTIVE' && !dto.reason) {
      refuse(LOYALTY_MEMBER_ERROR.REASON_REQUIRED, 'reason', `${dto.status} needs a reason.`);
    }
    if (dto.branchId) {
      await this.assertBranch(dto.companyId, dto.branchId);
    }
    const userId = this.requestContext.getUserId();
    const actorName = await this.actorName(userId);

    return this.prisma.$transaction(async (tx) => {
      const m = await this.lockMember(tx, dto.companyId, dto.memberId);
      if (m.lmb_status === 'MERGED') {
        throwUnprocessable('Loyalty member is merged', [
          detail(LOYALTY_MEMBER_ERROR.MERGED, 'memberId', 'A merged wallet keeps its status.'),
        ]);
      }
      if (m.lmb_status === dto.status) {
        throwUnprocessable('No change', [
          detail(LOYALTY_MEMBER_ERROR.NO_CHANGE, 'status', `The member is already ${dto.status}.`),
        ]);
      }
      const branchId =
        dto.branchId ?? m.lmb_branch_id ?? (await this.fallbackBranch(tx, dto.companyId));
      const today = await this.today(tx);
      const accYear = await this.yearOf(tx, dto.companyId, today);

      let drained: LoyaltyAdjustResult | null = null;
      const balance = Number(m.lmb_balance_points ?? 0);
      if (dto.status === 'CLOSED' && balance !== 0) {
        // D6 — refuse; with force, zero the wallet first through the one writer.
        if (!dto.force) {
          throwUnprocessable('Loyalty member still holds points', [
            detail(
              LOYALTY_MEMBER_ERROR.HAS_BALANCE,
              'status',
              `The wallet holds ${balance} points. Send force (with approvedBy) to write them off and close.`,
            ),
          ]);
        }
        if (!dto.approvedBy) {
          refuse(
            LOYALTY_MEMBER_ERROR.APPROVER_REQUIRED,
            'approvedBy',
            'A forced close writes the points off and needs an approver.',
          );
        }
        drained = await this.ledger.drain(tx, {
          companyId: dto.companyId,
          branchId,
          memberId: dto.memberId,
          txnDate: today,
          accYear,
          reason: `Closed: ${dto.reason}`,
          approvedBy: dto.approvedBy,
          userId,
          deviceId: this.requestContext.getDeviceId(),
          createdBy: actorName,
        });
      }

      await tx.$executeRaw`
        UPDATE sales.loyalty_member
           SET lmb_status       = ${dto.status},
               lmb_block_reason = ${dto.status === 'ACTIVE' ? null : (dto.reason ?? null)},
               lmb_is_active    = ${dto.status === 'ACTIVE'},
               lmb_modified_on  = now(),
               lmb_modified_by  = ${actorName}
         WHERE lmb_id = ${dto.memberId}::uuid`;

      await appendTxnStatusLog(tx, {
        companyId: dto.companyId,
        branchId,
        accYear,
        srcModule: TxnStatusSrcModule.SALES,
        // ck_tsl_src_doc_type has no LOYALTY_MEMBER value; OTHER + the member id
        // is the key the screen's Ctrl+H reads back (history()).
        srcDocType: TxnStatusDocType.OTHER,
        srcDocId: dto.memberId,
        srcDocRefno: m.lmb_card_no ?? m.lmb_mobile ?? null,
        event:
          dto.status === 'CLOSED'
            ? TxnStatusEvent.CLOSED
            : dto.status === 'ACTIVE'
              ? TxnStatusEvent.REOPENED
              : TxnStatusEvent.STATUS_CHANGED,
        fromStatus: m.lmb_status,
        toStatus: dto.status,
        changedBy: userId ?? '',
        remarks: dto.reason ?? null,
        deviceId: this.requestContext.getDeviceId(),
      });

      return {
        memberId: dto.memberId,
        fromStatus: m.lmb_status,
        toStatus: dto.status,
        balance: drained ? drained.balance : balance,
        drained,
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §7.2 — Adjust points
  // ═════════════════════════════════════════════════════════════════════════

  async adjust(dto: LoyaltyMemberAdjustDto): Promise<LoyaltyAdjustResult> {
    await this.assertRight('edit', 'adjust loyalty points');
    if (!(dto.points !== 0 && Number.isFinite(dto.points))) {
      refuse('SALES_LOYALTY_CAP', 'points', 'points must be a non-zero number.');
    }
    await this.assertBranch(dto.companyId, dto.branchId);
    const userId = this.requestContext.getUserId();
    const actorName = await this.actorName(userId);

    return this.prisma.$transaction(async (tx) => {
      const txnDate = dto.txnDate ?? (await this.today(tx));
      const accYear = await this.yearOf(tx, dto.companyId, txnDate);
      return this.ledger.adjust(tx, {
        companyId: dto.companyId,
        branchId: dto.branchId,
        memberId: dto.memberId,
        points: dto.points,
        txnDate,
        accYear,
        reason: dto.reason,
        approvedBy: dto.approvedBy,
        expiresOn: dto.expiresOn ?? null,
        lscId: dto.lscId ?? null,
        userId,
        deviceId: this.requestContext.getDeviceId(),
        createdBy: actorName,
      });
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Ctrl+H — the status trail
  // ═════════════════════════════════════════════════════════════════════════

  async history(q: LoyaltyMemberHistoryDto): Promise<{ memberId: string; steps: HistoryStep[] }> {
    await this.assertRight('view', 'view the Loyalty Status');
    const [m] = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT true AS ok FROM sales.loyalty_member
       WHERE lmb_id = ${q.memberId}::uuid AND lmb_comp_id = ${q.companyId}::uuid
         AND lmb_is_deleted = false`;
    if (!m) {
      throwNotFound(
        'Loyalty member not found',
        'memberId',
        `No live member ${q.memberId} in this company`,
      );
    }
    const rows = await this.prisma.$queryRaw<
      {
        tsl_seq_no: number;
        tsl_event: string;
        tsl_from_status: string | null;
        tsl_to_status: string;
        tsl_changed_on: Date;
        tsl_changed_by: string;
        usr_display_name: string | null;
        tsl_remarks: string | null;
      }[]
    >`
      SELECT t.tsl_seq_no, t.tsl_event, t.tsl_from_status, t.tsl_to_status, t.tsl_changed_on,
             t.tsl_changed_by, u.usr_display_name, t.tsl_remarks
        FROM public.txn_status_log t
        LEFT JOIN public.user_master u ON u.usr_id = t.tsl_changed_by
       WHERE t.tsl_company_id  = ${q.companyId}::uuid
         AND t.tsl_src_doc_type = ${TxnStatusDocType.OTHER}
         AND t.tsl_src_doc_id   = ${q.memberId}::uuid
       ORDER BY t.tsl_changed_on, t.tsl_seq_no`;
    return {
      memberId: q.memberId,
      steps: rows.map((r) => ({
        seqNo: r.tsl_seq_no,
        event: r.tsl_event,
        fromStatus: r.tsl_from_status,
        toStatus: r.tsl_to_status,
        changedOn: r.tsl_changed_on,
        changedBy: r.tsl_changed_by,
        changedByName: r.usr_display_name,
        remarks: r.tsl_remarks,
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  helpers
  // ═════════════════════════════════════════════════════════════════════════

  private async assertRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: LOYALTY_STATUS_MENU_ID,
      right,
      codePrefix: CODE_PREFIX,
      action,
    });
  }

  private async lockMember(
    tx: Prisma.TransactionClient,
    companyId: string,
    memberId: string,
  ): Promise<MemberRow> {
    const rows = await tx.$queryRaw<MemberRow[]>`
      SELECT lmb_comp_id, lmb_branch_id, lmb_cust_id, lmb_card_no, lmb_mobile, lmb_status,
             lmb_balance_points, lmb_is_deleted
        FROM sales.loyalty_member
       WHERE lmb_id = ${memberId}::uuid
         FOR UPDATE`;
    const m = rows[0];
    if (!m || m.lmb_is_deleted || m.lmb_comp_id !== companyId) {
      throwNotFound(
        'Loyalty member not found',
        'memberId',
        `No live member ${memberId} in this company`,
      );
    }
    return m;
  }

  private async assertBranch(companyId: string, branchId: string): Promise<void> {
    const [br] = await this.prisma.$queryRaw<{ br_comp_id: string | null }[]>`
      SELECT br_comp_id FROM public.branch_master WHERE br_id = ${branchId}::uuid`;
    if (!br || br.br_comp_id !== companyId) {
      refuse(
        LOYALTY_MEMBER_ERROR.BRANCH_NOT_IN_COMPANY,
        'branchId',
        'This branch does not belong to the company.',
      );
    }
  }

  /** txn_status_log needs a branch; a wallet enrolled with none takes the session's, else the company's default. */
  private async fallbackBranch(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const session = this.requestContext.getBranchId();
    if (session) {
      return session;
    }
    const [br] = await tx.$queryRaw<{ br_id: string }[]>`
      SELECT br_id FROM public.branch_master
       WHERE br_comp_id = ${companyId}::uuid AND br_is_deleted = false
       ORDER BY br_is_default DESC, br_created_on
       LIMIT 1`;
    if (!br) {
      refuse(LOYALTY_MEMBER_ERROR.BRANCH_NOT_IN_COMPANY, 'branchId', 'The company has no branch.');
    }
    return br.br_id;
  }

  private async today(tx: Prisma.TransactionClient): Promise<string> {
    const [row] = await tx.$queryRaw<{ d: string }[]>`SELECT CURRENT_DATE::text AS d`;
    return row.d;
  }

  /** The fiscal year a date falls in — the ledger's and the status log's partition key. */
  private async yearOf(
    tx: Prisma.TransactionClient,
    companyId: string,
    date: string,
  ): Promise<string> {
    const [fy] = await tx.$queryRaw<{ fy_year_name: string }[]>`
      SELECT fy_year_name FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND ${date}::date BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_year_name DESC
       LIMIT 1`;
    if (!fy) {
      refuse(
        LOYALTY_MEMBER_ERROR.YEAR_UNKNOWN,
        'txnDate',
        `No fiscal year holds ${date} for this company.`,
      );
    }
    return fy.fy_year_name;
  }

  /** Text audit columns take the login name (sales convention); uuid columns keep the id. */
  private async actorName(userId: string | null): Promise<string> {
    if (!userId) {
      return 'SYSTEM';
    }
    const [u] = await this.prisma.$queryRaw<{ usr_login_name: string }[]>`
      SELECT usr_login_name FROM public.user_master WHERE usr_id = ${userId}::uuid`;
    return u?.usr_login_name ?? 'SYSTEM';
  }
}

function detail(
  code: string,
  field: string,
  message: string,
): { field: string; message: string; code: string } {
  return { field, message, code };
}

function refuse(code: string, field: string, message: string): never {
  throwBadRequest('Loyalty member request refused', [detail(code, field, message)]);
}
