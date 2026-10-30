import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PENDING_STATUSES, TxnStatusService } from './txn-status.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d001';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46d002';
const DOC_ID = '019c6f6c-be87-7a11-8905-36092c46d003';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46d004';
const ACC_YEAR = '2026-2027';

const pendingRow = (overrides: Record<string, unknown> = {}) => ({
  tsl_src_module: 'SALES',
  tsl_src_doc_type: 'SALE_BILL',
  tsl_src_doc_id: DOC_ID,
  tsl_src_doc_refno: 'SB/0001',
  // bpchar(10) pads the 9-character year with a blank.
  tsl_acc_year: `${ACC_YEAR} `,
  tsl_to_status: 'DRAFT',
  tsl_changed_on: new Date('2026-10-20T04:30:00.000Z'),
  tsl_changed_by: USER_ID,
  changed_by_name: 'tester1',
  tsl_branch_id: BRANCH_ID,
  total_count: 3n,
  ...overrides,
});

/** The SQL text and bound values of the nth $queryRaw call. */
const queryOf = (mock: jest.Mock, call: number): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[call] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};

describe('TxnStatusService', () => {
  let service: TxnStatusService;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    // Call 0 is the page of documents, call 1 the counts.
    queryRaw = jest.fn().mockResolvedValue([]);
    service = new TxnStatusService({ $queryRaw: queryRaw } as unknown as PrismaService);
  });

  describe('bound filters', () => {
    it('scopes to the company and year, every branch and module, up to now, first 200', async () => {
      await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR });

      expect(queryOf(queryRaw, 0).values).toEqual([
        COMPANY_ID,
        ACC_YEAR,
        null,
        null,
        null,
        null,
        null,
        null,
        [...PENDING_STATUSES],
        200,
        0,
      ]);
      // The counts run over the same filter, unpaged.
      expect(queryOf(queryRaw, 1).values).toEqual([
        COMPANY_ID,
        ACC_YEAR,
        null,
        null,
        null,
        null,
        null,
        null,
        [...PENDING_STATUSES],
      ]);
    });

    it('binds the branch and an upper-cased, trimmed module', async () => {
      await service.pending({
        companyId: COMPANY_ID,
        accYear: ACC_YEAR,
        branchId: BRANCH_ID,
        srcModule: '  sales ',
      });

      const { values } = queryOf(queryRaw, 0);
      expect(values.slice(2, 6)).toEqual([BRANCH_ID, BRANCH_ID, 'SALES', 'SALES']);
    });

    it('reads a blank module as every module', async () => {
      await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR, srcModule: '   ' });

      expect(queryOf(queryRaw, 0).values.slice(4, 6)).toEqual([null, null]);
    });

    it('takes upToDate as the last instant of that day', async () => {
      await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR, upToDate: '2026-10-20' });

      const upTo = queryOf(queryRaw, 0).values[6] as Date;
      expect(upTo).toBeInstanceOf(Date);
      expect([
        upTo.getFullYear(),
        upTo.getMonth() + 1,
        upTo.getDate(),
        upTo.getHours(),
        upTo.getMinutes(),
        upTo.getSeconds(),
        upTo.getMilliseconds(),
      ]).toEqual([2026, 10, 20, 23, 59, 59, 999]);
    });

    it.each([
      [{ limit: 0 }, 1, 0],
      [{ limit: 5000 }, 2000, 0],
      [{ limit: 50, offset: 100 }, 50, 100],
      [{ offset: -10 }, 200, 0],
    ])('pages %o as LIMIT %i OFFSET %i', async (paging, limit, offset) => {
      await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR, ...paging });

      expect(queryOf(queryRaw, 0).values.slice(-2)).toEqual([limit, offset]);
    });
  });

  describe('the SQL', () => {
    // Save-and-post once stamped CREATED after POSTED; time order called posted docs draft.
    it('takes the latest step by sequence number, not by timestamp', async () => {
      await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR });

      const { sql } = queryOf(queryRaw, 0);
      expect(sql).toContain(
        'DISTINCT ON (tsl.tsl_src_doc_type, tsl.tsl_src_doc_id, tsl.tsl_acc_year)',
      );
      expect(sql).toContain('tsl.tsl_acc_year, tsl.tsl_seq_no DESC');
      expect(sql).not.toMatch(/tsl_changed_on\s+DESC/);
    });

    it('leaves out deleted log rows and documents whose latest step is DELETED', async () => {
      await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR });

      for (const call of [0, 1]) {
        const { sql } = queryOf(queryRaw, call);
        expect(sql).toContain('tsl.tsl_is_deleted = false');
        expect(sql).toContain("l.tsl_event <> 'DELETED'");
      }
    });

    it('names who made the step from user_master', async () => {
      await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR });

      expect(queryOf(queryRaw, 0).sql).toContain(
        'LEFT JOIN public.user_master u ON u.usr_id = l.tsl_changed_by',
      );
    });
  });

  describe('the result', () => {
    it('maps each row, trims the padded year and sends the step time as ISO', async () => {
      queryRaw.mockResolvedValueOnce([pendingRow()]).mockResolvedValueOnce([]);

      const result = await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR });

      expect(result.items).toEqual([
        {
          srcModule: 'SALES',
          srcDocType: 'SALE_BILL',
          srcDocId: DOC_ID,
          refno: 'SB/0001',
          accYear: ACC_YEAR,
          status: 'DRAFT',
          since: '2026-10-20T04:30:00.000Z',
          changedBy: USER_ID,
          changedByName: 'tester1',
          branchId: BRANCH_ID,
        },
      ]);
    });

    it('reads the total before paging from the window count', async () => {
      queryRaw.mockResolvedValueOnce([pendingRow({ total_count: 57n })]).mockResolvedValueOnce([]);

      const result = await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR, limit: 1 });

      expect(result.total).toBe(57);
    });

    it('turns the bigint counts into numbers', async () => {
      queryRaw.mockResolvedValueOnce([pendingRow()]).mockResolvedValueOnce([
        { tsl_src_module: 'SALES', tsl_src_doc_type: 'SALE_BILL', tsl_to_status: 'DRAFT', n: 2n },
        {
          tsl_src_module: 'INVENTORY',
          tsl_src_doc_type: 'STOCK_TRANSFER',
          tsl_to_status: 'IN_TRANSIT',
          n: 1n,
        },
      ]);

      const result = await service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR });

      expect(result.counts).toEqual([
        { srcModule: 'SALES', srcDocType: 'SALE_BILL', status: 'DRAFT', count: 2 },
        { srcModule: 'INVENTORY', srcDocType: 'STOCK_TRANSFER', status: 'IN_TRANSIT', count: 1 },
      ]);
    });

    it('answers nothing pending with empty lists and a zero total', async () => {
      await expect(service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR })).resolves.toEqual({
        items: [],
        counts: [],
        total: 0,
      });
    });

    it('lets a query failure through', async () => {
      const failure = new Error('connection reset');
      queryRaw.mockRejectedValueOnce(failure);

      await expect(service.pending({ companyId: COMPANY_ID, accYear: ACC_YEAR })).rejects.toBe(
        failure,
      );
    });
  });

  it('counts exactly the four not-done statuses as pending', () => {
    expect([...PENDING_STATUSES]).toEqual(['DRAFT', 'HELD', 'CONFIRMED', 'IN_TRANSIT']);
  });
});
