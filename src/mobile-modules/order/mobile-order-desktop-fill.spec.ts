import { withDesktopHeaderFigures, withDesktopLineFigures } from './mobile-order-desktop-fill';

const ITEM = '019d43f8-eb4c-7699-9572-3a87b8cbedb6';
const UNIT = '019d43f8-eb4d-7f1b-8e6a-2a1c3b4d5e6f';

/** The desktop's formulas (NexERP sale_order_entry.cpp priceRowStandard / finalizeRowWithCharges). */
describe('withDesktopLineFigures', () => {
  it('a GST-inclusive line: the pre-tax rate, sold price and saving off the phone money', () => {
    // CHILLI POWDER as on sor00011: 25 at 1770 incl. 18%, so 1500 before tax.
    const line = withDesktopLineFigures(
      {
        soiItemId: ITEM,
        soiItemUnitId: UNIT,
        soiOrderQty: 25,
        soiNetQty: 25,
        soiRate: '1770.00',
        soiIsTaxIncl: true,
        soiTaxPerc: '18.000',
        soiTaxAmt: '6750.00',
        soiTaxableAmt: '37500.00',
        soiNetAmt: '44250.00',
        soiMaxPrice: '2000',
      },
      {
        actPrice: 1800,
        costPrice: 1200,
        costPreTax: 1016.95,
        maxPrice: 2100,
        minPrice: 0,
        hasFreight: false,
        isService: false,
        eanCode: null,
        hsnCode: '0904',
        weight: 0,
        availableStock: null,
      },
    );
    expect(line).toEqual(
      expect.objectContaining({
        soiRatePreTax: 1500,
        soiRateDiff: -30,
        soiNetGross: 37500,
        soiChrgAfterTax: 0,
        soiSoldPrice: 1770,
        soiSoldPreTax: 1500,
        soiItemProfit: 570,
        soiProfitPreTax: 483.05,
        // The phone's MRP is kept over the lookup's.
        soiMaxPrice: '2000',
        soiMrpSavings: 5750,
        soiMrpSavingsPerc: 11.5,
        soiHsnCode: '0904',
      }),
    );
    // No stock record: the key stays out, as the desktop leaves the cell empty.
    expect(line).not.toHaveProperty('soiAvailableStock');
  });

  it("the phone's freight and loading are the after-tax charge; a free line saves its MRP", () => {
    const paid = withDesktopLineFigures(
      {
        soiItemId: ITEM,
        soiItemUnitId: UNIT,
        soiOrderQty: 4,
        soiNetQty: 4,
        soiRate: 50,
        soiIsTaxIncl: false,
        soiTaxPerc: 5,
        soiTaxAmt: 10,
        soiTaxableAmt: 200,
        soiFreightAmt: 8,
        soiLoadAmt: 4,
        soiNetAmt: 222,
      },
      null,
    );
    expect(paid).toEqual(
      expect.objectContaining({ soiRatePreTax: 50, soiChrgAfterTax: 12, soiSoldPrice: 55.5 }),
    );
    const free = withDesktopLineFigures(
      {
        soiItemId: ITEM,
        soiItemUnitId: UNIT,
        soiOrderQty: 1,
        soiNetQty: 1,
        soiRate: 0,
        soiIsFree: true,
        soiTaxableAmt: 0,
        soiNetAmt: 0,
        soiMaxPrice: 40,
      },
      null,
    );
    expect(free).toEqual(
      expect.objectContaining({ soiSoldPrice: 0, soiMrpSavings: 40, soiMrpSavingsPerc: 100 }),
    );
  });

  it('never changes a key the phone sent, and copies rather than mutates', () => {
    const sent = {
      soiItemId: ITEM,
      soiItemUnitId: UNIT,
      soiOrderQty: 1,
      soiRate: 10,
      soiNetAmt: 10,
      soiTaxableAmt: 10,
      soiIsRateLocked: true,
      soiSoldPrice: 9,
    };
    const out = withDesktopLineFigures(sent, null);
    expect(out.soiIsRateLocked).toBe(true);
    expect(out.soiSoldPrice).toBe(9);
    expect(sent).not.toHaveProperty('soiRatePreTax');
  });
});

describe('withDesktopHeaderFigures', () => {
  it('rolls cost, margin and savings up as recalcDocumentTotals does; settings only when set', () => {
    const header = withDesktopHeaderFigures(
      { soCustId: ITEM },
      [
        {
          soiItemId: ITEM,
          soiItemUnitId: UNIT,
          soiOrderQty: 2,
          soiNetQty: 2,
          soiGrossAmt: 210,
          soiCostPrice: 100,
          soiItemProfit: 5,
          soiMaxPrice: 150,
          soiSoldPrice: 105,
        },
        // No cost (the lookup could not price it) and no MRP: in neither roll-up.
        { soiItemId: ITEM, soiItemUnitId: UNIT, soiOrderQty: 1, soiGrossAmt: 50 },
      ],
      // A customer whose state the state list lacks: no place of supply.
      { gstType: null, stateCode: 'TN', posStateCode: null, posStateName: null },
      new Map([['sales.disc_alter_base_rate', 'true']]),
    );
    expect(header).toEqual(
      expect.objectContaining({
        soCustStcd: 'TN',
        soDiscAlterBase: true,
        soTotalCost: 200,
        soMarginAmt: 10,
        soMarginPerc: 3.85,
        soMrpSavings: 90,
        soMrpSavingsPerc: 30,
      }),
    );
    expect(header).not.toHaveProperty('soCustGstType');
    expect(header).not.toHaveProperty('soPosStcd');
    expect(header).not.toHaveProperty('soStateName');
    expect(header).not.toHaveProperty('soFreightCalcType');
    expect(header).not.toHaveProperty('soDeliveryMode');
  });
});
