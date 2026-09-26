import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import {
  cancelStockVoucher,
  postStockVoucher,
} from '../stock-voucher/stock-voucher-posting.helper';
import { StockPostingService } from './stock-posting.service';
import { StockVoucherSource } from './stock-voucher.source';

// The seven phases are the helper's and have their own suites; here only the
// door is under test — what the service checks BEFORE it lets a document in.
jest.mock('../stock-voucher/stock-voucher-posting.helper', () => ({
  postStockVoucher: jest.fn(),
  cancelStockVoucher: jest.fn(),
}));

const SVH_ID = '11111111-1111-4111-8111-111111111111';
const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const BRANCH_ID = '33333333-3333-4333-8333-333333333333';
const GODOWN_ID = '44444444-4444-4444-8444-444444444444';
const COUNT_ID = '55555555-5555-4555-8555-555555555555';
const ACTOR = '66666666-6666-4666-8666-666666666666';
const ACC_YEAR = '2026-2027';

const RULES = {
  voucherType: 'OPENING',
  postFunction: 'stock.fn_svh_post',
} as unknown as StockVoucherTypeRules;

const source = () =>
  new StockVoucherSource({
    svhId: SVH_ID,
    accYear: ACC_YEAR,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    rules: RULES,
  });

/**
 * A transaction client that answers the three reads `assertNotFrozen` makes,
 * keyed on what each query is FOR rather than on call order, so a reordering
 * inside the service does not silently turn this into a test of nothing.
 */
function txWith(opts: {
  docDatetime: Date | null;
  godowns: string[];
  frozenBy?: { from: Date; to: Date } | null;
}) {
  const queryRaw = jest.fn((strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('SELECT svh_doc_datetime')) {
      return Promise.resolve([{ svh_doc_datetime: opts.docDatetime }]);
    }
    if (sql.includes('SELECT DISTINCT g.godown_id')) {
      return Promise.resolve(opts.godowns.map((godown_id) => ({ godown_id })));
    }
    if (sql.includes('svh_freeze_stock = true')) {
      return Promise.resolve(
        opts.frozenBy
          ? [
              {
                svh_id: COUNT_ID,
                svh_refno: 'PHY0007',
                godown_id: GODOWN_ID,
                svh_freeze_from: opts.frozenBy.from,
                svh_freeze_to: opts.frozenBy.to,
              },
            ]
          : [],
      );
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  return { $queryRaw: queryRaw } as unknown as Parameters<StockPostingService['post']>[0] & {
    $queryRaw: jest.Mock;
  };
}

const window = { from: new Date('2026-09-21T09:00:00Z'), to: new Date('2026-09-21T12:00:00Z') };

describe('StockPostingService', () => {
  let service: StockPostingService;
  const postedOn = new Date('2026-09-21T14:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    (postStockVoucher as jest.Mock).mockResolvedValue(3);
    (cancelStockVoucher as jest.Mock).mockResolvedValue(3);
    service = new StockPostingService({} as PrismaService);
  });

  describe('post()', () => {
    it("runs the seven phases through the helper, inside the caller's transaction", async () => {
      const tx = txWith({ docDatetime: new Date('2026-09-21T14:00:00Z'), godowns: [GODOWN_ID] });

      await expect(service.post(tx, source(), { actor: ACTOR, postedOn })).resolves.toBe(3);

      expect(postStockVoucher).toHaveBeenCalledTimes(1);
      expect(postStockVoucher).toHaveBeenCalledWith(tx, {
        rules: RULES,
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        actor: ACTOR,
        postedOn,
      });
    });

    it('refuses a movement TIMED inside a freeze window with a 409, before any phase runs', async () => {
      const tx = txWith({
        docDatetime: new Date('2026-09-21T10:30:00Z'), // inside 09:00–12:00
        godowns: [GODOWN_ID],
        frozenBy: window,
      });

      const failure = service.post(tx, source(), { actor: ACTOR, postedOn });
      await expect(failure).rejects.toBeInstanceOf(ConflictException);
      await expect(failure).rejects.toThrow(/frozen for physical count PHY0007/);
      await expect(failure).rejects.toThrow(/Post or cancel the count first/);
      expect(postStockVoucher).not.toHaveBeenCalled();
    });

    it("asks the database about the MOVEMENT's timestamp, never about now()", async () => {
      const movedAt = new Date('2026-09-21T08:00:00Z'); // before the window, arriving at 14:00
      const tx = txWith({ docDatetime: movedAt, godowns: [GODOWN_ID], frozenBy: null });

      await service.post(tx, source(), { actor: ACTOR, postedOn });

      const freezeQuery = tx.$queryRaw.mock.calls.find(([strings]: [TemplateStringsArray]) =>
        strings.join('?').includes('svh_freeze_stock = true'),
      );
      expect(freezeQuery).toBeDefined();
      const [strings, ...params] = freezeQuery as [TemplateStringsArray, ...unknown[]];
      const sql = strings.join('?');
      // The window is compared against a bound parameter — the doc datetime —
      // and that parameter is what the source read, not the wall clock.
      expect(sql).toMatch(/\?::timestamptz BETWEEN c\.svh_freeze_from AND c\.svh_freeze_to/);
      expect(sql).not.toMatch(/now\(\)\s+BETWEEN/);
      expect(params).toContainEqual(movedAt);
      // …and the document's own id is excluded, so a count can post itself.
      expect(params).toContain(SVH_ID);
    });

    it('skips the guard when the document has no timestamp or touches no godown', async () => {
      const noTime = txWith({ docDatetime: null, godowns: [GODOWN_ID], frozenBy: window });
      await service.post(noTime, source(), { actor: ACTOR, postedOn });

      const noGodown = txWith({ docDatetime: postedOn, godowns: [], frozenBy: window });
      await service.post(noGodown, source(), { actor: ACTOR, postedOn });

      expect(postStockVoucher).toHaveBeenCalledTimes(2);
      for (const tx of [noTime, noGodown]) {
        const askedFreeze = tx.$queryRaw.mock.calls.some(([strings]: [TemplateStringsArray]) =>
          strings.join('?').includes('svh_freeze_stock = true'),
        );
        expect(askedFreeze).toBe(false);
      }
    });
  });

  describe('cancel()', () => {
    it("reverses through the helper with the reason, inside the caller's transaction", async () => {
      const tx = txWith({ docDatetime: postedOn, godowns: [GODOWN_ID] });
      const cancelledOn = new Date('2026-09-22T09:00:00Z');

      await expect(
        service.cancel(tx, source(), { actor: ACTOR, reason: 'keyed twice', cancelledOn }),
      ).resolves.toBe(3);

      expect(cancelStockVoucher).toHaveBeenCalledWith(tx, {
        rules: RULES,
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        actor: ACTOR,
        reason: 'keyed twice',
        cancelledOn,
      });
    });

    it('is held by the same freeze as a post — a reversal moves stock too', async () => {
      const tx = txWith({
        docDatetime: new Date('2026-09-21T11:00:00Z'),
        godowns: [GODOWN_ID],
        frozenBy: window,
      });

      await expect(
        service.cancel(tx, source(), { actor: ACTOR, reason: 'x', cancelledOn: postedOn }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(cancelStockVoucher).not.toHaveBeenCalled();
    });
  });
});
