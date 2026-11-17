import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { assertMenuRight } from '../../common/posting/rights';
import { throwConflict, type ModuleErrorDetail } from '../../common/utils/module-shared.utils';
import { OpenItemsService } from '../../modules/accountsModule/receipt/open-items.service';
import { lockBills } from '../../modules/accountsModule/receipt/receipt.guards';
import {
  daysOverdue,
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
  RECEIPT_MENU_ID,
  VoucherDeviceType,
} from '../../modules/accountsModule/receipt/types/receipt-enum';
import type {
  ReceiptDraftPayload,
  ReceiptPayload,
} from '../../modules/accountsModule/receipt/types/receipt-api.types';
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
  CreateMobileReceiptDto,
  MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE,
  MobileOpenBillsQueryDto,
  MobileReceiptOptionsQueryDto,
} from './dto/mobile-receipt.dto';
import { fillOldestFirst, moneyForBills } from './mobile-receipt-settlement';
import type {
  MobileOpenBillsPayload,
  MobileReceiptAllocation,
  MobileReceiptCreateResult,
  MobileReceiptOptions,
  MobileReceiptTender,
} from './types/mobile-receipt-api.types';

/** The tender types a salesman collects with (never CREDIT, TEMP_CR, LOYALTY, RRN or a gift VOUCHER). */
export const MOBILE_RECEIPT_TENDER_TYPES = ['CASH', 'CARD', 'UPI', 'WALLET', 'CHEQUE', 'BANK'];

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
}

/** The receipt's date: YYYY-MM-DD, no time zone shift. */
export function receiptDayOf(avhVoucherDate: string | undefined, today: string): string {
  return avhVoucherDate ? avhVoucherDate.slice(0, 10) : today;
}

/**
 * What a receipt settles now, one row per bill in the order it was filled:
 * its live settlement rows (not a credit pair's mirror, not one a cancel or
 * an amend has since retracted), summed per bill; and what it holds on account
 * (its live ADVANCE bills).
 */
export function settlementOf(payload: Pick<ReceiptPayload, 'allocations' | 'advanceBills'>): {
  allocations: MobileReceiptAllocation[];
  onAccount: string;
} {
  const byBill = new Map<
    string,
    { row: MobileReceiptAllocation; amount: Prisma.Decimal; pending: number | null }
  >();
  for (const row of payload.allocations) {
    if (row.againstBillId !== null || row.isReversed || row.reversalOfId !== null) {
      continue;
    }
    const key = `${row.billId}|${row.billAccYear}`;
    const entry = byBill.get(key) ?? {
      row: {
        billId: row.billId,
        billAccYear: row.billAccYear.trim(),
        docRefno: row.docRefno,
        amount: '0.00',
        pendingAmount: null,
      },
      amount: new Prisma.Decimal(0),
      pending: row.pendingAmount,
    };
    entry.amount = entry.amount.plus(row.amount);
    byBill.set(key, entry);
  }
  const allocations = [...byBill.values()].map((entry) => ({
    ...entry.row,
    amount: moneyText(entry.amount)!,
    pendingAmount: moneyText(entry.pending),
  }));
  const onAccount = payload.advanceBills.reduce(
    (total, bill) => total.plus(bill.billAmount),
    new Prisma.Decimal(0),
  );
  return { allocations, onAccount: moneyText(onAccount)! };
}

/**
 * Receipt upload from the phone: the money a salesman collected. The receipt
 * is the desktop's: ReceiptPostingService.saveAndPostInTransaction saves the
 * draft and posts it (notes 106) inside a transaction of ours that also holds
 * the resend check and writes avh_client_uuid. The phone sends only the
 * money; the server fills the customer's open bills oldest first (decision 4)
 * and keeps the rest on account. A refusal rolls all of it back and is
 * exactly /receipts/post's (RCT_RIGHT_POST, VCH_*, ACC_*).
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

  /** The branch the phone's receipts land in, and the tenders it may collect with there. */
  async options(query: MobileReceiptOptionsQueryDto): Promise<MobileReceiptOptions> {
    await assertMobileCompany(this.prisma, query.companyId);
    const device = await resolveMobileDevice(this.prisma, query.deviceUid);
    const branchId = await requireMobileBranch(this.prisma, query.companyId, device.devBranchId);
    const today = await databaseToday(this.prisma);
    return {
      companyId: query.companyId,
      branchId,
      tenders: await this.tendersOf(query.companyId, branchId, today),
    };
  }

  /**
   * Every customer's open bills in the company, paged: the rows and the order
   * of /receipts/open-items (OpenItemsService.listCompanyOpenBills: the same
   * filter, the same accounts.receipt_bill_sort order within a party), by
   * party, then by id so a page boundary never moves between two reads.
   * daysOverdue is measured as open-items measures it (its default onDate).
   * Customers only (the user's call, 2026-11-17): another party's receivable
   * is left out.
   */
  async openBills(query: MobileOpenBillsQueryDto): Promise<MobileOpenBillsPayload> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE;
    await assertMobileCompany(this.prisma, query.companyId);
    const bills = await this.customersOnly(
      await this.openItems.listCompanyOpenBills(query.companyId),
    );
    const onDate = todayUtc();
    const from = (page - 1) * pageSize;
    return {
      items: bills.slice(from, from + pageSize).map((bill) => ({
        partyId: bill.ablPartyId,
        billId: bill.ablId,
        billAccYear: bill.ablAccYear.trim(),
        billType: bill.ablBillType,
        docRefno: bill.ablDocRefno,
        docDate: toDateString(bill.ablDocDate)!,
        dueDate: toDateString(bill.ablDueDate),
        billAmount: moneyText(bill.ablBillAmount)!,
        pendingAmount: moneyText(bill.ablPendingAmount ?? 0)!,
        daysOverdue: daysOverdue(bill.ablDueDate, onDate),
      })),
      total: bills.length,
      page,
      pageSize,
      hasMore: from + pageSize < bills.length,
      companyId: query.companyId,
      onDate: toDateString(onDate)!,
    };
  }

  /**
   * The bills of parties that are customers: a live sales.customers row
   * (cus_id = the party's led_id), as /mobile/customers/list shows them,
   * active or not. A supplier's or another ledger's receivable is dropped.
   */
  private async customersOnly<T extends { ablPartyId: string }>(bills: T[]): Promise<T[]> {
    const partyIds = [...new Set(bills.map((bill) => bill.ablPartyId))];
    if (partyIds.length === 0) {
      return bills;
    }
    const rows = await this.prisma.$queryRaw<{ cusId: string }[]>`
      SELECT c.cus_id::text AS "cusId"
        FROM sales.customers c
       WHERE c.cus_id = ANY(${partyIds}::uuid[])
         AND c.cus_is_deleted = false`;
    const customers = new Set(rows.map((row) => row.cusId));
    return bills.filter((bill) => customers.has(bill.ablPartyId));
  }

  async create(dto: CreateMobileReceiptDto): Promise<MobileReceiptCreateResult> {
    const userId = requireMobileLogin(this.requestContextService.getUserId());
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
          return this.resendAnswer(tx, stored, dto);
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
        const branchId = await requireMobileBranch(tx, dto.avhCompanyId, device.devBranchId);
        const receiptDay = receiptDayOf(dto.avhVoucherDate, await databaseToday(tx));
        const accYear = await requireMobileAccYear(
          tx,
          dto.avhCompanyId,
          receiptDay,
          'avhVoucherDate',
        );
        const draft = this.toDraftDto(dto, {
          avhBranchId: branchId,
          avhAccYear: accYear,
          avhVoucherDate: receiptDay,
          avhDeviceId: device.devId,
          avhUserId: userId,
        });
        // Saved AND posted at upload (the user's decision 1, settled 2026-11-17).
        const posted = await this.posting.saveAndPostInTransaction(
          tx,
          { ...draft, post: true },
          (client, saved) => this.fillOpenBills(client, dto, saved),
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
        return this.toAnswer(saved!, settlementOf(posted), false);
      }, POST_TRANSACTION_OPTIONS);
    } catch (error: unknown) {
      // The lock makes this a backstop only (ux_avh_client_uuid): another
      // writer won the race, so its receipt is the answer.
      if (isClientUuidClash(error)) {
        const stored = await this.findReceipt(this.prisma, {
          companyId: dto.avhCompanyId,
          clientUuid: dto.avhClientUuid,
        });
        if (stored) {
          return this.resendAnswer(this.prisma, stored, dto);
        }
      }
      throw rethrowAllocationError(error);
    }
  }

  /** The desktop draft payload: the phone's fields and the server's scope. */
  private toDraftDto(
    dto: CreateMobileReceiptDto,
    scope: Pick<
      SaveDraftReceiptDto,
      'avhBranchId' | 'avhAccYear' | 'avhVoucherDate' | 'avhDeviceId' | 'avhUserId'
    >,
  ): SaveDraftReceiptDto {
    return {
      avhCompanyId: dto.avhCompanyId,
      avhPartyId: dto.avhPartyId,
      avhUsrRefno: dto.avhUsrRefno,
      avhRemarks: dto.avhRemarks,
      ...scope,
      avhDeviceType: VoucherDeviceType.MOBILE,
      // Row numbers are the instruments' order on the phone.
      tenders: dto.tenders.map((tender, index) => ({ ...tender, tdRowNo: index + 1 })),
      replace: true,
    };
  }

  /**
   * Decision 4, between the draft save and the post: the money (less the
   * surcharge the save seeded) fills the customer's open bills in the order
   * /receipts/open-items returns them, each up to what it owes under the row
   * lock the post itself takes next; the rest is on account. The engine then
   * checks every figure as it checks a desktop /post.
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

  /** The company's live, active money-in tenders usable at the branch today, with a ledger. */
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
             (y.ttm_type_name = 'CHEQUE' OR COALESCE(t.tnd_needs_ref, y.ttm_needs_ref, false))
               AS "needsRef",
             NULLIF(btrim(y.ttm_ref_label), '') AS "refLabel",
             t.tnd_is_default AS "isDefault",
             t.tnd_surcharge_perc AS "surchargePerc", t.tnd_surcharge_amount AS "surchargeAmount"
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
         AND y.ttm_type_name = ANY(${MOBILE_RECEIPT_TENDER_TYPES}::text[])
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
             h.avh_is_deleted AS "avhIsDeleted", h.avh_party_id::text AS "avhPartyId"
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
      return this.toAnswer(stored, { allocations: [], onAccount: '0.00' }, true);
    }
    const header = await this.receipts.loadHeaderOrThrow(
      client,
      stored.avhVoucherId,
      stored.avhAccYear,
    );
    const full = await this.receipts.loadFullReceipt(client, header);
    return this.toAnswer(stored, settlementOf(full), true);
  }

  private toAnswer(
    stored: StoredReceipt,
    settled: ReturnType<typeof settlementOf>,
    duplicate: boolean,
  ): MobileReceiptCreateResult {
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
    };
  }
}
