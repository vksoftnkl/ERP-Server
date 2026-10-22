import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import type { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import type { SettledShortRow } from '../stock-voucher/stock-voucher-posting.helper';
import type { StockVoucherType } from '../stock-voucher/types/stock-voucher.types';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  STOCK_ACCOUNTS_SRC_MODULE,
  STOCK_COGS_MODE,
  STOCK_COGS_MODE_PROVIDER,
  StockAccountsPostingService,
  type StockAccountsPostInput,
} from './stock-accounts-posting.service';
import { StockCogsModeService, type CogsMode } from './stock-cogs-mode.service';

const SVH_ID = '11111111-1111-4111-8111-111111111111';
const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const BRANCH_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR = '44444444-4444-4444-8444-444444444444';
const CREATOR = '55555555-5555-4555-8555-555555555555';
const DEVICE_ID = '66666666-6666-4666-8666-666666666666';
const REASON_ID = '77777777-7777-4777-8777-777777777777';
const REASON_LEDGER = '88888888-8888-4888-8888-888888888888';
const HEADER_LEDGER = '99999999-9999-4999-8999-999999999999';
const OUT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACC_YEAR = '2026-2027';
const STK_ADJ_TYPE_ID = 41;
const JOURNAL_TYPE_ID = 7;

interface HeaderRow {
  svh_refno: string;
  svh_doc_date: Date;
  svh_tenant_id: string | null;
  svh_device_id: string;
  svh_session_id: string | null;
  svh_created_by: string | null;
  svh_reason_id: string | null;
  reason_ledger_id: string | null;
}

const HEADER: HeaderRow = {
  svh_refno: 'OPN0001',
  svh_doc_date: new Date('2026-04-01T00:00:00.000Z'),
  svh_tenant_id: null,
  svh_device_id: DEVICE_ID,
  svh_session_id: 'session-1',
  svh_created_by: CREATOR,
  svh_reason_id: null,
  reason_ledger_id: null,
};

interface Answers {
  header?: Partial<HeaderRow> | null;
  openingSum?: Prisma.Decimal | null;
  variance?: Array<{
    sml_direction: number;
    reason_ledger_id: string | null;
    value: Prisma.Decimal | null;
  }>;
  voucherTypes?: Record<string, number>;
  liveVoucher?: string | null;
  reason?: { srm_gl_ledger_id: string | null; srm_name: string } | null;
  outHeader?: {
    svh_doc_date: Date;
    svh_tenant_id: string | null;
    svh_device_id: string;
    svh_session_id: string | null;
    svh_created_by: string | null;
  } | null;
}

/**
 * A transaction client that answers each read by what the query is FOR, not by
 * call order — so a reordering inside the service cannot quietly turn a test
 * into a test of nothing.
 */
function txWith(answers: Answers = {}) {
  const queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join('?');
    if (sql.includes('FROM accounts.acc_voucher_types')) {
      const types = answers.voucherTypes ?? { StkAdj: STK_ADJ_TYPE_ID, Jrl: JOURNAL_TYPE_ID };
      const id = types[values[0] as string];
      return Promise.resolve(id === undefined ? [] : [{ vchr_type_id: id }]);
    }
    if (sql.includes('srm.srm_id = svh.svh_reason_id')) {
      return Promise.resolve(answers.header === null ? [] : [{ ...HEADER, ...answers.header }]);
    }
    if (sql.includes('GROUP BY sml.sml_direction')) {
      return Promise.resolve(answers.variance ?? []);
    }
    if (sql.includes('SELECT SUM(sml.sml_cost_value) AS value')) {
      return Promise.resolve([{ value: answers.openingSum ?? null }]);
    }
    if (sql.includes('FROM accounts.acc_voucher_header')) {
      return Promise.resolve(answers.liveVoucher ? [{ avh_voucher_id: answers.liveVoucher }] : []);
    }
    if (sql.includes('FROM stock.stock_reason_master')) {
      return Promise.resolve(
        answers.reason === null
          ? []
          : [answers.reason ?? { srm_gl_ledger_id: null, srm_name: 'Transit loss' }],
      );
    }
    if (sql.includes('SELECT svh_doc_date, svh_tenant_id')) {
      return Promise.resolve(answers.outHeader ? [answers.outHeader] : []);
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  return { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient & { $queryRaw: jest.Mock };
}

/** The bound values of the first query whose text contains `fragment`. */
const paramsOf = (tx: { $queryRaw: jest.Mock }, fragment: string): unknown[] => {
  const call = tx.$queryRaw.mock.calls.find(([strings]: [TemplateStringsArray]) =>
    strings.join('?').includes(fragment),
  ) as [TemplateStringsArray, ...unknown[]] | undefined;
  if (!call) throw new Error(`no query containing ${fragment}`);
  return call.slice(1);
};

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

const input = (overrides: Partial<StockAccountsPostInput> = {}): StockAccountsPostInput => ({
  svhId: SVH_ID,
  accYear: ACC_YEAR,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  voucherType: 'OPENING',
  displayName: 'Opening stock',
  actor: ACTOR,
  postedOn: new Date('2026-04-02T10:00:00.000Z'),
  ...overrides,
});

const shortRow = (shortValue: string): SettledShortRow => ({
  sttId: 'stt-1',
  itemId: 'item-1',
  lotId: 'lot-1',
  toGodownId: 'godown-1',
  bucket: 'SALEABLE',
  shortQty: new Prisma.Decimal(1),
  costRate: new Prisma.Decimal(shortValue),
  shortValue: new Prisma.Decimal(shortValue),
});

describe('StockAccountsPostingService', () => {
  let voucherPosting: { postLegs: jest.Mock; reverseLegs: jest.Mock };
  let cogs: { cogsMode: jest.Mock<Promise<CogsMode>, [string, string]> };
  let service: StockAccountsPostingService;

  beforeEach(() => {
    voucherPosting = {
      postLegs: jest
        .fn()
        .mockResolvedValue({ voucherId: 'avh-1', voucherRefno: 'OPN0001', legCount: 2 }),
      reverseLegs: jest.fn().mockResolvedValue({ voucherId: 'avh-rev', legCount: 2 }),
    };
    cogs = { cogsMode: jest.fn().mockResolvedValue('PERPETUAL') };
    service = new StockAccountsPostingService(
      voucherPosting as unknown as VoucherPostingService,
      cogs,
    );
  });

  const posted = () =>
    voucherPosting.postLegs.mock.calls[0][1] as {
      header: Record<string, unknown>;
      legs: Array<Record<string, unknown>>;
    };

  // ── which documents post ──────────────────────────────────────────────────
  describe('postsAccounts', () => {
    it.each<[StockVoucherType, boolean]>([
      ['OPENING', true],
      ['PHYSICAL', true],
      ['ADJUSTMENT', true],
      ['ISSUE', true],
      ['DAMAGE', true],
      ['EXPIRY_WRITEOFF', true],
      ['RECEIPT', false],
      ['TRANSFER_OUT', false],
      ['TRANSFER_IN', false],
      ['REPACK_IN', false],
      ['REPACK_OUT', false],
    ])('%s → %s', (voucherType, expected) => {
      expect(StockAccountsPostingService.postsAccounts(voucherType)).toBe(expected);
    });
  });

  it('binds the cogs-mode token to the real resolver', () => {
    expect(STOCK_COGS_MODE_PROVIDER).toEqual({
      provide: STOCK_COGS_MODE,
      useExisting: StockCogsModeService,
    });
  });

  // ── postForVoucher: when nothing is written ───────────────────────────────
  describe('postForVoucher — nothing to write', () => {
    it('writes nothing for a type that posts no leg, without asking anything', async () => {
      const tx = txWith();

      await expect(
        service.postForVoucher(tx, input({ voucherType: 'TRANSFER_OUT' })),
      ).resolves.toBeNull();
      expect(cogs.cogsMode).not.toHaveBeenCalled();
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('writes nothing under PERIODIC, and asks the mode for the document’s own branch', async () => {
      cogs.cogsMode.mockResolvedValue('PERIODIC');
      const tx = txWith({ openingSum: new Prisma.Decimal(100) });

      await expect(service.postForVoucher(tx, input())).resolves.toBeNull();
      expect(cogs.cogsMode).toHaveBeenCalledWith(COMPANY_ID, BRANCH_ID);
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(voucherPosting.postLegs).not.toHaveBeenCalled();
    });

    it.each([
      ['no ledger rows', null],
      ['rows summing to zero', new Prisma.Decimal(0)],
    ])('writes nothing for an opening with %s', async (_label, sum) => {
      await expect(
        service.postForVoucher(txWith({ openingSum: sum }), input()),
      ).resolves.toBeNull();
      expect(voucherPosting.postLegs).not.toHaveBeenCalled();
    });

    it('refuses to guess when the stock document itself cannot be read', async () => {
      await expect(
        service.postForVoucher(
          txWith({ header: null, openingSum: new Prisma.Decimal(5) }),
          input(),
        ),
      ).rejects.toThrow(`Stock voucher ${SVH_ID} (${ACC_YEAR}) not found for accounts posting`);
    });
  });

  // ── OPENING ───────────────────────────────────────────────────────────────
  describe('postForVoucher — OPENING', () => {
    it('posts DR INVENTORY / CR OPENING_DIFFERENCE for the ledger’s own sum, on type 1', async () => {
      const tx = txWith({ openingSum: new Prisma.Decimal('1500.50') });

      await expect(service.postForVoucher(tx, input())).resolves.toEqual({
        voucherId: 'avh-1',
        voucherRefno: 'OPN0001',
        amount: 1500.5,
        legCount: 2,
      });

      expect(posted().legs).toEqual([
        {
          role: 'INVENTORY',
          roleTag: 'INVENTORY',
          drCr: 'DR',
          amount: 1500.5,
          remarks: 'Opening stock',
          field: 'lines',
        },
        {
          role: 'OPENING_DIFFERENCE',
          roleTag: 'OPENING_DIFFERENCE',
          drCr: 'CR',
          amount: 1500.5,
          remarks: 'Opening stock',
          field: 'lines',
        },
      ]);
      expect(posted().header).toEqual({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        tenantId: null,
        accYear: ACC_YEAR,
        voucherTypeId: 1,
        voucherDate: '2026-04-01',
        srcModule: STOCK_ACCOUNTS_SRC_MODULE,
        srcDocType: 'OPENING',
        srcDocId: SVH_ID,
        docLabel: 'Opening stock',
        docRefno: 'OPN0001',
        docDate: '2026-04-01',
        docAmount: 1500.5,
        partyId: null,
        userId: ACTOR,
        sessionId: 'session-1',
        deviceId: DEVICE_ID,
        remarks: 'Opening stock OPN0001',
        presetRefno: 'OPN0001',
        createdBy: ACTOR,
      });
    });

    it('sums only the forward, live rows of this document in this year', async () => {
      const tx = txWith({ openingSum: new Prisma.Decimal(10) });

      await service.postForVoucher(tx, input());

      const call = tx.$queryRaw.mock.calls.find(([s]: [TemplateStringsArray]) =>
        s.join('?').includes('SELECT SUM(sml.sml_cost_value) AS value'),
      ) as [TemplateStringsArray, ...unknown[]];
      const sql = call[0].join('?');
      expect(sql).toContain('sml.sml_is_deleted  = false');
      expect(sql).toContain('sml.sml_is_reversal = false');
      expect(call.slice(1)).toEqual([SVH_ID, ACC_YEAR]);
    });

    it('lets the voucher draw its own number when the stock refno is too long for the column', async () => {
      const deviceRefno = `OPN/2026-2027/${'TILL-01/'.repeat(5)}1`;
      expect(deviceRefno.length).toBeGreaterThan(50);

      await service.postForVoucher(
        txWith({ openingSum: new Prisma.Decimal(10), header: { svh_refno: deviceRefno } }),
        input(),
      );

      expect(posted().header).toMatchObject({ presetRefno: undefined, docRefno: deviceRefno });
    });

    it('keeps a refno of exactly 50 characters', async () => {
      const refno = 'R'.repeat(50);

      await service.postForVoucher(
        txWith({ openingSum: new Prisma.Decimal(10), header: { svh_refno: refno } }),
        input(),
      );

      expect(posted().header.presetRefno).toBe(refno);
    });
  });

  // ── who the voucher is posted by ──────────────────────────────────────────
  describe('the posting user (avh_user_id is NOT NULL with an FK)', () => {
    it('stands the document’s author in for the nil actor, and writes SYSTEM as creator', async () => {
      await service.postForVoucher(
        txWith({ openingSum: new Prisma.Decimal(10) }),
        input({ actor: DEFAULT_ACTOR }),
      );

      expect(posted().header).toMatchObject({ userId: CREATOR, createdBy: 'SYSTEM' });
    });

    it('stands the author in for an actor that is not a user id', async () => {
      await service.postForVoucher(
        txWith({ openingSum: new Prisma.Decimal(10) }),
        input({ actor: 'nightly-job' }),
      );

      expect(posted().header).toMatchObject({ userId: CREATOR, createdBy: 'nightly-job' });
    });

    it.each([
      ['no author', null],
      ['the nil author', DEFAULT_ACTOR],
      ['an author that is not a user id', 'importer'],
    ])('refuses with a 422 when the document has %s either', async (_label, createdBy) => {
      const refusal = await refusalOf(
        service.postForVoucher(
          txWith({ openingSum: new Prisma.Decimal(10), header: { svh_created_by: createdBy } }),
          input({ actor: DEFAULT_ACTOR }),
        ),
      );

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'Opening stock cannot be posted to accounts',
          errors: [
            {
              field: 'userId',
              code: StockErrorCode.ACCOUNTS_USER_REQUIRED,
              message:
                'The accounts voucher needs a user to be posted by, and this request carries none.',
            },
          ],
        },
      });
      expect(voucherPosting.postLegs).not.toHaveBeenCalled();
    });
  });

  // ── PHYSICAL and the adjustment family ────────────────────────────────────
  describe('postForVoucher — variance documents', () => {
    const physical = (overrides: Partial<StockAccountsPostInput> = {}) =>
      input({ voucherType: 'PHYSICAL', displayName: 'Physical stock count', ...overrides });

    it('posts a shortage DR STOCK_SHORTAGE and an excess CR STOCK_EXCESS, netting INVENTORY, on type 6', async () => {
      const tx = txWith({
        header: { svh_refno: 'PHY0003' },
        variance: [
          { sml_direction: -1, reason_ledger_id: null, value: new Prisma.Decimal(100) },
          { sml_direction: 1, reason_ledger_id: null, value: new Prisma.Decimal(30) },
        ],
      });

      const result = await service.postForVoucher(tx, physical());

      expect(posted().legs).toEqual([
        {
          role: 'STOCK_SHORTAGE',
          roleTag: 'STOCK_SHORTAGE',
          remarks: 'Physical stock count: stock out',
          field: 'reasonId',
          drCr: 'DR',
          amount: 100,
        },
        {
          role: 'INVENTORY',
          roleTag: 'INVENTORY',
          remarks: `Physical stock count ${SVH_ID}`,
          field: 'lines',
          drCr: 'CR',
          amount: 70,
        },
        {
          role: 'STOCK_EXCESS',
          roleTag: 'STOCK_EXCESS',
          remarks: 'Physical stock count: stock in',
          field: 'reasonId',
          drCr: 'CR',
          amount: 30,
        },
      ]);
      expect(posted().header).toMatchObject({
        voucherTypeId: 6,
        srcDocType: 'PHYSICAL',
        docAmount: 100,
        remarks: 'Physical stock count PHY0003',
      });
      expect(result?.amount).toBe(100);
    });

    it('posts a pure excess as DR INVENTORY / CR STOCK_EXCESS', async () => {
      await service.postForVoucher(
        txWith({
          variance: [{ sml_direction: 1, reason_ledger_id: null, value: new Prisma.Decimal(45) }],
        }),
        physical(),
      );

      expect(posted().legs).toEqual([
        expect.objectContaining({ role: 'STOCK_EXCESS', drCr: 'CR', amount: 45 }),
        expect.objectContaining({ role: 'INVENTORY', drCr: 'DR', amount: 45 }),
      ]);
    });

    it("names the row's reason ledger, keeping the role as the leg's tag", async () => {
      await service.postForVoucher(
        txWith({
          variance: [
            { sml_direction: -1, reason_ledger_id: REASON_LEDGER, value: new Prisma.Decimal(20) },
          ],
        }),
        physical(),
      );

      expect(posted().legs[0]).toEqual(
        expect.objectContaining({ ledgerId: REASON_LEDGER, roleTag: 'STOCK_SHORTAGE', drCr: 'DR' }),
      );
      expect(posted().legs[0]).not.toHaveProperty('role');
    });

    it("falls back to the header reason's ledger for a row with none of its own", async () => {
      await service.postForVoucher(
        txWith({
          header: { reason_ledger_id: HEADER_LEDGER },
          variance: [{ sml_direction: -1, reason_ledger_id: null, value: new Prisma.Decimal(20) }],
        }),
        physical(),
      );

      expect(posted().legs[0]).toEqual(expect.objectContaining({ ledgerId: HEADER_LEDGER }));
    });

    it('nets a shortage and an excess on the same ledger into one figure', async () => {
      await service.postForVoucher(
        txWith({
          variance: [
            { sml_direction: -1, reason_ledger_id: REASON_LEDGER, value: new Prisma.Decimal(100) },
            { sml_direction: 1, reason_ledger_id: REASON_LEDGER, value: new Prisma.Decimal(40) },
          ],
        }),
        physical(),
      );

      expect(posted().legs).toEqual([
        expect.objectContaining({ ledgerId: REASON_LEDGER, drCr: 'DR', amount: 60 }),
        expect.objectContaining({ role: 'INVENTORY', drCr: 'CR', amount: 60 }),
      ]);
    });

    it('writes no voucher when every row cancels or is zero', async () => {
      const tx = txWith({
        variance: [
          { sml_direction: -1, reason_ledger_id: REASON_LEDGER, value: new Prisma.Decimal(50) },
          { sml_direction: 1, reason_ledger_id: REASON_LEDGER, value: new Prisma.Decimal(50) },
          { sml_direction: -1, reason_ledger_id: null, value: new Prisma.Decimal(0) },
          { sml_direction: 1, reason_ledger_id: null, value: null },
        ],
      });

      await expect(service.postForVoucher(tx, physical())).resolves.toBeNull();
      expect(voucherPosting.postLegs).not.toHaveBeenCalled();
    });

    it('leaves the re-lot pair and a bucket move out of the variance query', async () => {
      const tx = txWith({ variance: [] });

      await service.postForVoucher(tx, physical());

      expect(paramsOf(tx, 'GROUP BY sml.sml_direction')).toEqual([
        SVH_ID,
        ACC_YEAR,
        ['RELOT_OUT', 'RELOT_IN'],
        ['BUCKET_OUT', 'BUCKET_IN'],
      ]);
    });

    it.each<StockVoucherType>(['ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF'])(
      'numbers a %s on the Stock Journal type, found by its code',
      async (voucherType) => {
        const tx = txWith({
          variance: [{ sml_direction: -1, reason_ledger_id: null, value: new Prisma.Decimal(12) }],
        });

        await service.postForVoucher(tx, input({ voucherType, displayName: voucherType }));

        expect(paramsOf(tx, 'FROM accounts.acc_voucher_types')).toEqual(['StkAdj']);
        expect(posted().header).toMatchObject({
          voucherTypeId: STK_ADJ_TYPE_ID,
          srcDocType: voucherType,
        });
      },
    );

    it('says which migration is missing when the Stock Journal type is not seeded', async () => {
      const tx = txWith({ voucherTypes: {} });

      await expect(service.postForVoucher(tx, input({ voucherType: 'DAMAGE' }))).rejects.toThrow(
        "Voucher type 'StkAdj' is missing — apply the migration that seeds it",
      );
    });

    it('cuts the INVENTORY remark to the 250 characters the column holds', async () => {
      await service.postForVoucher(
        txWith({
          variance: [{ sml_direction: -1, reason_ledger_id: null, value: new Prisma.Decimal(1) }],
        }),
        physical({ displayName: 'D'.repeat(300) }),
      );

      expect((posted().legs[1].remarks as string).length).toBe(250);
    });
  });

  // ── reverseForVoucher ─────────────────────────────────────────────────────
  describe('reverseForVoucher', () => {
    const cancel = {
      svhId: SVH_ID,
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      voucherType: 'OPENING' as const,
      reason: 'keyed twice',
      actor: ACTOR,
    };

    it('mirrors the live voucher of the document, dated the original', async () => {
      const tx = txWith({ liveVoucher: 'avh-9' });

      await expect(service.reverseForVoucher(tx, cancel)).resolves.toEqual({
        voucherId: 'avh-rev',
        legCount: 2,
      });
      expect(paramsOf(tx, 'FROM accounts.acc_voucher_header')).toEqual([
        COMPANY_ID,
        STOCK_ACCOUNTS_SRC_MODULE,
        'OPENING',
        SVH_ID,
        ACC_YEAR,
      ]);
      expect(voucherPosting.reverseLegs).toHaveBeenCalledWith(
        tx,
        'avh-9',
        ACC_YEAR,
        'keyed twice',
        ACTOR,
      );
    });

    it('reverses as SYSTEM for the nil actor', async () => {
      const tx = txWith({ liveVoucher: 'avh-9' });

      await service.reverseForVoucher(tx, { ...cancel, actor: DEFAULT_ACTOR });

      expect(voucherPosting.reverseLegs).toHaveBeenCalledWith(
        tx,
        'avh-9',
        ACC_YEAR,
        'keyed twice',
        'SYSTEM',
      );
    });

    it('does nothing for a document that never had a voucher', async () => {
      await expect(
        service.reverseForVoucher(txWith({ liveVoucher: null }), cancel),
      ).resolves.toBeNull();
      expect(voucherPosting.reverseLegs).not.toHaveBeenCalled();
    });
  });

  // ── postShortSettlement ───────────────────────────────────────────────────
  describe('postShortSettlement', () => {
    const settledOn = new Date('2026-10-21T09:00:00.000Z');
    const settle = (overrides: Record<string, unknown> = {}) => ({
      outId: OUT_ID,
      outAccYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      refno: 'TRO0012',
      reasonId: REASON_ID,
      remarks: null,
      rows: [shortRow('120.50'), shortRow('30.25')],
      actor: ACTOR,
      settledOn,
      ...overrides,
    });
    const OUT_HEADER = {
      svh_doc_date: new Date('2026-10-18T00:00:00.000Z'),
      svh_tenant_id: null,
      svh_device_id: DEVICE_ID,
      svh_session_id: 'session-7',
      svh_created_by: CREATOR,
    };

    it('writes nothing under PERIODIC', async () => {
      cogs.cogsMode.mockResolvedValue('PERIODIC');
      const tx = txWith();

      await expect(service.postShortSettlement(tx, settle())).resolves.toBeNull();
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('writes nothing when nothing of value went missing', async () => {
      const tx = txWith();

      await expect(
        service.postShortSettlement(tx, settle({ rows: [shortRow('0')] })),
      ).resolves.toBeNull();
      await expect(service.postShortSettlement(tx, settle({ rows: [] }))).resolves.toBeNull();
      expect(tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('posts DR STOCK_SHORTAGE / CR INVENTORY for the summed short value, as a Journal linked to the OUT', async () => {
      const tx = txWith({ outHeader: OUT_HEADER });

      await expect(service.postShortSettlement(tx, settle())).resolves.toEqual({
        voucherId: 'avh-1',
        voucherRefno: 'OPN0001',
        amount: 150.75,
        legCount: 2,
      });

      expect(posted().legs).toEqual([
        {
          role: 'STOCK_SHORTAGE',
          roleTag: 'STOCK_SHORTAGE',
          drCr: 'DR',
          amount: 150.75,
          remarks: 'Transit loss: transit short on TRO0012',
          field: 'reasonId',
        },
        {
          role: 'INVENTORY',
          roleTag: 'INVENTORY',
          drCr: 'CR',
          amount: 150.75,
          remarks: 'Transit short on TRO0012',
          field: 'reasonId',
        },
      ]);
      expect(posted().header).toEqual({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        tenantId: null,
        accYear: ACC_YEAR,
        voucherTypeId: JOURNAL_TYPE_ID,
        voucherDate: '2026-10-21',
        srcModule: STOCK_ACCOUNTS_SRC_MODULE,
        srcDocType: 'TRANSFER_OUT',
        srcDocId: OUT_ID,
        docLabel: 'Stock transfer short settlement',
        docRefno: 'TRO0012',
        docDate: '2026-10-18',
        docAmount: 150.75,
        partyId: null,
        userId: ACTOR,
        sessionId: 'session-7',
        deviceId: DEVICE_ID,
        remarks: 'Transit short on TRO0012',
        createdBy: ACTOR,
      });
      expect(paramsOf(tx, 'FROM accounts.acc_voucher_types')).toEqual(['Jrl']);
    });

    it("debits the reason's own ledger when it names one, and keeps the caller's remarks", async () => {
      await service.postShortSettlement(
        txWith({
          outHeader: OUT_HEADER,
          reason: { srm_gl_ledger_id: REASON_LEDGER, srm_name: 'Breakage' },
        }),
        settle({ remarks: 'Two cartons crushed' }),
      );

      expect(posted().legs[0]).toEqual(
        expect.objectContaining({ ledgerId: REASON_LEDGER, roleTag: 'STOCK_SHORTAGE' }),
      );
      expect(posted().legs[0]).not.toHaveProperty('role');
      expect(posted().header.remarks).toBe('Two cartons crushed');
    });

    it('refuses a reason that does not exist with a 422', async () => {
      const refusal = await refusalOf(
        service.postShortSettlement(txWith({ reason: null }), settle()),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          message: 'Reason not found',
          errors: [{ field: 'reasonId', code: StockErrorCode.REASON_NOT_FOUND }],
        },
      });
      expect(voucherPosting.postLegs).not.toHaveBeenCalled();
    });

    it('still posts when the OUT header cannot be read, dating the document by the settlement', async () => {
      await service.postShortSettlement(txWith({ outHeader: null }), settle());

      expect(posted().header).toMatchObject({
        tenantId: null,
        sessionId: null,
        deviceId: null,
        docDate: '2026-10-21',
        userId: ACTOR,
      });
    });

    it('refuses for the nil actor when the OUT header names no author', async () => {
      const refusal = await refusalOf(
        service.postShortSettlement(txWith({ outHeader: null }), settle({ actor: DEFAULT_ACTOR })),
      );

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          message: 'Transit short settlement cannot be posted to accounts',
          errors: [{ code: StockErrorCode.ACCOUNTS_USER_REQUIRED }],
        },
      });
    });

    it('stands the OUT’s author in for the nil actor, and writes SYSTEM as creator', async () => {
      await service.postShortSettlement(
        txWith({ outHeader: OUT_HEADER }),
        settle({ actor: DEFAULT_ACTOR }),
      );

      expect(posted().header).toMatchObject({ userId: CREATOR, createdBy: 'SYSTEM' });
    });

    it('says which migration is missing when the Journal type is not seeded', async () => {
      await expect(
        service.postShortSettlement(txWith({ voucherTypes: {} }), settle()),
      ).rejects.toThrow("Voucher type 'Jrl' is missing");
    });
  });
});
