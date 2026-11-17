import { Prisma } from '@prisma/client';
import { MobileReceiptService, receiptDayOf } from './mobile-receipt.service';
import type { CreateMobileReceiptDto } from './dto/mobile-receipt.dto';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const PARTY = '019f1dc6-7d53-7a5d-913b-66d57b891257';
const OTHER_PARTY = '019f659c-3942-7237-89b0-c4899603dd7a';
const DEV_ID = '01a12f63-5117-7a52-9e10-b5979d464059';
const LOGIN = '019e441b-6e48-7918-b246-b857ffb35db1';
const CLIENT_UUID = '3b241101-e2bb-4255-8caf-4136c566a962';
const AVH_ID = '01a20000-0000-7000-8000-0000000000aa';
const TENDER = '019fbbd2-406e-7e49-8376-0b03a840f640';

const dto = (over: Partial<CreateMobileReceiptDto> = {}): CreateMobileReceiptDto =>
  ({
    avhClientUuid: CLIENT_UUID,
    deviceUid: 'phone-1',
    avhCompanyId: COMPANY,
    avhPartyId: PARTY,
    avhUsrRefno: 'A1B2/RC/00001',
    tenders: [{ tdTenderId: TENDER, tdTenderTypeId: 3, tdAmount: 707, tdRefNo: 'UTR1' }],
    ...over,
  }) as CreateMobileReceiptDto;

const headerRow = (over: Record<string, unknown> = {}) => ({
  avhVoucherId: AVH_ID,
  avhCompanyId: COMPANY,
  avhBranchId: BRANCH,
  avhAccYear: '2026-2027',
  avhVoucherRefno: 'RCT00042',
  avhUsrRefno: 'A1B2/RC/00001',
  avhVoucherDate: '2026-11-17',
  avhDocAmount: new Prisma.Decimal('707'),
  avhVoucherStatus: 'POSTED',
  avhIsDeleted: false,
  avhPartyId: PARTY,
  ...over,
});

/** Open bills as /receipts/open-items orders them (due date first), and their pending under lock. */
const OPEN = [
  { billId: 'b-old', billAccYear: '2026-2027', pending: '300.00' },
  { billId: 'b-mid', billAccYear: '2026-2027', pending: '500.00' },
  { billId: 'b-new', billAccYear: '2026-2027', pending: '200.00' },
];

function build(script: { stored: object | null; canPost: boolean }) {
  const executed: { sql: string; values: unknown[] }[] = [];
  let stamped = false;
  const sqlOf = (s: TemplateStringsArray) => s.join('?');
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = sqlOf(strings);
      if (sql.includes('pg_advisory_xact_lock')) return [{ locked: 1 }];
      if (sql.includes('FROM accounts.acc_voucher_header h')) {
        const where = values[0] as Prisma.Sql;
        if (where.values.includes(CLIENT_UUID)) return script.stored ? [script.stored] : [];
        return stamped ? [headerRow()] : [];
      }
      if (sql.includes('FROM public.user_menus'))
        return [{ um_can_post: script.canPost, um_can_create: true }];
      if (sql.includes('FROM public.companys'))
        return [{ compId: COMPANY, compGstApplicable: true }];
      if (sql.includes('FROM fixed.device_master'))
        return [
          {
            devId: DEV_ID,
            devCode: 'P1',
            devCompanyId: COMPANY,
            devBranchId: BRANCH,
            devIsActive: true,
            devIsBlocked: false,
            devBlockReason: null,
          },
        ];
      if (sql.includes('FROM public.branch_master'))
        return [{ brId: BRANCH, preferred: true, isDefault: true }];
      if (sql.includes('CURRENT_DATE::text')) return [{ today: '2026-11-17' }];
      if (sql.includes('FROM public.fiscal_years')) return [{ name: '2026-2027' }];
      if (sql.includes('FROM accounts.acc_bill_balance'))
        // FOR UPDATE, ordered by id as lockBills orders it: the service must
        // follow the open-items order, not this one.
        return [...OPEN]
          .sort((a, b) => a.billId.localeCompare(b.billId))
          .map((b) => ({
            abl_id: b.billId,
            abl_acc_year: b.billAccYear,
            abl_party_id: PARTY,
            abl_bill_type: 'SALES',
            abl_doc_refno: b.billId,
            abl_doc_date: new Date(),
            abl_due_date: null,
            abl_bill_amount: new Prisma.Decimal(b.pending),
            abl_pending_amount: new Prisma.Decimal(b.pending),
            abl_dr_cr: 'DR',
            abl_is_deleted: false,
            abl_company_id: COMPANY,
            abl_branch_id: BRANCH,
          }));
      throw new Error(`unscripted read: ${sql}`);
    }),
    $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      executed.push({ sql: sqlOf(strings), values });
      stamped = true;
      return 1;
    }),
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    $queryRaw: tx.$queryRaw,
  };
  const settlements: unknown[] = [];
  const posting = {
    saveAndPostInTransaction: jest.fn(
      async (
        client: unknown,
        draft: Record<string, unknown>,
        settle: (c: unknown, saved: unknown) => Promise<unknown>,
      ) => {
        // The draft the save would answer: the 707 by UPI carries a 7.00
        // surcharge line (CR) the save seeded from the master's 1%.
        const settlement = await settle(client, {
          header: { avhVoucherId: AVH_ID },
          tenders: [{ tdAmount: 707 }],
          otherLines: [{ drCr: 'CR', amount: 7 }],
          expectedRoles: [],
        });
        settlements.push({ draft, settlement });
        return {
          header: { avhVoucherId: AVH_ID },
          allocations: [
            {
              billId: 'b-old',
              billAccYear: '2026-2027',
              docRefno: 'bil1',
              amount: 300,
              pendingAmount: 0,
              againstBillId: null,
              isReversed: false,
              reversalOfId: null,
            },
            {
              billId: 'b-mid',
              billAccYear: '2026-2027',
              docRefno: 'bil2',
              amount: 400,
              pendingAmount: 100,
              againstBillId: null,
              isReversed: false,
              reversalOfId: null,
            },
          ],
          advanceBills: [],
        };
      },
    ),
  };
  const openItems = {
    listOpenItems: jest.fn(async () => ({
      bills: OPEN.map((b) => ({ billId: b.billId, billAccYear: b.billAccYear })),
    })),
  };
  const receipts = {
    loadHeaderOrThrow: jest.fn(),
    loadFullReceipt: jest.fn(),
    saveInTransaction: jest.fn(),
  };
  const service = new MobileReceiptService(
    prisma as never,
    { getUserId: () => LOGIN } as never,
    receipts as never,
    posting as never,
    openItems as never,
  );
  return { service, posting, openItems, receipts, executed, settlements };
}

describe('receiptDayOf', () => {
  it('reads the date part, else today', () => {
    expect(receiptDayOf('2026-11-16', '2026-11-17')).toBe('2026-11-16');
    expect(receiptDayOf(undefined, '2026-11-17')).toBe('2026-11-17');
  });
});

describe('MobileReceiptService.create', () => {
  it('saves and posts with the money filling the open bills in open-items order; the uuid on the header only', async () => {
    const { service, posting, openItems, executed, settlements } = build({
      stored: null,
      canPost: true,
    });
    const answer = await service.create(dto());

    expect(openItems.listOpenItems).toHaveBeenCalledWith({ companyId: COMPANY, partyId: PARTY });
    const { draft, settlement } = settlements[0] as {
      draft: Record<string, unknown>;
      settlement: { allocations: unknown[]; onAccount: number };
    };
    expect(draft).toEqual(
      expect.objectContaining({
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: '2026-2027',
        avhVoucherDate: '2026-11-17',
        avhPartyId: PARTY,
        avhDeviceType: 'MOBILE',
        avhDeviceId: DEV_ID,
        avhUserId: LOGIN,
        avhUsrRefno: 'A1B2/RC/00001',
        post: true,
        tenders: [expect.objectContaining({ tdRowNo: 1, tdTenderId: TENDER, tdAmount: 707 })],
      }),
    );
    expect(draft).not.toHaveProperty('avhClientUuid');
    expect(draft).not.toHaveProperty('allocations');
    expect(draft).not.toHaveProperty('onAccount');
    // 707 less the 7.00 surcharge = 700: 300 to the oldest, 400 to the next, none on account.
    expect(settlement).toEqual({
      allocations: [
        { billId: 'b-old', billAccYear: '2026-2027', amount: 300 },
        { billId: 'b-mid', billAccYear: '2026-2027', amount: 400 },
      ],
      onAccount: 0,
    });
    expect(posting.saveAndPostInTransaction).toHaveBeenCalledTimes(1);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE accounts.acc_voucher_header');
    expect(executed[0].values).toEqual([CLIENT_UUID, AVH_ID, '2026-2027']);
    expect(answer).toEqual({
      avhVoucherId: AVH_ID,
      avhCompanyId: COMPANY,
      avhBranchId: BRANCH,
      avhAccYear: '2026-2027',
      avhVoucherRefno: 'RCT00042',
      avhUsrRefno: 'A1B2/RC/00001',
      avhVoucherDate: '2026-11-17',
      avhDocAmount: '707.00',
      avhVoucherStatus: 'POSTED',
      allocations: [
        {
          billId: 'b-old',
          billAccYear: '2026-2027',
          docRefno: 'bil1',
          amount: '300.00',
          pendingAmount: '0.00',
        },
        {
          billId: 'b-mid',
          billAccYear: '2026-2027',
          docRefno: 'bil2',
          amount: '400.00',
          pendingAmount: '100.00',
        },
      ],
      onAccount: '0.00',
      duplicate: false,
      avhIsDeleted: false,
    });
  });

  it('without the menu-99 Post right: 403 RCT_RIGHT_POST, nothing saved', async () => {
    const { service, posting, executed } = build({ stored: null, canPost: false });
    await expect(service.create(dto())).rejects.toMatchObject({
      status: 403,
      response: { errors: [expect.objectContaining({ code: 'RCT_RIGHT_POST' })] },
    });
    expect(posting.saveAndPostInTransaction).not.toHaveBeenCalled();
    expect(executed).toHaveLength(0);
  });

  it('a resend answers the stored receipt as it stands and writes nothing', async () => {
    const { service, posting, receipts, executed } = build({
      stored: headerRow({ avhVoucherStatus: 'CANCELLED' }),
      canPost: true,
    });
    receipts.loadHeaderOrThrow.mockResolvedValue({ avhVoucherId: AVH_ID });
    receipts.loadFullReceipt.mockResolvedValue({ allocations: [], advanceBills: [] });
    const answer = await service.create(dto());
    expect(answer).toEqual(
      expect.objectContaining({
        duplicate: true,
        avhVoucherStatus: 'CANCELLED',
        allocations: [],
        onAccount: '0.00',
      }),
    );
    expect(posting.saveAndPostInTransaction).not.toHaveBeenCalled();
    expect(executed).toHaveLength(0);
  });

  it('the same uuid on another customer is 409 MOBILE_CLIENT_UUID_REUSED', async () => {
    const { service } = build({ stored: headerRow(), canPost: true });
    await expect(service.create(dto({ avhPartyId: OTHER_PARTY }))).rejects.toMatchObject({
      status: 409,
      response: { errors: [expect.objectContaining({ code: 'MOBILE_CLIENT_UUID_REUSED' })] },
    });
  });
});

describe('MobileReceiptService.openBills', () => {
  const row = (id: string, party: string, due: string | null) => ({
    ablId: id,
    ablAccYear: '2026-2027',
    ablPartyId: party,
    ablBillType: 'SALES',
    ablDocRefno: `bil-${id}`,
    ablDocDate: new Date('2026-10-01T00:00:00Z'),
    ablDueDate: due ? new Date(`${due}T00:00:00Z`) : null,
    ablBillAmount: new Prisma.Decimal('1180'),
    ablPendingAmount: new Prisma.Decimal('680.5'),
  });
  // A supplier (or any ledger that is not a customer) holding a receivable.
  const NOT_A_CUSTOMER = '019f0000-0000-7000-8000-00000000beef';
  const rows = [
    row('1', PARTY, '2026-10-31'),
    row('2', PARTY, null),
    row('s', NOT_A_CUSTOMER, null),
    row('3', OTHER_PARTY, null),
  ];

  function make() {
    const prisma = {
      $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        if (sql.includes('FROM public.companys')) {
          return [{ compId: COMPANY, compGstApplicable: true }];
        }
        if (sql.includes('FROM sales.customers')) {
          // Live customers among the parties asked about.
          const asked = values[0] as string[];
          return [PARTY, OTHER_PARTY]
            .filter((id) => asked.includes(id))
            .map((cusId) => ({ cusId }));
        }
        throw new Error(`unscripted read: ${sql}`);
      }),
    };
    const openItems = { listCompanyOpenBills: jest.fn(async () => rows) };
    const service = new MobileReceiptService(
      prisma as never,
      { getUserId: () => LOGIN } as never,
      {} as never,
      {} as never,
      openItems as never,
    );
    return { service, openItems };
  }

  it('pages the open-items rows in their order, with the phone keys', async () => {
    const { service, openItems } = make();
    const first = await service.openBills({ companyId: COMPANY, page: 1, pageSize: 2 });
    expect(openItems.listCompanyOpenBills).toHaveBeenCalledWith(COMPANY);
    expect(first).toEqual(
      expect.objectContaining({
        total: 3,
        page: 1,
        pageSize: 2,
        hasMore: true,
        companyId: COMPANY,
      }),
    );
    expect(first.items.map((b) => b.billId)).toEqual(['1', '2']);
    expect(first.items[0]).toEqual({
      partyId: PARTY,
      billId: '1',
      billAccYear: '2026-2027',
      billType: 'SALES',
      docRefno: 'bil-1',
      docDate: '2026-10-01',
      dueDate: '2026-10-31',
      billAmount: '1180.00',
      pendingAmount: '680.50',
      daysOverdue: expect.any(Number),
    });
    expect(first.items[0].daysOverdue).toBeGreaterThan(0);
    expect(first.items[1]).toEqual(expect.objectContaining({ dueDate: null, daysOverdue: 0 }));
    const second = await service.openBills({ companyId: COMPANY, page: 2, pageSize: 2 });
    expect(second.items.map((b) => b.billId)).toEqual(['3']);
    expect(second.hasMore).toBe(false);
    const fallback = await service.openBills({ companyId: COMPANY });
    expect(fallback).toEqual(expect.objectContaining({ page: 1, pageSize: 200, hasMore: false }));
  });

  it('customers only: a party that is not a live customer is dropped, and total does not count it', async () => {
    const { service } = make();
    const all = await service.openBills({ companyId: COMPANY });
    expect(all.items.map((b) => b.billId)).toEqual(['1', '2', '3']);
    expect(all.items.some((b) => b.partyId === NOT_A_CUSTOMER)).toBe(false);
    expect(all.total).toBe(3);
  });
});
