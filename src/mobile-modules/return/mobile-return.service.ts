import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { loadRights } from '../../common/posting/rights';
import {
  throwConflict,
  throwUnprocessable,
  type ModuleErrorDetail,
} from '../../common/utils/module-shared.utils';
import { SalesContextService } from '../../modules/sales/posting/sales-context.service';
import { SALES_MENU_ID } from '../../modules/sales/posting/sales-doc.utils';
import { throwSalesLocked, throwSalesRefused } from '../../modules/sales/posting/sales.errors';
import { SALES_ERROR_CODES } from '../../modules/sales/posting/types/posting.types';
import type { DocKeys } from '../../modules/sales/posting/sales-doc-store';
import {
  SaleReturnBillReader,
  type BillHeaderFacts,
} from '../../modules/sales/sale-return/sale-return-bill-reader';
import { n } from '../../modules/sales/sale-return/sale-return-money';
import {
  SaleReturnService,
  type SaleReturnPostFire,
  type SaleReturnRefusedGate,
} from '../../modules/sales/sale-return/sale-return.service';
import type { SaveSaleReturnDto } from '../../modules/sales/sale-return/dto/save-sale-return.dto';
import { MobileErrorCode } from '../common/mobile-error-codes';
import { requireMobileLoginRow } from '../common/mobile-login';
import {
  assertMobileCompany,
  databaseToday,
  isClientUuidClash,
  lockMobileClientUuid,
  requireMobileAccYear,
  requireMobileBranch,
  requireMobileBranchOfCompany,
  requireMobileLogin,
  resolveMobileDevice,
  type MobileReadClient,
} from '../common/mobile-scope';
import {
  CreateMobileReturnDto,
  DeleteMobileReturnDto,
  MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE,
  MobileReturnBillLinesQueryDto,
  MobileReturnOptionsQueryDto,
} from './dto/mobile-return.dto';
import {
  billDaysOf,
  billReturnStatus,
  outcomeOf,
  phoneApprovalStatus,
  phoneCondition,
  phoneSettleDefault,
  refusalsOf,
  replanAdjust,
  type PhoneAdjustRow,
} from './mobile-return-plan';
import type {
  MobileReturnAdjusted,
  MobileReturnApproval,
  MobileReturnBill,
  MobileReturnBillLinesPayload,
  MobileReturnCreateResult,
  MobileReturnDeleteResult,
  MobileReturnGodown,
  MobileReturnLineResult,
  MobileReturnNote,
  MobileReturnOptions,
  MobileReturnOutcome,
  MobileReturnReason,
  MobileReturnReplanned,
} from './types/mobile-return-api.types';

/** sale_return.sr_device_type of a phone return. */
export const MOBILE_RETURN_DEVICE_TYPE = 'MOBILE';

/** Long enough for the save, the post and its locks (a desktop post allows 60 s). */
const RETURN_TX_OPTIONS = { timeout: 120_000, maxWait: 10_000 } as const;

/** How many bills /bill-lines reads at once. */
const BILL_READ_BATCH = 10;

const ZERO = new Prisma.Decimal(0);
const money = (v: Prisma.Decimal.Value | null | undefined): string =>
  new Prisma.Decimal(v ?? 0).toFixed(2);
const perc = (v: Prisma.Decimal): string => v.toFixed(3);

/** A uuid whose version nibble is 7: the desktop's /sale-returns/get only opens those. */
const isUuidV7 = (id: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-7/i.test(id);

/** The return a client uuid names (or one just saved), as the answer reads it. */
interface StoredReturn {
  srId: string;
  srAccYear: string;
  srCompanyId: string;
  srBranchId: string;
  srCustId: string;
  srClientUuid: string | null;
  srReturnRefno: string | null;
  srMobileRefno: string | null;
  srStatus: string;
  srIsDeleted: boolean;
  srReturnDate: string;
  srReturnAmt: Prisma.Decimal | null;
  srTaxAmt: Prisma.Decimal | null;
  srRoundOff: Prisma.Decimal | null;
  srCashDisc: Prisma.Decimal | null;
  srSettleMode: string | null;
  srCreditAmt: Prisma.Decimal | null;
  srSettleStatus: string | null;
}

/** What the answer says beyond the stored row. */
interface AnswerExtras {
  duplicate: boolean;
  status: MobileReturnOutcome;
  held?: MobileReturnNote | null;
  refusal?: MobileReturnNote | null;
  refusals?: MobileReturnNote[];
  warnings?: MobileReturnNote[];
  replanned?: MobileReturnReplanned[];
}

/** The customer of a phone return, as the save needs it. */
interface CustomerFacts {
  cusId: string;
  cusName: string;
  priceLevel: number | null;
}

/**
 * Sale returns from the phone (VKSMAN canvas page 6b,
 * plan-mobile-sales-return-2026-11-20). The return is the desktop's: it is
 * saved by SaleReturnService.saveInTx (the money worked out by the server,
 * D45; the SRT number of the phone's own device, D16; the revision) and
 * posted by postInTx (stock, the SRt voucher, the credit note, the
 * settlement, the approval gate, the menu-13 Post right), inside a transaction
 * of ours that also holds the resend check and writes sr_client_uuid /
 * sr_mobile_refno. The post runs behind a savepoint: a refusal rolls back the
 * post only, and the DRAFT stays HELD (the office's to clear) or SENT_BACK
 * (the phone's to fix and send again with the same uuid).
 */
@Injectable()
export class MobileReturnService {
  private readonly reader = new SaleReturnBillReader();

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
    private readonly returns: SaleReturnService,
    private readonly salesContext: SalesContextService,
  ) {}

  // ── options ─────────────────────────────────────────────────────────────

  /** The branch, the reasons, its godowns, the return settings and (with a token) the login's rights. */
  async options(query: MobileReturnOptionsQueryDto): Promise<MobileReturnOptions> {
    await assertMobileCompany(this.prisma, query.companyId);
    const device = await resolveMobileDevice(this.prisma, query.deviceUid);
    const branchId = await this.branchOf(this.prisma, query.companyId, query.branchId, device);
    const userId = this.requestContextService.getUserId();
    const [reasons, godowns, settings, rights] = await Promise.all([
      this.reasonsOf(this.prisma, query.companyId),
      this.godownsOf(this.prisma, branchId),
      this.settingsOf(query.companyId, branchId, device.devId),
      userId ? loadRights(this.prisma, userId, SALES_MENU_ID.SALE_RETURN) : Promise.resolve(null),
    ]);
    return {
      companyId: query.companyId,
      branchId,
      reasons,
      godowns,
      settings,
      rights: rights ? { create: rights.create, post: rights.post } : null,
    };
  }

  /** The return settings the phone needs, as the post reads them for this branch and device. */
  private async settingsOf(companyId: string, branchId: string, deviceId: string) {
    const [settings, values] = await Promise.all([
      this.salesContext.settings(companyId, branchId, deviceId),
      this.salesContext.values(companyId, branchId, deviceId, [
        'sales.return_settle_default',
        'sales.return_expired_lot_days',
      ]),
    ]);
    const lotDays = Number(values['sales.return_expired_lot_days'] ?? 0);
    return {
      returnWindowDays: settings.returnWindowDays,
      freeReturnAllowed: settings.freeReturnAllowed,
      settleDefault: phoneSettleDefault(values['sales.return_settle_default']),
      expiredLotDays: Number.isFinite(lotDays) && lotDays > 0 ? Math.trunc(lotDays) : null,
      billDays: billDaysOf(settings.returnWindowDays),
    };
  }

  /**
   * The SALE_RETURN reasons the company sees, as the desktop's dropdown 78
   * lists them: active, shared or the company's own, a company row hiding the
   * shared row of its code. isClaim = the code ends in _SHOP (the seeded
   * SR_EXPIRED_SHOP / SR_DAMAGED_SHOP and any company row overriding them).
   */
  private async reasonsOf(
    client: MobileReadClient,
    companyId: string,
  ): Promise<MobileReturnReason[]> {
    const rows = await client.$queryRaw<
      {
        reasonId: string;
        code: string;
        name: string;
        condition: string | null;
        refundCharges: boolean | null;
        sortOrder: number | null;
      }[]
    >`
      SELECT r.srm_id::text AS "reasonId", r.srm_code AS code, r.srm_name AS name,
             r.srm_default_condition AS condition, r.srm_refund_charges AS "refundCharges",
             r.srm_sort_order AS "sortOrder"
        FROM stock.stock_reason_master r
       WHERE r.srm_is_active = true
         AND r.srm_is_deleted = false
         AND r.srm_allowed_txn_types && ARRAY['SALE_RETURN']::text[]
         AND (r.srm_company_id IS NULL OR r.srm_company_id = ${companyId}::uuid)
         AND NOT (r.srm_company_id IS NULL AND EXISTS (
               SELECT 1 FROM stock.stock_reason_master c
                WHERE c.srm_company_id = ${companyId}::uuid
                  AND c.srm_code = r.srm_code
                  AND c.srm_is_deleted = false))
       ORDER BY r.srm_sort_order, r.srm_name`;
    return rows.map((r) => ({
      reasonId: r.reasonId,
      code: r.code,
      name: r.name,
      defaultCondition: phoneCondition(r.condition),
      refundCharges: r.refundCharges,
      isClaim: /_SHOP$/i.test(r.code.trim()),
      sortOrder: r.sortOrder ?? 0,
    }));
  }

  /** The branch's live, active godowns: the branch default first, then the master order. */
  private async godownsOf(
    client: MobileReadClient,
    branchId: string,
  ): Promise<MobileReturnGodown[]> {
    return client.$queryRaw<MobileReturnGodown[]>`
      SELECT g.gdl_id::text AS "godownId", g.gdl_name AS name,
             (g.gdl_id = b.br_default_godown_id) IS TRUE AS "isDefault"
        FROM inventory.godown_locations g
        JOIN public.branch_master b ON b.br_id = g.gdl_branch_id
       WHERE g.gdl_branch_id = ${branchId}::uuid
         AND g.gdl_is_deleted = false
         AND g.gdl_is_active = true
       ORDER BY 3 DESC, g.gdl_sort, lower(g.gdl_name), g.gdl_id`;
  }

  /** The Switch company branch when sent (422 MOBILE_BRANCH_NOT_OF_COMPANY), else the device rule. */
  private async branchOf(
    client: MobileReadClient,
    companyId: string,
    branchId: string | undefined,
    device: { devBranchId: string | null },
    field = 'branchId',
  ): Promise<string> {
    return branchId
      ? requireMobileBranchOfCompany(client, companyId, branchId, field)
      : requireMobileBranch(client, companyId, device.devBranchId);
  }

  // ── bill-lines ──────────────────────────────────────────────────────────

  /**
   * Posted, live sale bills of the branch dated `since` or later (default:
   * today less billDays), every customer of the company, newest first, paged
   * by bill. Each line's figures are the desktop /sale-returns/bill-lines' (the
   * same reader: billed base qty, what POSTED returns took, what is left, what
   * DRAFT returns hold), plus ratePreTaxBase.
   */
  async billLines(query: MobileReturnBillLinesQueryDto): Promise<MobileReturnBillLinesPayload> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE;
    await assertMobileCompany(this.prisma, query.companyId);
    const device = await resolveMobileDevice(this.prisma, query.deviceUid);
    const branchId = await this.branchOf(this.prisma, query.companyId, query.branchId, device);
    const settings = await this.salesContext.settings(query.companyId, branchId, device.devId);
    const billDays = billDaysOf(settings.returnWindowDays);
    const [clock] = await this.prisma.$queryRaw<{ asOf: Date; since: string }[]>`
      SELECT clock_timestamp() AS "asOf",
             (CURRENT_DATE - ${billDays}::int)::text AS since`;
    const since = query.since ? query.since.slice(0, 10) : clock.since;
    const rows = await this.prisma.$queryRaw<{ sbId: string; accYear: string; total: number }[]>`
      SELECT sb.sb_id::text AS "sbId", btrim(sb.sb_acc_year::text) AS "accYear",
             count(*) OVER ()::int AS total
        FROM sales.sale_bill sb
       WHERE sb.sb_company_id = ${query.companyId}::uuid
         AND sb.sb_branch_id = ${branchId}::uuid
         AND sb.sb_status = 'POSTED'
         AND sb.sb_is_deleted = false
         AND sb.sb_bill_date >= ${since}::date
         AND EXISTS (SELECT 1 FROM sales.customers c
                      WHERE c.cus_id = sb.sb_cust_id AND c.cus_is_deleted = false)
       ORDER BY sb.sb_bill_date DESC, sb.sb_created_on DESC, sb.sb_id DESC
       LIMIT ${pageSize}::int OFFSET ${(page - 1) * pageSize}::int`;
    const total =
      rows[0]?.total ?? (page > 1 ? await this.countBills(query.companyId, branchId, since) : 0);
    const bills: MobileReturnBill[] = [];
    for (let i = 0; i < rows.length; i += BILL_READ_BATCH) {
      const batch = await Promise.all(
        rows.slice(i, i + BILL_READ_BATCH).map((r) => this.billOf(r.sbId, r.accYear)),
      );
      bills.push(...batch.filter((b): b is MobileReturnBill => b !== null));
    }
    return {
      asOf: clock.asOf.toISOString(),
      billDays,
      since,
      page,
      pageSize,
      total,
      hasMore: (page - 1) * pageSize + rows.length < total,
      companyId: query.companyId,
      branchId,
      bills,
    };
  }

  private async countBills(companyId: string, branchId: string, since: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
        FROM sales.sale_bill sb
       WHERE sb.sb_company_id = ${companyId}::uuid
         AND sb.sb_branch_id = ${branchId}::uuid
         AND sb.sb_status = 'POSTED'
         AND sb.sb_is_deleted = false
         AND sb.sb_bill_date >= ${since}::date
         AND EXISTS (SELECT 1 FROM sales.customers c
                      WHERE c.cus_id = sb.sb_cust_id AND c.cus_is_deleted = false)`;
    return row?.total ?? 0;
  }

  /** One bill and its lines, read as /sale-returns/bill-lines reads them (no return excluded). */
  private async billOf(sbId: string, accYear: string): Promise<MobileReturnBill | null> {
    const c = this.prisma as unknown as Prisma.TransactionClient;
    const bill = await this.reader.billHeader(c, sbId, accYear);
    if (!bill) {
      return null;
    }
    const [lines, prior, drafts, due] = await Promise.all([
      this.reader.billLines(c, bill),
      this.reader.priorBack(c, bill, null),
      this.reader.onDrafts(c, bill, null),
      this.reader.billDue(c, bill),
    ]);
    return {
      sbId: bill.sbId,
      accYear: bill.accYear,
      refno: bill.refno,
      date: bill.date,
      custId: bill.custId,
      branchId: bill.branchId,
      billAmount: money(bill.billAmt),
      due: money(due),
      payMode: bill.payMode,
      returnedAmt: money(bill.returnedAmt),
      returnStatus: billReturnStatus(bill.returnStatus),
      lines: lines.map((l) => {
        const billBase = l.qty.times(l.factor);
        const back = prior.get(l.billItemId)?.base ?? ZERO;
        const left = Prisma.Decimal.max(ZERO, billBase.minus(back));
        return {
          billItemId: l.billItemId,
          accYear: l.accYear,
          lineNo: l.lineNo,
          itemId: l.itemId,
          itemName: l.itemName,
          itemUnitId: l.itemUnitId,
          unitName: l.unitName,
          toBaseFactor: n(l.factor),
          billQty: n(l.qty),
          billQtyBase: n(billBase),
          returnedQtyBase: n(back),
          qtyLeftBase: n(left),
          onOtherDraftsBase: n(drafts.get(l.billItemId)?.base ?? ZERO),
          // What a return line gets back per base unit before tax: the line's
          // taxable value (after every discount) over its billed base qty.
          ratePreTaxBase: billBase.gt(0)
            ? l.parts.taxableAmt
                .dividedBy(billBase)
                .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
                .toFixed(4)
            : null,
          rate: l.perUnit.rate ? money(l.perUnit.rate) : null,
          taxPerc: perc(l.percent.taxPerc),
          cgstPerc: perc(l.percent.cgstPerc),
          sgstPerc: perc(l.percent.sgstPerc),
          igstPerc: perc(l.percent.igstPerc),
          lotId: l.copy.lotId,
          batchNo: l.copy.batchNo ?? l.lotBatchNo,
          expiryDate: l.copy.expiryDate ?? l.lotExpiry,
          godownId: l.godownId,
          isFree: l.copy.isFree,
          allowReturn: l.allowReturn,
        };
      }),
    };
  }

  // ── create ──────────────────────────────────────────────────────────────

  async create(dto: CreateMobileReturnDto): Promise<MobileReturnCreateResult> {
    const userId = requireMobileLogin(this.requestContextService.getUserId());
    // Set inside the transaction, read after its commit: the GST queue runs
    // only for a return that really posted.
    const after: { fire: SaleReturnPostFire } = { fire: null };
    try {
      const answer = await this.prisma.$transaction(async (tx) => {
        // Two copies of one resend in flight: the second waits here, then
        // finds the first's return below.
        await lockMobileClientUuid(tx, 'return', dto.srCompanyId, dto.srClientUuid);
        const stored = await this.findReturn(tx, {
          companyId: dto.srCompanyId,
          clientUuid: dto.srClientUuid,
        });
        if (stored) {
          this.assertResendable(stored, dto);
          if (stored.srStatus !== 'DRAFT') {
            // POSTED or CANCELLED: answered as it stands, nothing written.
            return this.answerFrom(tx, stored, { duplicate: true, status: 'POSTED' });
          }
        }
        const saved = await this.saveDraft(tx, dto, userId, stored);
        return this.postSaved(tx, dto, userId, saved, after);
      }, RETURN_TX_OPTIONS);
      this.returns.afterPostCommit(after.fire);
      return answer;
    } catch (error: unknown) {
      // The lock makes this a backstop only (ux_sr_client_uuid): another
      // writer won the race, so its return is the answer.
      if (isClientUuidClash(error)) {
        const stored = await this.findReturn(this.prisma, {
          companyId: dto.srCompanyId,
          clientUuid: dto.srClientUuid,
        });
        if (stored) {
          this.assertResendable(stored, dto);
          return this.answerFrom(this.prisma, stored, {
            duplicate: true,
            status: stored.srStatus === 'DRAFT' ? 'SENT_BACK' : 'POSTED',
          });
        }
      }
      throw error;
    }
  }

  /**
   * A resend names the same return: the same customer (409
   * MOBILE_CLIENT_UUID_REUSED otherwise, a phone bug) and one the office has
   * not deleted (409 MOBILE_RETURN_DELETED: start a new return).
   */
  private assertResendable(stored: StoredReturn, dto: CreateMobileReturnDto): void {
    if (stored.srCustId !== dto.srCustId) {
      throwConflict<ModuleErrorDetail>('Return id already used', [
        {
          field: 'srClientUuid',
          message: `srClientUuid ${dto.srClientUuid} already names return ${stored.srReturnRefno ?? stored.srId} of another customer.`,
          code: MobileErrorCode.CLIENT_UUID_REUSED,
        },
      ]);
    }
    if (stored.srIsDeleted) {
      throwConflict<ModuleErrorDetail>('Return deleted', [
        {
          field: 'srClientUuid',
          message: `Return ${stored.srReturnRefno ?? stored.srId} was deleted in VK Nex: make a new return to send it again.`,
          code: MobileErrorCode.RETURN_DELETED,
        },
      ]);
    }
  }

  /**
   * The DRAFT, saved through the desktop (a new one, or the phone's own DRAFT
   * again with this body), and sr_client_uuid / sr_mobile_refno stamped. A
   * refusal here saves nothing and is a normal error answer. A DRAFT that
   * waits on an approval request (D77) is not re-saved: it is frozen until
   * the office decides, and the post below is simply tried again.
   */
  private async saveDraft(
    tx: Prisma.TransactionClient,
    dto: CreateMobileReturnDto,
    userId: string,
    stored: StoredReturn | null,
  ): Promise<DocKeys> {
    await assertMobileCompany(tx, dto.srCompanyId, 'srCompanyId');
    const device = await resolveMobileDevice(tx, dto.deviceUid);
    const branchId = stored
      ? stored.srBranchId
      : await this.branchOf(tx, dto.srCompanyId, dto.srBranchId, device, 'srBranchId');
    const today = await databaseToday(tx);
    let returnDay = dto.srReturnDate ? dto.srReturnDate.slice(0, 10) : today;
    const yearOfDay = await requireMobileAccYear(tx, dto.srCompanyId, returnDay, 'srReturnDate');
    // A saved DRAFT keeps its keys: a resend dated in another year keeps the saved date.
    if (stored && yearOfDay !== stored.srAccYear) {
      returnDay = stored.srReturnDate;
    }
    const accYear = stored ? stored.srAccYear : yearOfDay;
    if (stored && (await this.hasPendingApproval(tx, stored.srId))) {
      return { id: stored.srId, companyId: stored.srCompanyId, branchId, accYear };
    }
    const login = await requireMobileLoginRow(tx, userId);
    const customer = await this.requireCustomer(tx, dto.srCustId);
    await this.assertReason(tx, dto.srCompanyId, dto.srReasonId);
    const bill = await this.billOfUpload(tx, dto);
    const godowns = await this.lineGodowns(tx, branchId, dto, bill);
    const salesmen = bill
      ? bill.salesmanIds
      : await this.loginSalesman(tx, login.employeeId, dto.srCompanyId);
    const save: SaveSaleReturnDto = {
      ...(stored
        ? { srId: stored.srId }
        : isUuidV7(dto.srClientUuid)
          ? { srId: dto.srClientUuid }
          : {}),
      srCompanyId: dto.srCompanyId,
      srBranchId: branchId,
      srAccYear: accYear,
      srCounterId: device.devId,
      srDeviceType: MOBILE_RETURN_DEVICE_TYPE,
      srDeviceId: device.devId,
      srUserId: userId,
      srCustId: customer.cusId,
      srCustName: customer.cusName,
      srIsAgainstBill: bill !== null,
      srBillId: bill?.sbId ?? null,
      srBillAccYear: bill?.accYear ?? null,
      srReasonId: dto.srReasonId,
      srSettleMode: dto.srSettleMode,
      srReturnKind: 'RETURN',
      srReturnDate: returnDay,
      srUsrRefno: dto.srUsrRefno ?? null,
      srUsrRefdate: dto.srUsrRefdate ?? null,
      srRemarks: dto.srRemarks ?? null,
      srSalesmanId: salesmen,
      // A billed return takes the bill's price level (fillFromBill); a no-bill
      // one is priced at the customer's (D56 step 3).
      ...(bill ? {} : { srPriceLevel: customer.priceLevel }),
      items: dto.lines.map((line, index) => ({
        sriLineNo: line.sriLineNo,
        sriSplitNo: line.sriSplitNo ?? 1,
        sriBillItemId: bill ? (line.sriBillItemId ?? null) : null,
        sriBillAccYear: bill ? line.sriBillAccYear?.trim() || bill.accYear : null,
        sriItemId: line.sriItemId,
        sriItemUnitId: line.sriItemUnitId,
        sriGodownId: godowns[index],
        sriReturnQty: line.sriReturnQty,
        sriFreeQty: 0,
        sriCondition: line.sriCondition,
        sriRemarks: line.sriRemarks ?? null,
        ...(bill
          ? {}
          : { sriBatchNo: line.sriBatchNo ?? null, sriExpiryDate: line.sriExpiryDate ?? null }),
      })),
    };
    const saved = await this.returns.saveInTx(tx, save, { skipSaveRight: true, origin: 'PHONE' });
    // The uploaded return's own row: the phone's id and number.
    await tx.$executeRaw`
      UPDATE sales.sale_return
         SET sr_client_uuid = ${dto.srClientUuid}::uuid,
             sr_mobile_refno = ${dto.srMobileRefno}
       WHERE sr_id = ${saved.id}::uuid AND sr_acc_year = ${saved.accYear}::char(9)`;
    return saved;
  }

  /**
   * D7 — the post, at once, behind a savepoint: POSTED, or the post rolled
   * back and the DRAFT kept, HELD (only the office can clear it; an approval
   * the gate asks for is filed for its inbox) or SENT_BACK (the phone fixes it
   * and sends the same uuid again).
   */
  private async postSaved(
    tx: Prisma.TransactionClient,
    dto: CreateMobileReturnDto,
    userId: string,
    keys: DocKeys,
    after: { fire: SaleReturnPostFire },
  ): Promise<MobileReturnCreateResult> {
    const replanned: MobileReturnReplanned[] = [];
    const warnings: MobileReturnNote[] = [];
    const gates: SaleReturnRefusedGate[] = [];
    const rows: PhoneAdjustRow[] | null = dto.adjustments
      ? dto.adjustments.map((a) => ({
          billId: a.billId,
          billAccYear: a.billAccYear,
          amount: new Prisma.Decimal(String(a.amount)),
        }))
      : null;
    await tx.$executeRaw`SAVEPOINT mobile_return_post`;
    try {
      after.fire = await this.returns.postInTx(
        tx,
        {
          srId: keys.id,
          srCompanyId: keys.companyId,
          srBranchId: keys.branchId,
          srAccYear: keys.accYear,
        },
        {
          replanAdjust: rows
            ? ({ bills, adjustable }) => {
                const plan = replanAdjust({ rows, bills, adjustable });
                replanned.splice(0, replanned.length, ...plan.replanned);
                return plan.asks;
              }
            : null,
          onWarnings: (notes) =>
            warnings.push(
              ...notes.map((w) => ({
                code: w.code,
                message: w.message,
                field: w.field ?? null,
                line: w.line ?? null,
                level: w.level,
                ...(w.params === undefined ? {} : { params: w.params }),
              })),
            ),
          onGateRefused: (gate) => gates.push(gate),
        },
      );
      await tx.$executeRaw`RELEASE SAVEPOINT mobile_return_post`;
    } catch (error: unknown) {
      const refusals = refusalsOf(error);
      if (!refusals) {
        throw error;
      }
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT mobile_return_post`;
      const outcome = outcomeOf(refusals);
      if (outcome.status === 'HELD' && gates.length > 0) {
        const login = await requireMobileLoginRow(tx, userId);
        await this.returns.fileGateRequestsInTx(
          tx,
          gates,
          `Sent from the phone by ${login.loginName} (${dto.srMobileRefno})`,
        );
      }
      const row = await this.findReturn(tx, { srId: keys.id, accYear: keys.accYear });
      return this.answerFrom(tx, row!, {
        duplicate: false,
        status: outcome.status,
        held: outcome.status === 'HELD' ? outcome.first : null,
        refusal: outcome.status === 'SENT_BACK' ? outcome.first : null,
        refusals,
      });
    }
    const row = await this.findReturn(tx, { srId: keys.id, accYear: keys.accYear });
    return this.answerFrom(tx, row!, {
      duplicate: false,
      status: 'POSTED',
      warnings,
      replanned: await this.withRefnos(tx, replanned),
    });
  }

  /** A replanned row of a bill that is no longer open has no refno from the open list: read it. */
  private async withRefnos(
    client: MobileReadClient,
    rows: MobileReturnReplanned[],
  ): Promise<MobileReturnReplanned[]> {
    const missing = rows.filter((r) => r.refno === null).map((r) => r.billId);
    if (missing.length === 0) {
      return rows;
    }
    const found = await client.$queryRaw<{ id: string; refno: string | null }[]>`
      SELECT abl_id::text AS id, abl_doc_refno AS refno
        FROM accounts.acc_bill_balance
       WHERE abl_id = ANY(${missing}::uuid[])`;
    const byId = new Map(found.map((f) => [f.id, f.refno]));
    return rows.map((r) => (r.refno === null ? { ...r, refno: byId.get(r.billId) ?? null } : r));
  }

  /** The customer (a live sales.customers row); 422 MOBILE_RETURN_CUSTOMER_NOT_FOUND. */
  private async requireCustomer(client: MobileReadClient, custId: string): Promise<CustomerFacts> {
    const [row] = await client.$queryRaw<
      { cusId: string; cusName: string | null; priceLevel: number | null }[]
    >`
      SELECT c.cus_id::text AS "cusId", c.cus_name AS "cusName",
             c.cus_price_level_id AS "priceLevel"
        FROM sales.customers c
       WHERE c.cus_id = ${custId}::uuid
         AND c.cus_is_deleted = false`;
    if (!row) {
      throwUnprocessable<ModuleErrorDetail>('Customer not found', [
        {
          field: 'srCustId',
          message: `No live customer ${custId}.`,
          code: MobileErrorCode.RETURN_CUSTOMER_NOT_FOUND,
        },
      ]);
    }
    const level = row.priceLevel;
    return {
      cusId: row.cusId,
      cusName: row.cusName ?? '',
      priceLevel: level !== null && level >= 1 && level <= 7 ? level : null,
    };
  }

  /** srReasonId is an active SALE_RETURN reason the company sees (options.reasons); else 422. */
  private async assertReason(
    client: MobileReadClient,
    companyId: string,
    reasonId: string,
  ): Promise<void> {
    const [row] = await client.$queryRaw<{ id: string }[]>`
      SELECT r.srm_id::text AS id
        FROM stock.stock_reason_master r
       WHERE r.srm_id = ${reasonId}::uuid
         AND r.srm_is_active = true
         AND r.srm_is_deleted = false
         AND r.srm_allowed_txn_types && ARRAY['SALE_RETURN']::text[]
         AND (r.srm_company_id IS NULL OR r.srm_company_id = ${companyId}::uuid)
         AND NOT (r.srm_company_id IS NULL AND EXISTS (
               SELECT 1 FROM stock.stock_reason_master c
                WHERE c.srm_company_id = ${companyId}::uuid
                  AND c.srm_code = r.srm_code
                  AND c.srm_is_deleted = false))`;
    if (!row) {
      throwUnprocessable<ModuleErrorDetail>('Reason not usable', [
        {
          field: 'srReasonId',
          message: `Reason ${reasonId} is not an active sale return reason of this company.`,
          code: MobileErrorCode.RETURN_REASON_INVALID,
        },
      ]);
    }
  }

  /**
   * The bill a return is against: a POSTED, live bill of the company (422
   * SALES_RETURN_BILL_NOT_POSTED, the desktop's code for it) and of this
   * customer (422 MOBILE_RETURN_BILL_OTHER_CUSTOMER: the desktop would book
   * the note on the bill's customer instead, so a mismatch is refused). null
   * for a no-bill return.
   */
  private async billOfUpload(
    tx: Prisma.TransactionClient,
    dto: CreateMobileReturnDto,
  ): Promise<BillHeaderFacts | null> {
    const billId = dto.srBillId || null;
    if (dto.srIsAgainstBill !== true || !billId) {
      return null;
    }
    const accYear = (dto.srBillAccYear ?? '').trim();
    const bill = await this.reader.billHeader(tx, billId, accYear);
    if (!bill || bill.companyId !== dto.srCompanyId || bill.status !== 'POSTED') {
      throwSalesRefused(
        `Bill ${billId} (${accYear}) is not a POSTED bill of this company`,
        SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED,
        'srBillId',
      );
    }
    if (bill.custId !== dto.srCustId) {
      throwUnprocessable<ModuleErrorDetail>('Bill of another customer', [
        {
          field: 'srBillId',
          message: `Bill ${bill.refno ?? bill.sbId} belongs to another customer.`,
          code: MobileErrorCode.RETURN_BILL_OTHER_CUSTOMER,
        },
      ]);
    }
    return bill;
  }

  /**
   * D5 — each line's godown: the one the phone sent for every line (a live,
   * active godown of the branch, else 422 MOBILE_GODOWN_INVALID on godownId);
   * else a billed line's own bill line godown (the bill line it names, or the
   * only line of its item); else the branch default (live and active). No
   * godown at all is 422 MOBILE_GODOWN_INVALID: pick one.
   */
  private async lineGodowns(
    tx: Prisma.TransactionClient,
    branchId: string,
    dto: CreateMobileReturnDto,
    bill: BillHeaderFacts | null,
  ): Promise<string[]> {
    if (dto.godownId) {
      const [ok] = await tx.$queryRaw<{ id: string }[]>`
        SELECT g.gdl_id::text AS id
          FROM inventory.godown_locations g
         WHERE g.gdl_id = ${dto.godownId}::uuid
           AND g.gdl_branch_id = ${branchId}::uuid
           AND g.gdl_is_deleted = false
           AND g.gdl_is_active = true`;
      if (!ok) {
        throwUnprocessable<ModuleErrorDetail>('Godown not usable', [
          {
            field: 'godownId',
            message: `Godown ${dto.godownId} is not an active godown of this return's branch.`,
            code: MobileErrorCode.GODOWN_INVALID,
          },
        ]);
      }
      return dto.lines.map(() => dto.godownId!);
    }
    const billLines = bill
      ? await tx.$queryRaw<{ id: string; itemId: string; godownId: string }[]>`
          SELECT bi.sbi_id::text AS id, bi.sbi_item_id::text AS "itemId",
                 bi.sbi_godown_id::text AS "godownId"
            FROM sales.sale_bill_item bi
           WHERE bi.sbi_bill_id = ${bill.sbId}::uuid
             AND bi.sbi_acc_year = ${bill.accYear}::char(9)
             AND bi.sbi_is_deleted = false`
      : [];
    const [branch] = await tx.$queryRaw<{ godownId: string | null }[]>`
      SELECT g.gdl_id::text AS "godownId"
        FROM public.branch_master b
        LEFT JOIN inventory.godown_locations g
          ON g.gdl_id = b.br_default_godown_id
         AND g.gdl_branch_id = b.br_id
         AND g.gdl_is_deleted = false
         AND g.gdl_is_active = true
       WHERE b.br_id = ${branchId}::uuid`;
    const byLine = new Map(billLines.map((l) => [l.id, l.godownId]));
    const errors: ModuleErrorDetail[] = [];
    const out = dto.lines.map((line, index) => {
      const same = billLines.filter((l) => l.itemId === line.sriItemId);
      const own =
        (line.sriBillItemId ? byLine.get(line.sriBillItemId) : undefined) ??
        (same.length === 1 ? same[0].godownId : undefined);
      const godown = own ?? branch?.godownId ?? null;
      if (!godown) {
        errors.push({
          field: `lines.${index}.sriGodownId`,
          message: `Line ${line.sriLineNo}: the branch has no active default godown. Send godownId.`,
          code: MobileErrorCode.GODOWN_INVALID,
        });
      }
      return godown ?? '';
    });
    if (errors.length > 0) {
      throwUnprocessable<ModuleErrorDetail>('No godown', errors);
    }
    return out;
  }

  /** D10 — a no-bill return's salesman: the login's employee when it is the company's; else nobody. */
  private async loginSalesman(
    client: MobileReadClient,
    employeeId: string | null,
    companyId: string,
  ): Promise<string[]> {
    if (!employeeId) {
      return [];
    }
    const [row] = await client.$queryRaw<{ id: string }[]>`
      SELECT e.emp_id::text AS id
        FROM public.employee_master e
       WHERE e.emp_id = ${employeeId}::uuid
         AND e.emp_is_deleted = false
         AND e.emp_company_id = ${companyId}::uuid`;
    return row ? [row.id] : [];
  }

  /** A PENDING approval request of the return freezes its DRAFT (D77). */
  private async hasPendingApproval(client: MobileReadClient, srId: string): Promise<boolean> {
    const [row] = await client.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n
        FROM accounts.till_approval a
       WHERE a.tap_src_doc_type = 'SALE_RETURN'
         AND a.tap_src_doc_id = ${srId}::uuid
         AND a.tap_status = 'PENDING'
         AND a.tap_is_deleted = false`;
    return (row?.n ?? 0) > 0;
  }

  // ── delete ──────────────────────────────────────────────────────────────

  /**
   * D11 — the phone deletes a DRAFT it sent (HELD or SENT_BACK) through the
   * desktop delete (menu-13 DELETE right). Its own PENDING approval request is
   * withdrawn first. POSTED is 409 SALES_DOC_POSTED (the office cancels it),
   * CANCELLED 409 SALES_DOC_CANCELLED; a uuid VK Nex never saw answers
   * deleted: false, and one deleted before answers deleted: true again.
   */
  async delete(dto: DeleteMobileReturnDto): Promise<MobileReturnDeleteResult> {
    const userId = requireMobileLogin(this.requestContextService.getUserId());
    return this.prisma.$transaction(async (tx) => {
      await lockMobileClientUuid(tx, 'return', dto.srCompanyId, dto.srClientUuid);
      await assertMobileCompany(tx, dto.srCompanyId, 'srCompanyId');
      await resolveMobileDevice(tx, dto.deviceUid);
      const stored = await this.findReturn(tx, {
        companyId: dto.srCompanyId,
        clientUuid: dto.srClientUuid,
      });
      if (!stored) {
        return {
          deleted: false,
          srClientUuid: dto.srClientUuid,
          srId: null,
          srReturnRefno: null,
          duplicate: false,
        };
      }
      const answer = {
        deleted: true,
        srClientUuid: dto.srClientUuid,
        srId: stored.srId,
        srReturnRefno: stored.srReturnRefno,
      };
      if (stored.srIsDeleted) {
        return { ...answer, duplicate: true };
      }
      if (stored.srStatus === 'POSTED') {
        throwSalesLocked(
          'This sale return is POSTED: the office cancels it',
          SALES_ERROR_CODES.DOC_POSTED,
          'srClientUuid',
        );
      }
      if (stored.srStatus === 'CANCELLED') {
        throwSalesLocked(
          'This sale return is CANCELLED',
          SALES_ERROR_CODES.DOC_CANCELLED,
          'srClientUuid',
        );
      }
      const login = await requireMobileLoginRow(tx, userId);
      await this.returns.deleteInTx(
        tx,
        {
          id: stored.srId,
          companyId: stored.srCompanyId,
          branchId: stored.srBranchId,
          accYear: stored.srAccYear,
        },
        {
          withdrawPendingNote: `Withdrawn from the phone by ${login.loginName}: the return was deleted`,
        },
      );
      return { ...answer, duplicate: false };
    }, RETURN_TX_OPTIONS);
  }

  // ── reads ───────────────────────────────────────────────────────────────

  /**
   * The return a (company, client uuid) names in any year and any state,
   * deleted ones included; or one return by its keys.
   */
  private async findReturn(
    client: MobileReadClient,
    key: { companyId: string; clientUuid: string } | { srId: string; accYear: string },
  ): Promise<StoredReturn | null> {
    const where =
      'clientUuid' in key
        ? Prisma.sql`r.sr_company_id = ${key.companyId}::uuid
                 AND r.sr_client_uuid = ${key.clientUuid}::uuid`
        : Prisma.sql`r.sr_id = ${key.srId}::uuid AND r.sr_acc_year = ${key.accYear}::char(9)`;
    const [row] = await client.$queryRaw<StoredReturn[]>`
      SELECT r.sr_id::text AS "srId", btrim(r.sr_acc_year::text) AS "srAccYear",
             r.sr_company_id::text AS "srCompanyId", r.sr_branch_id::text AS "srBranchId",
             r.sr_cust_id::text AS "srCustId", r.sr_client_uuid::text AS "srClientUuid",
             r.sr_return_refno AS "srReturnRefno", r.sr_mobile_refno AS "srMobileRefno",
             r.sr_status AS "srStatus", r.sr_is_deleted AS "srIsDeleted",
             r.sr_return_date::text AS "srReturnDate", r.sr_return_amt AS "srReturnAmt",
             r.sr_tax_amt AS "srTaxAmt", r.sr_round_off AS "srRoundOff",
             r.sr_cash_disc AS "srCashDisc", r.sr_settle_mode AS "srSettleMode",
             r.sr_credit_amt AS "srCreditAmt", r.sr_settle_status AS "srSettleStatus"
        FROM sales.sale_return r
       WHERE ${where}
       ORDER BY r.sr_is_deleted, r.sr_created_on DESC
       LIMIT 1`;
    return row ?? null;
  }

  /** The answer, read back from the database (the post's own writes included). */
  private async answerFrom(
    client: MobileReadClient,
    row: StoredReturn,
    extras: AnswerExtras,
  ): Promise<MobileReturnCreateResult> {
    const [lines, adjusted, approval] = await Promise.all([
      client.$queryRaw<
        {
          sriLineNo: number;
          sriSplitNo: number | null;
          sriId: string;
          rateSource: string | null;
          taxableAmt: Prisma.Decimal | null;
          taxAmt: Prisma.Decimal | null;
          netAmt: Prisma.Decimal | null;
          bucket: string | null;
        }[]
      >`
        SELECT i.sri_line_no AS "sriLineNo", i.sri_split_no AS "sriSplitNo", i.sri_id::text AS "sriId",
               i.sri_rate_source AS "rateSource", i.sri_taxable_amt AS "taxableAmt",
               i.sri_tax_amt AS "taxAmt", i.sri_net_amt AS "netAmt", i.sri_bucket AS bucket
          FROM sales.sale_return_item i
         WHERE i.sri_return_id = ${row.srId}::uuid
           AND i.sri_acc_year = ${row.srAccYear}::char(9)
           AND i.sri_is_deleted = false
         ORDER BY i.sri_line_no, i.sri_split_no`,
      adjustedOf(client, row.srId, row.srAccYear),
      latestApproval(client, row.srId),
    ]);
    const goods = lines.reduce((t, l) => t.plus(l.netAmt ?? 0), ZERO);
    const creditNote = new Prisma.Decimal(row.srReturnAmt ?? 0);
    const roundOff = new Prisma.Decimal(row.srRoundOff ?? 0);
    // creditNote = goods + charges − cash discount + round off (totalsOf).
    const chargesNet = creditNote
      .minus(goods)
      .minus(roundOff)
      .plus(row.srCashDisc ?? 0);
    return {
      duplicate: extras.duplicate,
      srId: row.srId,
      srClientUuid: row.srClientUuid ?? '',
      srReturnRefno: row.srReturnRefno,
      srMobileRefno: row.srMobileRefno,
      srAccYear: row.srAccYear,
      srBranchId: row.srBranchId,
      srStatus: row.srStatus,
      status: extras.status,
      srReturnAmt: money(creditNote),
      totals: {
        goods: money(goods),
        tax: money(row.srTaxAmt),
        chargesNet: money(chargesNet),
        roundOff: money(roundOff),
        creditNote: money(creditNote),
      },
      settlement: {
        mode: row.srSettleMode,
        credited: money(row.srCreditAmt),
        settleStatus: row.srSettleStatus,
        adjusted,
      },
      lines: lines.map(
        (l): MobileReturnLineResult => ({
          sriLineNo: l.sriLineNo,
          sriSplitNo: l.sriSplitNo ?? 1,
          sriId: l.sriId,
          rateSource: l.rateSource,
          taxableAmt: money(l.taxableAmt),
          taxAmt: money(l.taxAmt),
          netAmt: money(l.netAmt),
          bucket: l.bucket,
        }),
      ),
      held: extras.held ?? null,
      refusal: extras.refusal ?? null,
      refusals: extras.refusals ?? [],
      warnings: extras.warnings ?? [],
      replanned: extras.replanned ?? [],
      approval,
    };
  }
}

/**
 * What the return's own Adjust at Post set off, live (not reversed): the
 * desktop's adjustedBills (OWN_ADJUST_AT_POST), with each bill's year.
 */
export async function adjustedOf(
  client: MobileReadClient,
  srId: string,
  accYear: string,
): Promise<MobileReturnAdjusted[]> {
  const rows = await client.$queryRaw<
    { billId: string; billAccYear: string; refno: string | null; amount: Prisma.Decimal }[]
  >`
    SELECT k.abl_id::text AS "billId", btrim(k.abl_acc_year::text) AS "billAccYear",
           k.abl_doc_refno AS refno, j.abj_amount AS amount
      FROM accounts.acc_bill_adjustment j
      JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
      JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
     WHERE b.abl_src_doc_id = ${srId}::uuid AND b.abl_acc_year = ${accYear}::char(9)
       AND b.abl_src_doc_type = 'SALE_RETURN' AND b.abl_is_deleted = false
       AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'DR'
       AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x
                        WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
       AND j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL
       AND k.abl_dr_cr = 'DR' AND k.abl_created_on < b.abl_created_on
     ORDER BY j.abj_created_on, k.abl_id`;
  return rows.map((r) => ({
    billId: r.billId,
    billAccYear: r.billAccYear,
    refno: r.refno,
    amount: money(r.amount),
  }));
}

/** The return's latest approval request that was not withdrawn, in the phone's words. */
export async function latestApproval(
  client: MobileReadClient,
  srId: string,
): Promise<MobileReturnApproval | null> {
  const [row] = await client.$queryRaw<{ status: string; note: string | null }[]>`
    SELECT a.tap_status AS status, a.tap_decision_note AS note
      FROM accounts.till_approval a
     WHERE a.tap_src_doc_type = 'SALE_RETURN'
       AND a.tap_src_doc_id = ${srId}::uuid
       AND a.tap_is_deleted = false
       AND a.tap_status <> 'CANCELLED'
     ORDER BY a.tap_requested_on DESC
     LIMIT 1`;
  const status = row ? phoneApprovalStatus(row.status) : null;
  return status ? { status, note: row.note } : null;
}
