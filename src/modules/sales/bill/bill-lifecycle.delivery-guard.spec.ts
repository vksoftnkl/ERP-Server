import { Prisma } from '@prisma/client';
import { BillLifecycleService } from './bill-lifecycle.service';

/**
 * §8.4 item 3 / C7 — the delivery guard sits BEFORE the IRN step: a bill whose
 * goods left the godown is refused (BILL_DELIVERED_CANCEL) without the IRN
 * ever being cancelled at the portal.
 */
jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual('../posting/sales.guards'),
  assertAccYearWritable: jest.fn().mockResolvedValue(undefined),
  loadDayClosed: jest.fn().mockResolvedValue(false),
  assertCancellable: jest.fn().mockResolvedValue(undefined),
  loadDeclaredLocks: jest.fn().mockResolvedValue({ irnLive: true, ewbLive: false }),
}));
jest.mock('./bill-pdc-posting.helper', () => ({
  ...jest.requireActual('./bill-pdc-posting.helper'),
  assertBillPdcHeld: jest.fn().mockResolvedValue(undefined),
}));

const D = (v: number) => new Prisma.Decimal(v);
const BILL = {
  sbId: '01a1e000-0000-7000-8000-000000000001',
  sbAccYear: '2026-2027',
  sbCompanyId: 'co',
  sbBranchId: 'br',
  sbBillRefno: 'bil00042',
  sbBillDate: new Date('2026-11-15T00:00:00Z'),
  sbDeliveryMode: 'PICKUP',
  sbDeliveryStatus: 'PART',
  sbDocRegisterId: 'gdr',
};

function harness(given: number) {
  const svc = Object.create(BillLifecycleService.prototype) as Record<string, unknown>;
  const cancelIrn = jest.fn().mockResolvedValue(undefined);
  Object.assign(svc, {
    deliveryPending: {
      linesOfBills: jest.fn().mockResolvedValue([
        { billItemId: 'sbi-1', lineNo: 1, givenQty: D(given), settledQty: D(given), billedQty: D(10), eligible: true },
      ]),
    },
    docBlocks: { gstRows: jest.fn().mockResolvedValue({ irnGeneratedOn: new Date() }) },
    statutory: { withinCancelWindow: jest.fn().mockResolvedValue({ within: true }) },
    gst: { cancelIrn, cancelEwb: jest.fn() },
  });
  const tx = { $queryRaw: jest.fn().mockResolvedValue([{ refno: 'DN/2026-2027/D3/00042', at: new Date() }]) };
  const run = () =>
    (svc as unknown as { assertUnwindable: (...a: unknown[]) => Promise<void> }).assertUnwindable(
      tx,
      BILL,
      {},
      'why',
      'cancel',
    );
  return { run, cancelIrn };
}

describe('bill cancel / void: the delivery guard runs before the IRN cancel (C7)', () => {
  it('goods given → BILL_DELIVERED_CANCEL and the IRN is NOT cancelled', async () => {
    const h = harness(4);
    await expect(h.run()).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'BILL_DELIVERED_CANCEL' })] },
    });
    expect(h.cancelIrn).not.toHaveBeenCalled();
  });

  it('nothing given → the IRN step runs as before', async () => {
    const h = harness(0);
    await h.run();
    expect(h.cancelIrn).toHaveBeenCalledTimes(1);
  });
});
