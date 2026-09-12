import { PhysicalStockVoucherController } from './physical-stock-voucher.controller';
import type { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type {
  StockVoucherCancelResult,
  StockVoucherLinePayload,
  StockVoucherPostResult,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46fe10';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const ACC_YEAR = '2026-2027';

const line = (lineNo: number, diffQty: number | null): StockVoucherLinePayload =>
  ({ lineNo, diffQty }) as StockVoucherLinePayload;

const postResult = (lines: StockVoucherLinePayload[], rowsPosted: number): StockVoucherPostResult =>
  ({
    header: { svhId: SVH_ID, status: 'POSTED', postedOn: '2026-06-30T18:00:00Z' },
    lines,
    rowsPosted,
    status: 'POSTED',
    postedOn: '2026-06-30T18:00:00Z',
  }) as unknown as StockVoucherPostResult;

const cancelResult = (rowsReversed: number): StockVoucherCancelResult =>
  ({
    header: { svhId: SVH_ID, status: 'CANCELLED' },
    lines: [],
    rowsReversed,
    status: 'CANCELLED',
    cancelledOn: '2026-06-30T18:00:00Z',
  }) as unknown as StockVoucherCancelResult;

describe('PhysicalStockVoucherController', () => {
  let service: {
    post: jest.Mock;
    cancel: jest.Mock;
    countSheet: jest.Mock;
    variance: jest.Mock;
  };
  let controller: PhysicalStockVoucherController;

  beforeEach(() => {
    service = { post: jest.fn(), cancel: jest.fn(), countSheet: jest.fn(), variance: jest.fn() };
    controller = new PhysicalStockVoucherController(service as unknown as StockVoucherService);
  });

  const post = () =>
    controller.post({
      svhId: SVH_ID,
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
    });

  /**
   * §3.6 — the whole point of the wording. A count where every line agrees
   * returns 0 from fn_svh_post and still closes POSTED. "posted — 0 ledger
   * rows" reads like a failure on the one document type where it is the best
   * possible outcome.
   */
  it('says how many lines varied, not how many ledger rows were written', async () => {
    // The captured run: MILK agreed, SALT was short 2, SUGAR over 3.
    service.post.mockResolvedValue(postResult([line(1, 0), line(2, -2), line(3, 3)], 2));

    const response = await post();

    expect(response.message).toBe('Physical stock count posted — 2 of 3 lines had a variance');
    // The honest number stays in the payload for anyone who wants it.
    expect(response.data.rowsPosted).toBe(2);
  });

  it('calls a count where everything agreed a success, and says so', async () => {
    service.post.mockResolvedValue(postResult([line(1, 0), line(2, 0)], 0));

    const response = await post();

    expect(response.success).toBe(true);
    expect(response.message).toBe('Physical stock count posted — all 2 lines agreed with the book');
    expect(response.data.status).toBe('POSTED');
  });

  it('pins PHYSICAL, and hands the service a record no payload can reach', async () => {
    service.post.mockResolvedValue(postResult([line(1, -1)], 1));

    await post();

    // jest's mock.calls is any[][]; naming the tuple is what lets the
    // assertions below read as type-checked field accesses rather than as
    // unsafe member access on `any`.
    const [rules] = service.post.mock.calls[0] as [StockVoucherTypeRules];
    expect(rules.voucherType).toBe('PHYSICAL');
    expect(rules.typeCode).toBe('PHY');
    // The four fields that make a count behave differently from an opening.
    expect(rules.quantityMode).toBe('COUNT');
    expect(rules.defaultRateSource).toBe('AVG_COST');
    expect(rules.allowsRepeatHolding).toBe(true);
    expect(rules.ledgerTxnTypes).toEqual(['PHYSICAL_PLUS', 'PHYSICAL_MINUS']);
  });

  it('reports an empty variance report as agreement, not as an empty result', async () => {
    service.variance.mockResolvedValue({
      items: [],
      meta: { limit: 200, offset: 0, count: 0 },
    });

    const response = await controller.variance({
      svhId: SVH_ID,
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
    });

    expect(response.message).toBe('Every line agreed — the count posted no ledger rows');
  });

  /**
   * The same wording problem as the post message, on the other route: a
   * cancelled DRAFT reverses nothing because nothing had posted, and
   * "cancelled — 0 reversal rows" reads like a failure on the outcome that is
   * now the ordinary way to abandon a count sheet and release its freeze.
   */
  describe('cancel', () => {
    const cancel = () =>
      controller.cancel({
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        reason: 'counter went home',
      });

    it('does not report a cancelled DRAFT as 0 reversal rows', async () => {
      service.cancel.mockResolvedValue(cancelResult(0));

      const response = await cancel();

      expect(response.success).toBe(true);
      expect(response.message).toBe(
        'Physical stock count cancelled successfully — no variance had posted, so nothing was reversed',
      );
      expect(response.data.rowsReversed).toBe(0);
    });

    it('counts the reversal rows when a POSTED count is cancelled', async () => {
      service.cancel.mockResolvedValue(cancelResult(2));

      const response = await cancel();

      expect(response.message).toBe(
        'Physical stock count cancelled successfully — 2 reversal rows',
      );
    });

    it('pins PHYSICAL on cancel too, and passes the reason through', async () => {
      service.cancel.mockResolvedValue(cancelResult(0));

      await cancel();

      const [rules, , , reason] = service.cancel.mock.calls[0] as [
        StockVoucherTypeRules,
        string,
        string,
        string,
      ];
      expect(rules.voucherType).toBe('PHYSICAL');
      // The generic entry point is what makes the draft path reachable at all:
      // the service refuses a draft cancellation on any type whose
      // postFunction is a transfer's.
      expect(rules.postFunction).toBe('stock.fn_svh_post');
      expect(reason).toBe('counter went home');
    });
  });
});
