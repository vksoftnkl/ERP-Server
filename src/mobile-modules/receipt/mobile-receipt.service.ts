import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { assertMenuRight } from '../../common/posting/rights';
import {
  isUniqueConstraintError,
  throwBadRequest,
  throwConflict,
  throwUnprocessable,
  violatedConstraintOf,
  type ModuleErrorDetail,
} from '../../common/utils/module-shared.utils';
import {
  OpenItemsService,
  type CompanyOpenBill,
  type CompanyOpenCredit,
} from '../../modules/accountsModule/receipt/open-items.service';
import { assertBillUsable, lockBills } from '../../modules/accountsModule/receipt/receipt.guards';
import {
  daysOverdue,
  money,
  toDateOnly,
  toDateString,
  todayUtc,
} from '../../modules/accountsModule/receipt/receipt.utils';
import { ReceiptService } from '../../modules/accountsModule/receipt/receipt.service';
import {
  POST_TRANSACTION_OPTIONS,
  ReceiptPostingService,
  rethrowAllocationError,
} from '../../modules/accountsModule/receipt/receipt-posting.service';
import type { SaveDraftReceiptDto } from '../../modules/accountsModule/receipt/dto/save-receipt.dto';
import type { PostReceiptDto } from '../../modules/accountsModule/receipt/dto/post-receipt.dto';
import {
  BillAdjType,
  BillType,
  DrCr,
  RECEIPT_MENU_ID,
  RECEIPT_VOUCHER_TYPE_CODE,
  VoucherDeviceType,
  VoucherStatus,
} from '../../modules/accountsModule/receipt/types/receipt-enum';
import { ACC } from '../../modules/accountsModule/receipt/types/acc-error-codes';
import { VCH } from '../../modules/accountsModule/vouchers/vouchers.errors';
import type {
  ReceiptDraftPayload,
  ReceiptPayload,
} from '../../modules/accountsModule/receipt/types/receipt-api.types';
import { MobileErrorCode } from '../common/mobile-error-codes';
import { findMobileLogin } from '../common/mobile-login';
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
import { moneyText } from '../item/mobile-item.service';
import {
  CreateMobileReceiptDto,
  MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE,
  MobileOpenBillsQueryDto,
  MobileReceiptOptionsQueryDto,
} from './dto/mobile-receipt.dto';
import { fillOldestFirst, moneyForBills } from './mobile-receipt-settlement';
import {
  adjustedAgainstPlan,
  assertPhoneLimits,
  billKeyOf,
  reconcilePhonePlan,
  type BillNow,
  type CreditNow,
  type MobileReceiptAdjusted,
  type PlanCredit,
  type PlanLine,
  type SettledFigure,
} from './mobile-receipt-plan';
import { ppdScheduleOf } from './mobile-receipt-ppd';
import type {
  MobileOpenBill,
  MobileOpenBillsPayload,
  MobileOpenItemKind,
  MobileReceiptAllocation,
  MobileReceiptCreateResult,
  MobileReceiptCreditApplied,
  MobileReceiptOptions,
  MobileReceiptPdcVoucher,
  MobileReceiptTender,
} from './types/mobile-receipt-api.types';

/**
 * The tender types the desktop Receipt screen never offers (NexERP
 * ReceiptEntry::loadTenderMasters, tender_master_row.cpp isAdjustTender): a
 * credit the party holds is not an instrument (it has its own list), and
 * neither is a loyalty, temp-credit or credit-sale tender. RRN is the old name
 * of ADJUST. Every other live type with a ledger is offered.
 */
export const MOBILE_RECEIPT_EXCLUDED_TENDER_TYPES = [
  'ADJUST',
  'RRN',
  'CREDIT',
  'LOYALTY',
  'TEMP_CR',
];

const ZERO = new Prisma.Decimal(0);

/** The receipt a client uuid names (or one just saved), as the answer reads it. */
interface StoredReceipt {
  avhVoucherId: string;
  avhCompanyId: string;
  avhBranchId: string;
  avhAccYear: string;
  avhVoucherRefno: string | null;
  avhUsrRefno: string | null;
  avhVoucherDate: string;
  avhDocAmount: Prisma.Decimal | string | null;
  avhVoucherStatus: string;
  avhIsDeleted: boolean;
  avhPartyId: string;
  /** avh_employee_id[1]: the collector. */
  employeeId: string | null;
}

/** The phone's own settlement (allocations / creditsApplied sent), as Decimals. */
export interface PhonePlan {
  lines: PlanLine[];
  credits: PlanCredit[];
  /** No allocations key, only credits: money and credits fill the open bills oldest first. */
  fillAll: boolean;
}

/** What a receipt settles now, shaped for the answer and for adjusted[]. */
export interface MobileSettlement {
  allocations: MobileReceiptAllocation[];
  creditsApplied: MobileReceiptCreditApplied[];
  pdcVouchers: MobileReceiptPdcVoucher[];
  onAccount: string;
  figures: {
    bills: Map<string, SettledFigure>;
    credits: Map<string, Prisma.Decimal>;
  };
}

const NOTHING_SETTLED: MobileSettlement = {
  allocations: [],
  creditsApplied: [],
  pdcVouchers: [],
  onAccount: '0.00',
  figures: { bills: new Map(), credits: new Map() },
};

/** The receipt's date: YYYY-MM-DD, no time zone shift. */
export function receiptDayOf(avhVoucherDate: string | undefined, today: string): string {
  return avhVoucherDate ? avhVoucherDate.slice(0, 10) : today;
}

/**
 * The phone's settlement, or null when it sent neither allocations nor
 * creditsApplied (older phones, and a phone with no open bills on it): the
 * server fills the open bills oldest first with the money, exactly as before.
 * creditsApplied without an allocations key: the money and the credits fill
 * the open bills oldest first (fillAll). An allocations key, even [], is the
 * phone's own settlement ([] = all of it on account). A bill or a credit named
 * twice is the engine's refusal (400 ACC_INVALID), raised here because D1 caps
 * one line per bill.
 */
export function phonePlanOf(dto: CreateMobileReceiptDto): PhonePlan | null {
  if (dto.allocations === undefined && dto.creditsApplied === undefined) {
    return null;
  }
  const lines: PlanLine[] = (dto.allocations ?? []).map((row) => ({
    billId: row.billId,
    billAccYear: row.billAccYear.trim(),
    amount: money(row.amount),
    discount: money(row.discount ?? 0),
    roundoff: money(row.roundoff ?? 0),
  }));
  const credits: PlanCredit[] = (dto.creditsApplied ?? []).map((row) => ({
    billId: row.billId,
    billAccYear: row.billAccYear.trim(),
    amount: money(row.amount),
  }));
  const refuseRepeat = (
    rows: readonly { billId: string; billAccYear: string }[],
    field: 'allocations' | 'creditsApplied',
  ): void => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const key = billKeyOf(row);
      if (seen.has(key)) {
        throwBadRequest<ModuleErrorDetail>('Validation failed', [
          {
            field: `${field}.${index}.billId`,
            code: ACC.INVALID,
            message:
              `${row.billId} appears twice. Send one row per ` +
              `${field === 'allocations' ? 'bill' : 'credit'} with the total.`,
          },
        ]);
      }
      seen.add(key);
    });
  };
  refuseRepeat(lines, 'allocations');
  refuseRepeat(credits, 'creditsApplied');
  return { lines, credits, fillAll: dto.allocations === undefined };
}

/**
 * What a receipt settles now, from its /receipts/get payload: per bill the
 * money and credits (its live ALLOCATION rows and the bill side of its credit
 * pairs), its DISCOUNT and its ROUND_OFF, in the order the rows were written;
 * per credit what was applied (the mirror rows on the credit); its post-dated
 * cheque vouchers; and what it holds on account (its live ADVANCE bills). A
 * row a cancel or an amend has since retracted counts for nothing.
 */
export function settlementOf(
  payload: Pick<ReceiptPayload, 'allocations' | 'creditsApplied' | 'advanceBills'> &
    Partial<Pick<ReceiptPayload, 'pdcVouchers'>>,
): MobileSettlement {
  type Row = ReceiptPayload['allocations'][number];
  const live = (row: Row): boolean => !row.isReversed && row.reversalOfId === null;
  const bills = new Map<
    string,
    { row: Row; amount: Prisma.Decimal; discount: Prisma.Decimal; roundoff: Prisma.Decimal }
  >();
  const billOf = (row: Row) => {
    const key = billKeyOf(row);
    const entry = bills.get(key) ?? { row, amount: ZERO, discount: ZERO, roundoff: ZERO };
    bills.set(key, entry);
    return entry;
  };
  for (const row of payload.allocations) {
    if (row.againstBillId !== null || !live(row)) {
      continue;
    }
    const entry = billOf(row);
    if (row.adjType === BillAdjType.DISCOUNT) {
      entry.discount = entry.discount.plus(row.amount);
    } else if (row.adjType === BillAdjType.ROUND_OFF) {
      entry.roundoff = entry.roundoff.plus(row.amount);
    } else if (row.adjType !== BillAdjType.WRITEOFF) {
      // A phone gives no write-off; one a desktop amend added is not money received.
      entry.amount = entry.amount.plus(row.amount);
    }
  }
  const credits = new Map<string, { row: Row; amount: Prisma.Decimal }>();
  for (const row of payload.creditsApplied) {
    if (row.againstBillId === null || !live(row)) {
      continue;
    }
    if (row.drCr === DrCr.CR) {
      // The bill side of a credit pair: the credit settles this bill.
      const entry = billOf(row);
      entry.amount = entry.amount.plus(row.amount);
      continue;
    }
    const key = billKeyOf(row);
    const entry = credits.get(key) ?? { row, amount: ZERO };
    entry.amount = entry.amount.plus(row.amount);
    credits.set(key, entry);
  }
  const onAccount = payload.advanceBills.reduce(
    (total, bill) => total.plus(bill.billAmount),
    new Prisma.Decimal(0),
  );
  return {
    allocations: [...bills.values()].map((entry) => ({
      billId: entry.row.billId,
      billAccYear: entry.row.billAccYear.trim(),
      docRefno: entry.row.docRefno,
      amount: moneyText(entry.amount)!,
      discount: moneyText(entry.discount)!,
      roundoff: moneyText(entry.roundoff)!,
      pendingAmount: moneyText(entry.row.pendingAmount),
    })),
    creditsApplied: [...credits.values()].map((entry) => ({
      billId: entry.row.billId,
      billAccYear: entry.row.billAccYear.trim(),
      docRefno: entry.row.docRefno,
      amount: moneyText(entry.amount)!,
      pendingAmount: moneyText(entry.row.pendingAmount),
    })),
    pdcVouchers: (payload.pdcVouchers ?? []).map((pdc) => ({
      voucherId: pdc.voucherId,
      voucherRefno: pdc.voucherRefno,
      chequeDate: pdc.voucherDate,
      amount: moneyText(pdc.docAmount)!,
    })),
    onAccount: moneyText(onAccount)!,
    figures: {
      bills: new Map(
        [...bills.entries()].map(([key, entry]) => [
          key,
          { amount: entry.amount, discount: entry.discount, roundoff: entry.roundoff },
        ]),
      ),
      credits: new Map([...credits.entries()].map(([key, entry]) => [key, entry.amount])),
    },
  };
}

/** A credit's kind on the phone: OPENING / JOURNAL credits are told apart from the bills of the same type. */
export function creditKindOf(billType: string): MobileOpenItemKind {
  switch (billType as BillType) {
    case BillType.ADVANCE:
      return 'ADVANCE';
    case BillType.SALES_RETURN:
      return 'SALES_RETURN';
    case BillType.OPENING:
      return 'OPENING_CR';
    default:
      return 'JOURNAL_CR';
  }
}

type OpenRow =
  | { kind: 'BILL'; row: CompanyOpenBill; ablPartyId: string }
  | { kind: 'CREDIT'; row: CompanyOpenCredit; ablPartyId: string };

/**
 * Two lists already in party order (the same localeCompare), merged: a
 * party's bills, then its credits, then the next party.
 */
export function mergeByParty(
  bills: readonly CompanyOpenBill[],
  credits: readonly CompanyOpenCredit[],
): OpenRow[] {
  const out: OpenRow[] = [];
  let b = 0;
  let c = 0;
  while (b < bills.length || c < credits.length) {
    if (
      c >= credits.length ||
      (b < bills.length && bills[b].ablPartyId.localeCompare(credits[c].ablPartyId) <= 0)
    ) {
      out.push({ kind: 'BILL', row: bills[b], ablPartyId: bills[b].ablPartyId });
      b += 1;
    } else {
      out.push({ kind: 'CREDIT', row: credits[c], ablPartyId: credits[c].ablPartyId });
      c += 1;
    }
  }
  return out;
}

/** A unique clash on ux_avh_doc_refno (its partitions are named by their first columns). */
function isDocRefnoClash(error: unknown): boolean {
  const violated = violatedConstraintOf(error);
  return violated !== null && (violated.includes('doc_refno') || violated.includes('avh_party_id'));
}

/**
 * Receipt upload from the phone: the money a salesman collected. The receipt
 * is the desktop's: ReceiptPostingService.saveAndPostInTransaction saves the
 * draft and posts it (notes 106) inside a transaction of ours that also holds
 * the resend check and writes avh_client_uuid. An older phone sends only the
 * money and the server fills the open bills oldest first (decision 4); a phone
 * that sends its own settlement (allocations / creditsApplied, canvas 5b) has
 * it posted, adjusted to the bills as they stand now (D1). A refusal rolls all
 * of it back and is exactly /receipts/post's (RCT_RIGHT_POST, VCH_*, ACC_*),
 * plus the MOBILE_* codes.
 */
@Injectable()
export class MobileReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
    private readonly receipts: ReceiptService,
    private readonly posting: ReceiptPostingService,
    private readonly openItems: OpenItemsService,
  ) {}

  /** The branch the phone's receipts land in, the tenders it may collect with there, and the rules. */
  async options(query: MobileReceiptOptionsQueryDto): Promise<MobileReceiptOptions> {
    await assertMobileCompany(this.prisma, query.companyId);
    const device = await resolveMobileDevice(this.prisma, query.deviceUid);
    const branchId = query.branchId
      ? await requireMobileBranchOfCompany(this.prisma, query.companyId, query.branchId, 'branchId')
      : await requireMobileBranch(this.prisma, query.companyId, device.devBranchId);
    const today = await databaseToday(this.prisma);
    const [tenders, companyWide, atBranch] = await Promise.all([
      this.tendersOf(query.companyId, branchId, today),
      this.openItems.loadSettings(query.companyId),
      this.openItems.loadSettings(query.companyId, branchId),
    ]);
    return {
      companyId: query.companyId,
      branchId,
      tenders,
      settings: {
        // The order open-bills lists and a phone receipt's freed money fills
        // in, and the slabs its ppdSchedule and the D4 check read: the
        // company's, as /receipts/open-items reads them.
        receiptBillSort: companyWide.billSort,
        // What the post checks, at the receipt's branch.
        salesmanMandatory: atBranch.salesmanMandatory,
        pdcPostingMode: atBranch.pdcPostingMode,
        ppdEnabled: companyWide.ppdSlabs.length > 0,
      },
    };
  }

  /**
   * Every customer's open bills in the company, paged: the rows and the order
   * of /receipts/open-items (OpenItemsService.listCompanyOpenBills: the same
   * filter, the same accounts.receipt_bill_sort order within a party), by
   * party, then by id so a page boundary never moves between two reads. With
   * withCredits, each customer's held credits follow its bills (the rows of
   * open-items' credit list, oldest first). daysOverdue, pdcHeld and the PPD
   * steps are measured as open-items measures them (its default onDate).
   * Customers only (the user's call, 2026-11-17): another party's rows are
   * left out.
   */
  async openBills(query: MobileOpenBillsQueryDto): Promise<MobileOpenBillsPayload> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE;
    await assertMobileCompany(this.prisma, query.companyId);
    const [bills, credits, settings] = await Promise.all([
      this.openItems.listCompanyOpenBills(query.companyId),
      query.withCredits === true
        ? this.openItems.listCompanyOpenCredits(query.companyId)
        : Promise.resolve([] as CompanyOpenCredit[]),
      this.openItems.loadSettings(query.companyId),
    ]);
    const rows = await this.customersOnly(mergeByParty(bills, credits));
    const onDate = todayUtc();
    const from = (page - 1) * pageSize;
    const slice = rows.slice(from, from + pageSize);
    const held = await this.openItems.loadPostDatedHeld(
      slice
        .filter((entry) => entry.kind === 'BILL')
        .map((entry) => ({ billId: entry.row.ablId, accYear: entry.row.ablAccYear })),
      onDate,
    );
    return {
      items: slice.map((entry): MobileOpenBill => {
        const row = entry.row;
        const pending = new Prisma.Decimal(row.ablPendingAmount ?? 0);
        const isBill = entry.kind === 'BILL';
        return {
          partyId: row.ablPartyId,
          billId: row.ablId,
          billAccYear: row.ablAccYear.trim(),
          billType: row.ablBillType,
          docRefno: row.ablDocRefno,
          docDate: toDateString(row.ablDocDate)!,
          dueDate: toDateString(row.ablDueDate),
          billAmount: moneyText(row.ablBillAmount)!,
          pendingAmount: moneyText(pending)!,
          daysOverdue: isBill ? daysOverdue(row.ablDueDate, onDate) : 0,
          kind: isBill ? 'BILL' : creditKindOf(row.ablBillType),
          paidAmount: moneyText(new Prisma.Decimal(row.ablBillAmount).minus(pending))!,
          pdcHeld: moneyText(isBill ? (held.get(`${row.ablId}|${row.ablAccYear}`) ?? ZERO) : ZERO)!,
          ppdSchedule: isBill
            ? ppdScheduleOf({
                docDate: row.ablDocDate,
                onDate,
                pendingAmount: pending,
                slabs: settings.ppdSlabs,
              })
            : [],
        };
      }),
      total: rows.length,
      page,
      pageSize,
      hasMore: from + pageSize < rows.length,
      companyId: query.companyId,
      onDate: toDateString(onDate)!,
    };
  }

  /**
   * The rows of parties that are customers: a live sales.customers row
   * (cus_id = the party's led_id), as /mobile/customers/list shows them,
   * active or not. A supplier's or another ledger's row is dropped.
   */
  private async customersOnly<T extends { ablPartyId: string }>(rows: T[]): Promise<T[]> {
    const partyIds = [...new Set(rows.map((row) => row.ablPartyId))];
    if (partyIds.length === 0) {
      return rows;
    }
    const found = await this.prisma.$queryRaw<{ cusId: string }[]>`
      SELECT c.cus_id::text AS "cusId"
        FROM sales.customers c
       WHERE c.cus_id = ANY(${partyIds}::uuid[])
         AND c.cus_is_deleted = false`;
    const customers = new Set(found.map((row) => row.cusId));
    return rows.filter((row) => customers.has(row.ablPartyId));
  }

  async create(dto: CreateMobileReceiptDto): Promise<MobileReceiptCreateResult> {
    const userId = requireMobileLogin(this.requestContextService.getUserId());
    const plan = phonePlanOf(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Two copies of one resend in flight: the second waits here, then
        // finds the first's receipt below.
        await lockMobileClientUuid(tx, 'receipt', dto.avhCompanyId, dto.avhClientUuid);
        const stored = await this.findReceipt(tx, {
          companyId: dto.avhCompanyId,
          clientUuid: dto.avhClientUuid,
        });
        if (stored) {
          return this.resendAnswer(tx, stored, dto, plan);
        }
        // The right /receipts/create judges a save-and-post on (notes 94 A):
        // Post on menu 99, the same call and the same RCT_RIGHT_POST.
        await assertMenuRight(tx, {
          userId,
          menuId: RECEIPT_MENU_ID,
          right: 'post',
          codePrefix: 'RCT',
          action: 'post receipts',
        });
        await assertMobileCompany(tx, dto.avhCompanyId, 'avhCompanyId');
        const device = await resolveMobileDevice(tx, dto.deviceUid);
        const branchId = dto.avhBranchId
          ? await requireMobileBranchOfCompany(tx, dto.avhCompanyId, dto.avhBranchId, 'avhBranchId')
          : await requireMobileBranch(tx, dto.avhCompanyId, device.devBranchId);
        const receiptDay = receiptDayOf(dto.avhVoucherDate, await databaseToday(tx));
        const accYear = await requireMobileAccYear(
          tx,
          dto.avhCompanyId,
          receiptDay,
          'avhVoucherDate',
        );
        const collector = await this.collectorOf(tx, userId, dto.avhCompanyId, branchId);
        await this.assertDocRefnoFree(tx, dto, accYear);
        const draft = this.toDraftDto(dto, {
          avhBranchId: branchId,
          avhAccYear: accYear,
          avhVoucherDate: receiptDay,
          avhDeviceId: device.devId,
          avhUserId: userId,
          avhEmployeeId: collector ? [collector] : [],
        });
        // Saved AND posted at upload (the user's decision 1, settled 2026-11-17).
        const posted = await this.posting.saveAndPostInTransaction(
          tx,
          { ...draft, post: true },
          (client, saved) =>
            plan
              ? this.settlePhonePlan(client, dto, plan, saved, receiptDay)
              : this.fillOpenBills(client, dto, saved),
        );
        const voucherId = posted.header.avhVoucherId;
        // The uploaded receipt's own header only, never its post-dated cheque
        // vouchers or a reversal: on create, after the save, so no desktop
        // re-save or amend can blank it.
        await tx.$executeRaw`
          UPDATE accounts.acc_voucher_header
             SET avh_client_uuid = ${dto.avhClientUuid}::uuid
           WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::char(9)`;
        const saved = await this.findReceipt(tx, { voucherId, accYear });
        return this.answerFrom(tx, saved!, settlementOf(posted), plan, false);
      }, POST_TRANSACTION_OPTIONS);
    } catch (error: unknown) {
      // ux_avh_doc_refno: a receipt with the same shop number won a race the
      // check above lost. The desktop's own code for the clash.
      if (isUniqueConstraintError(error) && isDocRefnoClash(error)) {
        this.refuseDocRefno(dto.avhDocRefno ?? '');
      }
      // The lock makes this a backstop only (ux_avh_client_uuid): another
      // writer won the race, so its receipt is the answer.
      if (isClientUuidClash(error)) {
        const stored = await this.findReceipt(this.prisma, {
          companyId: dto.avhCompanyId,
          clientUuid: dto.avhClientUuid,
        });
        if (stored) {
          return this.resendAnswer(this.prisma, stored, dto, plan);
        }
      }
      throw rethrowAllocationError(error);
    }
  }

  /**
   * The collector (avh_employee_id): the signed-in login's live employee. A
   * login with none leaves it empty, unless accounts.receipt_salesman_mandatory
   * is on at the receipt's branch (the setting the post reads): then 422
   * MOBILE_RECEIPT_NO_EMPLOYEE, which only the User screen can fix.
   */
  private async collectorOf(
    tx: MobileReadClient,
    userId: string,
    companyId: string,
    branchId: string,
  ): Promise<string | null> {
    const login = await findMobileLogin(tx, userId);
    const employeeId = login?.employeeId ?? null;
    if (employeeId) {
      return employeeId;
    }
    const settings = await this.openItems.loadSettings(companyId, branchId);
    if (settings.salesmanMandatory) {
      throwUnprocessable<ModuleErrorDetail>('No collector', [
        {
          field: 'avhEmployeeId',
          code: MobileErrorCode.RECEIPT_NO_EMPLOYEE,
          message:
            `Login ${login?.loginName ?? userId} is not linked to an employee, and ` +
            'accounts.receipt_salesman_mandatory needs a collector on every receipt. Link the ' +
            'login to its employee on the User screen.',
        },
      ]);
    }
    return null;
  }

  /**
   * The shop's own receipt number (avhDocRefno) as the desktop keeps it unique:
   * one live receipt per company, party, voucher type and year with it
   * (ux_avh_doc_refno; a cancelled one frees it). 409 VCH_DUP_DOC_REFNO, the
   * Voucher Register's code for the same clash.
   */
  private async assertDocRefnoFree(
    tx: MobileReadClient,
    dto: CreateMobileReceiptDto,
    accYear: string,
  ): Promise<void> {
    const refno = dto.avhDocRefno?.trim();
    if (!refno) {
      return;
    }
    const [taken] = await tx.$queryRaw<{ refno: string | null }[]>`
      SELECT h.avh_voucher_refno AS refno
        FROM accounts.acc_voucher_header h
        JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       WHERE h.avh_company_id = ${dto.avhCompanyId}::uuid
         AND h.avh_party_id = ${dto.avhPartyId}::uuid
         AND h.avh_acc_year = ${accYear}::char(9)
         AND h.avh_doc_refno = ${refno}
         AND h.avh_is_deleted = false
         AND h.avh_voucher_status <> ${VoucherStatus.CANCELLED}
         AND t.vchr_type_code = ${RECEIPT_VOUCHER_TYPE_CODE}
       LIMIT 1`;
    if (taken) {
      this.refuseDocRefno(refno, taken.refno);
    }
  }

  private refuseDocRefno(refno: string, takenBy?: string | null): never {
    return throwConflict<ModuleErrorDetail>('Reference number already used', [
      {
        field: 'avhDocRefno',
        code: VCH.DUP_DOC_REFNO,
        message:
          `${refno} is already on a live receipt of this customer in this year` +
          (takenBy ? ` (${takenBy}).` : '.'),
      },
    ]);
  }

  /** The desktop draft payload: the phone's fields and the server's scope. */
  private toDraftDto(
    dto: CreateMobileReceiptDto,
    scope: Pick<
      SaveDraftReceiptDto,
      | 'avhBranchId'
      | 'avhAccYear'
      | 'avhVoucherDate'
      | 'avhDeviceId'
      | 'avhUserId'
      | 'avhEmployeeId'
    >,
  ): SaveDraftReceiptDto {
    return {
      avhCompanyId: dto.avhCompanyId,
      avhPartyId: dto.avhPartyId,
      avhUsrRefno: dto.avhUsrRefno,
      avhRemarks: dto.avhRemarks,
      avhDocRefno: dto.avhDocRefno,
      avhDocDate: dto.avhDocDate,
      ...scope,
      avhDeviceType: VoucherDeviceType.MOBILE,
      // Row numbers are the instruments' order on the phone.
      tenders: dto.tenders.map((tender, index) => ({ ...tender, tdRowNo: index + 1 })),
      replace: true,
    };
  }

  /**
   * Decision 4 (older phones), between the draft save and the post: the money
   * (less the surcharge the save seeded) fills the customer's open bills in
   * the order /receipts/open-items returns them, each up to what it owes under
   * the row lock the post itself takes next; the rest is on account. The
   * engine then checks every figure as it checks a desktop /post.
   */
  private async fillOpenBills(
    tx: Prisma.TransactionClient,
    dto: CreateMobileReceiptDto,
    saved: ReceiptDraftPayload,
  ): Promise<Pick<PostReceiptDto, 'allocations' | 'onAccount'>> {
    const open = await this.openItems.listOpenItems({
      companyId: dto.avhCompanyId,
      partyId: dto.avhPartyId,
    });
    const locked = await lockBills(
      tx,
      open.bills.map((bill) => ({ billId: bill.billId, billAccYear: bill.billAccYear })),
    );
    const rooms = open.bills.flatMap((bill) => {
      const row = locked.get(`${bill.billId}|${bill.billAccYear}`);
      return row && !row.ablIsDeleted
        ? [{ billId: row.ablId, billAccYear: row.ablAccYear, pending: row.ablPendingAmount }]
        : [];
    });
    const filled = fillOldestFirst(rooms, moneyForBills(saved.tenders, saved.otherLines));
    // PostReceiptDto carries money as a number (the desktop DTO's type); the
    // engine reads it back into a Decimal. Paise only, so the round trip is exact.
    return {
      allocations: filled.allocations.map((row) => ({
        billId: row.billId,
        billAccYear: row.billAccYear,
        amount: row.amount.toNumber(),
      })),
      onAccount: filled.onAccount.toNumber(),
    };
  }

  /**
   * The phone's own settlement, between the draft save and the post, under
   * the row lock the post takes next: every bill and credit it names and the
   * party's open bills are locked and read now; D5 / D4 are checked
   * (assertPhoneLimits); D1 adjusts the plan to the bills as they stand
   * (reconcilePhonePlan). A bill or credit that is missing, another party's,
   * another company's or of the wrong kind keeps the desktop's refusal
   * (VCH_BILL_*); a cancelled one is D1's (no longer open).
   */
  private async settlePhonePlan(
    tx: Prisma.TransactionClient,
    dto: CreateMobileReceiptDto,
    plan: PhonePlan,
    saved: ReceiptDraftPayload,
    receiptDay: string,
  ): Promise<Pick<PostReceiptDto, 'allocations' | 'onAccount' | 'creditsApplied'>> {
    const companyId = dto.avhCompanyId;
    const partyId = dto.avhPartyId;
    const [open, settings] = await Promise.all([
      this.openItems.listOpenItems({ companyId, partyId }),
      // The slabs /receipts/open-items and GET /mobile/receipts/open-bills offer.
      this.openItems.loadSettings(companyId),
    ]);
    const keys = new Map<string, { billId: string; billAccYear: string }>();
    for (const row of [...open.bills, ...plan.lines, ...plan.credits]) {
      keys.set(billKeyOf(row), { billId: row.billId, billAccYear: row.billAccYear.trim() });
    }
    const locked = await lockBills(tx, [...keys.values()]);
    const nowOf = (key: string): BillNow | null => {
      const row = locked.get(key);
      if (!row) {
        return null;
      }
      const pending = new Prisma.Decimal(row.ablPendingAmount);
      return {
        billId: row.ablId,
        billAccYear: row.ablAccYear.trim(),
        docRefno: row.ablDocRefno,
        docDate: row.ablDocDate,
        pending,
        live: !row.ablIsDeleted && pending.greaterThan(0),
      };
    };
    const assertUsable = (
      row: { billId: string; billAccYear: string },
      kind: 'RECEIVABLE' | 'CREDIT',
      field: string,
    ): BillNow => {
      const found = locked.get(billKeyOf(row));
      if (!found || !found.ablIsDeleted) {
        assertBillUsable(found, { billId: row.billId, partyId, companyId, kind, field });
      }
      return nowOf(billKeyOf(row))!;
    };
    const billsNow = new Map<string, BillNow>();
    plan.lines.forEach((line, index) => {
      billsNow.set(
        billKeyOf(line),
        assertUsable(line, 'RECEIVABLE', `allocations.${index}.billId`),
      );
    });
    const creditsNow = new Map<string, CreditNow>();
    plan.credits.forEach((credit, index) => {
      const now = assertUsable(credit, 'CREDIT', `creditsApplied.${index}.billId`);
      creditsNow.set(billKeyOf(credit), {
        billId: now.billId,
        billAccYear: now.billAccYear,
        docRefno: now.docRefno,
        held: now.pending,
        live: now.live,
      });
    });
    const openOrder = open.bills.flatMap((bill) => {
      const now = nowOf(billKeyOf(bill));
      return now && now.live ? [now] : [];
    });

    assertPhoneLimits(plan.lines, billsNow, toDateOnly(receiptDay), settings.ppdSlabs);
    const settled = reconcilePhonePlan({
      lines: plan.lines,
      credits: plan.credits,
      billsNow,
      creditsNow,
      openOrder,
      money: moneyForBills(saved.tenders, saved.otherLines),
      fillAll: plan.fillAll,
    });
    // PostReceiptDto carries money as numbers (paise, so the round trip is
    // exact). A negative on-account means the phone allocated more than it
    // collected: claimed as 0, the engine refuses it as unbalanced
    // (VCH_UNBALANCED), as it refuses a desktop receipt.
    return {
      allocations: settled.allocations.map((line) => ({
        billId: line.billId,
        billAccYear: line.billAccYear,
        amount: line.amount.toNumber(),
        discount: line.discount.toNumber(),
        roundoff: line.roundoff.toNumber(),
      })),
      creditsApplied: settled.creditsApplied.map((credit) => ({
        billId: credit.billId,
        billAccYear: credit.billAccYear,
        amount: credit.amount.toNumber(),
      })),
      onAccount: Prisma.Decimal.max(settled.onAccount, ZERO).toNumber(),
    };
  }

  /**
   * The company's live, active money-in tenders usable at the branch today,
   * with a ledger: every type but the ones the desktop Receipt screen leaves
   * out (MOBILE_RECEIPT_EXCLUDED_TENDER_TYPES).
   */
  private async tendersOf(
    companyId: string,
    branchId: string,
    today: string,
  ): Promise<MobileReceiptTender[]> {
    const rows = await this.prisma.$queryRaw<
      (Omit<MobileReceiptTender, 'surchargePerc' | 'surchargeAmount'> & {
        surchargePerc: Prisma.Decimal;
        surchargeAmount: Prisma.Decimal;
      })[]
    >`
      SELECT t.tnd_id::text AS "tenderId", t.tnd_type_id AS "typeId",
             y.ttm_type_name AS "typeCode", t.tnd_name AS name,
             NULLIF(btrim(t.tnd_short_name), '') AS "shortName",
             (upper(y.ttm_type_name) = 'CHEQUE' OR COALESCE(t.tnd_needs_ref, y.ttm_needs_ref, false))
               AS "needsRef",
             NULLIF(btrim(y.ttm_ref_label), '') AS "refLabel",
             t.tnd_is_default AS "isDefault",
             t.tnd_surcharge_perc AS "surchargePerc", t.tnd_surcharge_amount AS "surchargeAmount",
             (upper(y.ttm_type_name) = 'CHEQUE') AS "requiresBank"
        FROM accounts.acc_tender_master t
        JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
       WHERE t.tnd_company_id = ${companyId}::uuid
         AND (t.tnd_branch_id IS NULL OR t.tnd_branch_id = ${branchId}::uuid)
         AND t.tnd_is_deleted = false
         AND t.tnd_is_active = true
         AND t.tnd_ledger_id IS NOT NULL
         AND (t.tnd_effective_from IS NULL OR t.tnd_effective_from <= ${today}::date)
         AND (t.tnd_effective_to IS NULL OR t.tnd_effective_to >= ${today}::date)
         AND y.ttm_is_deleted = false
         AND y.ttm_is_active = true
         AND upper(y.ttm_type_name) <> ALL(${MOBILE_RECEIPT_EXCLUDED_TENDER_TYPES}::text[])
       ORDER BY t.tnd_display_position, lower(t.tnd_name), t.tnd_id`;
    return rows.map((row) => ({
      ...row,
      surchargePerc: new Prisma.Decimal(row.surchargePerc).toFixed(3),
      surchargeAmount: moneyText(row.surchargeAmount)!,
    }));
  }

  /**
   * The receipt header a (company, client uuid) names in any year and any
   * state, deleted and cancelled ones included; or one header by its keys.
   */
  private async findReceipt(
    client: MobileReadClient,
    key: { companyId: string; clientUuid: string } | { voucherId: string; accYear: string },
  ): Promise<StoredReceipt | null> {
    const where =
      'clientUuid' in key
        ? Prisma.sql`h.avh_company_id = ${key.companyId}::uuid
                 AND h.avh_client_uuid = ${key.clientUuid}::uuid`
        : Prisma.sql`h.avh_voucher_id = ${key.voucherId}::uuid
                 AND h.avh_acc_year = ${key.accYear}::char(9)`;
    const [row] = await client.$queryRaw<StoredReceipt[]>`
      SELECT h.avh_voucher_id::text AS "avhVoucherId", h.avh_company_id::text AS "avhCompanyId",
             h.avh_branch_id::text AS "avhBranchId", btrim(h.avh_acc_year::text) AS "avhAccYear",
             h.avh_voucher_refno AS "avhVoucherRefno", h.avh_usr_refno AS "avhUsrRefno",
             h.avh_voucher_date::text AS "avhVoucherDate",
             h.avh_doc_amount AS "avhDocAmount", h.avh_voucher_status AS "avhVoucherStatus",
             h.avh_is_deleted AS "avhIsDeleted", h.avh_party_id::text AS "avhPartyId",
             h.avh_employee_id[1]::text AS "employeeId"
        FROM accounts.acc_voucher_header h
       WHERE ${where}
       ORDER BY h.avh_created_on
       LIMIT 1`;
    return row ?? null;
  }

  /**
   * A resend: the receipt already saved, as it stands now. The same uuid on
   * another customer's receipt is a phone bug, not a lost answer: 409.
   */
  private async resendAnswer(
    client: Prisma.TransactionClient | PrismaService,
    stored: StoredReceipt,
    dto: CreateMobileReceiptDto,
    plan: PhonePlan | null,
  ): Promise<MobileReceiptCreateResult> {
    if (stored.avhPartyId !== dto.avhPartyId) {
      throwConflict<ModuleErrorDetail>('Receipt id already used', [
        {
          field: 'avhClientUuid',
          message: `avhClientUuid ${dto.avhClientUuid} already names receipt ${stored.avhVoucherRefno ?? stored.avhVoucherId} of another customer.`,
          code: MobileErrorCode.CLIENT_UUID_REUSED,
        },
      ]);
    }
    if (stored.avhIsDeleted) {
      return this.answerFrom(client, stored, NOTHING_SETTLED, plan, true);
    }
    const header = await this.receipts.loadHeaderOrThrow(
      client,
      stored.avhVoucherId,
      stored.avhAccYear,
    );
    const full = await this.receipts.loadFullReceipt(client, header);
    return this.answerFrom(client, stored, settlementOf(full), plan, true);
  }

  /**
   * The answer, for a new receipt and a resend alike: the stored header, what
   * it settles now, and adjusted[] (the phone's plan against that; empty for
   * an older phone and once the receipt is cancelled or deleted).
   */
  private async answerFrom(
    client: MobileReadClient,
    stored: StoredReceipt,
    settled: MobileSettlement,
    plan: PhonePlan | null,
    duplicate: boolean,
  ): Promise<MobileReceiptCreateResult> {
    const adjusted =
      plan &&
      !stored.avhIsDeleted &&
      stored.avhVoucherStatus !== (VoucherStatus.CANCELLED as string)
        ? await this.adjustedOf(client, plan, settled)
        : [];
    return {
      avhVoucherId: stored.avhVoucherId,
      avhCompanyId: stored.avhCompanyId,
      avhBranchId: stored.avhBranchId,
      avhAccYear: stored.avhAccYear,
      avhVoucherRefno: stored.avhVoucherRefno,
      avhUsrRefno: stored.avhUsrRefno,
      avhVoucherDate: stored.avhVoucherDate,
      avhDocAmount: moneyText(stored.avhDocAmount ?? 0)!,
      avhVoucherStatus: stored.avhVoucherStatus,
      allocations: settled.allocations,
      onAccount: settled.onAccount,
      duplicate,
      avhIsDeleted: stored.avhIsDeleted,
      creditsApplied: settled.creditsApplied,
      pdcVouchers: settled.pdcVouchers,
      adjusted,
      employeeId: stored.employeeId,
    };
  }

  /** adjustedAgainstPlan, with each bill's and credit's number read back. */
  private async adjustedOf(
    client: MobileReadClient,
    plan: PhonePlan,
    settled: MobileSettlement,
  ): Promise<MobileReceiptAdjusted[]> {
    const named = [...plan.lines, ...plan.credits];
    if (named.length === 0) {
      return [];
    }
    const rows = await client.$queryRaw<{ id: string; year: string; refno: string }[]>`
      SELECT b.abl_id::text AS id, btrim(b.abl_acc_year::text) AS year, b.abl_doc_refno AS refno
        FROM accounts.acc_bill_balance b
       WHERE b.abl_id = ANY(${named.map((row) => row.billId)}::uuid[])`;
    const refnos = new Map(rows.map((row) => [`${row.id}|${row.year}`, row.refno]));
    return adjustedAgainstPlan(plan, settled.figures, (key) => refnos.get(key) ?? '');
  }
}
