import { OpenItemsService } from '../receipt/open-items.service';
import type { OpenCredit } from '../receipt/types/receipt-api.types';
import { TransactionService } from './transaction.service';
import {
  AdjustableCreditSide,
  BillAdjType,
  BillSettlementMode,
} from './types/transaction-api.types';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46e002';
const ORDER_ID = '019c6f6c-be87-7a11-8905-36092c46e003';

const credit = (overrides: Record<string, unknown> = {}): OpenCredit =>
  ({
    billId: '019c6f6c-be87-7a11-8905-36092c46e0b1',
    billAccYear: '2025-2026',
    billType: 'ADVANCE',
    docRefno: 'SO-2201',
    docDate: '2026-03-27',
    billAmount: 50000,
    pendingAmount: 18500,
    srcModule: 'SALES',
    srcDocType: 'SALES_ORDER',
    srcDocId: ORDER_ID,
    srcAccYear: '2025-2026',
    narration: 'Advance received on order',
    status: 'PARTIAL',
    drCr: 'CR',
    // What open-items routes it as; this endpoint answers from its own map.
    adjType: 'ADVANCE_ADJUST',
    settlementMode: 'ADVANCE',
    ...overrides,
  }) as unknown as OpenCredit;

describe('TransactionService', () => {
  let loadCredits: jest.Mock<Promise<OpenCredit[]>, [string, string, 'CR' | 'DR']>;
  let service: TransactionService;

  beforeEach(() => {
    loadCredits = jest.fn().mockResolvedValue([]);
    service = new TransactionService({ loadCredits } as unknown as OpenItemsService);
  });

  describe('getPartyAdjustableCredits', () => {
    it('reads the CR side when no type is sent', async () => {
      await service.getPartyAdjustableCredits({ companyId: COMPANY_ID, partyId: PARTY_ID });

      expect(loadCredits).toHaveBeenCalledWith(COMPANY_ID, PARTY_ID, 'CR');
    });

    it('reads the DR side when asked for it', async () => {
      await service.getPartyAdjustableCredits({
        companyId: COMPANY_ID,
        partyId: PARTY_ID,
        type: AdjustableCreditSide.DR,
      });

      expect(loadCredits).toHaveBeenCalledWith(COMPANY_ID, PARTY_ID, 'DR');
    });

    it('keeps every field of an advance and routes it as ADVANCE_ADJUST / ADVANCE', async () => {
      loadCredits.mockResolvedValue([credit()]);

      await expect(
        service.getPartyAdjustableCredits({ companyId: COMPANY_ID, partyId: PARTY_ID }),
      ).resolves.toEqual([
        {
          billId: '019c6f6c-be87-7a11-8905-36092c46e0b1',
          billAccYear: '2025-2026',
          billType: 'ADVANCE',
          docRefno: 'SO-2201',
          docDate: '2026-03-27',
          billAmount: 50000,
          pendingAmount: 18500,
          status: 'PARTIAL',
          drCr: 'CR',
          srcModule: 'SALES',
          srcDocType: 'SALES_ORDER',
          srcDocId: ORDER_ID,
          srcAccYear: '2025-2026',
          narration: 'Advance received on order',
          adjType: BillAdjType.ADVANCE_ADJUST,
          settlementMode: BillSettlementMode.ADVANCE,
        },
      ]);
    });

    it('routes a sales return as NOTE_ADJUST / CREDIT_NOTE', async () => {
      loadCredits.mockResolvedValue([
        credit({ billType: 'SALES_RETURN', docRefno: 'SR-4412', srcDocType: 'SALES_RETURN' }),
      ]);

      const [row] = await service.getPartyAdjustableCredits({
        companyId: COMPANY_ID,
        partyId: PARTY_ID,
      });

      expect(row).toMatchObject({
        billType: 'SALES_RETURN',
        adjType: BillAdjType.NOTE_ADJUST,
        settlementMode: BillSettlementMode.CREDIT_NOTE,
      });
    });

    // The routing has one definition here, whatever open-items attached to the row.
    it('answers adjType and settlementMode from its own routing map', async () => {
      loadCredits.mockResolvedValue([
        credit({
          billType: 'SALES_RETURN',
          adjType: 'ADVANCE_ADJUST',
          settlementMode: 'ADVANCE',
        }),
      ]);

      const [row] = await service.getPartyAdjustableCredits({
        companyId: COMPANY_ID,
        partyId: PARTY_ID,
      });

      expect(row.adjType).toBe(BillAdjType.NOTE_ADJUST);
      expect(row.settlementMode).toBe(BillSettlementMode.CREDIT_NOTE);
    });

    // open-items now returns OPENING and JOURNAL credits too; this panel has never offered them.
    it('leaves out opening and journal credits, keeping the rest in order', async () => {
      loadCredits.mockResolvedValue([
        credit({ docRefno: 'OB-1', billType: 'OPENING' }),
        credit({ docRefno: 'SO-1' }),
        credit({ docRefno: 'JV-1', billType: 'JOURNAL' }),
        credit({ docRefno: 'SR-1', billType: 'SALES_RETURN' }),
      ]);

      const rows = await service.getPartyAdjustableCredits({
        companyId: COMPANY_ID,
        partyId: PARTY_ID,
      });

      expect(rows.map((row) => row.docRefno)).toEqual(['SO-1', 'SR-1']);
    });

    it('answers [] when the party holds nothing', async () => {
      await expect(
        service.getPartyAdjustableCredits({ companyId: COMPANY_ID, partyId: PARTY_ID }),
      ).resolves.toEqual([]);
    });

    it('lets a read failure through', async () => {
      const failure = new Error('connection reset');
      loadCredits.mockRejectedValue(failure);

      await expect(
        service.getPartyAdjustableCredits({ companyId: COMPANY_ID, partyId: PARTY_ID }),
      ).rejects.toBe(failure);
    });
  });
});
