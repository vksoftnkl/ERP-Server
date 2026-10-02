// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../../src/app.module';
import { TokenService, type AccessTokenPayload } from '../../src/modules/auth/token.service';
import { AuthSessionService } from '../../src/modules/auth/auth-session.service';
import { grantMenuRights, restoreMenuRights, type MenuRightsMemo } from './menu-rights';

export { ISSUED_CHEQUES_MENU, PAYMENT_MENU, RECEIPT_MENU } from './menu-rights';

/**
 * The harness every `test/payment-*.e2e-spec.ts` suite shares — plan
 * "Payment (menu 100) — backend plan, REVISION 2" §7, the receipt's suites
 * mirrored with the money going OUT.
 *
 * ── The same rules as the receipt suites ─────────────────────────────────
 * Auth is stubbed at the PROVIDER level (TokenService + AuthSessionService),
 * never at the guard: the real AccessTokenGuard, the global ValidationPipe,
 * URI versioning, the global prefix and the exception filters all run, so
 * the results match the live server. See memory:
 * erp-server-http-testing-without-credentials.
 *
 * ── Own fixtures, cleaned up completely ──────────────────────────────────
 * Every suite creates its OWN party ledger (under Sundry Creditors, company
 * owned, bill-by-bill), its own OPENING bills and — unlike the receipt's
 * cheque-guards suite — the matching `acc_opening_balance` row, because
 * `accounts.reconcile_on_post` is ON for the dev company and the post is
 * refused (422 ACC_PARTY_OUT_OF_BALANCE) unless the party's open bills add
 * up to its ledger balance. Ledger = bills by construction, before the first
 * payment and after every one.
 *
 * `teardown()` removes everything hanging off those parties, newest table
 * first, so a failed run leaves nothing behind but the rows a failing test
 * was looking at.
 */

export const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292'; // Acme Foods Pvt Ltd
export const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab'; // Acme Foods - Coimbatore Branch
export const ACC_YEAR = '2026-2027';
/** tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor. */
export const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';
export const BEARER = 'Bearer dummy-test-token';

export const ROUTES = {
  openItems: '/api/v1/payments/open-items',
  partyContext: '/api/v1/payments/party-context',
  adjacent: '/api/v1/payments/adjacent',
  duplicateCheck: '/api/v1/payments/duplicate-check',
  create: '/api/v1/payments/create',
  post: '/api/v1/payments/post',
  get: '/api/v1/payments/get',
  updateHeader: '/api/v1/payments/update-header',
  cancel: '/api/v1/payments/cancel',
  delete: '/api/v1/payments/delete',
  amend: '/api/v1/payments/amend',
} as const;

/** The shared chart's Sundry Creditors group (prisma/seed/Account_Groups.sql pins the id). */
const SUNDRY_CREDITORS_GROUP = '019eee86-f34b-7d73-8a79-f5c6f036439a';

export const CHEQUE_TENDER_TYPE = 5;
export const BANK_TENDER_TYPE = 6;
export const CASH_TENDER_TYPE = 1;

export const prisma = new PrismaClient();

export const today = (): string => new Date().toISOString().slice(0, 10);
export const isoDate = (daysFromToday: number): string =>
  new Date(Date.now() + daysFromToday * 86_400_000).toISOString().slice(0, 10);
export const dateOnly = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
export const data = <T>(res: request.Response): T => (res.body as { data: T }).data;

/**
 * `expect(res.status).toBe(n)`, but a mismatch names the server's own answer —
 * the field errors are the whole diagnosis, and a bare "Expected 201, received
 * 400" throws them away.
 */
export function expectStatus(res: request.Response, status: number): void {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

/** A short unique stamp for names and references, so two runs never collide. */
export const stamp = (): string =>
  `${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

export async function bootApp(
  overrides: Partial<AccessTokenPayload> = {},
): Promise<INestApplication> {
  const claims: AccessTokenPayload = {
    sub: ACTOR,
    user_name: 'tester1',
    sid: 'e2e-test-session',
    user_type: 'SUPER ADMIN',
    company_id: COMPANY,
    branch_id: BRANCH,
    device_id: null,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    typ: 'access',
    ...overrides,
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenService)
    .useValue({ verifyAccessToken: (_t: string): AccessTokenPayload => claims })
    .overrideProvider(AuthSessionService)
    .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
    .compile();

  const app = moduleRef.createNestApplication();
  // Mirror src/main.ts so the route, validation and errors behave as live.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: process.env.API_VERSION ?? '1',
  });
  app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
  await app.init();
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Masters the suites read, never write
// ═══════════════════════════════════════════════════════════════════════════

export interface Masters {
  bankTenderId: string;
  /** The bank the BANK tender pays from — a live Bank Accounts ledger. */
  bankLedgerId: string;
  cashTenderId: string;
  cashLedgerId: string | null;
  chequeTenderId: string;
  /** A cash ledger, for the "a money ledger is not a payee" refusal. */
  aCashLedgerId: string;
  ledgerByRole: (role: string) => string;
}

export async function loadMasters(): Promise<Masters> {
  const tender = async (typeId: number) =>
    prisma.accTenderMaster.findFirstOrThrow({
      where: { tndTypeId: typeId, tndCompanyId: COMPANY, tndIsDeleted: false, tndIsActive: true },
      select: { tndId: true, tndLedgerId: true },
      orderBy: { tndCreatedOn: 'asc' },
    });
  const [bank, cash, cheque] = await Promise.all([
    tender(BANK_TENDER_TYPE),
    tender(CASH_TENDER_TYPE),
    tender(CHEQUE_TENDER_TYPE),
  ]);
  const roles = await prisma.accLedgerMap.findMany({
    where: { almIsDeleted: false, almIsActive: true, almCompanyId: null, almBranchId: null },
    select: { almRole: true, almLedgerId: true },
  });
  const cashLedger = await prisma.$queryRawUnsafe<Array<{ led_id: string }>>(
    `SELECT l.led_id
       FROM accounts.acc_ledger_master l
       JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
      WHERE g.acc_group_name = 'Cash-in-Hand'
        AND l.led_is_deleted = false AND l.led_is_active = true
        AND (l.led_company_id IS NULL OR l.led_company_id = $1::uuid)
      ORDER BY l.led_created_on
      LIMIT 1`,
    COMPANY,
  );

  return {
    bankTenderId: bank.tndId,
    bankLedgerId: bank.tndLedgerId,
    cashTenderId: cash.tndId,
    cashLedgerId: cash.tndLedgerId,
    chequeTenderId: cheque.tndId,
    aCashLedgerId: cashLedger[0].led_id,
    ledgerByRole: (role: string): string => {
      const row = roles.find((r) => r.almRole === role);
      if (!row) {
        throw new Error(`accounts.acc_ledger_map has no live global row for ${role}`);
      }
      return row.almLedgerId;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Fixtures the suites create, and remove
// ═══════════════════════════════════════════════════════════════════════════

export interface PartyOptions {
  tds?: { section: string; deducteeType: string; pan: string | null } | null;
}

export class PaymentFixtures {
  readonly parties: string[] = [];
  readonly chequeBooks: string[] = [];
  /** Vouchers the suite has SEEN — the API's own, for a teardown that runs even if a party lookup fails. */
  readonly vouchers: string[] = [];
  private rights: MenuRightsMemo | null = null;

  /**
   * notes (62) D2: every /payments (menu 100) and /receipts (menu 99) route
   * is judged on tester1's user_menus row, and tester1 has none. Granted for
   * the suite, put back by `teardown()`. See test/helpers/menu-rights.ts.
   */
  async grantRights(menuIds: readonly number[]): Promise<void> {
    this.rights = await grantMenuRights(prisma, menuIds);
  }

  /** A supplier-shaped party ledger: Sundry Creditors, company owned, bill-by-bill. */
  async createParty(tag: string, options: PartyOptions = {}): Promise<string> {
    const ledger = await prisma.accLedgerMaster.create({
      data: {
        ledCompanyId: COMPANY,
        ledGroupId: SUNDRY_CREDITORS_GROUP,
        ledName: `E2E-PAY-${tag}-${stamp()}`,
        ledLedgerType: 'PARTY',
        ledIsBillByBill: true,
        ledIsActive: true,
        ledIsTdsApplicable: Boolean(options.tds),
        ledTdsNatureOfPayment: options.tds?.section ?? null,
        ledTdsDeducteeType: options.tds?.deducteeType ?? null,
        ledPanNo: options.tds?.pan ?? null,
        ledCreatedBy: ACTOR,
      },
      select: { ledId: true },
    });
    this.parties.push(ledger.ledId);
    return ledger.ledId;
  }

  /**
   * An OPENING bill on the party, WITH the ledger opening that keeps the
   * party's ledger equal to its bills. CR = a bill we owe (a payable); DR =
   * a debit we hold (an advance paid, offered against the bills).
   *
   * OPENING because `ck_abl_voucher` exempts it from naming a voucher — the
   * one bill type a suite can raise before it has a document to hang it off.
   */
  async createOpeningBill(
    partyId: string,
    side: 'CR' | 'DR',
    amount: number,
    options: {
      refno?: string;
      docDate?: string;
      dueDate?: string | null;
      /**
       * false = the bill WITHOUT its ledger opening, so the party's ledger and
       * bills disagree and `accounts.reconcile_on_post` refuses the post at
       * its last step — the one way to make a post fail AFTER a leaf is taken.
       */
      ledgerOpening?: boolean;
    } = {},
  ): Promise<{ billId: string; billAccYear: string; docRefno: string }> {
    const docRefno = options.refno ?? `E2E-PAY-${side}-${stamp()}`;
    const docDate = dateOnly(options.docDate ?? today());
    const bill = await prisma.accBillBalance.create({
      data: {
        ablCompanyId: COMPANY,
        ablBranchId: BRANCH,
        ablAccYear: ACC_YEAR,
        ablPartyId: partyId,
        ablBillType: 'OPENING',
        ablDocRefno: docRefno,
        ablDocDate: docDate,
        ablDueDate:
          options.dueDate === null ? null : dateOnly(options.dueDate ?? options.docDate ?? today()),
        ablDrCr: side,
        ablBillAmount: new Prisma.Decimal(amount),
        ablCreatedBy: ACTOR,
      },
      select: { ablId: true, ablAccYear: true },
    });
    if (options.ledgerOpening === false) {
      return { billId: bill.ablId, billAccYear: bill.ablAccYear, docRefno };
    }
    // ONE opening row per ledger (company, branch, year) — so the party's
    // opening is the NET of every fixture bill on it, kept signed D/C.
    const signed = side === 'DR' ? amount : -amount;
    const existing = await prisma.accOpeningBalance.findFirst({
      where: { opCompanyId: COMPANY, opBranchId: BRANCH, opAccYear: ACC_YEAR, opLedgerId: partyId },
      select: { opId: true, opAmount: true, opDrCr: true },
    });
    const net =
      (existing
        ? existing.opDrCr.trim() === 'D'
          ? Number(existing.opAmount)
          : -Number(existing.opAmount)
        : 0) + signed;
    const row = {
      opAmount: new Prisma.Decimal(Math.abs(net).toFixed(2)),
      opDrCr: net >= 0 ? 'D' : 'C',
    };
    if (existing) {
      await prisma.accOpeningBalance.updateMany({
        where: { opId: existing.opId, opAccYear: ACC_YEAR },
        data: row,
      });
    } else {
      await prisma.accOpeningBalance.create({
        data: {
          opCompanyId: COMPANY,
          opBranchId: BRANCH,
          opAccYear: ACC_YEAR,
          opLedgerId: partyId,
          ...row,
          opSource: 'MANUAL',
          opRemarks: 'E2E payment fixture — the net of its fixture bills',
          opCreatedBy: ACTOR,
        },
      });
    }
    return { billId: bill.ablId, billAccYear: bill.ablAccYear, docRefno };
  }

  /**
   * notes (62) A4 — make the party a SUPPLIER with its own prompt-payment
   * terms: `cashDiscPerc`% off when paid within `creditDays` of the bill date.
   * `sup_id` IS the ledger id, as the supplier master creates it. The
   * non-key columns are copied from any live supplier, so the row needs no
   * master of its own.
   */
  async createSupplierTerms(partyId: string, creditDays: number, cashDiscPerc: number) {
    const [template] = await prisma.$queryRawUnsafe<
      Array<{
        sup_group_id: string;
        sup_purchase_type: string;
        sup_state_name: string;
        sup_state_code: string;
        sup_gst_type: string;
      }>
    >(
      `SELECT sup_group_id, sup_purchase_type, sup_state_name, sup_state_code, sup_gst_type
         FROM purchase.suppliers WHERE sup_is_deleted = false LIMIT 1`,
    );
    if (!template) {
      throw new Error('purchase.suppliers has no live row to copy the master columns from');
    }
    const ledger = await prisma.accLedgerMaster.findUniqueOrThrow({
      where: { ledId: partyId },
      select: { ledName: true },
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO purchase.suppliers (
         sup_id, sup_company_id, sup_group_id, sup_purchase_type, sup_name, sup_state_name,
         sup_state_code, sup_gst_type, sup_credit_days, sup_cash_disc_perc, sup_modified_on
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9::int, $10::numeric, now())`,
      partyId,
      COMPANY,
      template.sup_group_id,
      template.sup_purchase_type,
      ledger.ledName,
      template.sup_state_name,
      template.sup_state_code,
      template.sup_gst_type,
      creditDays,
      cashDiscPerc,
    );
  }

  /** One of OUR cheque books on `bankLedgerId`, with `leaves` leaves from `leafFrom`. */
  async createChequeBook(
    bankLedgerId: string,
    leaves: number,
    options: { leafFrom?: number; branchId?: string | null; width?: number } = {},
  ): Promise<{ chequeBookId: string; bookNo: string; leafFrom: number; width: number }> {
    // A leaf number nobody else's book on this bank is likely to hold —
    // ux_apd_issued_leaf is unique per bank account.
    const leafFrom = options.leafFrom ?? 700_000_000 + Math.floor(Math.random() * 200_000_000);
    const width = options.width ?? 9;
    const bookNo = `E2E-${stamp()}`;
    const book = await prisma.accChequeBook.create({
      data: {
        acbCompanyId: COMPANY,
        acbBranchId: options.branchId === undefined ? BRANCH : options.branchId,
        acbBankLedgerId: bankLedgerId,
        acbBookNo: bookNo,
        acbLeafFrom: BigInt(leafFrom),
        acbLeafTo: BigInt(leafFrom + leaves - 1),
        acbNextLeaf: BigInt(leafFrom),
        acbLeafWidth: width,
        acbCreatedBy: ACTOR,
      },
      select: { acbId: true },
    });
    this.chequeBooks.push(book.acbId);
    return { chequeBookId: book.acbId, bookNo, leafFrom, width };
  }

  async bookRow(chequeBookId: string) {
    return prisma.accChequeBook.findUniqueOrThrow({ where: { acbId: chequeBookId } });
  }

  async billRow(billId: string) {
    return prisma.accBillBalance.findUniqueOrThrow({
      where: { ablId_ablAccYear: { ablId: billId, ablAccYear: ACC_YEAR } },
    });
  }

  async headerRow(voucherId: string, accYear = ACC_YEAR) {
    return prisma.accVoucherHeader.findUniqueOrThrow({
      where: { avhVoucherId_avhAccYear: { avhVoucherId: voucherId, avhAccYear: accYear } },
    });
  }

  async legsOf(voucherId: string) {
    const rows = await prisma.accVoucher.findMany({
      where: { avVoucherId: voucherId, avIsDeleted: false },
      orderBy: { avRowNo: 'asc' },
      select: { avDrCr: true, avLedgerId: true, avAmount: true, avRole: true },
    });
    return rows.map((row) => ({
      drCr: row.avDrCr,
      ledgerId: row.avLedgerId,
      amount: Number(row.avAmount),
      role: row.avRole,
    }));
  }

  /** Every live adjustment row of a voucher that names an approver. */
  async approversOf(voucherId: string) {
    return prisma.accBillAdjustment.findMany({
      where: { abjVoucherId: voucherId, abjIsDeleted: false, abjApprovedBy: { not: null } },
      select: { abjBillId: true, abjSettlementMode: true, abjAmount: true, abjApprovedBy: true },
    });
  }

  async adjustmentsOf(voucherId: string) {
    const rows = await prisma.accBillAdjustment.findMany({
      where: { abjVoucherId: voucherId, abjIsDeleted: false },
      orderBy: { abjRowNo: 'asc' },
      select: {
        abjBillId: true,
        abjAdjType: true,
        abjSettlementMode: true,
        abjDrCr: true,
        abjAmount: true,
        abjAgainstBillId: true,
        abjReversalOfId: true,
      },
    });
    return rows.map((row) => ({
      billId: row.abjBillId,
      adjType: row.abjAdjType,
      mode: row.abjSettlementMode,
      drCr: row.abjDrCr,
      amount: Number(row.abjAmount),
      againstBillId: row.abjAgainstBillId,
      reversalOfId: row.abjReversalOfId,
    }));
  }

  async chequesOf(voucherIds: string[]) {
    return prisma.accPdcRegister.findMany({
      where: { apdVoucherId: { in: voucherIds }, apdIsDeleted: false },
      orderBy: { apdInstrumentNo: 'asc' },
    });
  }

  /**
   * Everything hanging off the suite's parties, newest table first, so no
   * foreign key is left dangling. Reversal vouchers and post-dated cheque
   * vouchers carry the party too, so "by party" finds all of them.
   */
  async teardown(): Promise<void> {
    await restoreMenuRights(prisma, this.rights);
    this.rights = null;
    const parties = [...this.parties];
    const headers =
      parties.length === 0
        ? []
        : await prisma.accVoucherHeader.findMany({
            where: { avhPartyId: { in: parties } },
            select: { avhVoucherId: true },
          });
    const vouchers = [...new Set([...this.vouchers, ...headers.map((h) => h.avhVoucherId)])];
    const cheques = (
      vouchers.length === 0
        ? []
        : await prisma.accPdcRegister.findMany({
            where: { OR: [{ apdVoucherId: { in: vouchers } }, { apdPartyId: { in: parties } }] },
            select: { apdId: true },
          })
    ).map((row) => row.apdId);
    const bills = (
      parties.length === 0
        ? []
        : await prisma.accBillBalance.findMany({
            where: { OR: [{ ablPartyId: { in: parties } }, { ablVoucherId: { in: vouchers } }] },
            select: { ablId: true },
          })
    ).map((row) => row.ablId);

    if (vouchers.length > 0 || cheques.length > 0) {
      await prisma.txnStatusLog.deleteMany({
        where: { tslSrcDocId: { in: [...cheques, ...vouchers] } },
      });
    }
    if (vouchers.length > 0) {
      // Reversal rows point at originals through atd_reversal_of_id.
      await prisma.accTdsRegister.deleteMany({
        where: { atdVoucherId: { in: vouchers }, atdReversalOfId: { not: null } },
      });
      await prisma.accTdsRegister.deleteMany({ where: { atdVoucherId: { in: vouchers } } });
      await prisma.accBillAdjustment.deleteMany({
        where: {
          OR: [
            { abjVoucherId: { in: vouchers } },
            ...(bills.length > 0 ? [{ abjBillId: { in: bills } }] : []),
            ...(cheques.length > 0 ? [{ abjChequeId: { in: cheques } }] : []),
          ],
        },
      });
    }
    if (cheques.length > 0) {
      await prisma.accPdcRegister.deleteMany({ where: { apdId: { in: cheques } } });
    }
    if (bills.length > 0) {
      await prisma.accBillBalance.deleteMany({ where: { ablId: { in: bills } } });
    }
    if (vouchers.length > 0) {
      await prisma.accTenderDetail.deleteMany({ where: { tdSrcDocId: { in: vouchers } } });
      await prisma.accVoucher.deleteMany({ where: { avVoucherId: { in: vouchers } } });
      await prisma.accVoucherHeader.deleteMany({ where: { avhVoucherId: { in: vouchers } } });
    }
    if (this.chequeBooks.length > 0) {
      await prisma.accChequeBook.deleteMany({ where: { acbId: { in: this.chequeBooks } } });
    }
    if (parties.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM purchase.suppliers WHERE sup_id = ANY($1::uuid[])`,
        parties,
      );
      await prisma.accOpeningBalance.deleteMany({ where: { opLedgerId: { in: parties } } });
      await prisma.accLedgerMaster.deleteMany({ where: { ledId: { in: parties } } });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Request builders
// ═══════════════════════════════════════════════════════════════════════════

export const keys = (voucherId: string, accYear = ACC_YEAR) => ({
  avhVoucherId: voucherId,
  avhCompanyId: COMPANY,
  avhBranchId: BRANCH,
  avhAccYear: accYear,
});

export const bankTender = (
  masters: Masters,
  amount: number,
  extra: Record<string, unknown> = {},
) => ({
  tdRowNo: 1,
  tdTenderId: masters.bankTenderId,
  tdTenderTypeId: BANK_TENDER_TYPE,
  tdAmount: amount,
  tdRefNo: `UTR${stamp()}`,
  tdBankName: 'Karur Vysya Bank',
  ...extra,
});

export const chequeTender = (
  masters: Masters,
  amount: number,
  chequeBookId: string,
  extra: Record<string, unknown> = {},
) => ({
  tdRowNo: 1,
  tdTenderId: masters.chequeTenderId,
  tdTenderTypeId: CHEQUE_TENDER_TYPE,
  tdAmount: amount,
  tdBankName: 'Karur Vysya Bank',
  cheque: { chequeBookId },
  ...extra,
});

export const draftBody = (
  partyId: string,
  tenders: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
) => ({
  avhCompanyId: COMPANY,
  avhBranchId: BRANCH,
  avhAccYear: ACC_YEAR,
  avhVoucherDate: today(),
  avhPartyId: partyId,
  avhUsrRefno: 'E2E-PAYMENT',
  avhUserId: ACTOR,
  tenders,
  ...extra,
});

export interface PostedPayment {
  voucherId: string;
  refno: string | null;
}

/** `/create` then `/post`, the ordinary way, returning the voucher. */
export async function createAndPost(
  app: INestApplication,
  fixtures: PaymentFixtures,
  body: Record<string, unknown>,
  post: Record<string, unknown>,
): Promise<{ voucherId: string; draft: request.Response; posted: request.Response }> {
  const draft = await request(app.getHttpServer())
    .post(ROUTES.create)
    .set('Authorization', BEARER)
    .send(body);
  if (draft.status !== 201) {
    throw new Error(`/payments/create answered ${draft.status}: ${JSON.stringify(draft.body)}`);
  }
  const voucherId = data<{ header: { avhVoucherId: string } }>(draft).header.avhVoucherId;
  fixtures.vouchers.push(voucherId);

  const posted = await request(app.getHttpServer())
    .post(ROUTES.post)
    .set('Authorization', BEARER)
    .send({ ...keys(voucherId), ...post });
  return { voucherId, draft, posted };
}
