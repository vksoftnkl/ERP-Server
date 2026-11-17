import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import {
  throwConflict,
  throwUnprocessable,
  type ModuleErrorDetail,
} from '../../common/utils/module-shared.utils';
import {
  BillLifecycleService,
  POST_TX_OPTIONS,
  type BillSavedAndPosted,
} from '../../modules/sales/bill/bill-lifecycle.service';
import { BillService } from '../../modules/sales/bill/bill.service';
import type { SaveBillDto } from '../../modules/sales/bill/dto/save-bill.dto';
import { MobileErrorCode } from '../common/mobile-error-codes';
import {
  assertMobileCompany,
  databaseToday,
  isClientUuidClash,
  lockMobileClientUuid,
  requireMobileAccYear,
  requireMobileBranch,
  requireMobileLogin,
  resolveMobileDevice,
  type MobileReadClient,
} from '../common/mobile-scope';
import { moneyText } from '../item/mobile-item.service';
import {
  CreateMobileBillDto,
  MOBILE_BILL_TYPE,
  MobileBillOptionsQueryDto,
} from './dto/mobile-bill.dto';
import type {
  MobileBillCreateResult,
  MobileBillGodown,
  MobileBillOptions,
} from './types/mobile-bill-api.types';

/** sale_bill.sb_device_type of a phone bill; maps to avh_device_type MOBILE on its voucher. */
export const MOBILE_BILL_DEVICE_TYPE = 'MOBILE';

/** The bill a client uuid names (or a bill just posted), as the answer reads it. */
interface StoredBill {
  sbId: string;
  sbCompanyId: string;
  sbBranchId: string;
  sbAccYear: string;
  sbBillRefno: string;
  sbUsrRefno: string | null;
  sbBillDate: string;
  sbBillAmt: Prisma.Decimal | string | null;
  sbStatus: string;
  sbIsDeleted: boolean;
  sbCustId: string | null;
}

/** The bill's date as the fiscal year is read for it: YYYY-MM-DD, no time zone shift. */
export function billDayOf(sbBillDate: string | undefined, today: string): string {
  return sbBillDate ? sbBillDate.slice(0, 10) : today;
}

/**
 * Bill upload from the phone. The bill is the desktop's: it is saved AND
 * posted by BillLifecycleService.saveAndPostInTx (the one-call save-and-post of
 * notes 106: the Sales Bill number, the lines, stock, the voucher, the
 * receivable, the status trail and revision, the menu-12 Post right), inside a
 * transaction of ours that also holds the resend check and writes
 * sb_client_uuid. A refusal rolls all of it back: nothing saved, no number
 * burnt, and the refusal is exactly /bills/post's.
 */
@Injectable()
export class MobileBillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
    private readonly bills: BillService,
    private readonly lifecycle: BillLifecycleService,
  ) {}

  /** The branch the phone's bills land in, and the godowns a line may draw on. */
  async options(query: MobileBillOptionsQueryDto): Promise<MobileBillOptions> {
    await assertMobileCompany(this.prisma, query.companyId);
    const device = await resolveMobileDevice(this.prisma, query.deviceUid);
    const branchId = await requireMobileBranch(this.prisma, query.companyId, device.devBranchId);
    return {
      companyId: query.companyId,
      branchId,
      godowns: await this.godownsOf(this.prisma, branchId),
    };
  }

  async create(dto: CreateMobileBillDto): Promise<MobileBillCreateResult> {
    const userId = requireMobileLogin(this.requestContextService.getUserId());
    // Set inside the transaction, read after its commit: the GST queue runs
    // only for a bill that really posted.
    const posted: { done: BillSavedAndPosted | null } = { done: null };
    try {
      const answer = await this.prisma.$transaction(async (tx) => {
        // Two copies of one resend in flight: the second waits here, then
        // finds the first's bill below.
        await lockMobileClientUuid(tx, 'bill', dto.sbCompanyId, dto.sbClientUuid);
        const stored = await this.findBill(tx, {
          companyId: dto.sbCompanyId,
          clientUuid: dto.sbClientUuid,
        });
        if (stored) {
          return this.resendAnswer(stored, dto);
        }
        await assertMobileCompany(tx, dto.sbCompanyId, 'sbCompanyId');
        const device = await resolveMobileDevice(tx, dto.deviceUid);
        const branchId = await requireMobileBranch(tx, dto.sbCompanyId, device.devBranchId);
        const billDay = billDayOf(dto.sbBillDate, await databaseToday(tx));
        const accYear = await requireMobileAccYear(tx, dto.sbCompanyId, billDay, 'sbBillDate');
        await this.assertLineGodowns(tx, branchId, dto.items);
        posted.done = await this.lifecycle.saveAndPostInTx(
          tx,
          this.toSaveDto(dto, {
            sbBranchId: branchId,
            sbAccYear: accYear,
            sbDeviceId: device.devId,
            sbUserId: userId,
            sbBillDate: billDay,
          }),
        );
        const { sbId, sbAccYear } = posted.done.keys;
        // The uploaded bill's own row only (never its voucher): on create,
        // after the save, so no desktop re-save or amend can blank it.
        await tx.$executeRaw`
          UPDATE sales.sale_bill
             SET sb_client_uuid = ${dto.sbClientUuid}::uuid
           WHERE sb_id = ${sbId}::uuid AND sb_acc_year = ${sbAccYear}::char(9)`;
        const saved = await this.findBill(tx, { sbId, accYear: sbAccYear });
        return this.toAnswer(saved!, false);
      }, POST_TX_OPTIONS);
      if (posted.done) {
        this.lifecycle.afterSaveAndPost(posted.done);
      }
      return answer;
    } catch (error: unknown) {
      // The lock makes this a backstop only (ux_sb_client_uuid): another
      // writer won the race, so its bill is the answer.
      if (isClientUuidClash(error)) {
        const stored = await this.findBill(this.prisma, {
          companyId: dto.sbCompanyId,
          clientUuid: dto.sbClientUuid,
        });
        if (stored) {
          return this.resendAnswer(stored, dto);
        }
      }
      this.bills.throwIfDuplicate(error);
      throw error;
    }
  }

  /** The desktop one-call payload: the phone's fields, the server's scope, nothing mobile-only. */
  private toSaveDto(
    dto: CreateMobileBillDto,
    scope: Pick<SaveBillDto, 'sbBranchId' | 'sbAccYear' | 'sbDeviceId' | 'sbUserId' | 'sbBillDate'>,
  ): SaveBillDto {
    const { sbClientUuid: _clientUuid, deviceUid: _deviceUid, ...bill } = dto;
    void _clientUuid;
    void _deviceUid;
    return {
      ...bill,
      ...scope,
      sbDeviceType: MOBILE_BILL_DEVICE_TYPE,
      sbBillType: MOBILE_BILL_TYPE,
      post: true,
    };
  }

  /**
   * Every line draws on a live, active godown of the bill's branch. The
   * desktop save takes any uuid there (sbi_godown_id has no FK), so a phone
   * holding a stale godown list would post stock out of another branch's
   * godown, or out of one that is gone. 422 MOBILE_GODOWN_INVALID per line.
   */
  private async assertLineGodowns(
    client: MobileReadClient,
    branchId: string,
    items: readonly { sbiGodownId: string }[],
  ): Promise<void> {
    const ids = [...new Set(items.map((item) => item.sbiGodownId))];
    const rows = await client.$queryRaw<{ id: string }[]>`
      SELECT g.gdl_id::text AS id
        FROM inventory.godown_locations g
       WHERE g.gdl_id = ANY(${ids}::uuid[])
         AND g.gdl_branch_id = ${branchId}::uuid
         AND g.gdl_is_deleted = false
         AND g.gdl_is_active = true`;
    const usable = new Set(rows.map((row) => row.id));
    const errors: ModuleErrorDetail[] = [];
    items.forEach((item, index) => {
      if (!usable.has(item.sbiGodownId)) {
        errors.push({
          field: `items.${index}.sbiGodownId`,
          message: `Line ${index + 1}: godown ${item.sbiGodownId} is not an active godown of this bill's branch.`,
          code: MobileErrorCode.GODOWN_INVALID,
        });
      }
    });
    if (errors.length > 0) {
      throwUnprocessable<ModuleErrorDetail>('Godown not usable', errors);
    }
  }

  /** The branch's live, active godowns: the branch default first, then the master order. */
  private async godownsOf(client: MobileReadClient, branchId: string): Promise<MobileBillGodown[]> {
    return client.$queryRaw<MobileBillGodown[]>`
      SELECT g.gdl_id::text AS "godownId", g.gdl_name AS name,
             NULLIF(btrim(g.gdl_short), '') AS "shortName",
             (g.gdl_id = b.br_default_godown_id) IS TRUE AS "isDefault"
        FROM inventory.godown_locations g
        JOIN public.branch_master b ON b.br_id = g.gdl_branch_id
       WHERE g.gdl_branch_id = ${branchId}::uuid
         AND g.gdl_is_deleted = false
         AND g.gdl_is_active = true
       ORDER BY 4 DESC, g.gdl_sort, lower(g.gdl_name), g.gdl_id`;
  }

  /**
   * The bill a (company, client uuid) names in any year and any state, deleted
   * and cancelled ones included; or one bill by its keys.
   */
  private async findBill(
    client: MobileReadClient,
    key: { companyId: string; clientUuid: string } | { sbId: string; accYear: string },
  ): Promise<StoredBill | null> {
    const where =
      'clientUuid' in key
        ? Prisma.sql`sb.sb_company_id = ${key.companyId}::uuid
                 AND sb.sb_client_uuid = ${key.clientUuid}::uuid`
        : Prisma.sql`sb.sb_id = ${key.sbId}::uuid AND sb.sb_acc_year = ${key.accYear}::char(9)`;
    const [row] = await client.$queryRaw<StoredBill[]>`
      SELECT sb.sb_id::text AS "sbId", sb.sb_company_id::text AS "sbCompanyId",
             sb.sb_branch_id::text AS "sbBranchId", btrim(sb.sb_acc_year::text) AS "sbAccYear",
             sb.sb_bill_refno AS "sbBillRefno", sb.sb_usr_refno AS "sbUsrRefno",
             sb.sb_bill_date::text AS "sbBillDate", sb.sb_bill_amt AS "sbBillAmt",
             sb.sb_status AS "sbStatus", sb.sb_is_deleted AS "sbIsDeleted",
             sb.sb_cust_id::text AS "sbCustId"
        FROM sales.sale_bill sb
       WHERE ${where}
       ORDER BY sb.sb_created_on
       LIMIT 1`;
    return row ?? null;
  }

  /**
   * A resend: the bill already saved, as it stands now. The same uuid on
   * another customer's bill is a phone bug, not a lost answer: 409.
   */
  private resendAnswer(stored: StoredBill, dto: CreateMobileBillDto): MobileBillCreateResult {
    if ((stored.sbCustId ?? null) !== (dto.sbCustId ?? null)) {
      throwConflict<ModuleErrorDetail>('Bill id already used', [
        {
          field: 'sbClientUuid',
          message: `sbClientUuid ${dto.sbClientUuid} already names bill ${stored.sbBillRefno} of another customer.`,
          code: MobileErrorCode.CLIENT_UUID_REUSED,
        },
      ]);
    }
    return this.toAnswer(stored, true);
  }

  private toAnswer(stored: StoredBill, duplicate: boolean): MobileBillCreateResult {
    return {
      sbId: stored.sbId,
      sbCompanyId: stored.sbCompanyId,
      sbBranchId: stored.sbBranchId,
      sbAccYear: stored.sbAccYear,
      sbBillRefno: stored.sbBillRefno,
      sbUsrRefno: stored.sbUsrRefno,
      sbBillDate: stored.sbBillDate.slice(0, 10),
      sbBillAmt: moneyText(stored.sbBillAmt ?? 0) ?? '0.00',
      sbStatus: stored.sbStatus,
      duplicate,
      sbIsDeleted: stored.sbIsDeleted,
    };
  }
}
