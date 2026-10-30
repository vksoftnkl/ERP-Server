import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { PartyOutstandingService } from '../../../../reports/party-outstanding/party-outstanding.service';
import type {
  PartiesExportPayload,
  PartyRow,
} from '../../../../reports/party-outstanding/types/party-outstanding.types';
import { ProviderRequest } from '../print-data-provider.types';
import {
  PARTY_OUTSTANDING_PRINT_PROVIDERS,
  PartyOutstandingHeadProvider,
  PartyOutstandingPartiesProvider,
  PartyOutstandingPrintSource,
} from './party-outstanding.providers';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e202';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46e203';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e204';

const requestFor = (params: Record<string, unknown>, rowLimit = 500) =>
  ({
    context: {
      companyId: COMPANY_ID,
      branchId: '019c6f6c-be87-7a11-8905-36092c46e2ff',
      accYear: '2026-2027',
      docId: null,
      userId: USER_ID,
      deviceId: null,
    },
    params,
    lang: 'en-IN',
    rowLimit,
  }) as ProviderRequest;

const ANSWERS = { as_on: '2026-10-19', side: 'receivable' };

const partyRow = (overrides: Partial<PartyRow> = {}): PartyRow => ({
  partyId: PARTY_ID,
  name: 'Sri Lakshmi Stores',
  area: 'Salem',
  phone: '9876543210',
  creditDays: 30,
  creditLimit: '50000.00',
  bills: 3,
  owed: '125000.00',
  onAccount: '0.00',
  net: { amount: '125000.00', side: 'DR' },
  buckets: ['100000.00', '0.00', '25000.00', '0.00', '0.00'],
  overdue: '25000.00',
  oldestDays: 75,
  pdcInHand: '0.00',
  flags: [],
  ...overrides,
});

const payload = (overrides: Partial<PartiesExportPayload> = {}): PartiesExportPayload => ({
  shape: 'PARTIES',
  asOn: '2026-10-19',
  side: 'RECEIVABLE',
  isFuture: false,
  accYear: '2026-2027',
  bucketLabels: ['0-30', '31-60', '61-90', '91-180', '> 180'],
  printedAs: 'Receivables as on 19-10-2026',
  companyName: 'Vknex Traders',
  branchName: null,
  totalRows: 1,
  rows: [partyRow()],
  totals: {
    bills: 3,
    owed: '125000.00',
    onAccount: '0.00',
    net: { amount: '125000.00', side: 'DR' },
    buckets: ['100000.00', '0.00', '25000.00', '0.00', '0.00'],
    overdue: '25000.00',
    pdcInHand: '0.00',
  },
  tiles: {
    net: { amount: '125000.00', side: 'DR' },
    parties: 1,
    bills: 3,
    overdue: '25000.00',
    overduePctOfOwed: '20.00',
    aboveDays: { days: 90, amount: '0.00', parties: 0 },
    onAccount: '0.00',
    pdcInHand: { amount: '0.00', cheques: 0 },
    dueNext: { days: 7, amount: '5000.00', from: '2026-10-20', to: '2026-10-26' },
  },
  ...overrides,
});

describe('Party-wise Outstanding print providers', () => {
  let exportFn: jest.Mock;
  let queryRaw: jest.Mock;
  let source: PartyOutstandingPrintSource;

  beforeEach(() => {
    exportFn = jest.fn().mockResolvedValue(payload());
    queryRaw = jest.fn().mockResolvedValue([{ name: 'Cashier One' }]);
    source = new PartyOutstandingPrintSource(
      { export: exportFn } as unknown as PartyOutstandingService,
      { $queryRaw: queryRaw } as unknown as PrismaService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('ships the head and the party list', () => {
    expect(PARTY_OUTSTANDING_PRINT_PROVIDERS.map((Provider) => new Provider(source).code)).toEqual([
      'reports.party_outstanding.head',
      'reports.party_outstanding.parties',
    ]);
  });

  describe('PartyOutstandingPrintSource.query', () => {
    it("maps the prompts onto the report's export query, upper- and lower-casing the enums", async () => {
      const q = await source.query(
        requestFor({
          ...ANSWERS,
          area_id: AREA_ID,
          age_by: 'due_date',
          buckets: '30,60',
          only_overdue: true,
          min_due_days: 10,
          sort: 'NAME',
          dir: 'ASC',
        }),
      );

      expect(q).toMatchObject({
        companyId: COMPANY_ID,
        shape: 'PARTIES',
        asOn: '2026-10-19',
        side: 'RECEIVABLE',
        areaId: AREA_ID,
        ageBy: 'DUE_DATE',
        buckets: '30,60',
        onlyOverdue: true,
        minDueDays: 10,
        sort: 'name',
        dir: 'asc',
      });
    });

    it("never narrows to the session's branch: only filter_branch_id names a branch", async () => {
      const q = await source.query(requestFor(ANSWERS));

      expect(q.branchId).toBeUndefined();
    });

    it('drops blank answers rather than sending them as filters', async () => {
      const q = await source.query(requestFor({ ...ANSWERS, area_id: '   ', only_overdue: 'yes' }));

      // A DTO's class fields always exist (ES2022), so it is the value that must be unset.
      expect(q.areaId).toBeUndefined();
      expect(q.onlyOverdue).toBeUndefined();
    });

    it("refuses answers the report's own DTO refuses, quoting its words", async () => {
      await expect(source.query(requestFor({ as_on: '19/10/2026', side: 'sideways' }))).rejects.toThrow(
        /^The print's filters are not what Party-wise Outstanding takes: .*asOn must be YYYY-MM-DD/,
      );
    });

    it('refuses a print with no side', async () => {
      await expect(source.query(requestFor({ as_on: '2026-10-19' }))).rejects.toThrow(
        /not what Party-wise Outstanding takes/,
      );
    });
  });

  describe('PartyOutstandingPrintSource.parties', () => {
    it("re-words a report refusal with its detail sentences, not 'Unprocessable Entity'", async () => {
      exportFn.mockRejectedValue(
        new UnprocessableEntityException({
          success: false,
          message: 'Refused',
          errors: [
            { field: 'asOn', code: 'AS_ON_OUTSIDE_YEARS', message: 'asOn is outside every year.' },
            { field: 'side', code: 'NOT_FOR_PAYABLE', message: 'Area is Receivable only.' },
          ],
        }),
      );

      await expect(source.parties(requestFor(ANSWERS))).rejects.toThrow(
        'asOn is outside every year. Area is Receivable only.',
      );
    });

    it('passes a plain error message through', async () => {
      exportFn.mockRejectedValue(new Error('connection reset'));

      await expect(source.parties(requestFor(ANSWERS))).rejects.toThrow('connection reset');
    });
  });

  describe('PartyOutstandingPrintSource.printedBy', () => {
    it('looks the user up by id', async () => {
      await expect(source.printedBy(USER_ID)).resolves.toBe('Cashier One');
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it.each([null, 'not-a-uuid'])('asks nothing for a user id of %p', async (userId) => {
      await expect(source.printedBy(userId)).resolves.toBeNull();
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('answers null when the user row is gone', async () => {
      queryRaw.mockResolvedValue([]);

      await expect(source.printedBy(USER_ID)).resolves.toBeNull();
    });
  });

  describe('reports.party_outstanding.head', () => {
    it('lays the totals, tiles and ageing slots out as one row, stamped in IST', async () => {
      // 04:30 UTC is 10:00 in Asia/Kolkata.
      jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 19, 4, 30));

      const head = await new PartyOutstandingHeadProvider(source).resolve(
        requestFor({ ...ANSWERS, deduct_pdc: true }),
      );

      expect(head).toMatchObject({
        company_name: 'Vknex Traders',
        branch_name: null,
        branch_label: 'All branches',
        side_word: 'Receivable',
        title: 'PARTY-WISE OUTSTANDING — RECEIVABLES',
        as_on_text: '19-10-2026',
        age_by_text: 'Aged by bill date',
        bucket_count: 5,
        parties: 1,
        owed: 125000,
        net_amt: 125000,
        net_side: 'Dr',
        overdue: 25000,
        overdue_pct: '20.00',
        deduct_pdc: true,
        due_next_amount: 5000,
        due_next_from_text: '20-10-2026',
        due_next_to_text: '26-10-2026',
        printed_at: '19-10-2026 10:00',
        printed_by: 'Cashier One',
        label_0: '0-30',
        bucket_0: 100000,
        label_4: '> 180',
        bucket_4: 0,
        // Eight fixed slots, the unused ones blank.
        label_7: '',
        bucket_7: null,
      });
    });

    it('words a payable list as payables, with a credit side', async () => {
      exportFn.mockResolvedValue(
        payload({
          side: 'PAYABLE',
          totals: { ...payload().totals, net: { amount: '900.00', side: 'CR' } },
        }),
      );

      const head = await new PartyOutstandingHeadProvider(source).resolve(
        requestFor({ ...ANSWERS, side: 'payable', age_by: 'DUE_DATE' }),
      );

      expect(head).toMatchObject({
        side_word: 'Payable',
        title: 'PARTY-WISE OUTSTANDING — PAYABLES',
        net_side: 'Cr',
        age_by_text: 'Aged by due date',
      });
    });
  });

  describe('reports.party_outstanding.parties', () => {
    it('numbers the parties and caps them at the row limit', async () => {
      exportFn.mockResolvedValue(
        payload({ rows: [partyRow(), partyRow({ name: 'B' }), partyRow({ name: 'C' })] }),
      );

      const rows = await new PartyOutstandingPartiesProvider(source).resolve(
        requestFor(ANSWERS, 2),
      );

      expect(rows.map((row) => [row.sl_no, row.name])).toEqual([
        [1, 'Sri Lakshmi Stores'],
        [2, 'B'],
      ]);
    });

    it('turns the money text into numbers and builds the line under the party', async () => {
      const [row] = await new PartyOutstandingPartiesProvider(source).resolve(requestFor(ANSWERS));

      expect(row).toMatchObject({
        party_id: PARTY_ID,
        credit_limit: 50000,
        owed: 125000,
        net_side: 'Dr',
        flags_text: null,
        ageing_text: '0-30 1,00,000.00 · 61-90 25,000.00',
        sub_text:
          'Salem · Ph 9876543210 · 30 days credit · Ageing: 0-30 1,00,000.00 · 61-90 25,000.00',
        bucket_0: 100000,
        bucket_1: 0,
        bucket_5: null,
      });
    });

    it("words the flags as the screen's chips, the oldest bucket by its last edge", async () => {
      exportFn.mockResolvedValue(
        payload({
          rows: [
            partyRow({
              flags: ['CHQ_BOUNCED', 'OVER_180', 'ADVANCE', 'OVER_LIMIT'],
              pdcInHand: '1500.00',
              creditLimit: null,
            }),
          ],
        }),
      );

      const [row] = await new PartyOutstandingPartiesProvider(source).resolve(
        requestFor({ ...ANSWERS, buckets: '30 60 120' }),
      );

      expect(row.flags_text).toBe('CHQ BOUNCED · > 120 DAYS · ADVANCE · OVER LIMIT');
      expect(row.credit_limit).toBeNull();
      expect(row.sub_text).toMatch(/PDC in hand 1,500\.00$/);
    });

    it('labels the oldest bucket by the default edges when none are asked for', async () => {
      exportFn.mockResolvedValue(payload({ rows: [partyRow({ flags: ['OVER_180'] })] }));

      const [row] = await new PartyOutstandingPartiesProvider(source).resolve(requestFor(ANSWERS));

      expect(row.flags_text).toBe('> 180 DAYS');
    });

    it('leaves the line under a bare party empty', async () => {
      exportFn.mockResolvedValue(
        payload({
          rows: [
            partyRow({
              area: null,
              phone: null,
              creditDays: null,
              buckets: ['0.00'],
            }),
          ],
        }),
      );

      const [row] = await new PartyOutstandingPartiesProvider(source).resolve(requestFor(ANSWERS));

      expect(row).toMatchObject({ sub_text: null, ageing_text: null });
    });
  });
});
