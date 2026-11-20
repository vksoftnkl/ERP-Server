import { Prisma } from '@prisma/client';
import { MobileReceiptStatusService, phoneChequeStatus } from './mobile-receipt-status.service';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const DEV_ID = '01a12f63-5117-7a52-9e10-b5979d464059';
const AS_OF = new Date('2026-11-19T07:47:10.249Z');

const row = (over: Record<string, unknown> = {}) => ({
  avhClientUuid: '3b241101-e2bb-4255-8caf-4136c566a962',
  avhVoucherId: '01a20000-0000-7000-8000-0000000000aa',
  avhAccYear: '2026-2027',
  avhVoucherRefno: 'rct00126',
  avhVoucherStatus: 'POSTED',
  statusOn: new Date('2026-11-19T07:51:00.000Z'),
  cancelReason: null,
  updatedOn: new Date('2026-11-19T07:51:51.205Z'),
  total: 3,
  pdc: [
    {
      voucherId: '01a1f2ca-5e80-729c-b6d4-87956ec680c8',
      voucherRefno: 'rct00127',
      instrumentNo: 'Z1',
      chequeDate: '2026-11-29',
      amount: '50.00',
      houseStatus: 'DEPOSITED',
      isPostDated: true,
    },
  ],
  ...over,
});

function make(pages: Record<string, unknown>[][]) {
  const reads: { sql: string; values: unknown[] }[] = [];
  let page = 0;
  const prisma = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      reads.push({ sql, values });
      if (sql.includes('FROM public.companys'))
        return [{ compId: COMPANY, compGstApplicable: true }];
      if (sql.includes('FROM fixed.device_master'))
        return [
          {
            devId: DEV_ID,
            devCode: 'P1',
            devCompanyId: COMPANY,
            devBranchId: null,
            devIsActive: true,
            devIsBlocked: false,
            devBlockReason: null,
          },
        ];
      if (sql.includes('clock_timestamp()')) return [{ asOf: AS_OF }];
      if (sql.includes('WITH mine AS')) return pages[page++] ?? [];
      throw new Error(`unscripted read: ${sql}`);
    }),
  };
  return { service: new MobileReceiptStatusService(prisma as never), reads };
}

describe('phoneChequeStatus', () => {
  it.each([
    ['HELD', 'HELD'],
    ['DEPOSITED', 'HELD'],
    ['CLEARED', 'CLEARED'],
    ['BOUNCED', 'BOUNCED'],
    ['RETURNED', 'CANCELLED'],
    ['CANCELLED', 'CANCELLED'],
    ['REPLACED', 'CANCELLED'],
  ])('%s reads %s on the phone', (house, phone) => {
    expect(phoneChequeStatus(house)).toBe(phone);
  });
});

describe('MobileReceiptStatusService.status', () => {
  it("this phone's receipts with their cheques; cancelled ones carry when and why", async () => {
    const { service, reads } = make([
      [
        row(),
        row({
          avhVoucherId: 'v2',
          avhVoucherStatus: 'CANCELLED',
          cancelReason: 'WRONG PARTY',
          pdc: [],
        }),
      ],
    ]);
    const out = await service.status({ companyId: COMPANY, deviceUid: 'phone-1', pageSize: 2 });
    expect(out).toEqual({
      items: [
        {
          avhClientUuid: '3b241101-e2bb-4255-8caf-4136c566a962',
          avhVoucherId: '01a20000-0000-7000-8000-0000000000aa',
          avhAccYear: '2026-2027',
          avhVoucherRefno: 'rct00126',
          avhVoucherStatus: 'POSTED',
          cancelledOn: null,
          cancelReason: null,
          pdc: [
            {
              voucherId: '01a1f2ca-5e80-729c-b6d4-87956ec680c8',
              voucherRefno: 'rct00127',
              instrumentNo: 'Z1',
              chequeDate: '2026-11-29',
              amount: '50.00',
              status: 'HELD',
              houseStatus: 'DEPOSITED',
              isPostDated: true,
            },
          ],
          updatedOn: '2026-11-19T07:51:51.205Z',
        },
        expect.objectContaining({
          avhVoucherStatus: 'CANCELLED',
          cancelledOn: '2026-11-19T07:51:00.000Z',
          cancelReason: 'WRONG PARTY',
        }),
      ],
      total: 3,
      page: 1,
      pageSize: 2,
      hasMore: true,
      companyId: COMPANY,
      asOf: AS_OF.toISOString(),
    });
    const main = reads.find((r) => r.sql.includes('WITH mine AS'))!;
    // this phone's device, no since filter, the page window
    expect(main.values).toContain(DEV_ID);
    expect(main.sql).not.toContain('x.updated_on >=');
    expect(main.values.slice(-2)).toEqual([2, 0]);
  });

  it('since is inclusive (>=); asOf overlaps five minutes back', async () => {
    const { service, reads } = make([[row({ total: 1 })]]);
    const out = await service.status({
      companyId: COMPANY,
      deviceUid: 'phone-1',
      since: '2026-11-19T07:00:00.000Z',
    });
    expect(out.hasMore).toBe(false);
    const main = reads.find((r) => r.sql.includes('WITH mine AS'))!;
    const since = main.values.find(
      (v) => typeof v === 'object' && v !== null && 'strings' in v,
    ) as Prisma.Sql;
    expect(since.sql).toContain('x.updated_on >=');
    expect(since.values).toEqual(['2026-11-19T07:00:00.000Z']);
    const clock = reads.find((r) => r.sql.includes('clock_timestamp()'))!;
    expect(clock.values).toEqual([5]);
  });

  it('a page past the end still counts them all', async () => {
    const { service } = make([[], [row({ total: 7 })]]);
    const out = await service.status({ companyId: COMPANY, deviceUid: 'phone-1', page: 9 });
    expect(out).toEqual(expect.objectContaining({ items: [], total: 7, hasMore: false, page: 9 }));
  });
});
