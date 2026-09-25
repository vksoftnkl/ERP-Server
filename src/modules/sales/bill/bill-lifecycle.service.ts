import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SaleBill, SaleBillItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  appendTxnStatusLog,
  TxnStatusEvent,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { SaleOrderService } from '../sale-order/sale-order.service';
import { ChargeCarryService } from '../posting/charge-carry.service';
import { DcFulfilmentService } from '../posting/dc-fulfilment.service';
import { DocRegisterService } from '../../../common/posting/doc-register.service';
import { GstGatewayService } from '../posting/gst-gateway.service';
import { LoyaltyLedgerService } from '../posting/loyalty-ledger.service';
import { PromotionUsageService } from '../posting/promotion-usage.service';
import { SalesContextService, type SalesCallContext } from '../posting/sales-context.service';
import { SalesDocBlocksService } from '../posting/sales-doc-blocks.service';
import { buildBillLegs } from '../posting/sales-leg.sources';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import { SalesStockService } from '../posting/sales-stock.service';
import { StockReservationService } from '../posting/stock-reservation.service';
import { StatutoryService } from '../../../common/posting/statutory.service';
import { TransportBandService } from '../posting/transport-band.service';
import {
  assertAccYearWritable,
  assertAmendable,
  assertBandWritable,
  assertCancellable,
  assertCreditLimit,
  assertSalesmen,
  assertTenderTotal,
  assertVoucherPartitionExists,
  loadDayClosed,
  loadDeclaredLocks,
  refuse,
  warn,
} from '../posting/sales.guards';
import { throwSalesLocked, throwSalesRefusals, throwSalesRight } from '../posting/sales.errors';
import {
  SALES_ERROR_CODES,
  createGuardContext,
  type SalesGuardContext,
  type SalesWarning,
} from '../posting/types/posting.types';
import type { RegisterDetailLine, RegisterDoc } from '../../../common/posting/doc-register.types';
import type { LoyaltyBillSource } from '../posting/types/loyalty.types';
import type { PromotionApplied } from '../posting/types/promotion.types';
import {
  SALES_MENU_ID,
  SALES_VOUCHER_TYPE,
  TENDER_TYPE,
  addDays,
  bucketTaxes,
  isoDate,
  isoToday,
  num,
  numericTail,
  round2,
  supplyNatureOf,
} from '../posting/sales-doc.utils';
import { BillService } from './bill.service';
import { assertBooksReconcile } from '../../accountsModule/reconcile/books-reconcile.guard';
import { readDraftCheques } from './bill-cheque-details';
import { retireCounterAllocations, syncCounterAllocations } from './bill-counter-allocation.helper';
import {
  assertBillPdcHeld,
  cancelBillPdcRegister,
  syncBillPdcRegister,
} from './bill-pdc-posting.helper';
import {
  loadSetOffCredits,
  setOffKey,
  splitSetOffs,
  syncBillAdjustments,
} from '../../../common/posting/bill-adjustment.helper';
import {
  cashTendered,
  decimal,
  isCreditTender,
  partyDebitOf,
  setOffAmtOf,
  settledByTenders,
  snapshotFromDto,
  snapshotFromRows,
  type BillSnapshot,
  type TenderMasterRow,
} from './bill-snapshot';
import type {
  AmendBillDto,
  CancelBillDto,
  PostBillDto,
  ValidateBillDto,
} from './dto/bill-lifecycle.dto';
import type { SaveBillAdjustmentDto } from './dto/save-bill-adjustment.dto';
import {
  BILL_STATUS_CANCELLED,
  BILL_STATUS_DRAFT,
  BILL_STATUS_POSTED,
  BILL_STATUS_SRC_DOC_TYPE,
  BILL_STATUS_SRC_MODULE,
  type BillPayload,
} from './types/bill-api.types';

/**
 * The bill's one-way doors — HANDOVER §2.2 `/validate`, §2.3 `/post`, §2.4
 * `/cancel`, §2.5 `/amend`.
 *
 * `/validate` and `/post` run THE SAME guards over THE SAME snapshot shape; the
 * only difference is `throwOnRefusal`. `/post` is one transaction, flow §5.1
 * steps 1–13, status written LAST so a failure anywhere leaves a DRAFT. A
 * cancel is a reversal, never a delete. An amend is unwind + re-apply +
 * re-post, one transaction, `sb_revision_no + 1`.
 */
const POST_TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 } as const;

interface PostResult {
  bill: SaleBill;
  gdrId: string | null;
  einvoice: boolean;
  ewaybill: boolean;
}

@Injectable()
export class BillLifecycleService {
  private readonly logger = new Logger(BillLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bills: BillService,
    private readonly salesContext: SalesContextService,
    private readonly statutory: StatutoryService,
    private readonly legs: VoucherPostingService,
    private readonly register: DocRegisterService,
    private readonly stock: SalesStockService,
    private readonly reservations: StockReservationService,
    private readonly loyalty: LoyaltyLedgerService,
    private readonly promo: PromotionUsageService,
    private readonly chargeCarry: ChargeCarryService,
    private readonly dcFulfilment: DcFulfilmentService,
    private readonly saleOrders: SaleOrderService,
    private readonly transportBand: TransportBandService,
    private readonly docBlocks: SalesDocBlocksService,
    private readonly gst: GstGatewayService,
    private readonly audit: AuditLogService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  §2.2 — /bills/validate: the dry run
  // ═══════════════════════════════════════════════════════════════════════

  async validate(dto: ValidateBillDto): Promise<Record<string, unknown>> {
    const ctx = await this.salesContext.resolve(
      { companyId: dto.sbCompanyId, branchId: dto.sbBranchId, deviceId: dto.sbDeviceId },
      SALES_MENU_ID.SALE_BILL,
    );
    const masters = await this.tenderMasters(
      this.prisma,
      (dto.tenders ?? []).map((t) => t.tdTenderId),
    );
    const snap = snapshotFromDto(dto, masters);
    const guard = createGuardContext({
      overrides: dto.overrides ?? [],
      canOverride: ctx.rights.override,
      throwOnRefusal: false,
      dryRun: true,
    });
    await this.prisma.$transaction(async (tx) => {
      await this.runGuards(tx, snap, ctx, guard, { adjustments: dto.adjustments });
      // Nothing is written: the transaction exists only so every read sees
      // one snapshot.
    });
    const proposals = await this.proposals(snap, ctx);
    return {
      ok: guard.refusals.length === 0,
      refusals: guard.refusals,
      warnings: guard.warnings,
      rights: ctx.rights,
      proposals,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  §2.3 — /bills/post: the one-way door
  // ═══════════════════════════════════════════════════════════════════════

  async post(dto: PostBillDto): Promise<BillPayload> {
    let posted: PostResult | null = null;
    await this.prisma.$transaction(async (tx) => {
      const bill = await this.bills.lockHeader(tx, dto);
      if (bill.sbStatus === BILL_STATUS_POSTED) {
        // Idempotent: a POSTED id answers 200 with the same response.
        return;
      }
      if (bill.sbStatus === BILL_STATUS_CANCELLED) {
        throwSalesLocked('This bill is CANCELLED', SALES_ERROR_CODES.BILL_CANCELLED, 'sbId');
      }
      const ctx = await this.salesContext.resolve(
        { companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId },
        SALES_MENU_ID.SALE_BILL,
        tx,
      );
      if (!ctx.rights.post) {
        throwSalesRight('This user may not post on this menu', SALES_ERROR_CODES.RIGHT_POST);
      }
      const parts = await this.bills.loadParts(tx, bill);
      const snap = snapshotFromRows(bill, parts.items, parts.charges, parts.tenders);
      const guard = createGuardContext({
        overrides: dto.overrides ?? [],
        canOverride: ctx.rights.override,
        throwOnRefusal: false,
      });
      await this.runGuards(tx, snap, ctx, guard, { adjustments: dto.adjustments });
      if (guard.refusals.length > 0) {
        throwSalesRefusals('Bill cannot be posted', guard.refusals);
      }
      posted = await this.postCore(tx, bill, parts.items, snap, ctx, {
        adjustments: dto.adjustments,
        now: new Date(),
        fromStatus: BILL_STATUS_DRAFT,
      });
    }, POST_TX_OPTIONS);

    if (posted) {
      const p = posted as PostResult;
      this.gst.enqueueAfterPost({ gdrId: p.gdrId, einvoice: p.einvoice, ewaybill: p.ewaybill });
    }
    return this.bills.getById(dto.sbId, dto.sbCompanyId, dto.sbBranchId, dto.sbAccYear);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  §2.4 — /bills/cancel
  // ═══════════════════════════════════════════════════════════════════════

  async cancel(dto: CancelBillDto): Promise<Record<string, unknown>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const bill = await this.bills.lockHeader(tx, dto);
      if (bill.sbStatus === BILL_STATUS_CANCELLED) {
        // Idempotent.
        return this.cancelResponse(tx, bill, now);
      }
      if (bill.sbStatus !== BILL_STATUS_POSTED) {
        throwSalesLocked(
          'Only a POSTED bill can be cancelled — a DRAFT is deleted',
          SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'sbId',
        );
      }
      const ctx = await this.salesContext.resolve(
        { companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId },
        SALES_MENU_ID.SALE_BILL,
        tx,
      );
      if (!ctx.rights.cancel) {
        throwSalesRight('This user may not cancel on this menu', SALES_ERROR_CODES.RIGHT_CANCEL);
      }
      await this.assertUnwindable(tx, bill, ctx, dto.reason, 'cancel');
      const items = await tx.saleBillItem.findMany({
        where: { sbiBillId: bill.sbId, sbiAccYear: bill.sbAccYear, sbiIsDeleted: false },
      });
      const reversal = await this.unwind(tx, bill, items, ctx, dto.reason, now);
      const cancelled = await tx.saleBill.update({
        where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
        data: { sbStatus: BILL_STATUS_CANCELLED, sbModifiedOn: now, sbModifiedBy: ctx.actorName },
      });
      await this.afterStatusChange(tx, cancelled, items, ctx.actor, now);
      await appendTxnStatusLog(tx, {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        srcModule: BILL_STATUS_SRC_MODULE,
        srcDocType: BILL_STATUS_SRC_DOC_TYPE,
        srcDocId: bill.sbId,
        srcDocRefno: bill.sbBillRefno,
        event: TxnStatusEvent.CANCELLED,
        fromStatus: BILL_STATUS_POSTED,
        toStatus: BILL_STATUS_CANCELLED,
        changedOn: now,
        changedBy: ctx.actor,
        remarks: dto.reason,
        deviceId: bill.sbDeviceId,
        sessionId: bill.sbSessionId,
      });
      await this.audit.logEntityChange(
        {
          action: 'cancel',
          tableName: 'sale_bill',
          screenName: 'Sale Bill',
          screenType: 'transaction',
          pk: bill.sbId,
          displayName: bill.sbBillRefno || bill.sbId,
          originalRecord: { sbStatus: BILL_STATUS_POSTED },
          modifiedRecord: { sbStatus: BILL_STATUS_CANCELLED },
          userId: ctx.actor,
          notes: `Bill cancelled: ${dto.reason}`,
        },
        tx,
      );
      // The trial check (notes 47), after every write. The reversal mirrors
      // the original's legs, so the original names every ledger it moved.
      await assertBooksReconcile(tx, {
        companyId: bill.sbCompanyId,
        accYear: bill.sbAccYear,
        ledgerIds: [bill.sbCustId],
        vouchers: bill.sbPostedVoucherId
          ? [{ voucherId: bill.sbPostedVoucherId, accYear: bill.sbAccYear }]
          : [],
      });
      return {
        sbId: bill.sbId,
        sbCompanyId: bill.sbCompanyId,
        sbBranchId: bill.sbBranchId,
        sbAccYear: bill.sbAccYear,
        sbStatus: BILL_STATUS_CANCELLED,
        reversalVoucherRefno: reversal.reversalRefno,
        cancelledOn: now.toISOString(),
      };
    }, POST_TX_OPTIONS);
  }

  private async cancelResponse(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    now: Date,
  ): Promise<Record<string, unknown>> {
    const [row] = bill.sbPostedVoucherId
      ? await tx.$queryRaw<{ refno: string | null; on: Date | null }[]>`
          SELECT r.avh_voucher_refno AS refno, o.avh_status_on AS "on"
            FROM accounts.acc_voucher_header o
            LEFT JOIN accounts.acc_voucher_header r
                   ON r.avh_voucher_id = o.avh_reversal_voucher_id AND r.avh_acc_year = o.avh_reversal_acc_year
           WHERE o.avh_voucher_id = ${bill.sbPostedVoucherId}::uuid AND o.avh_acc_year = ${bill.sbAccYear}::char(9)`
      : [];
    return {
      sbId: bill.sbId,
      sbCompanyId: bill.sbCompanyId,
      sbBranchId: bill.sbBranchId,
      sbAccYear: bill.sbAccYear,
      sbStatus: BILL_STATUS_CANCELLED,
      reversalVoucherRefno: row?.refno ?? null,
      cancelledOn: (row?.on ?? bill.sbModifiedOn ?? now).toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  §2.5 — /bills/amend: R20 on the bill
  // ═══════════════════════════════════════════════════════════════════════

  async amend(dto: AmendBillDto): Promise<BillPayload> {
    const now = new Date();
    let posted: PostResult | null = null;
    await this.prisma.$transaction(async (tx) => {
      const bill = await this.bills.lockHeader(tx, {
        sbId: dto.sbId,
        sbCompanyId: dto.sbCompanyId,
        sbBranchId: dto.sbBranchId,
        sbAccYear: dto.sbAccYear,
      });
      if (bill.sbStatus !== BILL_STATUS_POSTED) {
        throwSalesLocked(
          bill.sbStatus === BILL_STATUS_CANCELLED
            ? 'This bill is CANCELLED'
            : 'This bill is a DRAFT — use /bills/create',
          bill.sbStatus === BILL_STATUS_CANCELLED
            ? SALES_ERROR_CODES.BILL_CANCELLED
            : SALES_ERROR_CODES.DOC_NOT_DRAFT,
          'sbId',
        );
      }
      const ctx = await this.salesContext.resolve(
        { companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId },
        SALES_MENU_ID.SALE_BILL,
        tx,
      );
      if (!ctx.rights.amend) {
        throwSalesRight('This user may not amend on this menu', SALES_ERROR_CODES.RIGHT_AMEND);
      }
      if (!ctx.settings.allowPostedAmend) {
        throwSalesLocked(
          'Amending a posted bill is switched off (sales.allow_posted_amend)',
          SALES_ERROR_CODES.AMEND_OFF,
          'sbId',
        );
      }
      if (bill.sbRevisionNo !== dto.baseRevision) {
        throwSalesLocked(
          `This bill has been amended since you opened it (now revision ${bill.sbRevisionNo}, you sent ${dto.baseRevision}). Reload it and make the change again.`,
          SALES_ERROR_CODES.REVISION_STALE,
          'baseRevision',
        );
      }
      // Lock 2: a declared document is not ours to edit.
      await assertAmendable(tx, bill.sbDocRegisterId);
      await this.assertUnwindable(tx, bill, ctx, dto.editRemark, 'amend');

      const priorItems = await tx.saleBillItem.findMany({
        where: { sbiBillId: bill.sbId, sbiAccYear: bill.sbAccYear, sbiIsDeleted: false },
      });
      const before = await this.bills.getById(
        bill.sbId,
        bill.sbCompanyId,
        bill.sbBranchId,
        bill.sbAccYear,
      );

      // 1 · unwind — the old money leaves, the old goods come back, DRAFT again.
      //     The voucher is not mirrored: it is restated in place at step 3.
      const { restateVoucherId } = await this.unwind(
        tx,
        bill,
        priorItems,
        ctx,
        `Amended: ${dto.editRemark}`,
        now,
        'amend',
      );
      const draft = await tx.saleBill.update({
        where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
        data: {
          sbStatus: BILL_STATUS_DRAFT,
          sbPostedVoucherId: null,
          sbDocRegisterId: null,
          sbCogsAmt: 0,
          sbLoyaltyEarned: 0,
          sbLoyaltyRedeemed: 0,
          sbLoyaltyEarnPoints: 0,
          sbLoyaltyRedeemPoints: 0,
          sbModifiedOn: now,
          sbModifiedBy: ctx.actorName,
        },
      });
      await appendTxnStatusLog(tx, {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        srcModule: BILL_STATUS_SRC_MODULE,
        srcDocType: BILL_STATUS_SRC_DOC_TYPE,
        srcDocId: bill.sbId,
        srcDocRefno: bill.sbBillRefno,
        event: TxnStatusEvent.AMENDED,
        fromStatus: BILL_STATUS_POSTED,
        toStatus: BILL_STATUS_DRAFT,
        changedOn: now,
        changedBy: ctx.actor,
        remarks: dto.editRemark,
        deviceId: bill.sbDeviceId,
        sessionId: bill.sbSessionId,
      });

      // 2 · apply the new payload through the ONE definition of a bill edit.
      const { baseRevision: _b, editRemark: _e, overrides: _o, printAfter: _p, ...saveDto } = dto;
      void _b;
      void _e;
      void _o;
      void _p;
      const { updated, items } = await this.bills.applySaveInTx(
        tx,
        draft,
        saveDto,
        ctx.actor,
        now,
        {
          notes: `Bill amended (revision ${bill.sbRevisionNo} → ${bill.sbRevisionNo + 1}): ${dto.editRemark}`,
        },
      );

      // 3 · re-post, same guards as /post, and the revision counter.
      const parts = await this.bills.loadParts(tx, updated);
      const snap = snapshotFromRows(updated, items, parts.charges, parts.tenders);
      const guard = createGuardContext({
        overrides: dto.overrides ?? [],
        canOverride: ctx.rights.override,
        throwOnRefusal: false,
      });
      await this.runGuards(tx, snap, ctx, guard, { adjustments: dto.adjustments });
      if (guard.refusals.length > 0) {
        throwSalesRefusals('Bill cannot be amended', guard.refusals);
      }
      posted = await this.postCore(tx, updated, items, snap, ctx, {
        adjustments: dto.adjustments,
        now,
        fromStatus: BILL_STATUS_DRAFT,
        revisionNo: bill.sbRevisionNo + 1,
        restateVoucherId,
      });
      await this.audit.logEntityChange(
        {
          action: 'update',
          tableName: 'sale_bill',
          screenName: 'Sale Bill',
          screenType: 'transaction',
          pk: bill.sbId,
          displayName: bill.sbBillRefno || bill.sbId,
          originalRecord: before as unknown as Record<string, unknown>,
          modifiedRecord: {
            ...(saveDto as unknown as Record<string, unknown>),
            sbRevisionNo: bill.sbRevisionNo + 1,
          },
          userId: ctx.actor,
          notes: `Bill amended to revision ${bill.sbRevisionNo + 1}: ${dto.editRemark}`,
        },
        tx,
      );
    }, POST_TX_OPTIONS);

    if (posted) {
      const p = posted as PostResult;
      this.gst.enqueueAfterPost({ gdrId: p.gdrId, einvoice: p.einvoice, ewaybill: p.ewaybill });
    }
    return this.bills.getById(dto.sbId, dto.sbCompanyId, dto.sbBranchId, dto.sbAccYear);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  The guards — flow §9, one list for validate, post and amend
  // ═══════════════════════════════════════════════════════════════════════

  async runGuards(
    tx: Prisma.TransactionClient,
    snap: BillSnapshot,
    ctx: SalesCallContext,
    g: SalesGuardContext,
    opts: { adjustments?: SaveBillAdjustmentDto[] },
  ): Promise<void> {
    const s = ctx.settings;
    const today = isoToday();

    // 2 · the year and its partitions (400 either way — a request problem).
    await assertAccYearWritable(tx, snap.companyId, snap.accYear, 'sbAccYear');
    await assertVoucherPartitionExists(tx, snap.accYear, 'sbAccYear');

    // 3 · the calendar.
    if (snap.billDate > today) {
      refuse(
        g,
        SALES_ERROR_CODES.BACKDATE,
        `A bill cannot be dated ${snap.billDate}, which is in the future`,
        { field: 'sbBillDate' },
      );
    } else if (snap.billDate !== today && s.backdateMode !== 'ALLOW') {
      const msg = `This bill is dated ${snap.billDate}, before today (${today})`;
      if (s.backdateMode === 'REFUSE') {
        refuse(g, SALES_ERROR_CODES.BACKDATE, msg, { field: 'sbBillDate' });
      } else {
        warn(g, SALES_ERROR_CODES.BACKDATE, msg, { field: 'sbBillDate' });
      }
    }
    if (await loadDayClosed(tx, snap.companyId, snap.branchId, snap.billDate)) {
      refuse(
        g,
        SALES_ERROR_CODES.DAY_CLOSED,
        `The books for ${snap.billDate} are closed at this branch`,
        { field: 'sbBillDate' },
      );
    }

    // 5 · the party. Every accounting row is raised AGAINST somebody.
    if (!snap.custId) {
      refuse(
        g,
        SALES_ERROR_CODES.CUSTOMER_REQUIRED,
        'A bill must name a customer to post: its voucher and receivable are raised against the customer ledger (the walk-in customer has one too)',
        { field: 'sbCustId' },
      );
    }
    if (snap.items.length === 0) {
      refuse(g, SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'A bill with no lines cannot be posted', {
        field: 'items',
      });
    }

    // 6 · salesmen — the guard that replaces a foreign key.
    await assertSalesmen(tx, snap.companyId, snap.salesmanId.length ? snap.salesmanId : null, {
      field: 'sbSalesmanId',
    });
    if (s.salesmanMandatory && snap.salesmanId.length === 0) {
      refuse(
        g,
        SALES_ERROR_CODES.SALESMAN_INVALID,
        'A salesman is mandatory on every bill (sales.salesman_mandatory)',
        { field: 'sbSalesmanId' },
      );
    }

    // 7 · the law — 269ST cash limit and PAN / Form 60.
    const cash = cashTendered(snap);
    if (cash > 0 && snap.custId) {
      const [row] = await tx.$queryRaw<{ cash: Prisma.Decimal | null }[]>`
        SELECT SUM(t.td_amount) AS cash
          FROM accounts.acc_tender_detail t
          JOIN sales.sale_bill b ON b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
         WHERE t.td_party_ledger_id = ${snap.custId}::uuid AND t.td_tender_type_id = ${TENDER_TYPE.CASH}
           AND t.td_doc_date = ${snap.billDate}::date AND t.td_is_deleted = false AND t.td_is_voided = false
           AND t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
           AND b.sb_status = 'POSTED' AND b.sb_id <> ${snap.sbId ?? '00000000-0000-0000-0000-000000000000'}::uuid`;
      const cashToday = num(row?.cash);
      const isWalkIn = snap.custId === s.defaultCustomerId;
      const limit = await this.statutory.assertCashLimit(
        snap.companyId,
        isWalkIn ? cash : cash + cashToday,
        snap.billDate,
        tx,
      );
      if (limit.exceeded && limit.limit) {
        const st = {
          code: limit.limit.code,
          value: limit.limit.value,
          effectiveFrom: limit.limit.effectiveFrom,
          isCompanyOverride: limit.limit.isCompanyOverride,
        };
        const msg = `Cash received from this party today (${round2(cash + (isWalkIn ? 0 : cashToday))}) reaches the ${limit.limit.label} limit of ${limit.limit.value}`;
        if (limit.limit.enforce === 'REFUSE') {
          refuse(g, SALES_ERROR_CODES.CASH_LIMIT, msg, { field: 'tenders', statutory: st });
        } else {
          warn(g, SALES_ERROR_CODES.CASH_LIMIT, msg, { field: 'tenders', statutory: st });
        }
      }
      const pan = await this.statutory.assertPanOrForm60(snap.companyId, cash, snap.billDate, tx);
      if (pan.required && pan.limit && !snap.custPan && !snap.form60Ref) {
        refuse(
          g,
          SALES_ERROR_CODES.PAN_REQUIRED,
          `A cash sale above ${pan.limit.value} needs the customer's PAN or a Form 60 reference`,
          {
            field: 'sbCustPan',
            statutory: {
              code: pan.limit.code,
              value: pan.limit.value,
              effectiveFrom: pan.limit.effectiveFrom,
              isCompanyOverride: pan.limit.isCompanyOverride,
            },
          },
        );
      }
    }

    // HSN digits — INFO, never blocks.
    const hsn = await this.statutory.hsnDigits(snap.companyId, snap.billDate, tx);
    if (hsn.digits) {
      for (const i of snap.items) {
        if (!i.isService && (i.hsnCode ?? '').trim().length < hsn.digits) {
          g.warnings.push({
            code: SALES_ERROR_CODES.HSN_DIGITS,
            level: 'INFO',
            message: `Line ${i.lineNo}: HSN ${i.hsnCode ?? '(blank)'} is shorter than the ${hsn.digits} digits this company must report`,
            line: i.lineNo,
            overridable: false,
          } satisfies SalesWarning);
        }
      }
    }

    // 8 · the money.
    const separately = s.postSchemeDiscSeparately;
    const debit = partyDebitOf(snap, separately);
    if (Math.abs(debit - snap.billAmt) > 0.01) {
      refuse(
        g,
        SALES_ERROR_CODES.AMOUNT_MISMATCH,
        `The bill does not add up: taxable + tax + charges + round-off + TCS − discounts make ${debit.toFixed(2)}, the bill says ${snap.billAmt.toFixed(2)}`,
        { field: 'sbBillAmt' },
      );
    }
    const lineTax = round2(
      snap.items.reduce(
        (t, i) => t + i.cgstAmt + i.sgstAmt + i.igstAmt + i.cessAmt + i.acessAmt,
        0,
      ),
    );
    if (Math.abs(lineTax - snap.taxAmt) > 0.01) {
      refuse(
        g,
        SALES_ERROR_CODES.AMOUNT_MISMATCH,
        `Line taxes total ${lineTax.toFixed(2)} but sbTaxAmt says ${snap.taxAmt.toFixed(2)}`,
        { field: 'sbTaxAmt' },
      );
    }
    const tendered = round2(snap.tenders.reduce((t, x) => t + x.amount, 0));
    assertTenderTotal(g, tendered + setOffAmtOf(snap), snap.billAmt, s);
    // A bill with an outstanding must be CREDIT, or carry a credit tender.
    const settled = settledByTenders(snap) + setOffAmtOf(snap);
    const outstanding = round2(snap.billAmt - settled);
    if (outstanding > 0.01 && snap.custId) {
      if (
        snap.custId === s.defaultCustomerId &&
        !snap.tenders.some((t) => t.tenderTypeId === TENDER_TYPE.TEMP_CREDIT)
      ) {
        refuse(
          g,
          SALES_ERROR_CODES.TEMP_CREDIT_DETAILS_MISSING,
          `The walk-in customer cannot owe ${outstanding.toFixed(2)} — add a TEMP_CR tender with the person's name and mobile, or collect it`,
          { field: 'tenders' },
        );
      }
      await assertCreditLimit(
        tx,
        g,
        { custId: snap.custId, partyLedgerId: snap.custId },
        snap.companyId,
        outstanding,
        s,
        snap.billDate,
      );
    }

    // Discount caps.
    for (const i of snap.items) {
      if (s.maxLineDiscPerc < 100 && i.itemDiscPerc > s.maxLineDiscPerc + 0.001) {
        warn(
          g,
          SALES_ERROR_CODES.DISC_CAP,
          `Line ${i.lineNo}: ${i.itemDiscPerc}% discount exceeds the ${s.maxLineDiscPerc}% line cap`,
          { field: 'items', line: i.lineNo },
        );
      }
      if (
        s.rateBelowMinMode !== 'ALLOW' &&
        i.minPrice !== null &&
        i.minPrice > 0 &&
        !i.isFree &&
        i.rate < i.minPrice - 0.001
      ) {
        const msg = `Line ${i.lineNo}: rate ${i.rate} is below the minimum ${i.minPrice}`;
        if (s.rateBelowMinMode === 'REFUSE') {
          refuse(g, SALES_ERROR_CODES.RATE_BELOW_MIN, msg, { field: 'items', line: i.lineNo });
        } else {
          warn(g, SALES_ERROR_CODES.RATE_BELOW_MIN, msg, { field: 'items', line: i.lineNo });
        }
      }
    }
    if (s.maxBillDiscPerc < 100 && snap.grossAmt > 0) {
      const disc = snap.itemDisc + snap.splDisc + snap.schDisc + snap.billSchDisc + snap.cashDisc;
      const perc = (disc / snap.grossAmt) * 100;
      if (perc > s.maxBillDiscPerc + 0.001) {
        warn(
          g,
          SALES_ERROR_CODES.DISC_CAP,
          `Discounts of ${round2(disc)} are ${perc.toFixed(2)}% of the bill, over the ${s.maxBillDiscPerc}% cap`,
          { field: 'sbCashDisc' },
        );
      }
    }

    // Tender master limits.
    const masters = await this.tenderMasters(
      tx,
      snap.tenders.map((t) => t.tenderId),
    );
    for (const t of snap.tenders) {
      const m = t.tenderId ? masters.get(t.tenderId) : undefined;
      if (!m) {
        continue;
      }
      if (
        m.tnd_min_amount !== null &&
        num(m.tnd_min_amount) > 0 &&
        t.amount < num(m.tnd_min_amount)
      ) {
        warn(
          g,
          SALES_ERROR_CODES.TENDER_MIN_MAX,
          `${m.tnd_name ?? 'Tender'} ${t.amount} is below its minimum ${num(m.tnd_min_amount)}`,
          { field: 'tenders' },
        );
      }
      if (
        m.tnd_max_amount !== null &&
        num(m.tnd_max_amount) > 0 &&
        t.amount > num(m.tnd_max_amount)
      ) {
        warn(
          g,
          SALES_ERROR_CODES.TENDER_MIN_MAX,
          `${m.tnd_name ?? 'Tender'} ${t.amount} is above its maximum ${num(m.tnd_max_amount)}`,
          { field: 'tenders' },
        );
      }
      if (m.tnd_daily_limit !== null && num(m.tnd_daily_limit) > 0) {
        const [d] = await tx.$queryRaw<{ used: Prisma.Decimal | null }[]>`
          SELECT SUM(td_amount) AS used FROM accounts.acc_tender_detail
           WHERE td_tender_id = ${t.tenderId}::uuid AND td_doc_date = ${snap.billDate}::date
             AND td_branch_id = ${snap.branchId}::uuid AND td_is_deleted = false AND td_is_voided = false
             AND td_src_doc_id <> ${snap.sbId ?? '00000000-0000-0000-0000-000000000000'}::uuid`;
        if (num(d?.used) + t.amount > num(m.tnd_daily_limit)) {
          warn(
            g,
            SALES_ERROR_CODES.TENDER_DAILY_LIMIT,
            `${m.tnd_name ?? 'Tender'} would exceed its daily limit of ${num(m.tnd_daily_limit)}`,
            { field: 'tenders' },
          );
        }
      }
    }

    // 9 · the sources — an order line and a challan line may not be over-taken.
    await this.guardSources(tx, snap, g, s.allowBillOverOrderQty);

    // 10 · promotions live?
    const schemeIds = [
      ...new Set(snap.items.map((i) => i.schemeId).filter((x): x is string => !!x)),
    ];
    if (schemeIds.length > 0) {
      const issues = await this.promo.validateApplied(tx, this.promoDoc(snap), schemeIds, {
        throwOnFirst: false,
      });
      for (const issue of issues) {
        warn(g, SALES_ERROR_CODES.PROMO_NOT_LIVE, issue.message, { field: 'items' });
      }
    }

    // 11 · loyalty — a redemption within its caps.
    const loyaltyTenders = snap.tenders.filter((t) => t.tenderTypeId === TENDER_TYPE.LOYALTY);
    if (loyaltyTenders.length > 0) {
      const memberId = snap.loyaltyMemberId;
      if (!memberId) {
        refuse(
          g,
          SALES_ERROR_CODES.LOYALTY_CAP,
          'This bill redeems points but names no loyalty member',
          { field: 'sbLoyaltyMemberId' },
        );
      } else {
        const preview = await this.loyalty.preview(this.loyaltySource(snap, [], memberId), tx);
        const points = loyaltyTenders.reduce((t, x) => t + x.unitsUsed, 0);
        const amount = loyaltyTenders.reduce((t, x) => t + x.amount, 0);
        if (!preview.allowPointRedeem) {
          refuse(g, SALES_ERROR_CODES.LOYALTY_CAP, 'The scheme does not allow point redemption', {
            field: 'tenders',
          });
        }
        if (points > preview.redeemable + 0.0001) {
          refuse(
            g,
            SALES_ERROR_CODES.LOYALTY_CAP,
            `Redeeming ${points} points but only ${preview.redeemable} are redeemable today`,
            { field: 'tenders' },
          );
        }
        if (preview.minPoints > 0 && points < preview.minPoints) {
          refuse(
            g,
            SALES_ERROR_CODES.LOYALTY_CAP,
            `At least ${preview.minPoints} points must be redeemed at a time`,
            { field: 'tenders' },
          );
        }
        if (preview.maxPoints !== null && points > preview.maxPoints) {
          refuse(
            g,
            SALES_ERROR_CODES.LOYALTY_CAP,
            `At most ${preview.maxPoints} points may be redeemed on one bill`,
            { field: 'tenders' },
          );
        }
        if (preview.maxRedeemAmount !== null && amount > preview.maxRedeemAmount + 0.01) {
          refuse(
            g,
            SALES_ERROR_CODES.LOYALTY_CAP,
            `Redemption ${amount} exceeds the scheme's cap of ${preview.maxRedeemAmount} on this bill`,
            { field: 'tenders' },
          );
        }
        if (preview.rate > 0 && Math.abs(points * preview.rate - amount) > 0.01) {
          refuse(
            g,
            SALES_ERROR_CODES.LOYALTY_CAP,
            `${points} points at ${preview.rate} per point is ${round2(points * preview.rate)}, not ${amount}`,
            { field: 'tenders' },
          );
        }
      }
    }

    // 12 · temporary credit (31).
    for (const t of snap.tenders.filter((x) => x.tenderTypeId === TENDER_TYPE.TEMP_CREDIT)) {
      if (!t.tempCredit?.name || !t.tempCredit.mobile) {
        refuse(
          g,
          SALES_ERROR_CODES.TEMP_CREDIT_DETAILS_MISSING,
          'A temporary credit needs the name and mobile of the person who owes it',
          { field: 'tenders' },
        );
        continue;
      }
      if (s.tempCreditMaxDays > 0 && t.tempCredit.days > s.tempCreditMaxDays) {
        refuse(
          g,
          SALES_ERROR_CODES.TEMP_CREDIT_DAYS,
          `A temporary credit may run at most ${s.tempCreditMaxDays} days`,
          { field: 'tenders' },
        );
      }
      if (s.tempCreditMaxAmount > 0 && t.amount > s.tempCreditMaxAmount) {
        refuse(
          g,
          SALES_ERROR_CODES.TEMP_CREDIT_AMOUNT,
          `A temporary credit may be at most ${s.tempCreditMaxAmount}`,
          { field: 'tenders' },
        );
      }
      if (s.tempCreditBlockOpen !== 'OFF') {
        const [open] = await tx.$queryRaw<{ n: bigint; bal: Prisma.Decimal | null }[]>`
          SELECT COUNT(*) AS n, SUM(atc_balance_amount) AS bal FROM accounts.acc_temp_credit
           WHERE atc_company_id = ${snap.companyId}::uuid AND atc_mobile = ${t.tempCredit.mobile}
             AND atc_status IN ('OPEN', 'PARTIAL') AND atc_is_deleted = false
             AND atc_src_doc_id <> ${snap.sbId ?? '00000000-0000-0000-0000-000000000000'}::uuid`;
        if (Number(open?.n ?? 0) > 0) {
          const msg = `${t.tempCredit.mobile} already has ${Number(open?.n)} open temporary credit(s) totalling ${num(open?.bal)}`;
          if (s.tempCreditBlockOpen === 'REFUSE') {
            refuse(g, SALES_ERROR_CODES.TEMP_CREDIT_OPEN, msg, { field: 'tenders' });
          } else {
            warn(g, SALES_ERROR_CODES.TEMP_CREDIT_OPEN, msg, { field: 'tenders' });
          }
        }
      }
    }

    // 13 · adjustments, when the post body names them — each header figure
    //      against its own kind of credit: advances, then credit notes.
    if (opts.adjustments && opts.adjustments.length > 0 && snap.custId) {
      const split = splitSetOffs(opts.adjustments, await loadSetOffCredits(tx, opts.adjustments));
      for (const [field, total, declared, kind] of [
        ['sbAdvanceAmt', round2(split.advance), snap.advanceAmt, 'advance'],
        ['sbNoteAdjAmt', round2(split.note), snap.noteAdjAmt, 'credit-note'],
      ] as const) {
        if (Math.abs(total - declared) > 0.01) {
          refuse(
            g,
            SALES_ERROR_CODES.AMOUNT_MISMATCH,
            `${kind} adjustments total ${total} but ${field} says ${declared}`,
            { field },
          );
        }
      }
    }

    // 14 · e-way bill: applicable but the band is empty.
    const company = await this.company(tx, snap.companyId);
    const inter = supplyNatureOf(company?.comp_state_code, snap.posStcd) === 'INTER';
    const eway = await this.statutory.ewayApplicable(
      snap.companyId,
      snap.billAmt,
      snap.billDate,
      { interState: inter, stateCode: snap.posStcd },
      tx,
    );
    if (eway.applicable && snap.billMode !== 'POS') {
      // The band the BODY carries wins: a /validate of a draft that has not
      // been saved yet has no stored band, and was told "transport missing"
      // for it (E-WAY-DB). A body that says nothing about transport reads the
      // stored band, as post and amend do.
      const band =
        snap.transport !== undefined
          ? snap.transport
          : snap.sbId
            ? await this.transportBand.read(
                { docType: 'SALE_BILL', docId: snap.sbId, accYear: snap.accYear },
                tx,
              )
            : null;
      if (!band || (!band.transporterId && !band.transporterName && !band.lrNo)) {
        warn(
          g,
          SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING,
          `An e-way bill is required for this consignment (${snap.billAmt} ${inter ? 'inter' : 'intra'}-state) and the transport band is empty`,
          { field: 'transport' },
        );
      }
    }

    // 15 · stock — what the engine will say, said early.
    for (const i of snap.items) {
      if (i.isService || i.srcDocType === 'DELIVERY_CHALLAN' || i.qty <= 0) {
        continue;
      }
      const [row] = await tx.$queryRaw<{ on_hand: Prisma.Decimal | null }[]>`
        SELECT SUM(sbl_available_qty) AS on_hand FROM stock.stock_balance
         WHERE sbl_company_id = ${snap.companyId}::uuid AND sbl_branch_id = ${snap.branchId}::uuid
           AND sbl_godown_id = ${i.godownId}::uuid AND sbl_item_id = ${i.itemId}::uuid
           AND sbl_bucket = ${i.bucket} AND sbl_is_deleted = false`;
      const factor = i.toBaseFactor ?? 1;
      if (num(row?.on_hand) < i.qty * factor - 0.0005) {
        g.warnings.push({
          code: SALES_ERROR_CODES.STOCK_NEGATIVE,
          level: 'INFO',
          message: `Line ${i.lineNo}: ${num(row?.on_hand)} on hand in this godown against ${round2(i.qty * factor)} billed — the item's negative-stock policy decides at post`,
          line: i.lineNo,
          overridable: false,
        });
      }
    }
  }

  private async guardSources(
    tx: Prisma.TransactionClient,
    snap: BillSnapshot,
    g: SalesGuardContext,
    allowOverOrder: boolean,
  ): Promise<void> {
    const orderLines = snap.items.filter((i) => i.srcDocType === 'SALES_ORDER' && i.srcItemId);
    const dcLines = snap.items.filter((i) => i.srcDocType === 'DELIVERY_CHALLAN' && i.srcItemId);
    // Only a CONFIRMED or PARTIAL order is billable — the same rule
    // /bills/open-sources lists by. It was only ever enforced there, so a
    // whole-order import of a DRAFT posted, and drew down an order nobody had
    // confirmed. Checked by order, from the header and every line, so a line
    // that names its order without a line id is caught too.
    const orderIds = [
      ...new Set(
        [
          snap.srcDocType === 'SALES_ORDER' ? snap.srcDocId : null,
          ...snap.items.map((i) => (i.srcDocType === 'SALES_ORDER' ? i.srcDocId : null)),
        ].filter((id): id is string => !!id),
      ),
    ];
    if (orderIds.length > 0) {
      const orders = await tx.$queryRaw<
        { so_id: string; so_order_refno: string | null; so_status: string }[]
      >`
        SELECT so_id, so_order_refno, so_status FROM sales.sale_order
         WHERE so_id = ANY(${orderIds}::uuid[]) AND so_is_deleted = false`;
      const byId = new Map(orders.map((o) => [o.so_id, o]));
      for (const id of orderIds) {
        const o = byId.get(id);
        if (!o || !['CONFIRMED', 'PARTIAL'].includes(o.so_status)) {
          refuse(
            g,
            SALES_ERROR_CODES.ORDER_NOT_OPEN,
            o
              ? `Order ${o.so_order_refno ?? id} is ${o.so_status} — only a CONFIRMED or PARTIAL order can be billed`
              : `Order ${id} does not exist`,
            { field: 'items' },
          );
        }
      }
    }
    if (orderLines.length > 0) {
      const rows = await tx.$queryRaw<
        { soi_id: string; soi_pending_qty: Prisma.Decimal | null; so_status: string }[]
      >`
        SELECT d.soi_id, d.soi_pending_qty, h.so_status
          FROM sales.sale_order_item d JOIN sales.sale_order h ON h.so_id = d.soi_order_id AND h.so_acc_year = d.soi_acc_year
         WHERE d.soi_id = ANY(${orderLines.map((l) => l.srcItemId)}::uuid[])`;
      const by = new Map(rows.map((r) => [r.soi_id, r]));
      const taken = new Map<string, number>();
      for (const l of orderLines) {
        taken.set(l.srcItemId!, (taken.get(l.srcItemId!) ?? 0) + l.qty);
      }
      for (const [soiId, qty] of taken) {
        const r = by.get(soiId);
        if (!r) {
          refuse(g, SALES_ERROR_CODES.ORDER_LINE_OVER, `Order line ${soiId} does not exist`, {
            field: 'items',
          });
          continue;
        }
        if (qty > num(r.soi_pending_qty) + 0.0005) {
          const msg = `Order line has ${num(r.soi_pending_qty)} pending; this bill takes ${qty}`;
          if (allowOverOrder) {
            warn(g, SALES_ERROR_CODES.ORDER_LINE_OVER, msg, { field: 'items' });
          } else {
            refuse(g, SALES_ERROR_CODES.ORDER_LINE_OVER, msg, { field: 'items' });
          }
        }
      }
    }
    if (dcLines.length > 0) {
      const rows = await tx.$queryRaw<
        {
          sdi_id: string;
          sdi_open_qty: Prisma.Decimal | null;
          sdc_purpose: string;
          sdc_status: string;
        }[]
      >`
        SELECT d.sdi_id, d.sdi_open_qty, h.sdc_purpose, h.sdc_status
          FROM sales.sale_dc_item d JOIN sales.sale_dc h ON h.sdc_id = d.sdi_dc_id AND h.sdc_acc_year = d.sdi_acc_year
         WHERE d.sdi_id = ANY(${dcLines.map((l) => l.srcItemId)}::uuid[])`;
      const by = new Map(rows.map((r) => [r.sdi_id, r]));
      const taken = new Map<string, number>();
      for (const l of dcLines) {
        taken.set(l.srcItemId!, (taken.get(l.srcItemId!) ?? 0) + l.qty);
      }
      for (const [sdiId, qty] of taken) {
        const r = by.get(sdiId);
        if (!r || r.sdc_status !== 'POSTED') {
          refuse(
            g,
            SALES_ERROR_CODES.DC_LINE_OVER,
            `Challan line ${sdiId} is not on a POSTED challan`,
            { field: 'items' },
          );
          continue;
        }
        if (r.sdc_purpose !== 'SUPPLY') {
          refuse(
            g,
            SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED,
            `The challan's purpose is ${r.sdc_purpose} — convert it to SUPPLY before billing against it`,
            { field: 'items' },
          );
        }
        if (qty > num(r.sdi_open_qty) + 0.0005) {
          refuse(
            g,
            SALES_ERROR_CODES.DC_LINE_OVER,
            `Challan line has ${num(r.sdi_open_qty)} open; this bill takes ${qty}`,
            { field: 'items' },
          );
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  postCore — flow §5.1 steps 1–13, status LAST
  // ═══════════════════════════════════════════════════════════════════════

  async postCore(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    items: SaleBillItem[],
    snap: BillSnapshot,
    ctx: SalesCallContext,
    opts: {
      adjustments?: SaveBillAdjustmentDto[];
      now: Date;
      fromStatus: string;
      revisionNo?: number;
      /** Amend: the bill's own voucher, back in DRAFT, to restate in place. */
      restateVoucherId?: string | null;
    },
  ): Promise<PostResult> {
    const { now } = opts;
    const actor = ctx.actor;
    const partyId = snap.custId!;
    const company = await this.company(tx, snap.companyId);
    const supplyNature = supplyNatureOf(company?.comp_state_code, snap.posStcd);
    const refno = snap.refno ?? bill.sbBillRefno ?? bill.sbId;

    // 1 · the goods. Lines against a challan already left the shelf.
    const moving = snap.items.filter(
      (i) => !i.isService && i.srcDocType !== 'DELIVERY_CHALLAN' && i.qty > 0,
    );
    const stock = await this.stock.post(
      tx,
      {
        docType: 'SALE_BILL',
        docId: bill.sbId,
        accYear: bill.sbAccYear,
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        deviceId: bill.sbDeviceId,
        sessionId: bill.sbSessionId,
        docDate: snap.billDate,
        docDatetime: bill.sbBillDatetime ?? now,
        refno,
        revision: opts.revisionNo ?? bill.sbRevisionNo,
        partyId,
        direction: 'OUT',
        txnType: 'SALE',
        lines: moving.map((i) => ({
          lineId: i.sbiId!,
          lineNo: i.lineNo,
          itemId: i.itemId,
          itemUnitId: i.itemUnitId,
          godownId: i.godownId,
          lotId: i.lotId,
          bucket: i.bucket,
          qty: i.isFree ? 0 : i.qty,
          freeQty: i.isFree ? i.qty : 0,
          weightQty: i.weightQty,
          toBaseFactor: i.toBaseFactor,
          batchNo: i.batchNo,
          batchDate: i.batchDate,
          expiryDate: i.expiryDate,
          serialNo: i.serialNo,
          mrp: i.maxPrice,
          rate: i.rate,
          taxPerc: i.taxPerc,
        })),
      },
      actor,
      now,
    );
    // Write the resolved lot and the cost back onto the bill's own lines.
    for (const i of moving) {
      const cost = stock.costByLine.get(i.sbiId!) ?? 0;
      const lot = stock.lotByLine.get(i.sbiId!) ?? i.lotId ?? null;
      await tx.saleBillItem.update({
        where: { sbiId_sbiAccYear: { sbiId: i.sbiId!, sbiAccYear: bill.sbAccYear } },
        data: { sbiCogsAmt: decimal(cost), sbiLotId: lot },
      });
    }
    const cogsAmt = ctx.cogsMode === 'PERPETUAL' ? stock.cogsTotal : 0;

    // 2 · the set-offs the post will make — decided BEFORE the legs.
    const adjustments = await this.resolveAdjustments(tx, snap, partyId, opts.adjustments);
    const credits = await loadSetOffCredits(tx, adjustments);
    const split = splitSetOffs(adjustments, credits);
    const advanceAdjusted = round2(split.advance);
    const noteAdjusted = round2(split.note);
    // One leg pair per ledger the spent credits were HELD in — see
    // loadSetOffCredits. A credit held on the party moves nothing.
    const setOffs = new Map<string, number>();
    for (const a of adjustments) {
      const credit = credits.get(setOffKey(a.againstBillId, a.againstBillAccYear));
      if (credit && credit.holdingLedgerId !== partyId) {
        setOffs.set(
          credit.holdingLedgerId,
          round2((setOffs.get(credit.holdingLedgerId) ?? 0) + num(a.amount)),
        );
      }
    }

    // 3 · the legs.
    const legs = buildBillLegs({
      partyLedgerId: partyId,
      supplyNature,
      salesAmount: snap.taxableAmt,
      taxes: bucketTaxes(
        snap.items.map((i) => ({
          taxId: i.taxId,
          cgst: i.cgstAmt,
          sgst: i.sgstAmt,
          igst: i.igstAmt,
          cess: i.cessAmt,
          acess: i.acessAmt,
        })),
      ),
      charges: snap.charges.map((c) => ({
        ledgerId: c.ledgerId,
        amount: c.amount,
        separatelyPosted: c.separatelyPosted,
        cgst: c.cgst,
        sgst: c.sgst,
        igst: c.igst,
        cess: c.cess,
        name: c.name,
      })),
      cashDiscount: snap.cashDisc,
      schemeDiscount: ctx.settings.postSchemeDiscSeparately ? snap.schDisc + snap.billSchDisc : 0,
      roundOff: snap.roundOff,
      tcsAmount: snap.tcsAmt,
      setOffs: [...setOffs].map(([ledgerId, amount]) => ({ ledgerId, amount })),
      tenders: snap.tenders.map((t) => ({
        tenderTypeId: t.tenderTypeId,
        tenderLedgerId: t.tenderLedgerId,
        amount: t.amount,
        isLoyalty: t.tenderTypeId === TENDER_TYPE.LOYALTY,
        isCredit: isCreditTender(t),
        name: t.name,
      })),
      cogsAmount: cogsAmt,
    });
    const voucher = await this.legs.postLegs(tx, {
      header: {
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        tenantId: bill.sbTenantId,
        accYear: bill.sbAccYear,
        voucherTypeId: SALES_VOUCHER_TYPE.BILL,
        voucherDate: snap.billDate,
        srcModule: 'SALES',
        srcDocType: 'SALE_BILL',
        srcDocId: bill.sbId,
        docRefno: refno,
        docDate: snap.billDate,
        usrRefno: snap.usrRefno,
        docAmount: snap.billAmt,
        roundOff: snap.roundOff,
        partyId,
        userId: isUuid(snap.userId) ? snap.userId : actor,
        sessionId: snap.sessionId,
        deviceType: snap.deviceType,
        deviceId: isUuid(snap.deviceId) ? snap.deviceId : null,
        remarks: snap.remarks,
        deviceCode: snap.billMode === 'POS' ? snap.deviceId : null,
        createdBy: actor,
        presetRefno: bill.sbBillRefno,
        presetNo: bill.sbBillSlno,
        restateVoucherId: opts.restateVoucherId ?? null,
      },
      legs,
    });

    // 3b · the cheques. A CHEQUE tender posted DR Cheques In Hand above, but
    //      the money is still paper: the register row is what lets it be
    //      deposited, cleared or bounced (notes 46). On an amend's re-post a
    //      td row that kept its id keeps its register row.
    await syncBillPdcRegister(
      tx,
      bill,
      { voucherId: voucher.voucherId, accYear: bill.sbAccYear },
      actor,
      now,
      // notes (48): drawer / branch / IFSC / MICR the draft kept for /post.
      { details: readDraftCheques(bill.sbDraftCheques) },
    );

    // 4 · the GST view.
    const reg = await this.register.write(
      tx,
      this.registerDoc(bill, snap, voucher.voucherId, voucher.voucherLastNo, supplyNature, actor),
      {
        companyEinvoiceFlag: company?.comp_einvoice_applicable ?? false,
        interState: supplyNature === 'INTER',
      },
    );

    // 5 · the receivable.
    const settled = settledByTenders(snap);
    const ablId = await this.writeBalanceRow(
      tx,
      bill,
      snap,
      partyId,
      voucher.voucherId,
      voucher.voucherLastNo,
      settled,
      actor,
      now,
    );

    // 5b · what was paid at the counter, as ALLOCATION rows on the receivable
    //      (notes 49 item 2): the recompute every receipt runs counts only
    //      adjustment rows, and a counter payment with no row behind it was
    //      dropped by the first receipt. Before the set-offs, and capped at
    //      what the set-offs leave — the same figure writeBalanceRow seeded.
    const setOffTotal = adjustments.reduce((t, a) => t + num(a.amount), 0);
    await syncCounterAllocations(tx, {
      bill,
      abl: { ablId, ablAccYear: bill.sbAccYear },
      partyId,
      voucherFor: () => ({ voucherId: voucher.voucherId, accYear: bill.sbAccYear }),
      cap: decimal(Math.max(0, round2(snap.billAmt - setOffTotal))),
      actor,
      now,
    });

    // 6 · the set-offs, now that the invoice row exists.
    if (adjustments.length > 0) {
      await syncBillAdjustments(
        tx,
        {
          billId: ablId,
          billAccYear: bill.sbAccYear,
          billAmount: decimal(snap.billAmt),
          paidAmount: decimal(settled),
          companyId: bill.sbCompanyId,
          branchId: bill.sbBranchId,
          tenantId: bill.sbTenantId,
          accYear: bill.sbAccYear,
          partyId,
          adjDate: bill.sbBillDate,
          userId: isUuid(snap.userId) ? snap.userId : actor,
          sessionId: snap.sessionId,
        },
        adjustments,
        actor,
        now,
      );
    }

    // 7 · temporary credits — the WHO on the balance row.
    for (const t of snap.tenders.filter(
      (x) => x.tenderTypeId === TENDER_TYPE.TEMP_CREDIT && x.tempCredit,
    )) {
      const tc = t.tempCredit!;
      await tx.accTempCredit.create({
        data: {
          atcCompanyId: bill.sbCompanyId,
          atcBranchId: bill.sbBranchId,
          atcTenantId: bill.sbTenantId,
          atcAccYear: bill.sbAccYear,
          atcPartyId: partyId,
          atcSrcDocType: 'SALE_BILL',
          atcSrcDocId: bill.sbId,
          atcBillRefno: refno,
          atcBillDate: bill.sbBillDate,
          atcBillAmount: decimal(snap.billAmt),
          atcAblId: ablId,
          atcAblAccYear: bill.sbAccYear,
          atcTenderId: t.tdId,
          atcTenderAccYear: t.tdId ? bill.sbAccYear : null,
          atcName: tc.name,
          atcMobile: tc.mobile,
          atcPlace: tc.place,
          atcAddr: tc.addr,
          atcIdRef: tc.idRef,
          atcDays: tc.days,
          atcDueDate: new Date(`${addDays(snap.billDate, tc.days)}T00:00:00Z`),
          atcCreditAmount: decimal(t.amount),
          atcBalanceAmount: decimal(t.amount),
          atcStatus: 'OPEN',
          atcRemarks: tc.notes,
          atcUserId: isUuid(snap.userId) ? snap.userId : null,
          atcCounterId: bill.sbCounterId,
          atcSessionId: snap.sessionId,
          atcCreatedOn: now,
          atcCreatedBy: actor,
        },
      });
    }

    // 8 · loyalty — redeem what the tenders spent, earn on the rest.
    let earned = 0;
    let earnPoints = 0;
    let redeemed = 0;
    let redeemPoints = 0;
    let lscId: string | null = null;
    if (partyId !== ctx.settings.defaultCustomerId || snap.loyaltyMemberId) {
      const lines = await this.loyaltyLines(tx, snap);
      const source = this.loyaltySource(snap, lines, snap.loyaltyMemberId);
      const memberId = await this.loyalty.resolveMember(tx, source, {
        autoEnrol: ctx.settings.loyaltyAutoEnrol,
        isWalkIn: partyId === ctx.settings.defaultCustomerId,
        createdBy: actor,
      });
      if (memberId) {
        for (const t of snap.tenders.filter(
          (x) => x.tenderTypeId === TENDER_TYPE.LOYALTY && x.tdId,
        )) {
          const r = await this.loyalty.redeem(
            tx,
            { ...source, memberId },
            {
              tenderId: t.tdId!,
              tenderAccYear: bill.sbAccYear,
              points: t.unitsUsed,
              amount: t.amount,
            },
            { memberId, createdBy: actor },
          );
          redeemed += r.amount;
          redeemPoints += r.points;
        }
        const e = await this.loyalty.earn(
          tx,
          { ...source, memberId, redeemedAmount: redeemed },
          { memberId, createdBy: actor },
        );
        earnPoints = e.points;
        earned = e.points;
        lscId = e.schemeId;
        for (const l of e.lines) {
          const item = items.find((x) => x.sbiLineNo === l.lineNo);
          if (item) {
            await tx.saleBillItem.update({
              where: { sbiId_sbiAccYear: { sbiId: item.sbiId, sbiAccYear: bill.sbAccYear } },
              data: {
                sbiLoyaltyPoints: new Prisma.Decimal(l.points),
                sbiLoyaltyPv: new Prisma.Decimal(l.pv),
              },
            });
          }
        }
        if (memberId !== snap.loyaltyMemberId) {
          snap.loyaltyMemberId = memberId;
        }
      }
    }

    // 9 · promotions and charge carry.
    const applied = this.promoApplied(snap);
    if (applied.length > 0) {
      await this.promo.record(tx, this.promoDoc(snap, refno), applied);
    }
    await this.chargeCarry.consume(
      tx,
      snap.charges.map((c) => ({
        srcChargeId: c.srcChargeId,
        srcAccYear: c.srcAccYear,
        amount: c.amount,
        basis: (c.carryBasis ?? undefined) as never,
      })),
      { canOverride: ctx.rights.override },
    );

    // 10 · the header, status LAST.
    const paid = round2(settled + advanceAdjusted + noteAdjusted);
    const balance = round2(snap.billAmt - paid);
    const revisionNo = opts.revisionNo ?? bill.sbRevisionNo;
    const posted = await tx.saleBill.update({
      where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
      data: {
        sbStatus: BILL_STATUS_POSTED,
        sbPostedVoucherId: voucher.voucherId,
        sbDocRegisterId: reg.gdrId,
        sbCogsAmt: decimal(cogsAmt),
        sbTotalCost: decimal(stock.cogsTotal),
        sbLoyaltyMemberId: snap.loyaltyMemberId,
        sbLoyaltyEarned: decimal(earned),
        sbLoyaltyRedeemed: decimal(redeemed),
        sbLoyaltyEarnPoints: new Prisma.Decimal(earnPoints),
        sbLoyaltyRedeemPoints: new Prisma.Decimal(redeemPoints),
        sbLscId: lscId,
        sbAdvanceAmt: decimal(advanceAdjusted),
        sbNoteAdjAmt: decimal(noteAdjusted),
        sbPaidAmt: decimal(paid),
        sbBalanceAmt: decimal(balance),
        sbPayStatus: balance <= 0.005 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
        sbDeliveryStatus: snap.billMode === 'POS' ? 'NA' : 'PENDING',
        sbRevisionNo: revisionNo,
        // The draft's cheque details are in the register now (step 3b).
        sbDraftCheques: Prisma.DbNull,
        sbHasDc: snap.items.some((i) => i.srcDocType === 'DELIVERY_CHALLAN'),
        sbModifiedOn: now,
        sbModifiedBy: ctx.actorName,
      },
    });

    // 11 · the sources — only a POSTED bill draws down an order or a challan.
    await this.afterStatusChange(tx, posted, items, actor, now);

    // 12 · the trail.
    await appendTxnStatusLog(tx, {
      companyId: bill.sbCompanyId,
      branchId: bill.sbBranchId,
      tenantId: bill.sbTenantId,
      accYear: bill.sbAccYear,
      srcModule: BILL_STATUS_SRC_MODULE,
      srcDocType: BILL_STATUS_SRC_DOC_TYPE,
      srcDocId: bill.sbId,
      srcDocRefno: refno,
      event: TxnStatusEvent.POSTED,
      fromStatus: opts.fromStatus,
      toStatus: BILL_STATUS_POSTED,
      changedOn: now,
      changedBy: actor,
      remarks: opts.revisionNo ? `Re-posted as revision ${opts.revisionNo}` : null,
      deviceId: bill.sbDeviceId,
      sessionId: bill.sbSessionId,
    });
    await this.audit.logEntityChange(
      {
        action: 'update',
        tableName: 'sale_bill',
        screenName: 'Sale Bill',
        screenType: 'transaction',
        pk: bill.sbId,
        displayName: refno,
        originalRecord: { sbStatus: opts.fromStatus },
        modifiedRecord: {
          sbStatus: BILL_STATUS_POSTED,
          sbPostedVoucherId: voucher.voucherId,
          sbDocRegisterId: reg.gdrId,
          sbCogsAmt: cogsAmt,
        },
        userId: actor,
        notes: `Bill posted (voucher ${voucher.voucherRefno})`,
      },
      tx,
    );

    // 13 · the trial check (notes 47) — LAST, after every write: the party's
    //      bills = its ledger, Cheques In Hand = the register.
    await assertBooksReconcile(tx, {
      companyId: bill.sbCompanyId,
      accYear: bill.sbAccYear,
      ledgerIds: [partyId],
      vouchers: [{ voucherId: voucher.voucherId, accYear: bill.sbAccYear }],
    });

    return {
      bill: posted,
      gdrId: reg.gdrId,
      einvoice: reg.einvoiceApplicable,
      ewaybill: reg.ewaybillApplicable,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  unwind — cancel and amend share it
  // ═══════════════════════════════════════════════════════════════════════

  private async assertUnwindable(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    ctx: SalesCallContext,
    reason: string,
    verb: 'cancel' | 'amend',
  ): Promise<void> {
    const docDate = isoDate(bill.sbBillDate) ?? isoToday();
    await assertAccYearWritable(tx, bill.sbCompanyId, bill.sbAccYear, 'sbAccYear');
    if (await loadDayClosed(tx, bill.sbCompanyId, bill.sbBranchId, docDate)) {
      throwSalesLocked(
        `The books for ${docDate} are closed at this branch`,
        SALES_ERROR_CODES.DAY_CLOSED,
        'sbBillDate',
      );
    }
    await assertCancellable(tx, {
      billId: bill.sbId,
      accYear: bill.sbAccYear,
      companyId: bill.sbCompanyId,
    });
    // A cheque the bank has already seen is the Cheques screen's story now —
    // refused here, BEFORE the IRN below is cancelled at the portal.
    await assertBillPdcHeld(tx, bill);

    // Lock 2 on a cancel: inside the window the IRN is cancelled FIRST,
    // synchronously, and the cancel proceeds only on success.
    const { irnLive, ewbLive } = await loadDeclaredLocks(tx, bill.sbDocRegisterId);
    if (irnLive || ewbLive) {
      const gst = await this.docBlocks.gstRows(tx, bill.sbDocRegisterId, bill.sbAccYear);
      if (irnLive) {
        const w = gst.irnGeneratedOn
          ? await this.statutory.withinCancelWindow(
              bill.sbCompanyId,
              'IRN',
              gst.irnGeneratedOn,
              docDate,
              new Date(),
              tx,
            )
          : { within: false };
        if (!w.within) {
          throwSalesLocked(
            `The IRN's cancellation window has passed — a posted invoice is now corrected by a credit note, not by ${verb === 'cancel' ? 'cancelling it' : 'an amendment'}`,
            SALES_ERROR_CODES.IRN_WINDOW_PASSED,
            'posting.irn',
          );
        }
        await this.gst.cancelIrn({
          gdrId: bill.sbDocRegisterId!,
          accYear: bill.sbAccYear,
          companyId: bill.sbCompanyId,
          reason,
        });
      }
      if (ewbLive) {
        const w = gst.ewbGeneratedOn
          ? await this.statutory.withinCancelWindow(
              bill.sbCompanyId,
              'EWAYBILL',
              gst.ewbGeneratedOn,
              docDate,
              new Date(),
              tx,
            )
          : { within: false };
        if (!w.within) {
          throwSalesLocked(
            "The e-way bill's cancellation window has passed — cancel it at the portal or let it expire first",
            SALES_ERROR_CODES.EWB_WINDOW_PASSED,
            'posting.ewb',
          );
        }
        await this.gst.cancelEwb({
          gdrId: bill.sbDocRegisterId!,
          accYear: bill.sbAccYear,
          companyId: bill.sbCompanyId,
          reason,
        });
      }
    }
    void ctx;
  }

  private async unwind(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    items: SaleBillItem[],
    ctx: SalesCallContext,
    reason: string,
    now: Date,
    mode: 'cancel' | 'amend' = 'cancel',
  ): Promise<{ reversalRefno: string | null; restateVoucherId: string | null }> {
    const actor = ctx.actor;
    let reversalRefno: string | null = null;
    let restateVoucherId: string | null = null;

    // 1 · the mirror voucher — or, on an amend, the voucher back to DRAFT with
    //     its legs retired, for the re-post to restate under the same number.
    if (bill.sbPostedVoucherId && mode === 'amend') {
      if (await this.legs.retireForRestate(tx, bill.sbPostedVoucherId, bill.sbAccYear, actor)) {
        restateVoucherId = bill.sbPostedVoucherId;
      }
    } else if (bill.sbPostedVoucherId) {
      const r = await this.legs.reverseLegs(
        tx,
        bill.sbPostedVoucherId,
        bill.sbAccYear,
        reason,
        actor,
      );
      if (r) {
        const [row] = await tx.$queryRaw<{ avh_voucher_refno: string | null }[]>`
          SELECT avh_voucher_refno FROM accounts.acc_voucher_header
           WHERE avh_voucher_id = ${r.voucherId}::uuid AND avh_acc_year = ${bill.sbAccYear}::char(9)`;
        reversalRefno = row?.avh_voucher_refno ?? null;
      }
    }
    // 2 · the goods come back.
    await this.stock.cancel(
      tx,
      {
        docType: 'SALE_BILL',
        docId: bill.sbId,
        accYear: bill.sbAccYear,
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        direction: 'OUT',
        txnType: 'SALE',
      },
      actor,
      reason,
      now,
    );
    // 3 · the register row. An amend refiles the same invoice number, so its
    //     old row is retired rather than marked CANCELED (see retire()).
    if (bill.sbDocRegisterId && mode === 'amend') {
      await this.register.retire(tx, bill.sbDocRegisterId, bill.sbAccYear, actor);
    } else if (bill.sbDocRegisterId) {
      await this.register.cancel(tx, bill.sbDocRegisterId, bill.sbAccYear, reason, actor);
    }
    // 4 · loyalty — earned points taken back, redeemed points restored.
    await this.loyalty.reverseForCancel(
      tx,
      {
        docId: bill.sbId,
        accYear: bill.sbAccYear,
        docType: 'SALE_BILL',
        docRefno: bill.sbBillRefno,
      },
      { reason, createdBy: actor },
    );
    // 5 · promotions and charge carry.
    await this.promo.reverse(tx, { docId: bill.sbId, accYear: bill.sbAccYear }, reason, actor);
    const charges = await this.prismaChargesOf(tx, bill);
    await this.chargeCarry.release(tx, charges);
    // 6 · the set-offs and the receivable.
    const abl = await tx.accBillBalance.findFirst({
      where: {
        ablSrcDocId: bill.sbId,
        ablAccYear: bill.sbAccYear,
        ablSrcDocType: 'SALE_BILL',
        ablIsDeleted: false,
      },
      select: { ablId: true },
    });
    if (abl) {
      // The counter-payment rows go with the receivable they settle.
      await retireCounterAllocations(
        tx,
        bill,
        { ablId: abl.ablId, ablAccYear: bill.sbAccYear },
        actor,
        now,
      );
    }
    if (abl && bill.sbCustId) {
      await syncBillAdjustments(
        tx,
        {
          billId: abl.ablId,
          billAccYear: bill.sbAccYear,
          billAmount: bill.sbBillAmt ?? new Prisma.Decimal(0),
          paidAmount: bill.sbPaidAmt ?? new Prisma.Decimal(0),
          companyId: bill.sbCompanyId,
          branchId: bill.sbBranchId,
          tenantId: bill.sbTenantId,
          accYear: bill.sbAccYear,
          partyId: bill.sbCustId,
          adjDate: bill.sbBillDate,
          userId: isUuid(bill.sbUserId) ? bill.sbUserId : actor,
          sessionId: bill.sbSessionId,
        },
        [],
        actor,
        now,
      );
      await tx.accBillBalance.update({
        where: { ablId_ablAccYear: { ablId: abl.ablId, ablAccYear: bill.sbAccYear } },
        data: {
          ablIsActive: false,
          ablIsDeleted: true,
          ablNarration: reason,
          ablModifiedOn: now,
          ablModifiedBy: actor,
        },
      });
    }
    // 7 · temporary credits.
    await tx.accTempCredit.updateMany({
      where: { atcSrcDocId: bill.sbId, atcAccYear: bill.sbAccYear, atcIsDeleted: false },
      data: {
        atcStatus: 'CANCELLED',
        atcBalanceAmount: 0,
        atcRemarks: reason,
        atcModifiedOn: now,
        atcModifiedBy: actor,
      },
    });
    // 8 · the cheques. A cancel takes them out of the register; an amend
    //     leaves them for the re-post's sync, which keeps the row of every td
    //     row that survives the edit and cancels the rest.
    if (mode === 'cancel') {
      await cancelBillPdcRegister(tx, bill, reason, actor, now);
    }
    void items;
    return { reversalRefno, restateVoucherId };
  }

  /** Order and challan fulfilment, re-derived after any status change. */
  private async afterStatusChange(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    items: SaleBillItem[],
    actor: string,
    now: Date,
  ): Promise<void> {
    // The order's reservations: a post consumes, a cancel gives back.
    const sign = bill.sbStatus === BILL_STATUS_POSTED ? 1 : -1;
    for (const i of items) {
      if (i.sbiSrcDocType !== 'SALES_ORDER' || !i.sbiSrcDocId || i.sbiSrcDocLineNo === null) {
        continue;
      }
      const factor = num(i.sbiToBaseFactor) || 1;
      await this.reservations.consume(
        tx,
        { docId: i.sbiSrcDocId, lineNo: i.sbiSrcDocLineNo },
        sign * num(i.sbiBillQty) * factor,
        actor,
        now,
      );
    }
    await this.saleOrders.syncOrderFulfilment(
      tx,
      { refs: this.bills.orderRefsOf(bill, items) },
      actor,
      now,
    );
    const dcs = await this.dcFulfilment.dcRefsOfBill(tx, bill.sbId, bill.sbAccYear);
    await this.dcFulfilment.recompute(tx, dcs, actor, now);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * The set-offs to apply. Named in the body → those. Otherwise the party's
   * open credits FIFO, each kind up to its own header figure: advances up to
   * `sbAdvanceAmt` (the bill's own order's advance first), then credit notes
   * up to `sbNoteAdjAmt`.
   */
  private async resolveAdjustments(
    tx: Prisma.TransactionClient,
    snap: BillSnapshot,
    partyId: string,
    named: SaveBillAdjustmentDto[] | undefined,
  ): Promise<SaveBillAdjustmentDto[]> {
    if (named && named.length > 0) {
      return named;
    }
    const out: SaveBillAdjustmentDto[] = [];
    for (const [billType, field, asked] of [
      ['ADVANCE', 'sbAdvanceAmt', round2(snap.advanceAmt)],
      ['SALES_RETURN', 'sbNoteAdjAmt', round2(snap.noteAdjAmt)],
    ] as const) {
      let want = asked;
      if (want <= 0) {
        continue;
      }
      const credits = await tx.$queryRaw<
        {
          abl_id: string;
          abl_acc_year: string;
          abl_pending_amount: Prisma.Decimal | null;
        }[]
      >`
        SELECT abl_id, abl_acc_year, abl_pending_amount
          FROM accounts.acc_bill_balance
         WHERE abl_company_id = ${snap.companyId}::uuid AND abl_party_id = ${partyId}::uuid
           AND abl_dr_cr = 'CR' AND abl_pending_amount > 0 AND abl_is_deleted = false AND abl_is_active = true
           AND abl_bill_type = ${billType}
         ORDER BY (abl_src_doc_id = ${snap.srcDocId ?? '00000000-0000-0000-0000-000000000000'}::uuid) DESC,
                  abl_doc_date, abl_created_on
         FOR UPDATE`;
      for (const c of credits) {
        if (want <= 0.005) {
          break;
        }
        const take = Math.min(want, num(c.abl_pending_amount));
        if (take <= 0) {
          continue;
        }
        out.push({
          againstBillId: c.abl_id,
          againstBillAccYear: c.abl_acc_year.trim(),
          amount: round2(take),
        } as SaveBillAdjustmentDto);
        want = round2(want - take);
      }
      if (want > 0.005) {
        refuse(
          createGuardContext(),
          SALES_ERROR_CODES.AMOUNT_MISMATCH,
          `${field} asks to set off ${asked} but the customer holds only ${round2(asked - want)} in open ${billType === 'ADVANCE' ? 'advances' : 'credit notes'}`,
          { field },
        );
      }
    }
    return out;
  }

  private registerDoc(
    bill: SaleBill,
    snap: BillSnapshot,
    voucherId: string,
    voucherNo: bigint,
    supplyNature: 'INTRA' | 'INTER',
    actor: string,
  ): RegisterDoc {
    const lines: RegisterDetailLine[] = snap.items.map((i) => {
      const tax = i.cgstAmt + i.sgstAmt + i.igstAmt + i.cessAmt;
      const taxable = i.taxableAmt;
      return {
        rowNo: i.lineNo,
        itemId: i.itemId,
        hsnCode: i.hsnCode,
        unitId: i.itemUnitId,
        qty: i.qty,
        rate: i.rate,
        discount: i.itemDiscAmt + i.splDiscAmt + i.schDiscAmt + i.billSchAmt,
        isService: i.isService,
        taxableValue: taxable,
        taxId: i.taxId,
        totalTaxRate: i.taxPerc,
        cgstRate: i.cgstPerc,
        sgstRate: i.sgstPerc,
        igstRate: i.igstPerc,
        cessRate: i.cessPerc,
        cgstAmount: i.cgstAmt,
        sgstAmount: i.sgstAmt,
        igstAmount: i.igstAmt,
        cessAmount: i.cessAmt,
        otherAmount: 0,
        totalValue: round2(taxable + tax),
        billValue: i.netAmt || round2(taxable + tax),
        taxability: tax > 0 || i.taxPerc > 0 ? 'TAXABLE' : 'EXEMPT',
        supplyNature: supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      };
    });
    const taxed = lines.filter((l) => l.taxability === 'TAXABLE').length;
    const services = snap.items.filter((i) => i.isService).length;
    const other = snap.charges
      .filter((c) => c.separatelyPosted)
      .reduce((t, c) => t + c.amount + c.cgst + c.sgst + c.igst + c.cess, 0);
    return {
      companyId: bill.sbCompanyId,
      branchId: bill.sbBranchId,
      accYear: bill.sbAccYear,
      voucherId,
      voucherTypeId: SALES_VOUCHER_TYPE.BILL,
      voucherNo: bill.sbBillSlno ?? numericTail(bill.sbBillRefno, voucherNo),
      voucherDate: snap.billDate,
      voucherRefno: bill.sbBillRefno,
      sourceDocId: bill.sbId,
      docType: snap.docType === 'BILL_OF_SUPPLY' ? 'BILL_OF_SUPPLY' : 'INVOICE',
      tranNature: 'SALE',
      docFlow: 'OUTWARD',
      docSign: 1,
      docNo: bill.sbBillRefno ?? bill.sbId,
      docDate: snap.billDate,
      docRefNo: snap.usrRefno,
      taxability: taxed === 0 ? 'EXEMPT' : taxed === lines.length ? 'TAXABLE' : 'MIXED',
      supplyClass: services === 0 ? 'GOODS' : services === snap.items.length ? 'SERVICES' : 'MIXED',
      supplyNature: supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
      placeOfSupplyCode: snap.posStcd,
      placeOfSupplyName: snap.stateName,
      partyId: snap.custId!,
      partyName: snap.custName,
      partyAddr1: snap.custAddr,
      partyLocation: snap.custPlace,
      partyPin: snap.custPin,
      partyStateCode: snap.custStcd,
      partyStateName: snap.stateName,
      partyGstType: snap.custGstType,
      partyGstin: snap.custGstin?.trim() || null,
      grossValue: snap.grossAmt,
      discountValue: snap.itemDisc + snap.splDisc + snap.schDisc + snap.billSchDisc + snap.cashDisc,
      taxableValue: snap.taxableAmt,
      cgstValue: snap.cgstAmt,
      sgstValue: snap.sgstAmt,
      igstValue: snap.igstAmt,
      cessValue: snap.cessAmt,
      stateCessValue: 0,
      tcsValue: snap.tcsAmt,
      otherCharge: round2(other),
      roundOff: snap.roundOff,
      billValue: snap.billAmt,
      remarks: snap.remarks,
      createdBy: actor,
      lines,
    };
  }

  private async writeBalanceRow(
    tx: Prisma.TransactionClient,
    bill: SaleBill,
    snap: BillSnapshot,
    partyId: string,
    voucherId: string,
    voucherNo: bigint,
    settled: number,
    actor: string,
    now: Date,
  ): Promise<string> {
    const alloc = Math.min(settled, snap.billAmt);
    const created = await tx.accBillBalance.create({
      data: {
        ablCompanyId: bill.sbCompanyId,
        ablBranchId: bill.sbBranchId,
        ablTenantId: bill.sbTenantId,
        ablAccYear: bill.sbAccYear,
        ablPartyId: partyId,
        ablSalesmanId: snap.salesmanId[0] ?? null,
        ablAgentId: bill.sbAgentId,
        ablBillType: 'SALES',
        ablSrcModule: 'SALES',
        ablSrcDocType: 'SALE_BILL',
        ablSrcDocId: bill.sbId,
        ablSrcAccYear: bill.sbAccYear,
        ablVoucherId: voucherId,
        ablVoucherTypeId: SALES_VOUCHER_TYPE.BILL,
        ablVoucherNo: bill.sbBillSlno ?? voucherNo,
        ablVoucherDate: bill.sbBillDate,
        ablVoucherRefno: bill.sbBillRefno,
        ablDocRefno: bill.sbBillRefno ?? bill.sbId,
        ablDocDate: bill.sbBillDate,
        ablDueDate: bill.sbDueDate,
        ablCreditDays: bill.sbDueDays ?? 0,
        ablDrCr: 'DR',
        ablBillAmount: decimal(snap.billAmt),
        ablAllocAmount: decimal(alloc),
        ablTcsAmount: decimal(snap.tcsAmt),
        ablNarration: bill.sbRemarks,
        ablCreatedOn: now,
        ablCreatedBy: actor,
      },
      select: { ablId: true },
    });
    return created.ablId;
  }

  private promoDoc(snap: BillSnapshot, refno?: string | null) {
    return {
      docId: snap.sbId ?? '00000000-0000-0000-0000-000000000000',
      accYear: snap.accYear,
      companyId: snap.companyId,
      branchId: snap.branchId,
      custId: snap.custId,
      docDate: snap.billDate,
      docRefno: refno ?? snap.refno,
      docType: 'SALE_BILL' as const,
      billType: snap.billType,
      srcModule: 'SALES' as const,
      userId: isUuid(snap.userId) ? snap.userId : null,
      deviceId: snap.deviceId,
    };
  }

  private promoApplied(snap: BillSnapshot): PromotionApplied[] {
    const by = new Map<string, PromotionApplied>();
    for (const i of snap.items) {
      if (!i.schemeId) {
        continue;
      }
      const a = by.get(i.schemeId) ?? {
        schemeId: i.schemeId,
        baseAmount: 0,
        baseQty: 0,
        benefitAmt: 0,
        freeQty: 0,
        lineCount: 0,
      };
      a.baseAmount = round2(a.baseAmount + i.taxableAmt);
      a.baseQty += i.qty;
      a.benefitAmt = round2(a.benefitAmt + i.schDiscAmt + i.billSchAmt);
      if (i.isFree && i.freeType === 'SCHEME') {
        a.freeQty += i.qty;
      }
      a.lineCount += 1;
      by.set(i.schemeId, a);
    }
    return [...by.values()];
  }

  private async loyaltyLines(tx: Prisma.TransactionClient, snap: BillSnapshot) {
    const ids = [...new Set(snap.items.map((i) => i.itemId))];
    const rows = ids.length
      ? await tx.itemMaster.findMany({
          where: { itemId: { in: ids } },
          select: {
            itemId: true,
            itemAllowLoyalty: true,
            itemGroupId: true,
            itemCategoryId: true,
            itemBrandId: true,
            itemSectionId: true,
          },
        })
      : [];
    const by = new Map(rows.map((r) => [r.itemId, r]));
    return snap.items.map((i) => {
      const m = by.get(i.itemId);
      return {
        lineNo: i.lineNo,
        itemId: i.itemId,
        unitId: i.itemUnitId,
        qty: i.qty,
        grossAmt: i.grossAmt,
        netAmt: i.netAmt,
        taxableAmt: i.taxableAmt,
        isFree: i.isFree,
        allowLoyalty: m?.itemAllowLoyalty ?? false,
        groupId: m?.itemGroupId ?? null,
        categoryId: m?.itemCategoryId ?? null,
        brandId: m?.itemBrandId ?? null,
        sectionId: m?.itemSectionId ?? null,
      };
    });
  }

  private loyaltySource(
    snap: BillSnapshot,
    lines: LoyaltyBillSource['lines'],
    memberId: string | null,
  ): LoyaltyBillSource {
    return {
      docId: snap.sbId ?? '00000000-0000-0000-0000-000000000000',
      accYear: snap.accYear,
      companyId: snap.companyId,
      branchId: snap.branchId,
      custId: snap.custId ?? '00000000-0000-0000-0000-000000000000',
      docDate: snap.billDate,
      docRefno: snap.refno,
      docType: 'SALE_BILL',
      billType: snap.billType,
      memberId,
      chargesAmt: round2(snap.charges.reduce((t, c) => t + c.amount, 0)),
      redeemedAmount: round2(
        snap.tenders
          .filter((t) => t.tenderTypeId === TENDER_TYPE.LOYALTY)
          .reduce((t, x) => t + x.amount, 0),
      ),
      lines,
    };
  }

  private async prismaChargesOf(tx: Prisma.TransactionClient, bill: SaleBill) {
    const rows = await tx.$queryRaw<
      {
        cd_src_cd_id: string | null;
        cd_src_acc_year: string | null;
        cd_amount: Prisma.Decimal | null;
        cd_carry_basis: string | null;
      }[]
    >`
      SELECT cd_src_cd_id, cd_src_acc_year, cd_amount, cd_carry_basis FROM public.txn_charge_detail
       WHERE cd_doc_type = 'INVOICE' AND cd_doc_id = ${bill.sbId}::uuid AND cd_is_deleted = false`;
    return rows.map((r) => ({
      srcChargeId: r.cd_src_cd_id,
      srcAccYear: r.cd_src_acc_year?.trim() ?? null,
      amount: num(r.cd_amount),
      basis: (r.cd_carry_basis ?? undefined) as never,
    }));
  }

  private async tenderMasters(
    c: Prisma.TransactionClient | PrismaService,
    ids: (string | null | undefined)[],
  ): Promise<
    Map<
      string,
      TenderMasterRow & {
        tnd_min_amount: Prisma.Decimal | null;
        tnd_max_amount: Prisma.Decimal | null;
        tnd_daily_limit: Prisma.Decimal | null;
      }
    >
  > {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (uniq.length === 0) {
      return new Map();
    }
    const rows = await (c as Prisma.TransactionClient).$queryRaw<
      (TenderMasterRow & {
        tnd_min_amount: Prisma.Decimal | null;
        tnd_max_amount: Prisma.Decimal | null;
        tnd_daily_limit: Prisma.Decimal | null;
      })[]
    >`
      SELECT tnd_id, tnd_name, tnd_type_id, tnd_ledger_id, tnd_min_amount, tnd_max_amount, tnd_daily_limit
        FROM accounts.acc_tender_master WHERE tnd_id = ANY(${uniq}::uuid[])`;
    return new Map(rows.map((r) => [r.tnd_id, r]));
  }

  private async company(tx: Prisma.TransactionClient, companyId: string) {
    const [row] = await tx.$queryRaw<
      {
        comp_state_code: string | null;
        comp_einvoice_applicable: boolean;
        comp_dc_purposes: string[] | null;
      }[]
    >`
      SELECT comp_state_code, comp_einvoice_applicable, comp_dc_purposes FROM public.companys WHERE comp_id = ${companyId}::uuid`;
    return row ?? null;
  }

  /** §2.2 proposals — what the server would do, so the screen can show it. */
  private async proposals(
    snap: BillSnapshot,
    ctx: SalesCallContext,
  ): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {
      charges: [],
      advances: [],
      creditNotes: [],
      loyalty: null,
      tempCredit: { openOnMobile: [] },
    };
    await this.prisma.$transaction(async (tx) => {
      if (snap.srcDocType === 'SALES_ORDER' && snap.srcDocId && snap.srcDocYear) {
        const props = await this.chargeCarry.propose(
          tx,
          { orderId: snap.srcDocId, accYear: snap.srcDocYear },
          snap.items
            .filter((i) => i.srcItemId)
            .map((i) => ({ srcLineId: i.srcItemId!, taxableAmt: i.taxableAmt })),
        );
        out.charges = props.map((p) => ({
          cdSrcCdId: p.srcChargeId,
          cdSrcAccYear: p.srcAccYear,
          chgName: p.chargeName,
          orderAmount: p.amount,
          carriedSoFar: p.alreadyCarried,
          proposed: p.proposed,
          basis: p.basis,
          isFinalBill: p.completesOrder,
        }));
      }
      if (snap.custId) {
        const credits = await tx.$queryRaw<
          {
            abl_id: string;
            abl_acc_year: string;
            abl_doc_refno: string | null;
            abl_pending_amount: Prisma.Decimal | null;
            abl_bill_type: string;
            abl_src_doc_id: string | null;
          }[]
        >`
          SELECT abl_id, abl_acc_year, abl_doc_refno, abl_pending_amount, abl_bill_type, abl_src_doc_id
            FROM accounts.acc_bill_balance
           WHERE abl_company_id = ${snap.companyId}::uuid AND abl_party_id = ${snap.custId}::uuid
             AND abl_dr_cr = 'CR' AND abl_pending_amount > 0 AND abl_is_deleted = false AND abl_is_active = true
             AND abl_bill_type IN ('ADVANCE', 'SALES_RETURN')
           ORDER BY (abl_src_doc_id = ${snap.srcDocId ?? '00000000-0000-0000-0000-000000000000'}::uuid) DESC, abl_doc_date`;
        let want = snap.advanceAmt;
        out.advances = credits
          .filter((c) => c.abl_bill_type === 'ADVANCE')
          .map((c) => {
            const proposed = Math.min(Math.max(want, 0), num(c.abl_pending_amount));
            want = round2(want - proposed);
            return {
              ablId: c.abl_id,
              ablAccYear: c.abl_acc_year.trim(),
              refno: c.abl_doc_refno,
              pending: num(c.abl_pending_amount),
              proposed: round2(proposed),
            };
          });
        let wantNote = snap.noteAdjAmt;
        out.creditNotes = credits
          .filter((c) => c.abl_bill_type === 'SALES_RETURN')
          .map((c) => {
            const proposed = Math.min(Math.max(wantNote, 0), num(c.abl_pending_amount));
            wantNote = round2(wantNote - proposed);
            return {
              ablId: c.abl_id,
              ablAccYear: c.abl_acc_year.trim(),
              refno: c.abl_doc_refno,
              pending: num(c.abl_pending_amount),
              proposed: round2(proposed),
            };
          });
        if (snap.loyaltyMemberId || snap.custId !== ctx.settings.defaultCustomerId) {
          const lines = await this.loyaltyLines(tx, snap);
          const source = this.loyaltySource(snap, lines, snap.loyaltyMemberId);
          const memberId =
            snap.loyaltyMemberId ??
            (await this.loyalty.resolveMember(tx, source, {
              autoEnrol: false,
              isWalkIn: snap.custId === ctx.settings.defaultCustomerId,
            }));
          if (memberId) {
            const p = await this.loyalty.preview({ ...source, memberId }, tx);
            out.loyalty = {
              memberId,
              balance: p.balance,
              redeemable: p.redeemable,
              rate: p.rate,
              minPoints: p.minPoints,
              maxPoints: p.maxPoints,
              maxRedeemAmount: p.maxRedeemAmount,
              multiple: p.multiple,
              earnPreview: p.earnPreview,
              schemeId: p.schemeId,
            };
          }
        }
      }
      const mobiles = snap.tenders.map((t) => t.tempCredit?.mobile).filter((m): m is string => !!m);
      if (mobiles.length > 0) {
        const rows = await tx.$queryRaw<
          {
            atc_id: string;
            atc_bill_refno: string | null;
            atc_balance_amount: Prisma.Decimal;
            atc_due_date: Date;
            atc_mobile: string;
          }[]
        >`
          SELECT atc_id, atc_bill_refno, atc_balance_amount, atc_due_date, atc_mobile FROM accounts.acc_temp_credit
           WHERE atc_company_id = ${snap.companyId}::uuid AND atc_mobile = ANY(${mobiles}::text[])
             AND atc_status IN ('OPEN', 'PARTIAL') AND atc_is_deleted = false ORDER BY atc_due_date`;
        out.tempCredit = {
          openOnMobile: rows.map((r) => ({
            atcId: r.atc_id,
            billRefno: r.atc_bill_refno,
            balance: num(r.atc_balance_amount),
            dueDate: isoDate(r.atc_due_date),
            mobile: r.atc_mobile,
          })),
        };
      }
    });
    return out;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}

// Referenced so the lock-2 helper stays importable for the band verb.
void assertBandWritable;
