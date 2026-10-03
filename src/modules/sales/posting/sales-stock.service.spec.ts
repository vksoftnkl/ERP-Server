import { costRateWot } from './sales-stock.service';

describe('costRateWot — a sales line’s cost without tax (notes 77)', () => {
  it('nets a quoted cost of the line’s own tax rate, as the engine derives it', () => {
    expect(costRateWot({ costRate: 118, taxPerc: 18 }).toNumber()).toBe(100);
    expect(costRateWot({ costRate: 20, taxPerc: 5 }).toNumber()).toBe(19.047619);
    expect(costRateWot({ costRate: 80, taxPerc: 18 }).toNumber()).toBe(67.79661);
  });

  it('is the cost itself for a tax-free line, never the inclusive rate of a taxed one', () => {
    expect(costRateWot({ costRate: 20, taxPerc: 0 }).toNumber()).toBe(20);
    expect(costRateWot({ costRate: 20, taxPerc: null }).toNumber()).toBe(20);
  });

  it('is 0 with no quoted cost, so the engine prices the line from the average pair', () => {
    expect(costRateWot({ costRate: null, taxPerc: 18 }).toNumber()).toBe(0);
    expect(costRateWot({ costRate: 0, taxPerc: 18 }).toNumber()).toBe(0);
  });
});
