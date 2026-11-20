import { Prisma, type ItemPriceMaster } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service';
import { MobileItemService, moneyText, qty3, unitPriceAnswer } from './mobile-item.service';

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

describe('MobileItemService.options: branches', () => {
  const OTHER = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1';
  const SWITCHED_OFF = '01a0fb1b-efa4-7d3f-a17a-cf00b56d4644';

  function build() {
    const companyFind = jest.fn().mockResolvedValue([
      { compId: COMPANY, compName: 'Amazon Retail', compCity: 'Coimbatore' },
      { compId: OTHER, compName: 'Chandra Saw Mill', compCity: null },
    ]);
    // As the DB orders them; the last one's company went off between the two reads.
    const branchFind = jest.fn().mockResolvedValue([
      { brId: BRANCH, brName: 'Coimbatore', brCompId: COMPANY, brIsDefault: false },
      { brId: 'b-counter2', brName: 'Counter2', brCompId: COMPANY, brIsDefault: true },
      { brId: 'b-saw', brName: 'saw mill', brCompId: OTHER, brIsDefault: true },
      { brId: 'b-gone', brName: 'Main Branch', brCompId: SWITCHED_OFF, brIsDefault: false },
    ]);
    const prisma = {
      company: { findMany: companyFind },
      branchMaster: { findMany: branchFind },
      itemGroupMaster: { findMany: jest.fn().mockResolvedValue([]) },
      itemBrandMaster: { findMany: jest.fn().mockResolvedValue([]) },
      itemPriceLevel: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    return { service: new MobileItemService(prisma), companyFind, branchFind };
  }

  it('lists the branches of the listed companies as {id, name, companyId, isDefault}', async () => {
    const { service } = build();
    const options = await service.options();
    expect(Object.keys(options)).toEqual([
      'companies',
      'branches',
      'itemGroups',
      'brands',
      'priceLevels',
    ]);
    expect(options.branches).toEqual([
      { id: BRANCH, name: 'Coimbatore', companyId: COMPANY, isDefault: false },
      { id: 'b-counter2', name: 'Counter2', companyId: COMPANY, isDefault: true },
      { id: 'b-saw', name: 'saw mill', companyId: OTHER, isDefault: true },
    ]);
  });

  it("reads active, live branches of the companies' own filter, in the companies' order", async () => {
    const { service, companyFind, branchFind } = build();
    await service.options();
    const companyWhere = (companyFind.mock.calls[0][0] as { where: unknown }).where;
    expect(branchFind).toHaveBeenCalledWith({
      where: { brIsDeleted: false, brIsActive: true, company: companyWhere },
      select: { brId: true, brName: true, brCompId: true, brIsDefault: true },
      orderBy: [
        { company: { compName: 'asc' } },
        { brCompId: 'asc' },
        { brName: 'asc' },
        { brId: 'asc' },
      ],
    });
    expect(companyWhere).toEqual({ compIsDeleted: false, compIsActive: true });
  });
});

describe('MobileItemService.list: category and section (scheme matching, 2026-11-19)', () => {
  const CATEGORY = '019c6f6c-be87-7a11-8905-36092c46c301';
  const SECTION = '019c6f6c-be87-7a11-8905-36092c46c302';

  const itemRow = (over: Record<string, unknown>) => ({
    item_id: 'item-1',
    item_code: 'A1',
    item_name_en: 'Annam Chilli Powder',
    item_name_ta: null,
    item_group_id: 'grp-1',
    itg_name: 'Spices',
    item_brand_id: null,
    brand_name: null,
    item_category_id: null,
    item_section_id: null,
    item_allow_loading: false,
    item_allow_freight: false,
    item_allow_promo: true,
    item_incl_tax: false,
    item_hsn_code: null,
    item_default_tax_id: null,
    tax_rate_perc: null,
    ...over,
  });

  function build() {
    const sqls: string[] = [];
    const queryRaw = jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      sqls.push(sql);
      if (sql.includes('public.companys')) {
        return Promise.resolve([{ compId: COMPANY, compGstApplicable: true }]);
      }
      if (sql.includes('public.branch_master')) {
        return Promise.resolve([{ brId: BRANCH, preferred: false, isDefault: true }]);
      }
      if (sql.includes('CURRENT_DATE')) {
        return Promise.resolve([{ today: TODAY }]);
      }
      if (sql.includes('count(*)')) {
        return Promise.resolve([{ n: 2 }]);
      }
      if (sql.includes('stock.stock_balance')) {
        return Promise.resolve([]);
      }
      if (sql.includes('item_name_en')) {
        return Promise.resolve([
          itemRow({ item_id: 'item-1', item_category_id: CATEGORY, item_section_id: SECTION }),
          itemRow({ item_id: 'item-2', item_name_en: 'Bru Coffee' }),
        ]);
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    const prisma = {
      $queryRaw: queryRaw,
      itemUnitConversion: { findMany: jest.fn().mockResolvedValue([]) },
      itemPriceMaster: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    return { service: new MobileItemService(prisma), sqls };
  }

  it('reads item_category_id / item_section_id and answers them as categoryId / sectionId', async () => {
    const { service, sqls } = build();

    const out = await service.list({ companyId: COMPANY });

    const itemSql = sqls.find((sql) => sql.includes('ORDER BY lower(i.item_name_en)'));
    expect(itemSql).toContain('i.item_category_id, i.item_section_id');
    expect(out.items.map((i) => [i.itemId, i.categoryId, i.sectionId])).toEqual([
      ['item-1', CATEGORY, SECTION],
      ['item-2', null, null],
    ]);
    // Additive keys, right after the brand; nothing else moved.
    expect(Object.keys(out.items[0])).toEqual([
      'itemId',
      'itemCode',
      'itemNameEn',
      'itemNameTa',
      'itemGroupId',
      'itemGroupName',
      'itemBrandId',
      'itemBrandName',
      'categoryId',
      'sectionId',
      'allowLoading',
      'allowFreight',
      'allowPromo',
      'inclTax',
      'hsnCode',
      'taxId',
      'taxPerc',
      'availableBaseQty',
      'units',
    ]);
    expect(out.branchId).toBe(BRANCH);
  });
});
