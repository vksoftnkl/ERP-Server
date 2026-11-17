import { Prisma } from '@prisma/client';
import { MobileBillService, billDayOf } from './mobile-bill.service';
import type { CreateMobileBillDto } from './dto/mobile-bill.dto';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const OTHER_CUSTOMER = '019f1dc6-7d53-7a5d-913b-66d57b891257';
const CUSTOMER = '019f659c-3942-7237-89b0-c4899603dd7a';
const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const DEV_ID = '01a12f63-5117-7a52-9e10-b5979d464059';
const LOGIN = '019e441b-6e48-7918-b246-b857ffb35db1';
const CLIENT_UUID = '3b241101-e2bb-4255-8caf-4136c566a962';
const SB_ID = '01a20000-0000-7000-8000-000000000001';

const dto = (over: Partial<CreateMobileBillDto> = {}): CreateMobileBillDto =>
  ({
    sbClientUuid: CLIENT_UUID,
    deviceUid: 'phone-1',
    sbCompanyId: COMPANY,
    sbCustId: CUSTOMER,
    sbCustName: 'ZT customer',
    sbPriceLevel: 1,
    sbUsrRefno: 'A1B2/2627/00001',
    sbBillAmt: 118,
    items: [{ sbiItemId: GODOWN, sbiItemUnitId: GODOWN, sbiGodownId: GODOWN }],
    ...over,
  }) as CreateMobileBillDto;

const billRow = (over: Record<string, unknown> = {}) => ({
  sbId: SB_ID,
  sbCompanyId: COMPANY,
  sbBranchId: BRANCH,
  sbAccYear: '2026-2027',
  sbBillRefno: 'bil01300',
  sbUsrRefno: 'A1B2/2627/00001',
  sbBillDate: '2026-11-17',
  sbBillAmt: new Prisma.Decimal('118'),
  sbStatus: 'POSTED',
  sbIsDeleted: false,
  sbCustId: CUSTOMER,
  ...over,
});

/** A transaction that answers each raw read by what it reads. */
function scriptedTx(script: { stored: object | null; godowns: string[] }) {
  const executed: { sql: string; values: unknown[] }[] = [];
  let stamped = false;
  const sqlOf = (strings: TemplateStringsArray) => strings.join('?');
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = sqlOf(strings);
      if (sql.includes('pg_advisory_xact_lock')) return [{ locked: 1 }];
      if (sql.includes('FROM sales.sale_bill sb')) {
        const where = values[0] as Prisma.Sql;
        const byUuid = where.values.includes(CLIENT_UUID);
        if (byUuid) return script.stored ? [script.stored] : [];
        return stamped ? [billRow()] : [];
      }
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
      if (sql.includes('FROM inventory.godown_locations'))
        return script.godowns.map((id) => ({ id }));
      throw new Error(`unscripted read: ${sql}`);
    }),
    $executeRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      executed.push({ sql: sqlOf(strings), values });
      stamped = true;
      return 1;
    }),
  };
  return { tx, executed };
}

function build(script: { stored: object | null; godowns: string[] }) {
  const { tx, executed } = scriptedTx(script);
  const order: string[] = [];
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      const out = await fn(tx);
      order.push('commit');
      return out;
    }),
    $queryRaw: tx.$queryRaw,
  };
  const lifecycle = {
    saveAndPostInTx: jest.fn(async () => {
      order.push('saveAndPost');
      return {
        keys: { sbId: SB_ID, sbCompanyId: COMPANY, sbBranchId: BRANCH, sbAccYear: '2026-2027' },
        posted: { gdrId: null },
      };
    }),
    afterSaveAndPost: jest.fn(() => order.push('afterSaveAndPost')),
  };
  const bills = { throwIfDuplicate: jest.fn() };
  const ctx = { getUserId: () => LOGIN };
  const service = new MobileBillService(
    prisma as never,
    ctx as never,
    bills as never,
    lifecycle as never,
  );
  return { service, lifecycle, executed, order, bills };
}

describe('billDayOf', () => {
  it('reads the date part of what the phone sent, else today', () => {
    expect(billDayOf('2026-11-16T23:59:00+05:30', '2026-11-17')).toBe('2026-11-16');
    expect(billDayOf(undefined, '2026-11-17')).toBe('2026-11-17');
  });
});

describe('MobileBillService.create', () => {
  it('saves and posts through the desktop one-call path with the server-filled scope, then stamps the uuid', async () => {
    const { service, lifecycle, executed, order } = build({ stored: null, godowns: [GODOWN] });
    const answer = await service.create(dto({ sbBillDate: '2026-11-17T09:00:00+05:30' }));

    expect(lifecycle.saveAndPostInTx).toHaveBeenCalledTimes(1);
    const sent = (lifecycle.saveAndPostInTx.mock.calls[0] as unknown[])[1] as Record<
      string,
      unknown
    >;
    expect(sent).toEqual(
      expect.objectContaining({
        sbCompanyId: COMPANY,
        sbBranchId: BRANCH,
        sbAccYear: '2026-2027',
        sbDeviceType: 'MOBILE',
        sbDeviceId: DEV_ID,
        sbUserId: LOGIN,
        sbBillType: 'CREDIT',
        sbBillDate: '2026-11-17',
        sbUsrRefno: 'A1B2/2627/00001',
        post: true,
      }),
    );
    expect(sent).not.toHaveProperty('sbClientUuid');
    expect(sent).not.toHaveProperty('deviceUid');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE sales.sale_bill');
    expect(executed[0].sql).toContain('sb_client_uuid');
    expect(executed[0].values).toEqual([CLIENT_UUID, SB_ID, '2026-2027']);
    // The GST queue only after the commit.
    expect(order).toEqual(['saveAndPost', 'commit', 'afterSaveAndPost']);
    expect(answer).toEqual({
      sbId: SB_ID,
      sbCompanyId: COMPANY,
      sbBranchId: BRANCH,
      sbAccYear: '2026-2027',
      sbBillRefno: 'bil01300',
      sbUsrRefno: 'A1B2/2627/00001',
      sbBillDate: '2026-11-17',
      sbBillAmt: '118.00',
      sbStatus: 'POSTED',
      duplicate: false,
      sbIsDeleted: false,
    });
  });

  it('a resend answers the stored bill and writes nothing', async () => {
    const { service, lifecycle, executed, order } = build({
      stored: billRow({ sbStatus: 'CANCELLED' }),
      godowns: [GODOWN],
    });
    const answer = await service.create(dto());
    expect(answer).toEqual(expect.objectContaining({ duplicate: true, sbStatus: 'CANCELLED' }));
    expect(lifecycle.saveAndPostInTx).not.toHaveBeenCalled();
    expect(executed).toHaveLength(0);
    expect(order).toEqual(['commit']);
  });

  it('the same uuid on another customer is 409 MOBILE_CLIENT_UUID_REUSED', async () => {
    const { service, lifecycle } = build({ stored: billRow(), godowns: [GODOWN] });
    await expect(service.create(dto({ sbCustId: OTHER_CUSTOMER }))).rejects.toMatchObject({
      status: 409,
      response: { errors: [expect.objectContaining({ code: 'MOBILE_CLIENT_UUID_REUSED' })] },
    });
    expect(lifecycle.saveAndPostInTx).not.toHaveBeenCalled();
  });

  it('a line on a godown that is not the branch’s live one is 422 MOBILE_GODOWN_INVALID, before any save', async () => {
    const { service, lifecycle } = build({ stored: null, godowns: [] });
    await expect(service.create(dto())).rejects.toMatchObject({
      status: 422,
      response: {
        errors: [
          expect.objectContaining({ field: 'items.0.sbiGodownId', code: 'MOBILE_GODOWN_INVALID' }),
        ],
      },
    });
    expect(lifecycle.saveAndPostInTx).not.toHaveBeenCalled();
  });

  it('a client-uuid clash that slipped past the lock answers the winner’s bill', async () => {
    const { service, bills } = build({ stored: null, godowns: [GODOWN] });
    const clash = Object.assign(new Error('unique'), {
      code: 'P2010',
      meta: {
        code: '23505',
        message: 'Key (sb_company_id, sb_client_uuid, sb_acc_year)=(…) already exists.',
      },
    });
    const winner = billRow();
    let calls = 0;
    (service as unknown as { prisma: { $transaction: unknown; $queryRaw: unknown } }).prisma = {
      $transaction: jest.fn(async () => {
        throw clash;
      }),
      $queryRaw: jest.fn(async () => (calls++ === 0 ? [winner] : [])),
    };
    await expect(service.create(dto())).resolves.toEqual(
      expect.objectContaining({ sbId: SB_ID, duplicate: true }),
    );
    expect(bills.throwIfDuplicate).not.toHaveBeenCalled();
  });
});
