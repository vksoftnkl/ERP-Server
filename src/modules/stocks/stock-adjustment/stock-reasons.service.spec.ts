import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  DeactivateStockReasonDto,
  SaveStockReasonDto,
  StockReasonPickerQueryDto,
} from './dto/stock-reason.dto';
import { StockReasonsService } from './stock-reasons.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b201';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b202';
const SRM_ID = '019c6f6c-be87-7a11-8905-36092c46b203';
const SHARED_ID = '019c6f6c-be87-7a11-8905-36092c46b204';
const NEW_ID = '019c6f6c-be87-7a11-8905-36092c46b205';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46b206';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b207';
const BODY_USER_ID = '019c6f6c-be87-7a11-8905-36092c46b208';

const rawReason = (overrides: Record<string, unknown> = {}) => ({
  srm_id: SRM_ID,
  srm_company_id: COMPANY_ID as string | null,
  srm_code: 'THEFT',
  srm_name: 'Theft',
  srm_direction: 'OUT',
  srm_allowed_txn_types: [] as string[] | null,
  srm_require_remarks: false,
  srm_gl_ledger_id: null as string | null,
  led_name: null as string | null,
  srm_sort_order: 1,
  srm_remarks: null as string | null,
  srm_is_active: true,
  ...overrides,
});

const listRow = (overrides: Record<string, unknown> = {}, usage = 0n, overridden = false) => ({
  ...rawReason(overrides),
  is_overridden: overridden,
  usage_count: usage,
});

interface FakeDb {
  pick: ReturnType<typeof rawReason>[];
  list: ReturnType<typeof listRow>[];
  usage: Array<{ ledger_rows: bigint; headers: bigint; lines: bigint; last_used: Date | null }>;
  ledgers: Array<{ led_id: string }>;
  existing: Array<{ srm_company_id: string | null; srm_code: string; cited: bigint }>;
  clash: Array<{ srm_id: string }>;
}

/** $queryRaw over a fake database, each query told apart by its SQL text. */
const queryRawOver = (db: FakeDb) =>
  jest.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const sql = strings.join('?');
    if (sql.includes('cardinality(r.srm_allowed_txn_types)')) return db.pick;
    if (sql.includes('AS is_overridden')) return db.list;
    if (sql.includes('AS ledger_rows')) return db.usage;
    if (sql.includes('FROM accounts.acc_ledger_master')) return db.ledgers;
    if (sql.includes('AS cited')) return db.existing;
    if (sql.includes('INSERT INTO stock.stock_reason_master')) return [{ srm_id: NEW_ID }];
    if (sql.includes('SELECT srm_id FROM stock.stock_reason_master')) return db.clash;
    throw new Error(`unrouted query: ${sql.slice(0, 80)}`);
  });

const saveDto = (plain: Record<string, unknown> = {}) =>
  plainToInstance(SaveStockReasonDto, {
    companyId: COMPANY_ID,
    code: 'theft',
    name: '  Theft  ',
    direction: 'OUT',
    ...plain,
  });

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: any }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

describe('StockReasonsService', () => {
  let db: FakeDb;
  let prisma: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: StockReasonsService;

  beforeEach(() => {
    db = {
      pick: [],
      list: [listRow(), listRow({ srm_id: NEW_ID, srm_code: 'NEWCODE' })],
      usage: [],
      ledgers: [{ led_id: LEDGER_ID }],
      existing: [{ srm_company_id: COMPANY_ID, srm_code: 'THEFT', cited: 0n }],
      clash: [],
    };
    prisma = { $queryRaw: queryRawOver(db), $executeRaw: jest.fn().mockResolvedValue(1) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new StockReasonsService(prisma as unknown as PrismaService, context as never);
  });

  const queriesMatching = (marker: string) =>
    prisma.$queryRaw.mock.calls.filter(([strings]) =>
      (strings as TemplateStringsArray).join('?').includes(marker),
    );
  const executed = () =>
    prisma.$executeRaw.mock.calls.map(([strings, ...values]) => ({
      sql: (strings as TemplateStringsArray).join('?'),
      values,
    }));

  // ── the picker ────────────────────────────────────────────────────────────
  describe('pick', () => {
    const pickQuery = (plain: Record<string, unknown>) =>
      plainToInstance(StockReasonPickerQueryDto, { companyId: COMPANY_ID, ...plain });

    it('maps each row, a shared one flagged and missing types as none', async () => {
      db.pick = [
        rawReason({ srm_gl_ledger_id: LEDGER_ID, led_name: 'Shrinkage', srm_remarks: 'r' }),
        rawReason({ srm_id: SHARED_ID, srm_company_id: null, srm_allowed_txn_types: null }),
      ];

      await expect(service.pick(pickQuery({ voucherType: 'ADJUSTMENT' }))).resolves.toEqual([
        {
          srmId: SRM_ID,
          companyId: COMPANY_ID,
          isShared: false,
          code: 'THEFT',
          name: 'Theft',
          direction: 'OUT',
          allowedTxnTypes: [],
          requireRemarks: false,
          glLedgerId: LEDGER_ID,
          glLedgerName: 'Shrinkage',
          sortOrder: 1,
          remarks: 'r',
          isActive: true,
        },
        expect.objectContaining({
          srmId: SHARED_ID,
          companyId: null,
          isShared: true,
          allowedTxnTypes: [],
        }),
      ]);
    });

    it('filters by the txn types the kind posts, any-movement reasons included', async () => {
      await service.pick(pickQuery({ voucherType: 'ADJUSTMENT' }));

      const [[, ...values]] = queriesMatching('cardinality');
      expect(values).toEqual([
        COMPANY_ID,
        COMPANY_ID,
        false,
        ['ADJUST_PLUS', 'ADJUST_MINUS'],
        // Not a transfer: no BOTH-only rule.
        false,
        null,
        null,
      ]);
    });

    it('offers a move only the reasons that name a bucket type', async () => {
      await service.pick(pickQuery({ voucherType: 'BUCKET_MOVE', direction: 'OUT' }));

      const [[, ...values]] = queriesMatching('cardinality');
      expect(values).toEqual([
        COMPANY_ID,
        COMPANY_ID,
        true,
        ['BUCKET_OUT', 'BUCKET_IN'],
        false,
        'OUT',
        'OUT',
      ]);
    });

    it.each(['TRANSFER_OUT', 'TRANSFER_IN'])(
      'notes 153 E4 — %s: only BOTH reasons naming that type, never an any-movement one (so no TRANSIT_LOSS)',
      async (voucherType) => {
        await service.pick(pickQuery({ voucherType }));

        const [[strings, ...values]] = queriesMatching('cardinality');
        expect(values).toEqual([COMPANY_ID, COMPANY_ID, true, [voucherType], true, null, null]);
        expect((strings as unknown as string[]).join('?')).toContain(
          "AND (NOT ?::boolean OR r.srm_direction = 'BOTH')",
        );
      },
    );
  });

  // ── list / get / usage ────────────────────────────────────────────────────
  describe('list', () => {
    it('answers every row the company sees with its override, usage and delete facts', async () => {
      db.list = [
        listRow({}, 0n),
        listRow({ srm_id: 'used', srm_code: 'USED' }, 3n),
        listRow({ srm_id: SHARED_ID, srm_company_id: null }, 0n, true),
      ];

      const rows = await service.list(COMPANY_ID);

      expect(rows.map((r) => [r.srmId, r.isOverridden, r.usageCount, r.canDelete])).toEqual([
        [SRM_ID, false, 0, true],
        ['used', false, 3, false],
        // A shared row is never the company's to delete.
        [SHARED_ID, true, 0, false],
      ]);
      const [[, ...values]] = queriesMatching('AS is_overridden');
      expect(values).toEqual([COMPANY_ID, COMPANY_ID, false]);
    });

    it('asks for inactive rows only when told to', async () => {
      await service.list(COMPANY_ID, true);

      expect(queriesMatching('AS is_overridden')[0].at(-1)).toBe(true);
    });
  });

  describe('getOne', () => {
    it('finds the row among the inactive ones too', async () => {
      await expect(service.getOne(COMPANY_ID, NEW_ID)).resolves.toMatchObject({
        srmId: NEW_ID,
        code: 'NEWCODE',
      });
      expect(queriesMatching('AS is_overridden')[0].at(-1)).toBe(true);
    });

    it('answers 404 for a reason the company cannot see', async () => {
      const refusal = await refusalOf(service.getOne(COMPANY_ID, SHARED_ID));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Stock reason not found',
          errors: [
            {
              field: 'srmId',
              code: StockErrorCode.REASON_NOT_FOUND,
              message: `No stock reason ${SHARED_ID} visible to this company.`,
            },
          ],
        },
      });
    });
  });

  describe('usage', () => {
    it('counts where the reason is cited and when it was last used', async () => {
      db.usage = [
        {
          ledger_rows: 4n,
          headers: 2n,
          lines: 7n,
          last_used: new Date('2026-10-01T05:00:00.000Z'),
        },
      ];

      await expect(service.usage(COMPANY_ID, SRM_ID)).resolves.toEqual({
        srmId: SRM_ID,
        ledgerRows: 4,
        voucherHeaders: 2,
        voucherLines: 7,
        lastUsedOn: '2026-10-01T05:00:00.000Z',
      });
      expect(queriesMatching('AS ledger_rows')[0].slice(1)).toEqual(Array(6).fill(SRM_ID));
    });

    it('answers zeros and no date for a reason never cited', async () => {
      await expect(service.usage(COMPANY_ID, SRM_ID)).resolves.toEqual({
        srmId: SRM_ID,
        ledgerRows: 0,
        voucherHeaders: 0,
        voucherLines: 0,
        lastUsedOn: null,
      });
    });

    it('answers 404 before counting anything for a reason the company cannot see', async () => {
      const refusal = await refusalOf(service.usage(COMPANY_ID, SHARED_ID));

      expect(refusal.status).toBe(404);
      expect(queriesMatching('AS ledger_rows')).toHaveLength(0);
    });
  });

  // ── save: create ──────────────────────────────────────────────────────────
  describe('save — create (no srmId)', () => {
    it("inserts the company's own row, normalised, and answers it", async () => {
      const row = await service.save(
        saveDto({
          allowedTxnTypes: [' adjust_minus ', 'ADJUST_MINUS', '', 'damage'],
          requireRemarks: true,
          glLedgerId: LEDGER_ID,
          sortOrder: 4,
          remarks: 'Shop floor',
          isActive: false,
        }),
      );

      const [[, ...values]] = queriesMatching('INSERT INTO stock.stock_reason_master');
      expect(values).toEqual([
        COMPANY_ID,
        'THEFT',
        'Theft',
        'OUT',
        ['ADJUST_MINUS', 'DAMAGE'],
        true,
        LEDGER_ID,
        4,
        'Shop floor',
        false,
        expect.any(Date),
        USER_ID,
      ]);
      expect(row).toMatchObject({ srmId: NEW_ID });
    });

    it('fills the defaults a create leaves out', async () => {
      await service.save(saveDto());

      const [[, ...values]] = queriesMatching('INSERT INTO stock.stock_reason_master');
      expect(values.slice(4, 10)).toEqual([[], false, null, 0, null, true]);
    });

    it('stamps the user named in the body, and nobody when there is no one', async () => {
      await service.save(saveDto({ userId: BODY_USER_ID }));
      context.getUserId.mockReturnValue(null);
      await service.save(saveDto());

      const inserts = queriesMatching('INSERT INTO stock.stock_reason_master');
      expect(inserts.map((call) => call.at(-1))).toEqual([BODY_USER_ID, null]);
    });

    it('refuses a code the company already uses', async () => {
      db.clash = [{ srm_id: SRM_ID }];

      const refusal = await refusalOf(service.save(saveDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Code already in use',
          errors: [
            {
              field: 'code',
              code: StockErrorCode.REASON_CODE_TAKEN,
              message: 'This company already has a reason coded THEFT.',
            },
          ],
        },
      });
      expect(queriesMatching('SELECT srm_id FROM stock.stock_reason_master')[0].slice(1)).toEqual([
        COMPANY_ID,
        'THEFT',
        null,
        null,
      ]);
      expect(queriesMatching('INSERT INTO')).toHaveLength(0);
    });

    it('refuses a ledger that does not exist before writing anything', async () => {
      db.ledgers = [];

      const refusal = await refusalOf(service.save(saveDto({ glLedgerId: LEDGER_ID })));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          message: 'Stock reason cannot be saved',
          errors: [{ field: 'glLedgerId', code: StockErrorCode.REASON_LEDGER_NOT_FOUND }],
        },
      });
      expect(queriesMatching('INSERT INTO')).toHaveLength(0);
    });
  });

  // ── save: update ──────────────────────────────────────────────────────────
  describe('save — update (srmId present)', () => {
    const fullUpdate = (plain: Record<string, unknown> = {}) =>
      saveDto({
        srmId: SRM_ID,
        allowedTxnTypes: ['ADJUST_MINUS'],
        requireRemarks: true,
        glLedgerId: LEDGER_ID,
        sortOrder: 2,
        remarks: 'kept',
        isActive: true,
        ...plain,
      });

    it("rewrites the company's own row and answers it", async () => {
      const row = await service.save(fullUpdate());

      const [update] = executed();
      expect(update.sql).toContain('UPDATE stock.stock_reason_master');
      expect(update.values).toEqual([
        'THEFT',
        'Theft',
        'OUT',
        ['ADJUST_MINUS'],
        true,
        LEDGER_ID,
        2,
        'kept',
        true,
        expect.any(Date),
        USER_ID,
        SRM_ID,
      ]);
      expect(queriesMatching('SELECT srm_id FROM stock.stock_reason_master')[0].slice(1)).toEqual([
        COMPANY_ID,
        'THEFT',
        SRM_ID,
        SRM_ID,
      ]);
      expect(row.srmId).toBe(SRM_ID);
    });

    it('answers 404 for a row that does not exist', async () => {
      db.existing = [];

      const refusal = await refusalOf(service.save(fullUpdate()));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            { code: StockErrorCode.REASON_NOT_FOUND, message: `No stock reason ${SRM_ID}.` },
          ],
        },
      });
    });

    it('refuses to write a shared row', async () => {
      db.existing = [{ srm_company_id: null, srm_code: 'THEFT', cited: 0n }];

      const refusal = await refusalOf(service.save(fullUpdate()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Shared reasons are read-only',
          errors: [{ field: 'srmId', code: StockErrorCode.REASON_SHARED_READ_ONLY }],
        },
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it("answers 404 for another company's row", async () => {
      db.existing = [{ srm_company_id: OTHER_COMPANY_ID, srm_code: 'THEFT', cited: 0n }];

      const refusal = await refusalOf(service.save(fullUpdate()));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ message: `No stock reason ${SRM_ID} for this company.` }] },
      });
    });

    it('refuses a new code once the ledger cites the reason', async () => {
      db.existing = [{ srm_company_id: COMPANY_ID, srm_code: 'THEFT', cited: 12n }];

      const refusal = await refusalOf(service.save(fullUpdate({ code: 'SHRINK' })));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Code is immutable once used',
          errors: [
            {
              field: 'code',
              code: StockErrorCode.REASON_CODE_LOCKED,
              message:
                'THEFT is cited by 12 ledger rows; its code cannot change. Deactivate it and create another.',
            },
          ],
        },
      });
    });

    it('lets a cited reason keep its code while the rest changes', async () => {
      db.existing = [{ srm_company_id: COMPANY_ID, srm_code: 'THEFT', cited: 12n }];

      await expect(service.save(fullUpdate({ name: 'Theft (shop)' }))).resolves.toBeDefined();
    });

    it('lets a reason nobody cited take a new code', async () => {
      await service.save(fullUpdate({ code: 'shrink' }));

      expect(executed()[0].values[0]).toBe('SHRINK');
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────
  describe('deactivate', () => {
    const deactivateDto = (plain: Record<string, unknown> = {}) =>
      plainToInstance(DeactivateStockReasonDto, { companyId: COMPANY_ID, srmId: SRM_ID, ...plain });

    it('deletes a company reason nobody ever cited', async () => {
      await expect(service.deactivate(deactivateDto())).resolves.toEqual({
        srmId: SRM_ID,
        deleted: true,
      });

      const [update] = executed();
      expect(update.sql).toContain('srm_is_deleted = true');
      expect(update.values).toEqual([expect.any(Date), USER_ID, SRM_ID]);
    });

    it('only deactivates a reason that is cited somewhere', async () => {
      db.list = [listRow({}, 2n)];

      const row = await service.deactivate(deactivateDto({ userId: BODY_USER_ID }));

      const [update] = executed();
      expect(update.sql).toContain('srm_is_active = false');
      expect(update.sql).not.toContain('srm_is_deleted');
      expect(update.values).toEqual([expect.any(Date), BODY_USER_ID, SRM_ID]);
      expect(row).toMatchObject({ srmId: SRM_ID });
    });

    it('reactivates when asked, whether cited or not', async () => {
      await service.deactivate(deactivateDto({ reactivate: true }));

      const [update] = executed();
      expect(update.sql).toContain('srm_is_active = true');
      expect(update.sql).not.toContain('srm_is_deleted');
    });

    it('refuses a shared row', async () => {
      db.list = [listRow({ srm_company_id: null })];

      const refusal = await refusalOf(service.deactivate(deactivateDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'srmId', code: StockErrorCode.REASON_SHARED_READ_ONLY }] },
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('answers 404 for a reason the company cannot see', async () => {
      const refusal = await refusalOf(service.deactivate(deactivateDto({ srmId: SHARED_ID })));

      expect(refusal.status).toBe(404);
    });
  });
});
