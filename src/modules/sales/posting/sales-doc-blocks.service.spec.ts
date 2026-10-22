import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { SalesDocBlocksService, type DocPostingFacts } from './sales-doc-blocks.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46ad01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46ad02';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46ad03';
const GDR_ID = '019c6f6c-be87-7a11-8905-36092c46ad04';
const ACK_ON = new Date('2026-10-19T05:00:00.000Z');
const EWB_ON = new Date('2026-10-19T06:00:00.000Z');
const EWB_UPTO = new Date('2026-10-20T18:29:59.000Z');
const EWB_EXTENDED = new Date('2026-10-22T18:29:59.000Z');
const POSTED_ON = new Date('2026-10-19T04:45:00.000Z');

const facts = (overrides: Partial<DocPostingFacts> = {}): DocPostingFacts => ({
  status: 'POSTED',
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: '2026-2027',
  docDate: '2026-10-19',
  voucherId: VOUCHER_ID,
  registerId: GDR_ID,
  cogsAmt: 412.5,
  ...overrides,
});

const gstRow = (overrides: Record<string, unknown> = {}) => ({
  gde_status: null,
  gde_irn: null,
  gde_ack_no: null,
  gde_ack_on: null,
  gde_last_message: null,
  gdw_status: null,
  gdw_no: null,
  gdw_vehicle_no: null,
  gdw_generated_on: null,
  gdw_valid_upto: null,
  gdw_extended_upto: null,
  gdw_last_message: null,
  ...overrides,
});

/**
 * A client whose `$queryRaw` answers by the table the statement reads. The
 * day-close reads answer "open" unless `dayClosed` says otherwise.
 */
function clientFor(opts: {
  gst?: Record<string, unknown> | null;
  voucher?: { avh_voucher_refno: string | null; avh_posted_on: Date | null } | null;
  dayClosed?: boolean;
}) {
  const queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('acc_voucher_doc_einvoice')) return opts.gst ? [opts.gst] : [];
    if (sql.includes('acc_voucher_header')) return opts.voucher ? [opts.voucher] : [];
    if (sql.includes('till_business_day')) return [{ n: opts.dayClosed ? 1 : 0 }];
    if (sql.includes('to_regclass')) return [{ tbl: null }];
    throw new Error(`unrouted SQL: ${sql.slice(0, 80)}`);
  });
  return { $queryRaw: queryRaw, $queryRawUnsafe: jest.fn() };
}

describe('SalesDocBlocksService', () => {
  let statutory: { withinCancelWindow: jest.Mock };

  const serviceOn = (client: ReturnType<typeof clientFor>) =>
    new SalesDocBlocksService(client as unknown as PrismaService, statutory as never);

  beforeEach(() => {
    statutory = {
      withinCancelWindow: jest.fn().mockResolvedValue({
        limit: { value: 24 },
        within: true,
        hoursElapsed: 1,
      }),
    };
  });

  it('answers NA blocks and reads no GST row for a document with no register yet', async () => {
    const client = clientFor({ voucher: null });

    const { posting, locks } = await serviceOn(client).build(
      facts({ status: 'DRAFT', registerId: null, voucherId: null }),
    );

    expect(posting).toEqual({
      voucherId: null,
      voucherRefno: null,
      postedOn: null,
      registerId: null,
      cogsAmt: 412.5,
      loyaltyEarned: 0,
      loyaltyRedeemed: 0,
      irn: { status: 'NA', number: null, ackNo: null, ackOn: null, message: null },
      ewb: {
        status: 'NA',
        number: null,
        generatedOn: null,
        validUpto: null,
        message: null,
        vehicleNo: null,
      },
    });
    expect(locks).toEqual({
      returns: 0,
      allocations: 0,
      dayClosed: false,
      irnLive: false,
      ewbLive: false,
      irnCancelWindowUntil: null,
      ewbValidUpto: null,
      editable: { document: true, transportBand: true },
    });
    const sql = client.$queryRaw.mock.calls.map(([s]) => s.join('?'));
    expect(sql.some((s) => s.includes('acc_voucher_doc_einvoice'))).toBe(false);
    expect(sql.some((s) => s.includes('acc_voucher_header'))).toBe(false);
  });

  it('reads the voucher refno and posting instant, and carries the loyalty and lock counts', async () => {
    const client = clientFor({
      gst: gstRow(),
      voucher: { avh_voucher_refno: 'SV00042', avh_posted_on: POSTED_ON },
    });

    const { posting, locks } = await serviceOn(client).build(
      facts({ loyaltyEarned: 12, loyaltyRedeemed: 5, returns: 1, allocations: 2 }),
    );

    expect(posting).toMatchObject({
      voucherRefno: 'SV00042',
      postedOn: POSTED_ON.toISOString(),
      loyaltyEarned: 12,
      loyaltyRedeemed: 5,
    });
    expect(locks).toMatchObject({ returns: 1, allocations: 2 });
    const voucherCall = client.$queryRaw.mock.calls.find(([s]) =>
      s.join('?').includes('acc_voucher_header'),
    );
    expect(voucherCall?.slice(1)).toEqual([VOUCHER_ID, '2026-2027']);
  });

  it('locks a live IRN: content and band frozen, the cancel window from the statutory hours', async () => {
    const client = clientFor({
      gst: gstRow({
        gde_status: 'generated',
        gde_irn: 'IRN-1',
        gde_ack_no: 'ACK-1',
        gde_ack_on: ACK_ON,
        gde_last_message: 'ok',
      }),
      voucher: null,
    });

    const { posting, locks } = await serviceOn(client).build(facts());

    expect(posting.irn).toEqual({
      status: 'GENERATED',
      number: 'IRN-1',
      ackNo: 'ACK-1',
      ackOn: ACK_ON.toISOString(),
      message: 'ok',
    });
    expect(statutory.withinCancelWindow).toHaveBeenCalledWith(
      COMPANY_ID,
      'IRN',
      ACK_ON,
      '2026-10-19',
      expect.any(Date),
      client,
    );
    expect(locks).toMatchObject({
      irnLive: true,
      ewbLive: false,
      irnCancelWindowUntil: new Date(ACK_ON.getTime() + 24 * 3_600_000).toISOString(),
      editable: { document: false, transportBand: false },
    });
  });

  it('gives no cancel window when the statutory pack states no hours', async () => {
    statutory.withinCancelWindow.mockResolvedValue({ limit: null, within: true, hoursElapsed: 1 });
    const client = clientFor({ gst: gstRow({ gde_status: 'GENERATED', gde_ack_on: ACK_ON }) });

    const { locks } = await serviceOn(client).build(facts());

    expect(locks.irnLive).toBe(true);
    expect(locks.irnCancelWindowUntil).toBeNull();
  });

  it('asks for no window when the IRN is live but carries no acknowledgement time', async () => {
    const client = clientFor({ gst: gstRow({ gde_status: 'GENERATED' }) });

    const { locks } = await serviceOn(client).build(facts());

    expect(statutory.withinCancelWindow).not.toHaveBeenCalled();
    expect(locks.irnCancelWindowUntil).toBeNull();
  });

  it('reads a live e-way bill, preferring its extended validity, and freezes the band', async () => {
    const client = clientFor({
      gst: gstRow({
        gdw_status: 'GENERATED',
        gdw_no: 'EWB-9',
        gdw_vehicle_no: 'TN01AB1234',
        gdw_generated_on: EWB_ON,
        gdw_valid_upto: EWB_UPTO,
        gdw_extended_upto: EWB_EXTENDED,
        gdw_last_message: 'extended',
      }),
    });

    const { posting, locks } = await serviceOn(client).build(facts());

    expect(posting.ewb).toEqual({
      status: 'GENERATED',
      number: 'EWB-9',
      generatedOn: EWB_ON.toISOString(),
      validUpto: EWB_EXTENDED.toISOString(),
      message: 'extended',
      vehicleNo: 'TN01AB1234',
    });
    expect(locks).toMatchObject({
      irnLive: false,
      ewbLive: true,
      ewbValidUpto: EWB_EXTENDED.toISOString(),
      editable: { document: false, transportBand: false },
    });
    expect(statutory.withinCancelWindow).not.toHaveBeenCalled();
  });

  it('falls back to the original validity when the e-way bill was never extended', async () => {
    const client = clientFor({
      gst: gstRow({ gdw_status: 'GENERATED', gdw_valid_upto: EWB_UPTO }),
    });

    const { locks } = await serviceOn(client).build(facts());

    expect(locks.ewbValidUpto).toBe(EWB_UPTO.toISOString());
  });

  it.each([
    ['PENDING', 'PENDING'],
    ['cancelled', 'CANCELLED'],
    ['SOMETHING_NEW', 'NA'],
    [null, 'NA'],
  ])('reads a stored GST status %p as %p, and only GENERATED locks', async (stored, expected) => {
    const client = clientFor({ gst: gstRow({ gde_status: stored, gdw_status: stored }) });

    const { posting, locks } = await serviceOn(client).build(facts());

    expect(posting.irn.status).toBe(expected);
    expect(posting.ewb.status).toBe(expected);
    expect(locks).toMatchObject({ irnLive: false, ewbLive: false });
  });

  it.each([
    // status, amendable, document editable, band editable
    ['DRAFT', undefined, true, true],
    ['DRAFT', false, false, true],
    ['POSTED', undefined, false, true],
    ['CANCELLED', undefined, false, false],
  ] as const)(
    'a %s document (amendable %p) edits its content: %p, its band: %p',
    async (status, amendable, document, transportBand) => {
      const client = clientFor({ gst: gstRow() });

      const { locks } = await serviceOn(client).build(facts({ status, amendable }));

      expect(locks.editable).toEqual({ document, transportBand });
    },
  );

  it('reports a closed day from the till business day', async () => {
    const client = clientFor({ gst: null, dayClosed: true });

    const { locks } = await serviceOn(client).build(facts());

    expect(locks.dayClosed).toBe(true);
  });

  it('answers NA when the register has no GST rows yet', async () => {
    const client = clientFor({ gst: null });

    const rows = await serviceOn(client).gstRows(
      client as unknown as Prisma.TransactionClient,
      GDR_ID,
      '2026-2027',
    );

    expect(rows).toMatchObject({
      irn: { status: 'NA' },
      ewb: { status: 'NA' },
      irnGeneratedOn: null,
      ewbValidUpto: null,
    });
    expect(client.$queryRaw.mock.calls[0].slice(1)).toEqual([
      GDR_ID,
      '2026-2027',
      GDR_ID,
      '2026-2027',
    ]);
  });

  it('builds through the transaction client when given one', async () => {
    const tx = clientFor({ gst: gstRow() });
    const prisma = clientFor({});
    const service = new SalesDocBlocksService(prisma as unknown as PrismaService, statutory as never);

    await service.build(facts(), tx as unknown as Prisma.TransactionClient);

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
