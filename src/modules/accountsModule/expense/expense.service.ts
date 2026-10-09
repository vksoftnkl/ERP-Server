import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DocRegisterService } from 'src/common/posting/doc-register.service';
import type { RegisterDetailLine, RegisterDoc } from 'src/common/posting/doc-register.types';
import { VoucherPostingService } from 'src/common/posting/voucher-posting.service';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { DEFAULT_ACTOR } from 'src/common/utils/module-shared.utils';
import {
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
} from 'src/common/utils/module-service.utils';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { TillApprovalService } from '../../till/services/till-approval.service';
import { TillSessionService } from '../../till/services/till-session.service';
import { TillErrorCode, TillEventCode } from '../../till/types/till-enum';
import type { TillApprovalNeed } from '../../till/types/till-api.types';
import {
  loadCompanyFacts,
  loadLedgerFacts,
  loadTaxRates,
  resolveRoleLedgerMap,
  type RoleLedgerAsk,
} from '../vouchers/voucher-facts';
import {
  newGuardContext,
  throwRefusals,
  type VoucherGuardContext,
} from '../vouchers/vouchers.errors';
import { checkCashPaymentLimit, type CashPaymentLimitFinding } from '../payment/cash-payment-limit';
import { normalisePaymentTenders, type PaymentTenderInput } from '../payment/payment-lines';
import {
  accYearOf,
  assertAccYearWritable,
  assertVoucherPartitionExists,
} from '../receipt/receipt.guards';
import { TenderDetailService } from '../tenderDetail/tender-detail.service';
import type { SaveTenderDetailDto } from '../tenderDetail/dto/save-tender-detail.dto';
import {
  TenderDrCr,
  TenderSrcDocType,
  TenderSrcModule,
  type TenderDocumentScope,
} from '../tenderDetail/types/tender-detail-api.types';
import type { SaveExpenseDto } from './dto/save-expense.dto';
import { deriveExpense, type DerivedExpense, type ExpenseFacts } from './expense-derive';
import type {
  ExpenseDraftLines,
  ExpenseLedgerPickPayload,
  ExpensePayload,
  ExpensePostPayload,
  ExpenseQuickReasonPayload,
  ExpenseValidatePayload,
} from './types/expense-api.types';
import {
  EXPENSE_GROUP_NATURE,
  EXPENSE_GST_BILL_ABOVE_KEY,
  EXPENSE_REASON_CATEGORY,
  EXPENSE_SRC_DOC_TYPE,
  EXPENSE_VOUCHER_TYPE_CODE,
  ExpenseErrorCode,
  ExpenseMoneyFrom,
  ExpenseStatus,
} from './types/expense-enum';

type Tx = Prisma.TransactionClient;
const SAVE_TX = { maxWait: 10_000, timeout: 30_000 };
const POST_TX = { maxWait: 15_000, timeout: 120_000 };
const CASH_TENDER_TYPE_ID = 1;
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

interface ExpenseKey {
  companyId: string;
  branchId: string;
  accYear: string;
  voucherId: string;
}

type StoredExpense = Prisma.AccVoucherHeaderGetPayload<{
  include: { voucherType: { select: { vchrTypeCode: true } } };
}>;

/**
 * The expense voucher (ExpV, plan-till-receipt-payment-expense §4 / REV 2
 * §2.16): an expense paid by one or more tenders. Lines DR an expense ledger
 * (+ input GST when a supplier's GST bill is entered), tenders CR the money —
 * the drawer of a live till session, the branch safe from a back-office device,
 * or the tender's own ledger. No new table: acc_voucher_header (type ExpV),
 * acc_vouchers, acc_tender_detail (EXPENSE, CR), the GSTR-2 register.
 *
 * DRAFT → POSTED → CANCELLED. The number is issued at post. A cancel is a
 * mirror in the Rev series, and is refused once the till session it moved
 * drawer cash in has stopped taking money (TILL_SESSION_CLOSED).
 */
@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly tenderDetail: TenderDetailService,
    private readonly posting: VoucherPostingService,
    private readonly register: DocRegisterService,
    private readonly till: TillSessionService,
    private readonly approvals: TillApprovalService,
    private readonly appSettings: AppSettingValueService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  Draft
  // ═════════════════════════════════════════════════════════════════════════

  async save(dto: SaveExpenseDto): Promise<ExpensePayload> {
    const actor = this.actor();
    const voucherId = await this.prisma.$transaction(async (tx) => {
      if (accYearOf(new Date(`${dto.voucherDate}T00:00:00Z`)) !== dto.accYear) {
        throwAccountsBadRequest('Validation failed', [
          { field: 'voucherDate', message: `${dto.voucherDate} is not in the year ${dto.accYear}` },
        ]);
      }
      await assertAccYearWritable(tx, dto.companyId, dto.accYear, 'accYear');
      this.assertUniqueRows(dto);
      const type = await this.voucherType(tx);
      const existing = dto.voucherId
        ? await this.load(tx, {
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            voucherId: dto.voucherId,
          })
        : null;
      if (existing && existing.avhVoucherStatus !== ExpenseStatus.DRAFT) {
        throwAccountsConflict('Expense voucher is not a draft', [
          {
            field: 'voucherId',
            message: `Voucher ${existing.avhVoucherRefno ?? dto.voucherId} is ${existing.avhVoucherStatus}: only a DRAFT is edited`,
          },
        ]);
      }
      const date = new Date(`${dto.voucherDate}T00:00:00Z`);
      const party = dto.partyId
        ? await tx.accLedgerMaster.findFirst({
            where: { ledId: dto.partyId, ledIsDeleted: false },
            select: { ledName: true },
          })
        : null;
      const tenders = await normalisePaymentTenders(tx, {
        tenders: dto.tenders,
        companyId: dto.companyId,
        branchId: dto.branchId,
        paymentDate: date,
        partyName: party?.ledName ?? dto.remarks ?? 'expense',
      });
      const draft: ExpenseDraftLines = {
        version: 1,
        reasonId: dto.reasonId ?? null,
        lines: dto.lines.map((l) => ({
          rowNo: l.rowNo,
          ledgerId: l.ledgerId,
          amount: Number(new Prisma.Decimal(String(l.amount)).toFixed(2)),
          description: l.description ?? null,
          costCentreId: l.costCentreId ?? null,
          taxId: dto.gstBill ? (l.taxId ?? null) : null,
          hsn: l.hsn ?? null,
          itc: l.itc ?? true,
        })),
        gstBill: dto.gstBill
          ? {
              supplierGstin: dto.gstBill.supplierGstin?.trim().toUpperCase() || null,
              invoiceNo: dto.gstBill.invoiceNo,
              invoiceDate: dto.gstBill.invoiceDate.slice(0, 10),
              placeOfSupplyCode: dto.gstBill.placeOfSupplyCode ?? null,
            }
          : null,
      };
      const docAmount = draft.lines.reduce(
        (s, l) => s.plus(new Prisma.Decimal(String(l.amount))),
        new Prisma.Decimal(0),
      );
      const now = new Date();
      const common = {
        avhCompanyId: dto.companyId,
        avhBranchId: dto.branchId,
        avhTenantId: dto.tenantId ?? null,
        avhVoucherTypeId: type.vchrTypeId,
        avhVoucherDate: date,
        avhPartyId: dto.partyId ?? null,
        avhUsrRefno: dto.usrRefno ?? null,
        avhDocRefno: draft.gstBill?.invoiceNo ?? null,
        avhDocDate: draft.gstBill ? new Date(`${draft.gstBill.invoiceDate}T00:00:00Z`) : null,
        avhDocAmount: docAmount,
        avhRemarks: dto.remarks ?? null,
        avhSessionId: dto.sessionId ?? null,
        avhDeviceId: this.requestContext.getDeviceId() ?? null,
        avhUserId: actor,
        avhDraftLines: draft as unknown as Prisma.InputJsonValue,
      };
      const id = existing
        ? (
            await tx.accVoucherHeader.update({
              where: {
                avhVoucherId_avhAccYear: {
                  avhVoucherId: existing.avhVoucherId,
                  avhAccYear: dto.accYear,
                },
              },
              data: { ...common, avhModifiedOn: now, avhModifiedBy: actor },
              select: { avhVoucherId: true },
            })
          ).avhVoucherId
        : (
            await tx.accVoucherHeader.create({
              data: {
                ...common,
                avhAccYear: dto.accYear,
                avhVoucherStatus: ExpenseStatus.DRAFT,
                avhCreatedOn: now,
                avhCreatedBy: actor,
              },
              select: { avhVoucherId: true },
            })
          ).avhVoucherId;

      const scope: TenderDocumentScope = {
        tdSrcModule: TenderSrcModule.ACCOUNTS,
        tdSrcDocType: TenderSrcDocType.EXPENSE,
        tdSrcDocId: id,
        tdCompanyId: dto.companyId,
        tdBranchId: dto.branchId,
        tdTenantId: dto.tenantId ?? null,
        tdAccYear: dto.accYear,
        tdDocDate: date,
        // NOT NULL: who the money went to — the supplier, else the first expense ledger.
        tdPartyLedgerId: dto.partyId ?? dto.lines[0].ledgerId,
        tdUserId: actor,
        tdSessionId: dto.sessionId ?? null,
        tdDeviceId: this.requestContext.getDeviceId() ?? null,
        tdDrCr: TenderDrCr.CR,
      };
      await this.tenderDetail.syncDocumentTenders(
        tx,
        scope,
        tenders.map((t) => ({
          ...(t.tdId ? { tdId: t.tdId } : {}),
          tdRowNo: t.rowNo,
          tdTenderId: t.tenderId,
          tdTenderTypeId: t.tenderTypeId,
          tdTenderLedgerId: t.tenderLedgerId,
          tdAmount: t.amount.toFixed(2),
          tdReceivedAmt: t.receivedAmt.toFixed(2),
          tdChangeAmt: t.changeAmt.toFixed(2),
          tdMdrAmt: t.mdrAmt.toFixed(2),
          tdRefNo: t.refNo,
          tdBankName: t.bankName,
          tdPayerVpa: t.payerVpa,
          tdInstrumentDate: t.instrumentDate ? isoDate(t.instrumentDate) : null,
          tdIsPdc: t.isPdc,
          tdSettleLedgerId: t.clearingLedgerId,
          tdNotes: t.notes,
          tdVoucherId: null,
        })) as unknown as SaveTenderDetailDto[],
        actor,
        {
          tableName: 'expense tender',
          screenName: 'Expense Voucher',
          entityName: 'Expense tender',
        },
      );

      if (!existing) {
        await appendTxnStatusLog(tx, {
          companyId: dto.companyId,
          branchId: dto.branchId,
          tenantId: dto.tenantId ?? null,
          accYear: dto.accYear,
          srcModule: TxnStatusSrcModule.ACCOUNTS,
          srcDocType: TxnStatusDocType.EXPENSE,
          srcDocId: id,
          event: TxnStatusEvent.CREATED,
          toStatus: ExpenseStatus.DRAFT,
          changedBy: actor,
          deviceId: this.requestContext.getDeviceId() ?? null,
          sessionId: dto.sessionId ?? null,
        });
      }
      return id;
    }, SAVE_TX);
    return this.get({
      companyId: dto.companyId,
      branchId: dto.branchId,
      accYear: dto.accYear,
      voucherId,
    });
  }

  /**
   * `/validate`: what `/post` would write and refuse, for what the client has
   * typed (saved or not) — always 200. A till refusal (no session for cash, a
   * session on another device …) comes back as a refusal, not an error.
   */
  async validate(dto: SaveExpenseDto): Promise<ExpenseValidatePayload> {
    return this.prisma.$transaction(async (tx) => {
      const ctx = newGuardContext({ dryRun: true, canOverride: false });
      const tenders = await normalisePaymentTenders(tx, {
        tenders: dto.tenders,
        companyId: dto.companyId,
        branchId: dto.branchId,
        paymentDate: new Date(`${dto.voucherDate}T00:00:00Z`),
        partyName: 'expense',
      });
      const draft: ExpenseDraftLines = {
        version: 1,
        reasonId: dto.reasonId ?? null,
        lines: dto.lines.map((l) => ({
          rowNo: l.rowNo,
          ledgerId: l.ledgerId,
          amount: l.amount,
          description: l.description ?? null,
          costCentreId: l.costCentreId ?? null,
          taxId: dto.gstBill ? (l.taxId ?? null) : null,
          hsn: l.hsn ?? null,
          itc: l.itc ?? true,
        })),
        gstBill: dto.gstBill
          ? {
              supplierGstin: dto.gstBill.supplierGstin?.trim().toUpperCase() || null,
              invoiceNo: dto.gstBill.invoiceNo,
              invoiceDate: dto.gstBill.invoiceDate.slice(0, 10),
              placeOfSupplyCode: dto.gstBill.placeOfSupplyCode ?? null,
            }
          : null,
      };
      let route: Awaited<ReturnType<TillSessionService['routeMoneyDoc']>> = {
        ref: null,
        cashLedgerId: null,
        safeName: null,
      };
      try {
        route = await this.till.routeMoneyDoc(tx, {
          companyId: dto.companyId,
          branchId: dto.branchId,
          sessionId: dto.sessionId ?? null,
          field: 'sessionId',
          hasCash: tenders.some((t) => t.tenderTypeId === CASH_TENDER_TYPE_ID),
        });
      } catch (error: unknown) {
        this.refusalFromTill(ctx, error);
      }
      const derived = await this.derive(tx, {
        companyId: dto.companyId,
        branchId: dto.branchId,
        partyId: dto.partyId ?? null,
        draft,
        tenders,
        route,
        ctx,
      });
      const checks = await this.moneyChecks(tx, {
        companyId: dto.companyId,
        branchId: dto.branchId,
        accYear: dto.accYear,
        voucherDate: dto.voucherDate,
        voucherId: dto.voucherId ?? null,
        partyId: dto.partyId ?? null,
        tenders,
        total: derived.payload.total,
        inSession: !!route.ref,
        ctx,
      });
      return {
        ok: ctx.refusals.length === 0,
        derived: {
          ...derived.payload,
          session: route.ref ? { sessionId: route.ref.tssId, accYear: route.ref.tssAccYear } : null,
          safeName: route.safeName,
        },
        refusals: ctx.refusals,
        warnings: ctx.warnings,
        approval: checks.approval,
      };
    }, SAVE_TX);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Post
  // ═════════════════════════════════════════════════════════════════════════

  async post(key: ExpenseKey): Promise<ExpensePostPayload> {
    const actor = this.actor();
    const ctx = newGuardContext({ dryRun: false, canOverride: false });
    let approval: TillApprovalNeed | null = null;
    await this.prisma.$transaction(async (tx) => {
      await this.lockHeader(tx, key);
      const header = await this.load(tx, key);
      if (header.avhVoucherStatus !== ExpenseStatus.DRAFT) {
        throwAccountsConflict('Expense voucher cannot be posted', [
          {
            field: 'voucherId',
            message: `Voucher ${header.avhVoucherRefno ?? key.voucherId} is ${header.avhVoucherStatus}: only a DRAFT posts`,
          },
        ]);
      }
      await assertAccYearWritable(tx, key.companyId, key.accYear, 'accYear');
      await assertVoucherPartitionExists(tx, key.accYear, 'accYear');

      const draft = this.draftOf(header);
      const tenders = await this.storedTenders(tx, header);
      // §2.3: the drawer of the live session, the safe from the back office, or as before.
      const route = await this.till.routeMoneyDoc(tx, {
        companyId: key.companyId,
        branchId: key.branchId,
        sessionId: header.avhSessionId,
        field: 'sessionId',
        hasCash: tenders.some((t) => t.tenderTypeId === CASH_TENDER_TYPE_ID),
      });
      const derived = await this.derive(tx, {
        companyId: key.companyId,
        branchId: key.branchId,
        partyId: header.avhPartyId,
        draft,
        tenders,
        route,
        ctx,
      });
      const checks = await this.moneyChecks(tx, {
        companyId: key.companyId,
        branchId: key.branchId,
        accYear: key.accYear,
        voucherDate: isoDate(header.avhVoucherDate),
        voucherId: key.voucherId,
        partyId: header.avhPartyId,
        tenders,
        total: derived.payload.total,
        inSession: !!route.ref,
        ctx,
      });
      approval = checks.approval;
      if (ctx.refusals.length > 0) {
        throwRefusals('Expense voucher cannot be posted', ctx.refusals);
      }

      const actorName = await this.actorName(tx, actor);
      if (route.ref) {
        await this.till.stampVoucher(
          tx,
          route.ref,
          { voucherId: key.voucherId, accYear: key.accYear, srcDocType: EXPENSE_SRC_DOC_TYPE },
          actorName,
        );
      }
      if (route.cashLedgerId) {
        await this.till.routeCashToLedger(tx, {
          srcDocType: EXPENSE_SRC_DOC_TYPE,
          srcDocId: key.voucherId,
          accYear: key.accYear,
          ledgerId: route.cashLedgerId,
          actor,
        });
      }

      const voucherDate = isoDate(header.avhVoucherDate);
      const posted = await this.posting.postLegs(tx, {
        header: {
          companyId: key.companyId,
          branchId: key.branchId,
          tenantId: header.avhTenantId,
          accYear: key.accYear,
          voucherTypeId: header.avhVoucherTypeId,
          voucherDate,
          docLabel: 'Expense voucher',
          docRefno: header.avhDocRefno,
          docDate: header.avhDocDate ? isoDate(header.avhDocDate) : null,
          usrRefno: header.avhUsrRefno,
          docAmount: derived.payload.total,
          partyId: header.avhPartyId,
          userId: actor,
          sessionId: route.ref?.tssId ?? header.avhSessionId,
          deviceId: header.avhDeviceId,
          remarks: header.avhRemarks,
          createdBy: actorName,
          draftVoucherId: key.voucherId,
        },
        legs: derived.legs,
      });
      await tx.accTenderDetail.updateMany({
        where: {
          tdSrcDocType: EXPENSE_SRC_DOC_TYPE,
          tdSrcDocId: key.voucherId,
          tdAccYear: key.accYear,
          tdIsDeleted: false,
        },
        data: { tdVoucherId: key.voucherId, tdModifiedOn: new Date(), tdModifiedBy: actor },
      });
      for (const c of derived.costCentres) {
        await tx.$executeRaw`
          UPDATE accounts.acc_vouchers SET av_cost_centre_id = ${c.costCentreId}::uuid
           WHERE av_voucher_id = ${key.voucherId}::uuid AND av_acc_year = ${key.accYear}::char(9)
             AND av_row_no = ${c.rowNo}::int AND av_is_deleted = false`;
      }
      if (derived.gst) {
        await this.register.write(
          tx,
          await this.registerDoc(tx, header, derived, posted, voucherDate, actorName),
          { interState: derived.gst.supplyNature === 'INTER' },
        );
      }
      await appendTxnStatusLog(tx, {
        companyId: key.companyId,
        branchId: key.branchId,
        tenantId: header.avhTenantId,
        accYear: key.accYear,
        srcModule: TxnStatusSrcModule.ACCOUNTS,
        srcDocType: TxnStatusDocType.EXPENSE,
        srcDocId: key.voucherId,
        srcDocRefno: posted.voucherRefno,
        event: TxnStatusEvent.POSTED,
        fromStatus: ExpenseStatus.DRAFT,
        toStatus: ExpenseStatus.POSTED,
        changedBy: actor,
        deviceId: this.requestContext.getDeviceId() ?? null,
        sessionId: route.ref?.tssId ?? null,
      });
      if (route.ref) {
        await this.till.logMoneyDoc(tx, {
          sessionId: route.ref.tssId,
          code: TillEventCode.EXPENSE_POSTED,
          srcDocType: 'EXPENSE',
          srcDocId: key.voucherId,
          srcRefno: posted.voucherRefno,
          amount: derived.payload.total,
          payload: {
            cash: derived.payload.tenders
              .filter((t) => t.moneyFrom === ExpenseMoneyFrom.DRAWER)
              .reduce((s, t) => s + t.amount, 0),
            ...(checks.approval ? { approval: { ...checks.approval } } : {}),
            ...(checks.limit40A3 ? { statutory: { ...checks.limit40A3.statutory } } : {}),
          },
        });
      }
    }, POST_TX);
    return { ...(await this.get(key)), warnings: ctx.warnings, approval };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Cancel
  // ═════════════════════════════════════════════════════════════════════════

  async cancel(key: ExpenseKey & { reason: string }): Promise<ExpensePayload> {
    const actor = this.actor();
    await this.prisma.$transaction(async (tx) => {
      await this.lockHeader(tx, key);
      const header = await this.load(tx, key);
      if (header.avhVoucherStatus !== ExpenseStatus.POSTED) {
        throwAccountsConflict('Expense voucher cannot be cancelled', [
          {
            field: 'voucherId',
            message: `Voucher ${header.avhVoucherRefno ?? key.voucherId} is ${header.avhVoucherStatus}: only a POSTED voucher is cancelled`,
          },
        ]);
      }
      await assertAccYearWritable(tx, key.companyId, key.accYear, 'accYear');
      // §2.3: the cash really moved; once the drawer is being counted, it stays.
      await this.till.assertMoneyDocCancellable(tx, {
        sessionId: header.avhSessionId,
        field: 'voucherId',
      });
      const actorName = await this.actorName(tx, actor);
      const mirror = await this.posting.reverseLegs(
        tx,
        key.voucherId,
        key.accYear,
        key.reason,
        actorName,
      );
      if (!mirror) {
        throwAccountsConflict('Expense voucher cannot be cancelled', [
          { field: 'voucherId', message: 'There is no live posted voucher to reverse' },
        ]);
      }
      await tx.accTenderDetail.updateMany({
        where: {
          tdSrcDocType: EXPENSE_SRC_DOC_TYPE,
          tdSrcDocId: key.voucherId,
          tdAccYear: key.accYear,
          tdIsDeleted: false,
        },
        data: { tdIsDeleted: true, tdModifiedOn: new Date(), tdModifiedBy: actor },
      });
      const gdrId = await this.register.registerIdOfVoucher(tx, key.voucherId, key.accYear);
      if (gdrId) {
        await this.register.cancel(tx, gdrId, key.accYear, key.reason, actorName);
      }
      await appendTxnStatusLog(tx, {
        companyId: key.companyId,
        branchId: key.branchId,
        tenantId: header.avhTenantId,
        accYear: key.accYear,
        srcModule: TxnStatusSrcModule.ACCOUNTS,
        srcDocType: TxnStatusDocType.EXPENSE,
        srcDocId: key.voucherId,
        srcDocRefno: header.avhVoucherRefno,
        event: TxnStatusEvent.CANCELLED,
        fromStatus: ExpenseStatus.POSTED,
        toStatus: ExpenseStatus.CANCELLED,
        changedBy: actor,
        deviceId: this.requestContext.getDeviceId() ?? null,
        remarks: key.reason,
      });
      if (header.avhSessionId) {
        await this.till.logMoneyDoc(tx, {
          sessionId: header.avhSessionId,
          code: TillEventCode.MONEY_DOC_CANCELLED,
          srcDocType: 'EXPENSE',
          srcDocId: key.voucherId,
          srcRefno: header.avhVoucherRefno,
          amount: header.avhDocAmount,
          payload: { reason: key.reason, reversalVoucherId: mirror.voucherId },
        });
      }
    }, POST_TX);
    return this.get(key);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Reads
  // ═════════════════════════════════════════════════════════════════════════

  async get(key: ExpenseKey): Promise<ExpensePayload> {
    return this.prisma.$transaction(async (tx) => {
      const header = await this.load(tx, key);
      const draft = this.draftOf(header);
      const tenders = await this.storedTenders(tx, header, true);
      const ctx = newGuardContext({ dryRun: true, canOverride: false });
      const posted = header.avhVoucherStatus !== ExpenseStatus.DRAFT;
      const derived = await this.derive(tx, {
        companyId: key.companyId,
        branchId: key.branchId,
        partyId: header.avhPartyId,
        draft,
        tenders,
        // A posted voucher shows the ledgers it was written to (the tender rows hold them).
        route: { ref: null, cashLedgerId: null, safeName: null },
        ctx,
      });
      const party = header.avhPartyId
        ? await tx.accLedgerMaster.findFirst({
            where: { ledId: header.avhPartyId },
            select: { ledName: true },
          })
        : null;
      let safeName: string | null = null;
      if (posted) {
        derived.payload.legs = await this.storedLegs(tx, key);
        safeName = await this.markMoneyFrom(tx, header, derived);
      }
      return {
        voucherId: header.avhVoucherId,
        companyId: header.avhCompanyId,
        branchId: header.avhBranchId,
        accYear: header.avhAccYear,
        status: header.avhVoucherStatus as ExpenseStatus,
        voucherNo: header.avhVoucherRefno,
        voucherDate: isoDate(header.avhVoucherDate),
        partyId: header.avhPartyId,
        partyName: party?.ledName ?? null,
        usrRefno: header.avhUsrRefno,
        remarks: header.avhRemarks,
        reasonId: draft.reasonId,
        sessionId: header.avhSessionId,
        gstBill: draft.gstBill,
        amount: derived.payload.total,
        derived: { ...derived.payload, session: null, safeName },
        postedOn: header.avhPostedOn?.toISOString() ?? null,
        cancelReason: header.avhCancelReason,
        reversalVoucherId: header.avhReversalVoucherId,
        createdOn: header.avhCreatedOn.toISOString(),
      };
    });
  }

  /** The EXPENSE till reasons (shared + the company's), with the ledger each one fills a line with. */
  async quickReasons(companyId: string): Promise<ExpenseQuickReasonPayload[]> {
    const rows = await this.prisma.$queryRaw<
      {
        trs_id: string;
        trs_code: string;
        trs_name: string;
        trs_ledger_id: string | null;
        led_name: string | null;
        trs_needs_note: boolean;
        trs_needs_ref: boolean;
        trs_max_amount: Prisma.Decimal | null;
      }[]
    >`
      SELECT r.trs_id, r.trs_code, r.trs_name, r.trs_ledger_id, l.led_name,
             r.trs_needs_note, r.trs_needs_ref, r.trs_max_amount
        FROM accounts.till_reason r
        LEFT JOIN accounts.acc_ledger_master l
               ON l.led_id = r.trs_ledger_id AND l.led_is_deleted = false
       WHERE r.trs_category = ${EXPENSE_REASON_CATEGORY}
         AND r.trs_is_active AND NOT r.trs_is_deleted
         AND (r.trs_company_id IS NULL OR r.trs_company_id = ${companyId}::uuid)
       ORDER BY r.trs_sort_order, r.trs_name`;
    return rows.map((r) => ({
      reasonId: r.trs_id,
      code: r.trs_code,
      name: r.trs_name,
      ledgerId: r.led_name ? r.trs_ledger_id : null,
      ledgerName: r.led_name,
      needsNote: r.trs_needs_note,
      needsRef: r.trs_needs_ref,
      maxAmount: r.trs_max_amount === null ? null : Number(r.trs_max_amount),
    }));
  }

  /** Live ledgers under an Expenses group, the company's and shared: what a line may DR. */
  async ledgerPick(companyId: string, search: string | null): Promise<ExpenseLedgerPickPayload[]> {
    const like = search?.trim() ? `%${search.trim()}%` : null;
    const rows = await this.prisma.$queryRaw<
      {
        led_id: string;
        led_name: string;
        acc_group_name: string;
        led_tax_id: string | null;
        led_itc_eligibility: string | null;
      }[]
    >`
      WITH RECURSIVE g AS (
        SELECT acc_group_id FROM accounts.acc_group_master
         WHERE acc_group_nature = ${EXPENSE_GROUP_NATURE} AND acc_group_is_deleted = false
           AND (acc_group_company_id IS NULL OR acc_group_company_id = ${companyId}::uuid)
        UNION
        SELECT c.acc_group_id FROM accounts.acc_group_master c JOIN g ON c.acc_group_parent_id = g.acc_group_id
         WHERE c.acc_group_is_deleted = false
      )
      SELECT l.led_id, l.led_name, grp.acc_group_name, l.led_tax_id, l.led_itc_eligibility
        FROM accounts.acc_ledger_master l
        JOIN accounts.acc_group_master grp ON grp.acc_group_id = l.led_group_id
       WHERE l.led_group_id IN (SELECT acc_group_id FROM g)
         AND l.led_is_active AND NOT l.led_is_deleted
         AND (l.led_company_id IS NULL OR l.led_company_id = ${companyId}::uuid)
         AND (${like}::text IS NULL OR l.led_name ILIKE ${like}::text)
       ORDER BY l.led_name
       LIMIT 500`;
    return rows.map((r) => ({
      ledgerId: r.led_id,
      name: r.led_name,
      groupName: r.acc_group_name,
      taxId: r.led_tax_id,
      itcEligibility: r.led_itc_eligibility,
    }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Internals
  // ═════════════════════════════════════════════════════════════════════════

  private async derive(
    tx: Tx,
    input: {
      companyId: string;
      branchId: string;
      partyId: string | null;
      draft: ExpenseDraftLines;
      tenders: Awaited<ReturnType<typeof normalisePaymentTenders>>;
      route: Awaited<ReturnType<TillSessionService['routeMoneyDoc']>>;
      ctx: VoucherGuardContext;
    },
  ): Promise<DerivedExpense> {
    const company = await loadCompanyFacts(tx, input.companyId);
    if (!company) {
      throwAccountsNotFound('Company not found', 'companyId', `No company ${input.companyId}`);
    }
    const lineLedgerIds = input.draft.lines.map((l) => l.ledgerId);
    const ledgers = await loadLedgerFacts(tx, input.companyId, [
      ...lineLedgerIds,
      ...(input.partyId ? [input.partyId] : []),
    ]);
    const party = input.partyId ? (ledgers.get(input.partyId) ?? null) : null;
    if (input.partyId && (!party || !party.isActive || party.isDeleted || !party.isParty)) {
      input.ctx.refusals.push({
        code: ExpenseErrorCode.PARTY_INVALID,
        message:
          'The supplier named is not a live party ledger (Sundry Creditors / Debtors) of this company',
        field: 'partyId',
      });
    }
    const expenseLedgerIds = await this.expenseLedgerIds(tx, lineLedgerIds);
    const bill = input.draft.gstBill;
    const taxIds = bill
      ? input.draft.lines.map((l) => l.taxId).filter((t): t is string => !!t)
      : [];
    const taxRates = await loadTaxRates(tx, taxIds);
    const asks: RoleLedgerAsk[] = [];
    for (const taxId of new Set(taxIds)) {
      for (const nature of ['INTRA', 'INTER'] as const) {
        for (const c of ['CGST', 'SGST', 'IGST', 'CESS']) {
          asks.push({ role: `INPUT_${c}`, taxId, supplyNature: nature });
        }
      }
    }
    const roleLedgers = await resolveRoleLedgerMap(tx, input.companyId, input.branchId, asks);
    const tenders = input.tenders;
    const ledgerIds = new Set<string>();
    for (const t of tenders) {
      ledgerIds.add(t.clearingLedgerId ?? t.tenderLedgerId);
    }
    if (input.route.cashLedgerId) ledgerIds.add(input.route.cashLedgerId);
    for (const hit of roleLedgers.values()) if (hit) ledgerIds.add(hit.ledgerId);
    const named = await tx.accLedgerMaster.findMany({
      where: { ledId: { in: [...ledgerIds] } },
      select: { ledId: true, ledName: true },
    });
    const facts: ExpenseFacts = {
      company,
      ledgers,
      expenseLedgerIds,
      party,
      taxRates,
      roleLedgers,
      tenders,
      ledgerNames: new Map(named.map((n) => [n.ledId, n.ledName])),
      cash: {
        moneyFrom: input.route.ref
          ? ExpenseMoneyFrom.DRAWER
          : input.route.cashLedgerId
            ? ExpenseMoneyFrom.SAFE
            : ExpenseMoneyFrom.LEDGER,
        ledgerId: input.route.cashLedgerId,
      },
    };
    const derived = deriveExpense(input.draft, facts, input.ctx);
    await this.warnNoGstBill(tx, input, derived);
    return derived;
  }

  /**
   * The checks on the money that leaves (plan §3.4 / §4.3), for /validate and
   * /post alike:
   *   · 40A(3) — the cash rows, summed with the supplier's other cash payments
   *     and expenses of the day (no supplier: this voucher alone). WARN as
   *     shipped, never blocks; a company REFUSE row refuses.
   *   · the EXPENSE approval rule on the TOTAL, when the voucher books into a
   *     till session. Reported, never enforced, until phase 3 builds the gate.
   */
  private async moneyChecks(
    tx: Tx,
    input: {
      companyId: string;
      branchId: string;
      accYear: string;
      voucherDate: string;
      voucherId: string | null;
      partyId: string | null;
      tenders: Awaited<ReturnType<typeof normalisePaymentTenders>>;
      total: number;
      inSession: boolean;
      ctx: VoucherGuardContext;
    },
  ): Promise<{ approval: TillApprovalNeed | null; limit40A3: CashPaymentLimitFinding | null }> {
    const cash = input.tenders
      .filter((t) => t.tenderTypeId === CASH_TENDER_TYPE_ID)
      .reduce((sum, t) => sum.plus(t.amount), new Prisma.Decimal(0));
    const limit40A3 = await checkCashPaymentLimit(tx, {
      companyId: input.companyId,
      accYear: input.accYear,
      onDate: input.voucherDate,
      payeeLedgerId: input.partyId,
      cash,
      excludeDocId: input.voucherId,
      field: 'tenders',
    });
    if (limit40A3?.enforce === 'REFUSE') {
      input.ctx.refusals.push({
        code: limit40A3.code,
        message: limit40A3.message,
        field: limit40A3.field,
      });
    } else if (limit40A3) {
      input.ctx.warnings.push({
        code: limit40A3.code,
        level: limit40A3.enforce === 'INFO' ? 'INFO' : 'WARN',
        overridable: false,
        message: limit40A3.message,
        field: limit40A3.field,
      });
    }
    const approval = input.inSession
      ? await this.approvals.assess(tx, {
          companyId: input.companyId,
          branchId: input.branchId,
          event: 'EXPENSE',
          onDate: input.voucherDate,
          amount: new Prisma.Decimal(input.total),
        })
      : null;
    if (approval) {
      input.ctx.warnings.push({
        code: TillErrorCode.APPROVAL_REQUIRED,
        level: 'INFO',
        overridable: false,
        message:
          `An expense of ${input.total.toFixed(2)} at a till is above the EXPENSE threshold of ` +
          `${approval.threshold.toFixed(2)} (${approval.minRole}): recorded for review — ` +
          'the approval gate is not built yet',
        field: 'tenders',
      });
    }
    return { approval, limit40A3 };
  }

  /** §4.3: a large expense with no GST bill WARNs (accounts.expense_gst_bill_above; 0 = never). Never blocks. */
  private async warnNoGstBill(
    _tx: Tx,
    input: {
      companyId: string;
      branchId: string;
      draft: ExpenseDraftLines;
      ctx: VoucherGuardContext;
    },
    derived: DerivedExpense,
  ): Promise<void> {
    if (input.draft.gstBill) {
      return;
    }
    const effective = await this.appSettings.resolveEffective({
      companyId: input.companyId,
      branchId: input.branchId,
      deviceId: null,
      userId: null,
    });
    const raw = effective.find((e) => e.asdKey === EXPENSE_GST_BILL_ABOVE_KEY)?.value;
    const above = Number(raw ?? 0);
    if (Number.isFinite(above) && above > 0 && derived.payload.total > above) {
      input.ctx.warnings.push({
        code: ExpenseErrorCode.GST_BILL_MISSING,
        level: 'WARN',
        overridable: false,
        message: `An expense of ${derived.payload.total.toFixed(2)} with no GST bill (asked above ${above.toFixed(2)}): enter the supplier's bill to claim the input tax`,
        field: 'gstBill',
      });
    }
  }

  /** The line ledgers with an Expenses group anywhere above them. */
  private async expenseLedgerIds(tx: Tx, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }
    const rows = await tx.$queryRaw<{ led_id: string }[]>`
      WITH RECURSIVE up AS (
        SELECT l.led_id, g.acc_group_parent_id, g.acc_group_nature, 0 AS d
          FROM accounts.acc_ledger_master l
          JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
         WHERE l.led_id = ANY(${[...new Set(ids)]}::uuid[])
        UNION ALL
        SELECT up.led_id, p.acc_group_parent_id, p.acc_group_nature, up.d + 1
          FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
         WHERE up.d < 24
      )
      SELECT DISTINCT led_id::text AS led_id FROM up WHERE acc_group_nature = ${EXPENSE_GROUP_NATURE}`;
    return new Set(rows.map((r) => r.led_id));
  }

  /** The stored tender rows, re-normalised as /post sees them. */
  private async storedTenders(tx: Tx, header: StoredExpense, keepLedger = false) {
    const stored = await tx.accTenderDetail.findMany({
      where: {
        tdSrcDocType: EXPENSE_SRC_DOC_TYPE,
        tdSrcDocId: header.avhVoucherId,
        tdAccYear: header.avhAccYear,
        // A cancelled voucher's rows are soft-deleted with it, and still shown.
        ...(header.avhVoucherStatus === ExpenseStatus.CANCELLED ? {} : { tdIsDeleted: false }),
      },
      orderBy: { tdRowNo: 'asc' },
    });
    if (stored.length === 0) {
      return [];
    }
    const inputs: PaymentTenderInput[] = stored.map((row) => ({
      tdId: row.tdId,
      tdRowNo: row.tdRowNo,
      tdTenderId: row.tdTenderId,
      tdTenderTypeId: row.tdTenderTypeId,
      // A posted row may name the safe (§2.3), which the tender master does not
      // allow as an edit: read it back below instead of re-validating it.
      tdTenderLedgerId: keepLedger ? undefined : row.tdTenderLedgerId,
      tdAmount: row.tdAmount,
      tdReceivedAmt: row.tdReceivedAmt,
      tdChangeAmt: row.tdChangeAmt,
      tdMdrAmt: row.tdMdrAmt,
      tdRefNo: row.tdRefNo,
      tdBankName: row.tdBankName,
      tdPayerVpa: row.tdPayerVpa,
      tdInstrumentDate: row.tdInstrumentDate ? isoDate(row.tdInstrumentDate) : null,
      tdNotes: row.tdNotes,
    }));
    const tenders = await normalisePaymentTenders(tx, {
      tenders: inputs,
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      paymentDate: header.avhVoucherDate,
      partyName: 'expense',
    });
    if (!keepLedger) {
      return tenders;
    }
    // A posted voucher's rows hold the ledger the money really left (the safe, say).
    const byRow = new Map(stored.map((r) => [r.tdRowNo, r.tdTenderLedgerId]));
    return tenders.map((t) => ({
      ...t,
      tenderLedgerId: byRow.get(t.rowNo) ?? t.tenderLedgerId,
    }));
  }

  private async storedLegs(tx: Tx, key: ExpenseKey) {
    const legs = await tx.$queryRaw<
      {
        av_row_no: number;
        av_dr_cr: string;
        av_ledger_id: string;
        led_name: string | null;
        av_role: string | null;
        av_amount: Prisma.Decimal;
        av_remarks: string | null;
      }[]
    >`
      SELECT v.av_row_no, v.av_dr_cr, v.av_ledger_id, l.led_name, v.av_role, v.av_amount, v.av_remarks
        FROM accounts.acc_vouchers v
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = v.av_ledger_id
       WHERE v.av_voucher_id = ${key.voucherId}::uuid AND v.av_acc_year = ${key.accYear}::char(9)
         AND v.av_is_deleted = false
       ORDER BY v.av_row_no`;
    return legs.map((l) => ({
      rowNo: l.av_row_no,
      drCr: l.av_dr_cr.trim() as 'DR' | 'CR',
      ledgerId: l.av_ledger_id,
      ledgerName: l.led_name,
      role: l.av_role,
      amount: Number(new Prisma.Decimal(l.av_amount).toFixed(2)),
      remarks: l.av_remarks,
      line: null,
    }));
  }

  private async registerDoc(
    tx: Tx,
    header: StoredExpense,
    derived: DerivedExpense,
    posted: { voucherLastNo: bigint; voucherRefno: string | null },
    voucherDate: string,
    actorName: string,
  ): Promise<RegisterDoc> {
    const g = derived.gst!;
    const [party] = await tx.$queryRaw<
      {
        led_name: string;
        led_addr1: string | null;
        led_addr2: string | null;
        led_addr3: string | null;
        led_city: string | null;
        led_pin: string | null;
        led_state_code: string | null;
        led_state_name: string | null;
        led_gst_party_reg_type: string | null;
      }[]
    >`
      SELECT led_name, led_addr1, led_addr2, led_addr3, led_city, led_pin, led_state_code, led_state_name,
             led_gst_party_reg_type
        FROM accounts.acc_ledger_master WHERE led_id = ${header.avhPartyId}::uuid`;
    const supplyNature = g.supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE';
    const n = (v: Prisma.Decimal): number => Number(v.toFixed(2));
    const tax = g.cgst.plus(g.sgst).plus(g.igst).plus(g.cess);
    const services = g.lines.filter((l) => l.isService).length;
    const lines: RegisterDetailLine[] = g.lines.map((l) => {
      const lineTax = l.cgst.plus(l.sgst).plus(l.igst).plus(l.cess);
      return {
        rowNo: l.rowNo,
        description: l.ledgerName,
        hsnCode: l.hsn,
        qty: 1,
        rate: n(l.taxable),
        discount: 0,
        isService: l.isService,
        taxableValue: n(l.taxable),
        taxId: l.rate.taxId,
        totalTaxRate: Number(l.rate.ratePerc.toString()),
        cgstRate: Number(l.rate.cgstPerc.toString()),
        sgstRate: Number(l.rate.sgstPerc.toString()),
        igstRate: Number(l.rate.igstPerc.toString()),
        cessRate: Number(l.rate.cessPerc.toString()),
        cgstAmount: n(l.cgst),
        sgstAmount: n(l.sgst),
        igstAmount: n(l.igst),
        cessAmount: n(l.cess),
        otherAmount: 0,
        totalValue: n(l.taxable.plus(lineTax)),
        billValue: n(l.taxable.plus(lineTax)),
        taxability: taxabilityOf(l.rate.taxability),
        supplyNature,
        taxableLedgerId: l.ledgerId,
        cgstLedgerId: l.taxLedgers.CGST,
        sgstLedgerId: l.taxLedgers.SGST,
        igstLedgerId: l.taxLedgers.IGST,
        cessLedgerId: l.taxLedgers.CESS,
        itcEligibility: l.itcEligibility as RegisterDetailLine['itcEligibility'],
      };
    });
    return {
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      accYear: header.avhAccYear,
      voucherId: header.avhVoucherId,
      voucherTypeId: header.avhVoucherTypeId,
      voucherNo: posted.voucherLastNo,
      voucherDate,
      voucherRefno: posted.voucherRefno ?? '',
      sourceModule: 'ACCOUNTS',
      sourceDocId: header.avhVoucherId,
      docType: 'INVOICE',
      tranNature: 'PURCHASE',
      docFlow: 'INWARD',
      docSign: 1,
      // The supplier's own invoice number and date: what GSTR-2B matches on.
      docNo: g.invoiceNo,
      docDate: g.invoiceDate,
      docRefNo: posted.voucherRefno,
      taxability: lines.every((l) => l.taxability === lines[0].taxability)
        ? lines[0].taxability
        : 'MIXED',
      supplyClass: services === 0 ? 'GOODS' : services === lines.length ? 'SERVICES' : 'MIXED',
      supplyNature,
      placeOfSupplyCode: g.placeOfSupplyCode,
      placeOfSupplyName: null,
      isReverseCharge: false,
      igstOnIntra: false,
      partyType: 'VENDOR',
      partyId: header.avhPartyId!,
      partyName: party?.led_name ?? '',
      partyAddr1: party?.led_addr1 ?? null,
      partyAddr2: party?.led_addr2 ?? null,
      partyAddr3: party?.led_addr3 ?? null,
      partyLocation: party?.led_city ?? null,
      partyPin: party?.led_pin ?? null,
      partyStateCode: g.supplierGstin.slice(0, 2) || (party?.led_state_code ?? null),
      partyStateName: party?.led_state_name ?? null,
      partyGstType: party?.led_gst_party_reg_type ?? 'REGULAR',
      partyGstin: g.supplierGstin,
      grossValue: n(g.taxable),
      discountValue: 0,
      taxableValue: n(g.taxable),
      cgstValue: n(g.cgst),
      sgstValue: n(g.sgst),
      igstValue: n(g.igst),
      cessValue: n(g.cess),
      stateCessValue: 0,
      tcsValue: 0,
      otherCharge: 0,
      roundOff: 0,
      billValue: n(g.taxable.plus(tax)),
      remarks: header.avhRemarks,
      createdBy: actorName,
      lines,
    } as RegisterDoc;
  }

  /**
   * A posted voucher's CASH rows: the drawer of a real till session, else the safe its ledger is.
   * Answers the safe's name when one did come from a safe — `derived.safeName`, which /validate
   * fills from the route (notes 99 §6): this branch's safe on that ledger, the default first.
   */
  private async markMoneyFrom(
    tx: Tx,
    header: StoredExpense,
    derived: DerivedExpense,
  ): Promise<string | null> {
    const session = header.avhSessionId
      ? await tx.tillSession.findFirst({
          where: { tssId: header.avhSessionId, tssIsDeleted: false },
          select: { tssId: true, tssAccYear: true },
        })
      : null;
    const cash = derived.payload.tenders.filter((t) => t.tenderTypeId === CASH_TENDER_TYPE_ID);
    const safes = await tx.tillSafe.findMany({
      where: { tsfLedgerId: { in: cash.map((t) => t.ledgerId) }, tsfIsDeleted: false },
      select: { tsfLedgerId: true, tsfName: true, tsfCompanyId: true, tsfBranchId: true },
      orderBy: [{ tsfIsDefault: 'desc' }, { tsfCode: 'asc' }],
    });
    const safeLedgers = new Set(safes.map((s) => s.tsfLedgerId));
    for (const t of cash) {
      t.moneyFrom = session
        ? ExpenseMoneyFrom.DRAWER
        : safeLedgers.has(t.ledgerId)
          ? ExpenseMoneyFrom.SAFE
          : ExpenseMoneyFrom.LEDGER;
    }
    if (session) {
      return null;
    }
    const used = new Set(
      cash.filter((t) => t.moneyFrom === ExpenseMoneyFrom.SAFE).map((t) => t.ledgerId),
    );
    const safe = safes.find(
      (s) =>
        used.has(s.tsfLedgerId) &&
        s.tsfCompanyId === header.avhCompanyId &&
        s.tsfBranchId === header.avhBranchId,
    );
    return safe?.tsfName ?? null;
  }

  private refusalFromTill(ctx: VoucherGuardContext, error: unknown): void {
    if (!(error instanceof HttpException)) {
      throw error;
    }
    const body = error.getResponse() as {
      errors?: { code?: string; message?: string; field?: string }[];
    };
    const detail = body?.errors?.[0];
    ctx.refusals.push({
      code: detail?.code ?? 'TILL',
      message: detail?.message ?? error.message,
      field: detail?.field ?? 'sessionId',
    });
  }

  private assertUniqueRows(dto: SaveExpenseDto): void {
    const dup = (rows: number[]) => rows.find((r, i) => rows.indexOf(r) !== i);
    const line = dup(dto.lines.map((l) => l.rowNo));
    const tender = dup(dto.tenders.map((t) => t.tdRowNo));
    if (line !== undefined || tender !== undefined) {
      throwAccountsBadRequest('Validation failed', [
        line !== undefined
          ? { field: 'lines', message: `Line row ${line} appears twice` }
          : { field: 'tenders', message: `Tender row ${tender} appears twice` },
      ]);
    }
  }

  private draftOf(header: StoredExpense): ExpenseDraftLines {
    const raw = header.avhDraftLines as unknown as ExpenseDraftLines | null;
    if (!raw || raw.version !== 1 || !Array.isArray(raw.lines)) {
      throwAccountsConflict('Expense voucher has no lines', [
        { field: 'voucherId', message: 'The voucher carries no expense lines (avh_draft_lines)' },
      ]);
    }
    return raw;
  }

  private async voucherType(tx: Tx) {
    const type = await tx.accVoucherType.findFirst({
      where: { vchrTypeCode: EXPENSE_VOUCHER_TYPE_CODE },
      select: { vchrTypeId: true, vchrIsActive: true },
    });
    if (!type || !type.vchrIsActive) {
      throwAccountsNotFound(
        'Voucher type not found',
        'voucherType',
        `The ${EXPENSE_VOUCHER_TYPE_CODE} voucher type is missing or inactive`,
      );
    }
    return type;
  }

  private async load(tx: Tx, key: ExpenseKey): Promise<StoredExpense> {
    const header = await tx.accVoucherHeader.findFirst({
      where: {
        avhVoucherId: key.voucherId,
        avhAccYear: key.accYear,
        avhIsDeleted: false,
        voucherType: { vchrTypeCode: EXPENSE_VOUCHER_TYPE_CODE },
      },
      include: { voucherType: { select: { vchrTypeCode: true } } },
    });
    if (!header || header.avhCompanyId !== key.companyId || header.avhBranchId !== key.branchId) {
      throwAccountsNotFound(
        'Expense voucher not found',
        'voucherId',
        `No expense voucher ${key.voucherId} in ${key.accYear} for this branch`,
      );
    }
    return header;
  }

  private async lockHeader(tx: Tx, key: ExpenseKey): Promise<void> {
    await tx.$queryRaw`
      SELECT avh_voucher_id FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${key.voucherId}::uuid AND avh_acc_year = ${key.accYear}::char(9)
       FOR UPDATE`;
  }

  private actor(): string {
    return this.requestContext.getUserId() ?? DEFAULT_ACTOR;
  }

  /** The TEXT *_by columns carry the login name (the till's convention). */
  private async actorName(tx: Tx, userId: string): Promise<string> {
    const user = await tx.userMaster.findUnique({
      where: { usrId: userId },
      select: { usrLoginName: true },
    });
    return user?.usrLoginName ?? userId;
  }
}

function taxabilityOf(rate: string): RegisterDetailLine['taxability'] {
  switch (rate.toUpperCase()) {
    case 'EXEMPT':
      return 'EXEMPT';
    case 'NIL_RATED':
      return 'NIL_RATED';
    case 'NON_GST':
      return 'NON_GST';
    default:
      return 'TAXABLE';
  }
}
