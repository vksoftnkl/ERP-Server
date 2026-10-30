import {
  buildBillLegs,
  buildCogsLegs,
  buildReturnLegs,
  buildTenderLegs,
  chargePostsSeparately,
  splitRegisterCharges,
} from './sales-leg.sources';
import type { BillLegInput, SalesLeg, TenderLegInput } from './types/sales-leg.types';

const PARTY = 'ledger-party';
const CASH = 'ledger-cash';
const FREIGHT = 'ledger-freight';
const ADVANCE = 'ledger-advance';

const bill = (overrides: Partial<BillLegInput> = {}): BillLegInput => ({
  partyLedgerId: PARTY,
  supplyNature: 'INTRA',
  salesAmount: 1000,
  taxes: [{ taxId: 'gst18', cgst: 90, sgst: 90, igst: 0, cess: 0, acess: 0 }],
  charges: [],
  cashDiscount: 0,
  schemeDiscount: 0,
  roundOff: 0,
  tcsAmount: 0,
  setOffs: [],
  tenders: [],
  cogsAmount: 0,
  ...overrides,
});

const tender = (overrides: Partial<TenderLegInput> = {}): TenderLegInput => ({
  tenderTypeId: 1,
  tenderLedgerId: CASH,
  amount: 1180,
  isLoyalty: false,
  isCredit: false,
  name: 'Cash',
  ...overrides,
});

const total = (legs: SalesLeg[], side: 'DR' | 'CR') =>
  Math.round(legs.filter((l) => l.drCr === side).reduce((s, l) => s + l.amount, 0) * 100) / 100;

const tagOf = (l: SalesLeg) => l.roleTag ?? l.ledgerId;

describe('sales-leg.sources', () => {
  describe('chargePostsSeparately', () => {
    it('folds a before-tax charge into SALES unless it is flagged to post separately', () => {
      expect(chargePostsSeparately({ cdBeforeTax: true })).toBe(false);
      expect(chargePostsSeparately({ cdBeforeTax: true, cdSepPost: true })).toBe(true);
    });

    it('always posts an after-tax charge on its own ledger', () => {
      expect(chargePostsSeparately({ cdBeforeTax: false, cdSepPost: false })).toBe(true);
      expect(chargePostsSeparately({})).toBe(true);
    });
  });

  it('splitRegisterCharges keeps every register amount non-negative', () => {
    expect(splitRegisterCharges([100, -25.5, 0, 40.005])).toEqual({
      other: 140.01,
      deduction: 25.5,
    });
    expect(splitRegisterCharges([])).toEqual({ other: 0, deduction: 0 });
  });

  describe('buildBillLegs', () => {
    it('writes party, sales and intra-state tax in the fixed order, balanced', () => {
      const legs = buildBillLegs(bill());

      expect(legs.map(tagOf)).toEqual([PARTY, 'SALES', 'OUTPUT_CGST', 'OUTPUT_SGST']);
      expect(legs[0]).toMatchObject({ drCr: 'DR', amount: 1180 });
      expect(total(legs, 'DR')).toBe(total(legs, 'CR'));
    });

    it('drops a zero leg rather than writing one the CHECK refuses', () => {
      const legs = buildBillLegs(bill({ cashDiscount: 0, schemeDiscount: 0, tcsAmount: 0 }));

      expect(legs.every((l) => l.amount > 0)).toBe(true);
      expect(legs.map(tagOf)).not.toContain('DISCOUNT_ALLOWED');
    });

    it('posts IGST for an inter-state supply, tagged with the tax id', () => {
      const legs = buildBillLegs(
        bill({
          supplyNature: 'INTER',
          taxes: [{ taxId: 'gst18', cgst: 0, sgst: 0, igst: 180, cess: 0, acess: 0 }],
        }),
      );

      expect(legs.find((l) => l.roleTag === 'OUTPUT_IGST')).toMatchObject({
        drCr: 'CR',
        amount: 180,
        taxId: 'gst18',
        supplyNature: 'INTER',
      });
      expect(legs.map(tagOf)).not.toContain('OUTPUT_CGST');
    });

    it('balances discounts, a negative round-off and TCS against the party', () => {
      const legs = buildBillLegs(
        bill({ cashDiscount: 30, schemeDiscount: 20, roundOff: -0.4, tcsAmount: 1.13 }),
      );

      expect(legs.find((l) => l.roleTag === 'DISCOUNT_ALLOWED')).toMatchObject({
        drCr: 'DR',
        amount: 30,
      });
      expect(legs.find((l) => l.roleTag === 'SCHEME_DISCOUNT')).toMatchObject({
        drCr: 'DR',
        amount: 20,
      });
      expect(legs.find((l) => l.roleTag === 'ROUND_OFF')).toMatchObject({
        drCr: 'DR',
        amount: 0.4,
      });
      expect(legs.find((l) => l.roleTag === 'TCS_PAYABLE')).toMatchObject({
        drCr: 'CR',
        amount: 1.13,
      });
      expect(legs[0].amount).toBe(1130.73);
      expect(total(legs, 'DR')).toBe(total(legs, 'CR'));
    });

    it('posts a separate charge and its tax on the credit side, and a deduction on the debit side', () => {
      const legs = buildBillLegs(
        bill({
          charges: [
            {
              ledgerId: FREIGHT,
              amount: 100,
              separatelyPosted: true,
              taxId: 'gst18',
              cgst: 9,
              sgst: 9,
              name: 'Freight',
            },
            { ledgerId: 'ledger-rebate', amount: -50, separatelyPosted: true, name: 'Rebate' },
            { ledgerId: 'ledger-packing', amount: 40, separatelyPosted: false },
          ],
        }),
      );

      expect(legs.find((l) => l.ledgerId === FREIGHT)).toMatchObject({
        drCr: 'CR',
        amount: 100,
        remarks: 'Freight',
      });
      expect(legs.filter((l) => l.roleTag === 'OUTPUT_CGST').map((l) => l.amount)).toEqual([90, 9]);
      expect(legs.find((l) => l.ledgerId === 'ledger-rebate')).toMatchObject({
        drCr: 'DR',
        amount: 50,
      });
      // A charge inside SALES writes no leg of its own.
      expect(legs.find((l) => l.ledgerId === 'ledger-packing')).toBeUndefined();
      expect(legs[0].amount).toBe(1180 + 118 - 50);
      expect(total(legs, 'DR')).toBe(total(legs, 'CR'));
    });

    it('appends the COGS pair, then tenders, then set-offs, keeping the balance', () => {
      const legs = buildBillLegs(
        bill({
          cogsAmount: 640,
          tenders: [tender({ amount: 1000 })],
          setOffs: [
            { ledgerId: ADVANCE, amount: 180 },
            // A credit already held on the party moves nothing.
            { ledgerId: PARTY, amount: 99 },
          ],
        }),
      );

      expect(legs.map(tagOf).slice(4)).toEqual(['COGS', 'INVENTORY', CASH, PARTY, ADVANCE, PARTY]);
      expect(legs.find((l) => l.ledgerId === ADVANCE)).toMatchObject({
        drCr: 'DR',
        amount: 180,
        remarks: 'Advance adjusted',
      });
      expect(total(legs, 'DR')).toBe(total(legs, 'CR'));
    });
  });

  describe('buildTenderLegs', () => {
    it('settles a money tender: DR its ledger, CR the party', () => {
      expect(buildTenderLegs(tender({ amount: 500 }), PARTY)).toEqual([
        { ledgerId: CASH, drCr: 'DR', amount: 500, remarks: 'Cash', field: 'tenders' },
        { ledgerId: PARTY, drCr: 'CR', amount: 500, remarks: 'Cash' },
      ]);
    });

    it('writes nothing for an on-account tender or a zero one', () => {
      expect(buildTenderLegs(tender({ isCredit: true }), PARTY)).toEqual([]);
      expect(buildTenderLegs(tender({ amount: 0.001 }), PARTY)).toEqual([]);
    });

    it('posts a loyalty tender to LOYALTY_REDEMPTION and ignores the master ledger', () => {
      const [settlement] = buildTenderLegs(
        tender({ isLoyalty: true, tenderLedgerId: 'ledger-ignored', amount: 75 }),
        PARTY,
      );

      expect(settlement).toEqual({
        role: 'LOYALTY_REDEMPTION',
        roleTag: 'LOYALTY_REDEMPTION',
        drCr: 'DR',
        amount: 75,
        field: 'tenders',
      });
    });

    it('runs the other way for a refund', () => {
      const legs = buildTenderLegs(tender({ amount: 200 }), PARTY, 'RETURN');

      expect(legs.map((l) => [l.ledgerId, l.drCr])).toEqual([
        [CASH, 'CR'],
        [PARTY, 'DR'],
      ]);
    });
  });

  describe('buildCogsLegs', () => {
    it('issues DR COGS / CR INVENTORY and receives the reverse', () => {
      expect(buildCogsLegs(250).map((l) => [l.roleTag, l.drCr])).toEqual([
        ['COGS', 'DR'],
        ['INVENTORY', 'CR'],
      ]);
      expect(buildCogsLegs(250, 'RETURN').map((l) => [l.roleTag, l.drCr])).toEqual([
        ['COGS', 'CR'],
        ['INVENTORY', 'DR'],
      ]);
    });

    it('writes nothing for no cost', () => {
      expect(buildCogsLegs(0.004)).toEqual([]);
    });
  });

  describe('buildReturnLegs', () => {
    it('mirrors the bill under its own SALES_RETURN role, balanced', () => {
      const legs = buildReturnLegs({
        ...bill({ cashDiscount: 10, roundOff: 0.2, cogsAmount: 600 }),
        tenders: [tender({ amount: 500 })],
      });

      expect(legs[0]).toMatchObject({ ledgerId: PARTY, drCr: 'CR', amount: 1170.2 });
      expect(legs[1]).toMatchObject({ role: 'SALES_RETURN', drCr: 'DR', amount: 1000 });
      expect(legs.filter((l) => l.roleTag === 'OUTPUT_CGST')[0].drCr).toBe('DR');
      expect(legs.find((l) => l.roleTag === 'DISCOUNT_ALLOWED')?.drCr).toBe('CR');
      expect(legs.find((l) => l.roleTag === 'ROUND_OFF')?.drCr).toBe('DR');
      expect(legs.find((l) => l.roleTag === 'COGS')?.drCr).toBe('CR');
      expect(legs.find((l) => l.ledgerId === CASH)?.drCr).toBe('CR');
      expect(legs.map(tagOf)).not.toContain('SALES');
      expect(total(legs, 'DR')).toBe(total(legs, 'CR'));
    });
  });
});
