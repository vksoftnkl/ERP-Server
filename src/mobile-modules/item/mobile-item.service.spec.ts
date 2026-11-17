import { Prisma, type ItemPriceMaster } from '@prisma/client';
import { moneyText, qty3, unitPriceAnswer } from './mobile-item.service';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const TODAY = '2026-11-16';

let seq = 0;
function row(over: Partial<ItemPriceMaster>): ItemPriceMaster {
  seq += 1;
  return {
    ipmId: `row-${seq}`,
    ipmCompanyId: null,
    ipmBranchId: null,
    ipmKeyMrp: new Prisma.Decimal(-1),
    ipmKeySp: new Prisma.Decimal(-1),
    ipmBucketMrp: null,
    ipmBucketSp: null,
    ipmEffectiveFrom: new Date('2026-01-01'),
    ipmEffectiveTo: new Date('2099-12-31'),
    ipmIsDeleted: false,
    ipmSalesPriceA: new Prisma.Decimal(10),
    ...over,
  } as ItemPriceMaster;
}

describe('unitPriceAnswer (the /master-lookups/item-price pick for a line with no MRP)', () => {
  const caller = { companyId: COMPANY, branchId: BRANCH };

  it('takes the headline, the branch row before the chain row', () => {
    const chain = row({ ipmSalesPriceA: new Prisma.Decimal(10) });
    const branch = row({
      ipmBranchId: BRANCH,
      ipmCompanyId: COMPANY,
      ipmSalesPriceA: new Prisma.Decimal(12),
    });
    const answer = unitPriceAnswer([chain, branch], TODAY, caller);
    expect(answer?.row.ipmId).toBe(branch.ipmId);
    expect(answer?.source).toBe('MASTER');
    expect(answer?.scope).toBe('BRANCH');
  });

  it('prefers the headline over any bucket', () => {
    const bucket = row({
      ipmKeyMrp: new Prisma.Decimal(200),
      ipmBucketMrp: new Prisma.Decimal(200),
    });
    const headline = row({});
    expect(unitPriceAnswer([bucket, headline], TODAY, caller)?.row.ipmId).toBe(headline.ipmId);
  });

  it('an item priced only per MRP takes its dearest bucket (notes 71 B2)', () => {
    const cheap = row({
      ipmKeyMrp: new Prisma.Decimal(150),
      ipmBucketMrp: new Prisma.Decimal(150),
    });
    const dear = row({ ipmKeyMrp: new Prisma.Decimal(200), ipmBucketMrp: new Prisma.Decimal(200) });
    const answer = unitPriceAnswer([cheap, dear], TODAY, caller);
    expect(answer?.row.ipmId).toBe(dear.ipmId);
    expect(answer?.source).toBe('BUCKET');
  });

  it('nothing in force = unpriced', () => {
    const future = row({ ipmEffectiveFrom: new Date('2027-01-01') });
    expect(unitPriceAnswer([future], TODAY, caller)).toBeNull();
    expect(unitPriceAnswer([], TODAY, caller)).toBeNull();
  });
});

describe('phone number formats', () => {
  it('money is two decimals as text, null stays null', () => {
    expect(moneyText(new Prisma.Decimal('12.345'))).toBe('12.35');
    expect(moneyText(0)).toBe('0.00');
    expect(moneyText(null)).toBeNull();
    expect(moneyText(undefined)).toBeNull();
  });

  it('a quantity is three decimals as a number', () => {
    expect(qty3(new Prisma.Decimal(25).div(12))).toBe(2.083);
    expect(qty3(new Prisma.Decimal(0))).toBe(0);
  });
});
