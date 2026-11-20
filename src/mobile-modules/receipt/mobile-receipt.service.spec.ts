import { Prisma } from '@prisma/client';
import {
  MobileReceiptService,
  mergeByParty,
  phonePlanOf,
  receiptDayOf,
} from './mobile-receipt.service';
import type { CreateMobileReceiptDto } from './dto/mobile-receipt.dto';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const PICKED_BRANCH = '019c8ea7-0000-7000-8000-00000000b2b2';
const PARTY = '019f1dc6-7d53-7a5d-913b-66d57b891257';
const OTHER_PARTY = '019f659c-3942-7237-89b0-c4899603dd7a';
const DEV_ID = '01a12f63-5117-7a52-9e10-b5979d464059';
const LOGIN = '019e441b-6e48-7918-b246-b857ffb35db1';
const EMPLOYEE = '01a11695-f492-791d-9b88-111a44b8666c';
const CLIENT_UUID = '3b241101-e2bb-4255-8caf-4136c566a962';
const AVH_ID = '01a20000-0000-7000-8000-0000000000aa';
const TENDER = '019fbbd2-406e-7e49-8376-0b03a840f640';
const YEAR = '2026-2027';

const dto = (over: Partial<CreateMobileReceiptDto> = {}): CreateMobileReceiptDto => ({
  avhClientUuid: CLIENT_UUID,
  deviceUid: 'phone-1',
  avhCompanyId: COMPANY,
  avhPartyId: PARTY,
  avhUsrRefno: 'A1B2/RC/00001',
  tenders: [{ tdTenderId: TENDER, tdTenderTypeId: 3, tdAmount: 707, tdRefNo: 'UTR1' }],
  allocations: undefined,
  creditsApplied: undefined,
  ...over,
});

const headerRow = (over: Record<string, unknown> = {}) => ({
  avhVoucherId: AVH_ID,
  avhCompanyId: COMPANY,
  avhBranchId: BRANCH,
  avhAccYear: YEAR,
  avhVoucherRefno: 'RCT00042',
  avhUsrRefno: 'A1B2/RC/00001',
  avhVoucherDate: '2026-11-17',
  avhDocAmount: new Prisma.Decimal('707'),
  avhVoucherStatus: 'POSTED',
  avhIsDeleted: false,
  avhPartyId: PARTY,
  employeeId: null,
  ...over,
});

interface BillRow {
  billId: string;
  pending: string;
  type?: string;
  drCr?: string;
  deleted?: boolean;
  party?: string;
}

/** Open bills as /receipts/open-items orders them (due date first), and their pending under lock. */
const OPEN: BillRow[] = [
  { billId: 'b-old', pending: '300.00' },
  { billId: 'b-mid', pending: '500.00' },
  { billId: 'b-new', pending: '200.00' },
];

/** One /receipts/get adjustment row, as loadFullReceipt shapes it. */
const adj = (billId: string, amount: number, over: Record<string, unknown> = {}) => ({
  billId,
  billAccYear: YEAR,
  docRefno: `no-${billId}`,
  amount,
  pendingAmount: 0,
  adjType: 'ALLOCATION',
  drCr: 'CR',
  againstBillId: null,
  isReversed: false,
  reversalOfId: null,
  ...over,
});

function build(
  script: {
    stored?: object | null;
    canPost?: boolean;
    employee?: string | null;
    salesmanMandatory?: boolean;
    ppdSlabs?: { days: number; perc: number }[];
    locked?: BillRow[];
    docRefnoTaken?: boolean;
    pickedBranchLive?: boolean;
    posted?: Record<string, unknown>;
  } = {},
) {
  const {
    stored = null,
    canPost = true,
    employee = null,
    salesmanMandatory = false,
    ppdSlabs = [],
    locked = OPEN,
    docRefnoTaken = false,
    pickedBranchLive = true,
  } = script;
  const executed: { sql: string; values: unknown[] }[] = [];
  let stamped = false;
  const sqlOf = (s: TemplateStringsArray) => s.join('?');
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = sqlOf(strings);
      if (sql.includes('pg_advisory_xact_lock')) return [{ locked: 1 }];
      if (sql.includes('JOIN accounts.acc_voucher_types')) {
        return docRefnoTaken ? [{ refno: 'RCT00007' }] : [];
      }
      if (sql.includes('FROM accounts.acc_voucher_header h')) {
        const where = values[0] as Prisma.Sql;
        if (where.values.includes(CLIENT_UUID)) return stored ? [stored] : [];
        return stamped ? [headerRow({ employeeId: employee })] : [];
      }
      if (sql.includes('FROM public.user_menus'))
        return [{ um_can_post: canPost, um_can_create: true }];
      if (sql.includes('FROM public.user_master'))
        return [
          {
            userId: LOGIN,
            loginName: 'VKPOS',
            employeeId: employee,
            employeeName: employee ? 'Ravi' : null,
          },
        ];
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
      if (sql.includes('FROM public.branch_master') && sql.includes('b.br_id = ?::uuid'))
        return pickedBranchLive ? [{ brId: values[0] }] : [];
      if (sql.includes('FROM public.branch_master'))
        return [{ brId: BRANCH, preferred: true, isDefault: true }];
      if (sql.includes('CURRENT_DATE::text')) return [{ today: '2026-11-17' }];
      if (sql.includes('FROM public.fiscal_years')) return [{ name: YEAR }];
      if (sql.includes('FROM accounts.acc_bill_balance') && sql.includes('FOR UPDATE')) {
        // FOR UPDATE, ordered by id as lockBills orders it: the service must
        // follow the open-items order, not this one.
        const ids = values[0] as string[];
        return [...locked]
          .filter((b) => ids.includes(b.billId))
          .sort((a, b) => a.billId.localeCompare(b.billId))
          .map((b) => ({
            abl_id: b.billId,
            abl_acc_year: YEAR,
            abl_party_id: b.party ?? PARTY,
            abl_bill_type: b.type ?? 'SALES',
            abl_doc_refno: `no-${b.billId}`,
            abl_doc_date: new Date('2026-11-10T00:00:00.000Z'),
            abl_due_date: null,
            abl_bill_amount: new Prisma.Decimal(b.pending),
            abl_pending_amount: new Prisma.Decimal(b.pending),
            abl_dr_cr: b.drCr ?? 'DR',
            abl_is_deleted: b.deleted ?? false,
            abl_company_id: COMPANY,
            abl_branch_id: BRANCH,
          }));
      }
      if (sql.includes('FROM accounts.acc_bill_balance b')) {
        const ids = values[0] as string[];
        return ids.map((id) => ({ id, year: YEAR, refno: `no-${id}` }));
      }
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
  const settlements: { draft: Record<string, unknown>; settlement: Record<string, unknown> }[] = [];
  const posting = {
    saveAndPostInTransaction: jest.fn(
      async (
        client: unknown,
        draft: Record<string, unknown>,
        settle: (c: unknown, saved: unknown) => Promise<Record<string, unknown>>,
      ) => {
        // The draft the save would answer: the 707 by UPI carries a 7.00
        // surcharge line (CR) the save seeded from the master's 1%.
        const settlement = await settle(client, {
          header: { avhVoucherId: AVH_ID },
          tenders: (draft.tenders as { tdAmount: number }[]).map((t) => ({ tdAmount: t.tdAmount })),
          otherLines: [{ drCr: 'CR', amount: 7 }],
          expectedRoles: [],
        });
        settlements.push({ draft, settlement });
        return (
          script.posted ?? {
            header: { avhVoucherId: AVH_ID },
            allocations: [adj('b-old', 300), adj('b-mid', 400, { pendingAmount: 100 })],
            creditsApplied: [],
            pdcVouchers: [],
            advanceBills: [],
          }
        );
      },
    ),
  };
  const openItems = {
    listOpenItems: jest.fn(async () => ({
      bills: OPEN.map((b) => ({ billId: b.billId, billAccYear: YEAR })),
    })),
    loadSettings: jest.fn(async () => ({ salesmanMandatory, ppdSlabs })),
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

describe('phonePlanOf', () => {
  it('older phones (neither key) have no plan; an allocations key, even [], is a plan', () => {
    expect(phonePlanOf(dto())).toBeNull();
    expect(phonePlanOf(dto({ allocations: [] }))).toEqual({
      lines: [],
      credits: [],
      fillAll: false,
    });
    const credits = phonePlanOf(
      dto({ creditsApplied: [{ billId: 'adv', billAccYear: YEAR, amount: 50 }] }),
    );
    expect(credits?.fillAll).toBe(true);
    expect(credits?.credits.map((c) => c.amount.toFixed(2))).toEqual(['50.00']);
  });

  it('a bill named twice is the engine refusal, 400 ACC_INVALID', () => {
    expect(() =>
      phonePlanOf(
        dto({
          allocations: [
            { billId: 'b', billAccYear: YEAR, amount: 1 },
            { billId: 'b', billAccYear: YEAR, amount: 2 },
          ],
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        status: 400,
        response: expect.objectContaining({
          errors: [expect.objectContaining({ field: 'allocations.1.billId', code: 'ACC_INVALID' })],
        }),
      }),
    );
  });
});

describe('MobileReceiptService.create (older phones)', () => {
  it('saves and posts with the money filling the open bills in open-items order; the uuid on the header only', async () => {
    const { service, posting, openItems, executed, settlements } = build();
    const answer = await service.create(dto());

    expect(openItems.listOpenItems).toHaveBeenCalledWith({ companyId: COMPANY, partyId: PARTY });
    const { draft, settlement } = settlements[0];
    expect(draft).toEqual(
      expect.objectContaining({
        avhCompanyId: COMPANY,
        avhBranchId: BRANCH,
        avhAccYear: YEAR,
        avhVoucherDate: '2026-11-17',
        avhPartyId: PARTY,
        avhDeviceType: 'MOBILE',
        avhDeviceId: DEV_ID,
        avhUserId: LOGIN,
        avhUsrRefno: 'A1B2/RC/00001',
        avhEmployeeId: [],
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
        { billId: 'b-old', billAccYear: YEAR, amount: 300 },
        { billId: 'b-mid', billAccYear: YEAR, amount: 400 },
      ],
      onAccount: 0,
    });
    expect(posting.saveAndPostInTransaction).toHaveBeenCalledTimes(1);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE accounts.acc_voucher_header');
    expect(executed[0].values).toEqual([CLIENT_UUID, AVH_ID, YEAR]);
    expect(answer).toEqual({
      avhVoucherId: AVH_ID,
      avhCompanyId: COMPANY,
      avhBranchId: BRANCH,
      avhAccYear: YEAR,
      avhVoucherRefno: 'RCT00042',
      avhUsrRefno: 'A1B2/RC/00001',
      avhVoucherDate: '2026-11-17',
      avhDocAmount: '707.00',
      avhVoucherStatus: 'POSTED',
      allocations: [
        {
          billId: 'b-old',
          billAccYear: YEAR,
          docRefno: 'no-b-old',
          amount: '300.00',
          discount: '0.00',
          roundoff: '0.00',
          pendingAmount: '0.00',
        },
        {
          billId: 'b-mid',
          billAccYear: YEAR,
          docRefno: 'no-b-mid',
          amount: '400.00',
          discount: '0.00',
          roundoff: '0.00',
          pendingAmount: '100.00',
        },
      ],
      onAccount: '0.00',
      duplicate: false,
      avhIsDeleted: false,
      creditsApplied: [],
      pdcVouchers: [],
      adjusted: [],
      employeeId: null,
    });
  });

  it('without the menu-99 Post right: 403 RCT_RIGHT_POST, nothing saved', async () => {
    const { service, posting, executed } = build({ canPost: false });
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
    });
    receipts.loadHeaderOrThrow.mockResolvedValue({ avhVoucherId: AVH_ID });
    receipts.loadFullReceipt.mockResolvedValue({
      allocations: [],
      creditsApplied: [],
      pdcVouchers: [],
      advanceBills: [],
    });
    const answer = await service.create(dto());
    expect(answer).toEqual(
      expect.objectContaining({
        duplicate: true,
        avhVoucherStatus: 'CANCELLED',
        allocations: [],
        onAccount: '0.00',
        adjusted: [],
      }),
    );
    expect(posting.saveAndPostInTransaction).not.toHaveBeenCalled();
    expect(executed).toHaveLength(0);
  });

  it('the same uuid on another customer is 409 MOBILE_CLIENT_UUID_REUSED', async () => {
    const { service } = build({ stored: headerRow() });
    await expect(service.create(dto({ avhPartyId: OTHER_PARTY }))).rejects.toMatchObject({
      status: 409,
      response: { errors: [expect.objectContaining({ code: 'MOBILE_CLIENT_UUID_REUSED' })] },
    });
  });
});

describe('MobileReceiptService.create: collector, branch, shop number', () => {
  it("the login's employee is the collector, on the draft and in the answer", async () => {
    const { service, settlements } = build({ employee: EMPLOYEE });
    const answer = await service.create(dto());
    expect(settlements[0].draft.avhEmployeeId).toEqual([EMPLOYEE]);
    expect(answer.employeeId).toBe(EMPLOYEE);
  });

  it('salesman mandatory and a login with no employee: 422 MOBILE_RECEIPT_NO_EMPLOYEE, nothing saved', async () => {
    const { service, posting, executed } = build({ salesmanMandatory: true });
    await expect(service.create(dto())).rejects.toMatchObject({
      status: 422,
      response: {
        errors: [
          expect.objectContaining({ field: 'avhEmployeeId', code: 'MOBILE_RECEIPT_NO_EMPLOYEE' }),
        ],
      },
    });
    expect(posting.saveAndPostInTransaction).not.toHaveBeenCalled();
    expect(executed).toHaveLength(0);
  });

  it('salesman mandatory with an employee posts', async () => {
    const { service, posting } = build({ salesmanMandatory: true, employee: EMPLOYEE });
    await service.create(dto());
    expect(posting.saveAndPostInTransaction).toHaveBeenCalledTimes(1);
  });

  it('the picked branch is the receipt branch; one not of the company is 422 MOBILE_BRANCH_NOT_OF_COMPANY', async () => {
    const ok = build();
    await ok.service.create(dto({ avhBranchId: PICKED_BRANCH }));
    expect(ok.settlements[0].draft.avhBranchId).toBe(PICKED_BRANCH);
    const bad = build({ pickedBranchLive: false });
    await expect(bad.service.create(dto({ avhBranchId: PICKED_BRANCH }))).rejects.toMatchObject({
      status: 422,
      response: {
        errors: [
          expect.objectContaining({ field: 'avhBranchId', code: 'MOBILE_BRANCH_NOT_OF_COMPANY' }),
        ],
      },
    });
    expect(bad.posting.saveAndPostInTransaction).not.toHaveBeenCalled();
  });

  it("the shop's number and date ride on the draft; a number a live receipt holds is 409 VCH_DUP_DOC_REFNO", async () => {
    const ok = build();
    await ok.service.create(dto({ avhDocRefno: 'SHOP/7', avhDocDate: '2026-11-16' }));
    expect(ok.settlements[0].draft).toEqual(
      expect.objectContaining({ avhDocRefno: 'SHOP/7', avhDocDate: '2026-11-16' }),
    );
    const taken = build({ docRefnoTaken: true });
    await expect(taken.service.create(dto({ avhDocRefno: 'SHOP/7' }))).rejects.toMatchObject({
      status: 409,
      response: {
        errors: [expect.objectContaining({ field: 'avhDocRefno', code: 'VCH_DUP_DOC_REFNO' })],
      },
    });
    expect(taken.posting.saveAndPostInTransaction).not.toHaveBeenCalled();
  });
});

describe("MobileReceiptService.create: the phone's own settlement (D1, D4, D5)", () => {
  it('posts the plan adjusted to the bills now; adjusted[] reports each change', async () => {
    // b-old was paid in the office (pending 0); the advance holds 60, not 100.
    const { service, settlements } = build({
      locked: [
        { billId: 'b-old', pending: '0.00' },
        { billId: 'b-mid', pending: '500.00' },
        { billId: 'b-new', pending: '200.00' },
        { billId: 'adv', pending: '60.00', type: 'ADVANCE', drCr: 'CR' },
      ],
      posted: {
        header: { avhVoucherId: AVH_ID },
        allocations: [adj('b-mid', 440), adj('b-new', 200)],
        creditsApplied: [
          adj('b-mid', 60, { adjType: 'ADVANCE_ADJUST', againstBillId: 'adv' }),
          adj('adv', 60, { adjType: 'ADVANCE_ADJUST', drCr: 'DR', againstBillId: 'b-mid' }),
        ],
        pdcVouchers: [],
        advanceBills: [{ billAmount: 0 }],
      },
    });
    // The phone: 700 of money + 100 of credit = b-old 300 + b-mid 500.
    const answer = await service.create(
      dto({
        allocations: [
          { billId: 'b-old', billAccYear: YEAR, amount: 300 },
          { billId: 'b-mid', billAccYear: YEAR, amount: 500 },
        ],
        creditsApplied: [{ billId: 'adv', billAccYear: YEAR, amount: 100 }],
        onAccount: 0,
      }),
    );
    // b-old frees 300 and the credit is 40 short: money 700 + credit 60 = 760.
    // b-mid keeps its 500; of the freed 300 only 260 is left after it, and
    // b-new (open-items order) takes 200; 60 stays on account.
    expect(settlements[0].settlement).toEqual({
      allocations: [
        { billId: 'b-mid', billAccYear: YEAR, amount: 500, discount: 0, roundoff: 0 },
        { billId: 'b-new', billAccYear: YEAR, amount: 200, discount: 0, roundoff: 0 },
      ],
      creditsApplied: [{ billId: 'adv', billAccYear: YEAR, amount: 60 }],
      onAccount: 60,
    });
    expect(answer.adjusted).toEqual([
      {
        billId: 'b-old',
        billAccYear: YEAR,
        docRefno: 'no-b-old',
        planned: '300.00',
        applied: '0.00',
        reason: 'BILL_SETTLED',
      },
      {
        billId: 'adv',
        billAccYear: YEAR,
        docRefno: 'no-adv',
        planned: '100.00',
        applied: '60.00',
        reason: 'CREDIT_REDUCED',
      },
    ]);
    expect(answer.creditsApplied).toEqual([
      expect.objectContaining({ billId: 'adv', docRefno: 'no-adv', amount: '60.00' }),
    ]);
    expect(answer.allocations.map((a) => [a.billId, a.amount])).toEqual([
      ['b-mid', '500.00'],
      ['b-new', '200.00'],
    ]);
  });

  it('allocations [] is the phone keeping all of it on account, never the oldest-first fill', async () => {
    const { service, settlements } = build({
      posted: {
        header: { avhVoucherId: AVH_ID },
        allocations: [],
        creditsApplied: [],
        pdcVouchers: [],
        advanceBills: [{ billAmount: 700 }],
      },
    });
    const answer = await service.create(dto({ allocations: [], onAccount: 700 }));
    // 707 less the 7.00 surcharge, all of it held; the open bills are not touched.
    expect(settlements[0].settlement).toEqual({
      allocations: [],
      creditsApplied: [],
      onAccount: 700,
    });
    expect(answer).toEqual(
      expect.objectContaining({ allocations: [], onAccount: '700.00', adjusted: [] }),
    );
    // A missing key is the older phones' fill (the first describe), not this.
    expect(phonePlanOf(dto({ allocations: [] }))?.fillAll).toBe(false);
  });

  it('a cancelled bill is D1 (dropped), another party’s bill keeps the desktop refusal', async () => {
    const cancelled = build({
      locked: [
        { billId: 'b-old', pending: '300.00', deleted: true },
        { billId: 'b-mid', pending: '500.00' },
      ],
    });
    await cancelled.service.create(
      dto({ allocations: [{ billId: 'b-old', billAccYear: YEAR, amount: 300 }] }),
    );
    expect(cancelled.settlements[0].settlement.allocations).toEqual([
      { billId: 'b-mid', billAccYear: YEAR, amount: 300, discount: 0, roundoff: 0 },
    ]);
    const foreign = build({ locked: [{ billId: 'x', pending: '50.00', party: OTHER_PARTY }] });
    await expect(
      foreign.service.create(
        dto({ allocations: [{ billId: 'x', billAccYear: YEAR, amount: 50 }] }),
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errors: [
          expect.objectContaining({ field: 'allocations.0.billId', code: 'VCH_BILL_WRONG_PARTY' }),
        ],
      },
    });
  });

  it('D5 and D4 refuse before anything posts', async () => {
    const roundoff = build();
    await expect(
      roundoff.service.create(
        dto({ allocations: [{ billId: 'b-old', billAccYear: YEAR, amount: 298, roundoff: 2 }] }),
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: { errors: [expect.objectContaining({ code: 'MOBILE_RECEIPT_ROUNDOFF_TOO_BIG' })] },
    });
    expect(roundoff.settlements).toHaveLength(0);

    // bill dated 2026-11-10, receipt 2026-11-17: 7 days, inside the 2% slab = 6.00 on 300.
    const slabs = [{ days: 7, perc: 2 }];
    const within = build({ ppdSlabs: slabs });
    await within.service.create(
      dto({ allocations: [{ billId: 'b-old', billAccYear: YEAR, amount: 294, discount: 6 }] }),
    );
    // Nothing moved, so nothing is freed: the rest of the money is on account.
    expect(within.settlements[0].settlement).toEqual({
      allocations: [{ billId: 'b-old', billAccYear: YEAR, amount: 294, discount: 6, roundoff: 0 }],
      creditsApplied: [],
      onAccount: 406,
    });
    const above = build({ ppdSlabs: slabs });
    await expect(
      above.service.create(
        dto({
          allocations: [{ billId: 'b-old', billAccYear: YEAR, amount: 293.99, discount: 6.01 }],
        }),
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: {
        errors: [
          expect.objectContaining({
            field: 'allocations.0.discount',
            code: 'MOBILE_RECEIPT_DISCOUNT_ABOVE_PPD',
          }),
        ],
      },
    });
    expect(above.settlements).toHaveLength(0);
  });

  it('a resend carries the same adjusted[], read back from the receipt; none once cancelled', async () => {
    const plan = dto({
      allocations: [
        { billId: 'b-old', billAccYear: YEAR, amount: 300 },
        { billId: 'b-mid', billAccYear: YEAR, amount: 400 },
      ],
    });
    const again = build({ stored: headerRow() });
    again.receipts.loadHeaderOrThrow.mockResolvedValue({ avhVoucherId: AVH_ID });
    again.receipts.loadFullReceipt.mockResolvedValue({
      allocations: [adj('b-mid', 400)],
      creditsApplied: [],
      pdcVouchers: [],
      advanceBills: [{ billAmount: 300 }],
    });
    const answer = await again.service.create(plan);
    expect(answer).toEqual(
      expect.objectContaining({
        duplicate: true,
        onAccount: '300.00',
        adjusted: [
          expect.objectContaining({ billId: 'b-old', applied: '0.00', reason: 'BILL_SETTLED' }),
        ],
      }),
    );
    expect(again.posting.saveAndPostInTransaction).not.toHaveBeenCalled();

    const cancelled = build({ stored: headerRow({ avhVoucherStatus: 'CANCELLED' }) });
    cancelled.receipts.loadHeaderOrThrow.mockResolvedValue({ avhVoucherId: AVH_ID });
    cancelled.receipts.loadFullReceipt.mockResolvedValue({
      allocations: [],
      creditsApplied: [],
      pdcVouchers: [],
      advanceBills: [],
    });
    expect((await cancelled.service.create(plan)).adjusted).toEqual([]);
  });
});

describe('MobileReceiptService.openBills', () => {
  const row = (
    id: string,
    party: string,
    due: string | null,
    over: Record<string, unknown> = {},
  ) => ({
    ablId: id,
    ablAccYear: YEAR,
    ablPartyId: party,
    ablBillType: 'SALES',
    ablDocRefno: `bil-${id}`,
    ablDocDate: new Date('2026-10-01T00:00:00Z'),
    ablDueDate: due ? new Date(`${due}T00:00:00Z`) : null,
    ablBillAmount: new Prisma.Decimal('1180'),
    ablPendingAmount: new Prisma.Decimal('680.5'),
    ...over,
  });
  // A supplier (or any ledger that is not a customer) holding a receivable.
  const NOT_A_CUSTOMER = '019f0000-0000-7000-8000-00000000beef';
  const [A, B] = [PARTY, OTHER_PARTY].sort((x, y) => x.localeCompare(y));
  const rows = [
    row('1', A, '2026-10-31'),
    row('2', A, null),
    row('s', NOT_A_CUSTOMER, null),
    row('3', B, null),
  ].sort((x, y) => x.ablPartyId.localeCompare(y.ablPartyId));
  const credits = [
    row('adv', A, null, {
      ablBillType: 'ADVANCE',
      ablBillAmount: new Prisma.Decimal('500'),
      ablPendingAmount: new Prisma.Decimal('200'),
    }),
    row('opn', B, null, {
      ablBillType: 'OPENING',
      ablBillAmount: new Prisma.Decimal('90'),
      ablPendingAmount: new Prisma.Decimal('90'),
    }),
  ];

  function make(slabs: { days: number; perc: number }[] = []) {
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
    const openItems = {
      listCompanyOpenBills: jest.fn(async () => rows),
      listCompanyOpenCredits: jest.fn(async () => credits),
      loadSettings: jest.fn(async () => ({ ppdSlabs: slabs })),
      loadPostDatedHeld: jest.fn(async () => new Map([[`1|${YEAR}`, new Prisma.Decimal('150')]])),
    };
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
    expect(openItems.listCompanyOpenCredits).not.toHaveBeenCalled();
    expect(first).toEqual(
      expect.objectContaining({
        total: 3,
        page: 1,
        pageSize: 2,
        hasMore: true,
        companyId: COMPANY,
      }),
    );
    const ids = first.items.map((b) => b.billId);
    expect(ids).toEqual(A === PARTY ? ['1', '2'] : ['3', '1']);
    const one =
      first.items.find((b) => b.billId === '1') ??
      (await service.openBills({ companyId: COMPANY })).items.find((b) => b.billId === '1')!;
    expect(one).toEqual({
      partyId: PARTY,
      billId: '1',
      billAccYear: YEAR,
      billType: 'SALES',
      docRefno: 'bil-1',
      docDate: '2026-10-01',
      dueDate: '2026-10-31',
      billAmount: '1180.00',
      pendingAmount: '680.50',
      daysOverdue: expect.any(Number),
      kind: 'BILL',
      paidAmount: '499.50',
      pdcHeld: '150.00',
      ppdSchedule: [],
    });
    expect(one.daysOverdue).toBeGreaterThan(0);
    const second = await service.openBills({ companyId: COMPANY, page: 2, pageSize: 2 });
    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    const fallback = await service.openBills({ companyId: COMPANY });
    expect(fallback).toEqual(expect.objectContaining({ page: 1, pageSize: 200, hasMore: false }));
  });

  it('customers only: a party that is not a live customer is dropped, and total does not count it', async () => {
    const { service } = make();
    const all = await service.openBills({ companyId: COMPANY });
    expect(all.items.map((b) => b.billId).sort()).toEqual(['1', '2', '3']);
    expect(all.items.some((b) => b.partyId === NOT_A_CUSTOMER)).toBe(false);
    expect(all.total).toBe(3);
  });

  it("withCredits: each customer's credits follow its bills, kind named, pending = what is held", async () => {
    const { service } = make();
    const all = await service.openBills({ companyId: COMPANY, withCredits: true });
    expect(all.total).toBe(5);
    const byParty = (party: string) =>
      all.items.filter((i) => i.partyId === party).map((i) => i.kind);
    expect(byParty(PARTY)).toEqual(['BILL', 'BILL', 'ADVANCE']);
    expect(byParty(OTHER_PARTY)).toEqual(['BILL', 'OPENING_CR']);
    expect(all.items.find((i) => i.billId === 'adv')).toEqual(
      expect.objectContaining({
        kind: 'ADVANCE',
        billType: 'ADVANCE',
        pendingAmount: '200.00',
        paidAmount: '300.00',
        pdcHeld: '0.00',
        daysOverdue: 0,
        ppdSchedule: [],
      }),
    );
  });

  it('with PPD slabs a bill carries the steps still ahead', async () => {
    const { service } = make([{ days: 100000, perc: 1 }]);
    const all = await service.openBills({ companyId: COMPANY });
    expect(all.items[0].ppdSchedule).toEqual([
      expect.objectContaining({ perc: '1.000', amount: '6.81' }),
    ]);
  });
});

describe('mergeByParty', () => {
  it("keeps the party order, a party's bills before its credits", () => {
    const b = (party: string) => ({ ablPartyId: party }) as never;
    const out = mergeByParty([b('a'), b('a'), b('c')], [b('a'), b('b'), b('c')]);
    expect(out.map((r) => `${r.ablPartyId}:${r.kind}`)).toEqual([
      'a:BILL',
      'a:BILL',
      'a:CREDIT',
      'b:CREDIT',
      'c:BILL',
      'c:CREDIT',
    ]);
  });
});
