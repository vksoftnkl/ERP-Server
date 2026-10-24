import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
import {
  cancelStockVoucher,
  postStockVoucher,
} from '../stock-voucher/stock-voucher-posting.helper';
import type { StockAccountsPostingService } from './stock-accounts-posting.service';
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
  postShape: 'SIMPLE',
} as unknown as StockVoucherTypeRules;

const POSTED = { rowsPosted: 3, status: 'POSTED', transitRows: 0, closedOut: null };

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
  let accounts: { postForVoucher: jest.Mock; reverseForVoucher: jest.Mock };
  const postedOn = new Date('2026-09-21T14:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    (postStockVoucher as jest.Mock).mockResolvedValue(POSTED);
    (cancelStockVoucher as jest.Mock).mockResolvedValue(3);
    // §1.9 — the accounts leg is the accounts service's; here only WHEN it is
    // asked matters.
    accounts = {
      postForVoucher: jest
        .fn()
        .mockResolvedValue({ voucherId: 'v1', voucherRefno: 'OPN0001', amount: 1, legCount: 2 }),
      reverseForVoucher: jest.fn().mockResolvedValue(null),
    };
    service = new StockPostingService(
      {} as PrismaService,
      accounts as unknown as StockAccountsPostingService,
    );
  });

  describe('post()', () => {
    it("runs the seven phases through the helper, inside the caller's transaction", async () => {
      const tx = txWith({ docDatetime: new Date('2026-09-21T14:00:00Z'), godowns: [GODOWN_ID] });

      await expect(service.post(tx, source(), { actor: ACTOR, postedOn })).resolves.toMatchObject({
        rowsPosted: 3,
        status: 'POSTED',
        accountsVoucherId: 'v1',
      });

      expect(postStockVoucher).toHaveBeenCalledTimes(1);
      expect(postStockVoucher).toHaveBeenCalledWith(tx, {
        rules: RULES,
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        actor: ACTOR,
        postedOn,
      });
    });

    it('asks for the accounts voucher with the document’s own identity once it POSTED', async () => {
      const tx = txWith({ docDatetime: postedOn, godowns: [GODOWN_ID] });
      const rules = { ...RULES, displayName: 'Opening stock' } as unknown as StockVoucherTypeRules;
      const named = new StockVoucherSource({
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        rules,
      });

      await service.post(tx, named, { actor: ACTOR, postedOn });

      expect(accounts.postForVoucher).toHaveBeenCalledWith(tx, {
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        voucherType: 'OPENING',
        displayName: 'Opening stock',
        actor: ACTOR,
        postedOn,
      });
    });

    it('reports no accounts voucher when the accounts side wrote none (PERIODIC, or zero value)', async () => {
      accounts.postForVoucher.mockResolvedValue(null);
      const tx = txWith({ docDatetime: postedOn, godowns: [GODOWN_ID] });

      await expect(service.post(tx, source(), { actor: ACTOR, postedOn })).resolves.toMatchObject({
        status: 'POSTED',
        accountsVoucherId: null,
      });
    });

    it("writes NO accounts leg for a sales document's shadow voucher — the bill posts its own COGS pair", async () => {
      const tx = txWith({ docDatetime: postedOn, godowns: [GODOWN_ID] });
      await service.post(tx, source(), {
        actor: ACTOR,
        postedOn,
        ledgerSource: { srcModule: 'SALES', srcDocType: 'SALE_BILL', srcRefno: 'bil00042' },
      });
      expect(accounts.postForVoucher).not.toHaveBeenCalled();
    });

    it('writes no accounts leg for a despatch that ended IN_TRANSIT', async () => {
      (postStockVoucher as jest.Mock).mockResolvedValue({ ...POSTED, status: 'IN_TRANSIT' });
      const tx = txWith({ docDatetime: postedOn, godowns: [GODOWN_ID] });
      const outcome = await service.post(tx, source(), { actor: ACTOR, postedOn });
      expect(outcome.status).toBe('IN_TRANSIT');
      expect(accounts.postForVoucher).not.toHaveBeenCalled();
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

    it('names the count by its id when it has no refno yet', async () => {
      const tx = txWith({
        docDatetime: new Date('2026-09-21T10:30:00Z'),
        godowns: [GODOWN_ID],
        frozenBy: window,
      });
      tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('SELECT svh_doc_datetime')) {
          return Promise.resolve([{ svh_doc_datetime: new Date('2026-09-21T10:30:00Z') }]);
        }
        if (sql.includes('SELECT DISTINCT g.godown_id')) {
          return Promise.resolve([{ godown_id: GODOWN_ID }]);
        }
        return Promise.resolve([
          {
            svh_id: COUNT_ID,
            svh_refno: null,
            godown_id: GODOWN_ID,
            svh_freeze_from: window.from,
            svh_freeze_to: window.to,
          },
        ]);
      });

      await expect(service.post(tx, source(), { actor: ACTOR, postedOn })).rejects.toThrow(
        // Notes 150 (minor): the shop's clock, 12-hour — 09:00Z is 02:30 PM IST.
        `frozen for physical count ${COUNT_ID} from 21-09-2026 02:30 PM to 21-09-2026 05:30 PM`,
      );
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

    it('mirrors the accounts voucher of a type that posts one, in the same transaction', async () => {
      const tx = txWith({ docDatetime: postedOn, godowns: [GODOWN_ID] });

      await service.cancel(tx, source(), {
        actor: ACTOR,
        reason: 'keyed twice',
        cancelledOn: postedOn,
      });

      expect(accounts.reverseForVoucher).toHaveBeenCalledWith(tx, {
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        voucherType: 'OPENING',
        reason: 'keyed twice',
        actor: ACTOR,
      });
    });

    it('leaves accounts alone for a sales shadow or a type that never posts a voucher', async () => {
      const shadow = txWith({ docDatetime: postedOn, godowns: [GODOWN_ID] });
      await service.cancel(shadow, source(), {
        actor: ACTOR,
        reason: 'bill cancelled',
        cancelledOn: postedOn,
        ledgerSource: { srcModule: 'SALES', srcDocType: 'SALE_BILL', srcRefno: 'bil00042' },
      });

      const transfer = new StockVoucherSource({
        svhId: SVH_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        rules: {
          voucherType: 'TRANSFER_OUT',
          postShape: 'TRANSFER_OUT',
        } as unknown as StockVoucherTypeRules,
      });
      await service.cancel(txWith({ docDatetime: postedOn, godowns: [GODOWN_ID] }), transfer, {
        actor: ACTOR,
        reason: 'wrong branch',
        cancelledOn: postedOn,
      });

      expect(cancelStockVoucher).toHaveBeenCalledTimes(2);
      expect(accounts.reverseForVoucher).not.toHaveBeenCalled();
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
