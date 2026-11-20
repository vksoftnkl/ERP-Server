import { Prisma } from '@prisma/client';
import { resolveSaleLinePrice } from './sale-line-price';

/**
 * Review step 6 (D12): the shared sale-line price resolver the item-price lookup and the
 * Sale Bill rate lock both use. Its misses are reasons, never throws; the customer rate
 * only lowers levels 1–4. (The lookup's own suite covers the payload built around it.)
 */
const d = (v: number | string) => new Prisma.Decimal(v);
const ITEM = '019c6f6c-be87-7a11-8905-36092c46f701';
const IUC = '019c6f6c-be87-7a11-8905-36092c46f702';
const UNIT = '019c6f6c-be87-7a11-8905-36092c46f703';

const row = (o: Record<string, unknown> = {}) => ({
  ipmId: 'ipm-1',
  ipmItemId: ITEM,
  ipmUcUnitId: IUC,
  ipmCompanyId: null,
  ipmBranchId: null,
  ipmKeyMrp: d(-1),
  ipmKeySp: d(-1),
  ipmEffectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  ipmEffectiveTo: new Date('9999-12-31T00:00:00.000Z'),
  ipmIsDeleted: false,
  ipmSalesPriceA: d(100),
  ipmSalesPriceB: d(95),
  ipmSalesPriceC: d(0),
  ipmSalesPriceD: d(0),
  ipmMaxPrice: d(120),
  ipmMinPrice: d(80),
  ipmCostPrice: d(70),
  ipmDiscPerc: d(5),
  ipmDiscQty: d(0),
  itemUnitConversion: { iucId: IUC, iucUnitId: UNIT, iucUnitSlno: 1, unit: null },
  ...o,
});

const client = (o: Record<string, unknown> = {}) => ({
  itemMaster: {
    findFirst: jest.fn(async () => ({
      itemId: ITEM,
      itemRetailItem: false,
      itemCompanyId: null,
      itemBranchId: null,
      itemWeighScale: false,
    })),
  },
  itemPriceMaster: { findMany: jest.fn(async () => [row()]) },
  stockLot: { findFirst: jest.fn(async () => null) },
  custItemRate: { findFirst: jest.fn(async () => ({ csrDiscQty: d(3) })) },
  itemQtyPrice: { findMany: jest.fn(async () => []) },
  $queryRaw: jest.fn(async () => [{ ord: BigInt(1), trackMrp: false, trackSalePrice: false }]),
  ...o,
});

const query = (o: Record<string, unknown> = {}) => ({
  itemId: ITEM,
  unitId: UNIT,
  companyId: 'c',
  branchId: 'b',
  priceLevel: 1,
  docDate: '2026-11-20',
  ...o,
});

describe('resolveSaleLinePrice', () => {
  it('prices the level on the headline row; no customer = no customer rate read', async () => {
    const c = client();
    const answer = await resolveSaleLinePrice(c as never, query());
    expect(answer).toMatchObject({ ok: true, basePrice: 100, customerDiscQty: 0, salesPrice: 100 });
    expect(c.custItemRate.findFirst).not.toHaveBeenCalled();
  });

  it('a customer rate takes its per-unit discount off levels 1–4 only', async () => {
    expect(
      await resolveSaleLinePrice(client() as never, query({ customerId: 'cus' })),
    ).toMatchObject({
      basePrice: 100,
      customerDiscQty: 3,
      salesPrice: 97,
    });
    expect(
      await resolveSaleLinePrice(client() as never, query({ customerId: 'cus', priceLevel: 5 })),
    ).toMatchObject({ basePrice: 120, customerDiscQty: 0, salesPrice: 120 });
  });

  it('misses are reasons, not throws', async () => {
    expect(
      await resolveSaleLinePrice(
        client({ itemMaster: { findFirst: jest.fn(async () => null) } }) as never,
        query(),
      ),
    ).toEqual({ ok: false, reason: 'ITEM_NOT_FOUND' });
    expect(
      await resolveSaleLinePrice(client() as never, query({ unitId: 'another-unit' })),
    ).toEqual({ ok: false, reason: 'PRICE_NOT_FOUND' });
    expect(
      await resolveSaleLinePrice(client() as never, query({ lotId: 'lot-of-another-item' })),
    ).toEqual({ ok: false, reason: 'LOT_NOT_FOUND' });
  });

  it('a row not yet in force is not a price', async () => {
    const c = client({
      itemPriceMaster: {
        findMany: jest.fn(async () => [
          row({ ipmEffectiveFrom: new Date('2026-12-01T00:00:00.000Z') }),
        ]),
      },
    });
    expect(await resolveSaleLinePrice(c as never, query())).toEqual({
      ok: false,
      reason: 'PRICE_NOT_FOUND',
    });
  });
});
