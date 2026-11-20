import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PrismaService } from '../../database/prisma/prisma.service';
import type { RequestContextService } from '../../common/request-context/request-context.service';
import type { SaleOrderService } from '../../modules/sales/sale-order/sale-order.service';
import type { SaleOrderLifecycleService } from '../../modules/sales/sale-order/sale-order-lifecycle.service';
import type { SaveSaleOrderDto } from '../../modules/sales/sale-order/dto/save-sale-order.dto';
import type { CreateMobileOrderDto } from './dto/mobile-order.dto';
import type { AppSettingValueService } from '../../modules/settings/appSettings/app-setting-value.service';
import { ItemPriceLookup } from '../../modules/master-lookup/lookups/item-price.lookup';
import {
  resolveDefaultSaleGodowns,
  type SaleGodown,
} from '../../common/utils/sale-line-godown.utils';
import { MobileOrderService, confirmRefusalOf, withLineGodowns } from './mobile-order.service';

// The desktop's item lookup: each test says what it answers (default: it cannot price).
jest.mock('../../modules/master-lookup/lookups/item-price.lookup', () => ({
  ItemPriceLookup: jest.fn().mockImplementation(() => ({
    getItemPriceLookup: jest.fn(() => Promise.reject(new Error('no price'))),
  })),
}));
jest.mock('../../common/utils/sale-line-godown.utils', () => ({
  ...jest.requireActual<object>('../../common/utils/sale-line-godown.utils'),
  resolveDefaultSaleGodowns: jest.fn(() => Promise.resolve(new Map())),
}));

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const OTHER_COMPANY = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1';
const DEVICE_BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const PICKED_BRANCH = '019efa00-c227-7672-a55b-161842adf59c';
const OTHER_COMPANY_BRANCH = '019d9b39-3dbd-702a-8c7a-90aa1bee679a';
const DEV_ID = '01a12f63-5117-7a52-9e10-b5979d464059';
const LOGIN = '019e441b-6e48-7918-b246-b857ffb35db1';
const CUSTOMER = '019f1dc6-7d53-7a5d-913b-66d57b891257';
const CLIENT_UUID = '3b241101-e2bb-4255-8caf-4136c566a962';
const SO_ID = '01a20000-0000-7000-8000-0000000000aa';
const ITEM_GODOWN = '019c9935-79f4-772b-8666-2b46b9fc82cc';
const OWN_GODOWN = '019d2e48-7af3-7d5c-82a7-2eb57fdabf1c';
const ITEM = '019d43f8-eb4c-7699-9572-3a87b8cbedb6';
const UNIT = '019d43f8-eb4d-7f1b-8e6a-2a1c3b4d5e6f';
const OTHER_UNIT = '019d43f8-eb4d-7f1b-8e6a-2a1c3b4d5e70';
const godown = (gdlId: string, gdlName = 'namakkal'): SaleGodown => ({
  gdlId,
  gdlName,
  gdlNegativeStock: false,
});

/** The live, active branches of each company, as branch_master would answer. */
const BRANCHES_OF: Record<string, string[]> = {
  [COMPANY]: [DEVICE_BRANCH, PICKED_BRANCH],
  [OTHER_COMPANY]: [OTHER_COMPANY_BRANCH],
};

const dto = (over: Partial<CreateMobileOrderDto> = {}) => ({
  soClientUuid: CLIENT_UUID,
  deviceUid: 'phone-1',
  soCompanyId: COMPANY,
  soCustId: CUSTOMER,
  soCustName: 'ZT mobile order',
  soPriceLevel: 1,
  items: [{ soiItemId: CUSTOMER, soiItemUnitId: CUSTOMER, soiOrderQty: 2 }],
  ...over,
});

function build(
  script: {
    stored?: Record<string, unknown> | null;
    /** What postInTx does: answer (default CONFIRMED, no shortfall) or throw. */
    post?: () => Promise<unknown>;
    /** What resolveDefaultSaleGodowns answers, keyed item|unit (default: no godown for any line). */
    lineGodowns?: Map<string, SaleGodown | null>;
    /** What the item-price lookup answers for a query (default: it cannot price the line). */
    itemPrice?: (query: Record<string, unknown>) => Promise<Record<string, unknown>>;
    /** The effective settings, key → value (default: none). */
    settings?: Record<string, string | null>;
    /** What WhatsApp on Post answers (default null: the company setting asked for nothing). */
    whatsapp?: () => Promise<unknown>;
  } = {},
) {
  const sqls: string[] = [];
  /** The SAVEPOINT / RELEASE / ROLLBACK TO statements, in order. */
  const savepoints: string[] = [];
  const tx = {
    $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
      savepoints.push(strings.join('?'));
      return 0;
    }),
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      sqls.push(sql);
      if (sql.includes('pg_advisory_xact_lock')) return [{ locked: 1 }];
      if (sql.includes('FROM sales.sale_order so')) return script.stored ? [script.stored] : [];
      if (sql.includes('FROM public.companys'))
        return [{ compId: COMPANY, compGstApplicable: true }];
      if (sql.includes('FROM fixed.device_master'))
        return [
          {
            devId: DEV_ID,
            devCode: 'D9',
            devCompanyId: COMPANY,
            devBranchId: DEVICE_BRANCH,
            devIsActive: true,
            devIsBlocked: false,
            devBlockReason: null,
          },
        ];
      if (sql.includes('FROM public.branch_master') && sql.includes('"preferred"')) {
        // findMobileBranch: (preferred, company)
        const [preferred, companyId] = values as string[];
        return (BRANCHES_OF[companyId] ?? []).map((brId) => ({
          brId,
          preferred: brId === preferred,
          isDefault: false,
        }));
      }
      if (sql.includes('FROM public.branch_master')) {
        // requireMobileBranchOfCompany: (branch, company)
        const [branchId, companyId] = values as string[];
        return (BRANCHES_OF[companyId] ?? []).includes(branchId) ? [{ brId: branchId }] : [];
      }
      if (sql.includes('FROM sales.customers'))
        return [
          {
            gstType: 'UNREGISTERED',
            stateCode: '33',
            posStateCode: '33',
            posStateName: 'Tamil Nadu',
          },
        ];
      if (sql.includes('CURRENT_DATE::text')) return [{ today: '2026-11-18' }];
      if (sql.includes('FROM public.fiscal_years')) return [{ name: '2026-2027' }];
      throw new Error(`unexpected read: ${sql}`);
    }),
    saleOrder: { update: jest.fn().mockResolvedValue({}) },
  };
  jest.mocked(resolveDefaultSaleGodowns).mockReset();
  jest.mocked(resolveDefaultSaleGodowns).mockResolvedValue(script.lineGodowns ?? new Map());
  const prisma = {
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  } as unknown as PrismaService;
  const saved: SaveSaleOrderDto[] = [];
  const createOrderInTx = jest.fn(async (_tx: unknown, save: SaveSaleOrderDto) => {
    saved.push(save);
    return {
      soId: SO_ID,
      soOrderRefno: 'sor00042',
      soStatus: 'DRAFT',
      soAccYear: save.soAccYear,
      soCompanyId: save.soCompanyId,
      soBranchId: save.soBranchId,
    };
  });
  const saleOrders = {
    prepareSave: jest.fn(),
    createOrderInTx,
    throwIfDuplicate: jest.fn(),
  } as unknown as SaleOrderService;
  const postInTx = jest.fn(
    script.post ?? (async () => ({ soStatus: 'CONFIRMED', warnings: [], confirmedNow: true })),
  );
  const whatsappAfterPost = jest.fn(script.whatsapp ?? (async () => null));
  const lifecycle = { postInTx, whatsappAfterPost } as unknown as SaleOrderLifecycleService;
  const requestContext = { getUserId: () => LOGIN } as unknown as RequestContextService;
  const getItemPriceLookup = jest.fn(
    script.itemPrice ?? (() => Promise.reject(new Error('no price'))),
  );
  jest
    .mocked(ItemPriceLookup)
    .mockImplementation(() => ({ getItemPriceLookup }) as unknown as ItemPriceLookup);
  const appSettings = {
    resolveEffective: jest.fn(async () =>
      Object.entries(script.settings ?? {}).map(([asdKey, value]) => ({ asdKey, value })),
    ),
  } as unknown as AppSettingValueService;
  const service = new MobileOrderService(
    prisma,
    requestContext,
    saleOrders,
    lifecycle,
    appSettings,
  );
  return {
    getItemPriceLookup,
    appSettings,
    service,
    tx,
    sqls,
    saved,
    createOrderInTx,
    postInTx,
    savepoints,
    whatsappAfterPost,
    prisma,
  };
}

/** The branch-choice reads. */
const branchReads = (sqls: string[]) => sqls.filter((sql) => sql.includes('public.branch_master'));

describe('MobileOrderService.create: the branch', () => {
  it("saves in the branch the salesman picked, not the phone's own", async () => {
    const { service, saved, sqls } = build();
    const answer = await service.create(dto({ soBranchId: PICKED_BRANCH }));
    expect(answer).toEqual(expect.objectContaining({ soId: SO_ID, duplicate: false }));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(
      expect.objectContaining({
        soBranchId: PICKED_BRANCH,
        soDeviceId: DEV_ID,
        soAccYear: '2026-2027',
        soUserId: LOGIN,
      }),
    );
    // Only the picked-branch check ran: the device / default fallback was not asked.
    expect(branchReads(sqls)).toHaveLength(1);
    expect(branchReads(sqls)[0]).not.toContain('"preferred"');
  });

  it.each([
    ["another company's branch", OTHER_COMPANY_BRANCH],
    ['an id no live, active branch has', '01a0f60f-acd5-724b-a62d-519905edc0a7'],
  ])('refuses %s with a 422 on soBranchId and saves nothing', async (_label, branchId) => {
    const { service, createOrderInTx, sqls } = build();
    let caught: unknown = null;
    try {
      await service.create(dto({ soBranchId: branchId }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnprocessableEntityException);
    const body = (caught as UnprocessableEntityException).getResponse() as {
      errors: { field: string; code: string }[];
    };
    expect(body.errors).toEqual([
      expect.objectContaining({ field: 'soBranchId', code: 'MOBILE_BRANCH_NOT_OF_COMPANY' }),
    ]);
    expect(createOrderInTx).not.toHaveBeenCalled();
    // No fallback to the phone's branch or the default.
    expect(branchReads(sqls).some((sql) => sql.includes('"preferred"'))).toBe(false);
  });

  it("without soBranchId keeps the old fallback: the phone's branch of the company", async () => {
    const { service, saved, sqls } = build();
    await service.create(dto());
    expect(saved[0].soBranchId).toBe(DEVICE_BRANCH);
    expect(branchReads(sqls)).toHaveLength(1);
    expect(branchReads(sqls)[0]).toContain('"preferred"');
  });

  it('a resend answers the stored order, whatever branch it now carries', async () => {
    const stored = {
      soId: SO_ID,
      soOrderRefno: 'sor00042',
      soStatus: 'DRAFT',
      soAccYear: '2026-2027',
      soIsDeleted: false,
      soCustId: CUSTOMER,
    };
    for (const soBranchId of [PICKED_BRANCH, OTHER_COMPANY_BRANCH, undefined]) {
      const { service, createOrderInTx, sqls } = build({ stored });
      await expect(service.create(dto({ soBranchId }))).resolves.toEqual({
        soId: SO_ID,
        soOrderRefno: 'sor00042',
        soStatus: 'DRAFT',
        soAccYear: '2026-2027',
        duplicate: true,
        soIsDeleted: false,
        confirmRefused: null,
        warnings: [],
      });
      expect(createOrderInTx).not.toHaveBeenCalled();
      expect(branchReads(sqls)).toHaveLength(0);
    }
  });
});

describe('MobileOrderService.create: the confirm (user, 2026-11-19)', () => {
  const short = { code: 'SALES_RESERVE_SHORT', line: 1, short: 2, message: 'short by 2' };

  it('confirms the new order in the same transaction, behind a savepoint, as the phone', async () => {
    const { service, postInTx, savepoints, createOrderInTx } = build({
      post: async () => ({ soStatus: 'CONFIRMED', warnings: [short], confirmedNow: true }),
    });
    const answer = await service.create(dto({ soBranchId: PICKED_BRANCH }));
    expect(answer).toEqual({
      soId: SO_ID,
      soOrderRefno: 'sor00042',
      soStatus: 'CONFIRMED',
      soAccYear: '2026-2027',
      duplicate: false,
      soIsDeleted: false,
      confirmRefused: null,
      warnings: [short],
    });
    expect(postInTx).toHaveBeenCalledTimes(1);
    const [txArg, keys, now, options] = postInTx.mock.calls[0] as unknown[];
    expect(txArg).toBeDefined();
    expect(keys).toEqual({
      soId: SO_ID,
      soCompanyId: COMPANY,
      soBranchId: PICKED_BRANCH,
      soAccYear: '2026-2027',
    });
    expect(now).toBeInstanceOf(Date);
    // The phone path only: the Post-right check is skipped, the notes say "from the phone".
    expect(options).toEqual({ skipPostRight: true, origin: 'PHONE' });
    expect(createOrderInTx.mock.invocationCallOrder[0]).toBeLessThan(
      postInTx.mock.invocationCallOrder[0],
    );
    expect(savepoints).toEqual([
      'SAVEPOINT mobile_order_confirm',
      'RELEASE SAVEPOINT mobile_order_confirm',
    ]);
  });

  it.each([
    [
      'a closed day',
      new ConflictException({
        message: 'Conflict',
        errors: [{ field: 'soOrderDate', code: 'SALES_DAY_CLOSED', message: 'closed' }],
      }),
      { code: 'SALES_DAY_CLOSED', field: 'soOrderDate', message: 'closed' },
    ],
    [
      'an invalid salesman',
      new UnprocessableEntityException({
        message: 'Unprocessable',
        errors: [{ field: 'soSalesmanId', code: 'SALES_SALESMAN_INVALID', message: 'nobody' }],
      }),
      { code: 'SALES_SALESMAN_INVALID', field: 'soSalesmanId', message: 'nobody' },
    ],
    [
      'a missing right (should the option ever be dropped)',
      new ForbiddenException({
        message: 'Forbidden',
        errors: [{ field: 'userId', code: 'SALES_RIGHT_POST', message: 'no right' }],
      }),
      { code: 'SALES_RIGHT_POST', field: 'userId', message: 'no right' },
    ],
  ])('keeps the DRAFT on %s and says why', async (_label, refusal, expected) => {
    const { service, savepoints } = build({ post: () => Promise.reject(refusal) });
    const answer = await service.create(dto());
    expect(answer).toEqual(
      expect.objectContaining({
        soId: SO_ID,
        soStatus: 'DRAFT',
        duplicate: false,
        confirmRefused: expected,
        warnings: [],
      }),
    );
    // Only the confirm's writes are rolled back; the draft and its uuid commit.
    expect(savepoints).toEqual([
      'SAVEPOINT mobile_order_confirm',
      'ROLLBACK TO SAVEPOINT mobile_order_confirm',
    ]);
  });

  it.each([
    ['a database error', Object.assign(new Error('deadlock'), { code: 'P2034' })],
    ['a 5xx', new InternalServerErrorException('boom')],
    ['an uncoded 4xx', new ConflictException('no code')],
  ])('fails the whole upload on %s, as before', async (_label, error) => {
    const { service, savepoints } = build({ post: () => Promise.reject(error) });
    await expect(service.create(dto())).rejects.toBe(error);
    expect(savepoints).toEqual(['SAVEPOINT mobile_order_confirm']);
  });

  it('a resend does not confirm again', async () => {
    const stored = {
      soId: SO_ID,
      soOrderRefno: 'sor00042',
      soStatus: 'CONFIRMED',
      soAccYear: '2026-2027',
      soIsDeleted: false,
      soCustId: CUSTOMER,
    };
    const { service, postInTx, savepoints } = build({ stored });
    await expect(service.create(dto())).resolves.toEqual(
      expect.objectContaining({ soStatus: 'CONFIRMED', duplicate: true, confirmRefused: null }),
    );
    expect(postInTx).not.toHaveBeenCalled();
    expect(savepoints).toEqual([]);
  });
});

describe('confirmRefusalOf', () => {
  it('reads the first coded error of a 4xx and nothing else', () => {
    expect(
      confirmRefusalOf(
        new ConflictException({
          message: 'Conflict',
          errors: [
            { field: 'soOrderDate', code: 'SALES_DAY_CLOSED', message: 'closed' },
            { field: 'x', code: 'OTHER', message: 'second' },
          ],
        }),
      ),
    ).toEqual({ code: 'SALES_DAY_CLOSED', field: 'soOrderDate', message: 'closed' });
    expect(confirmRefusalOf(new Error('plain'))).toBeNull();
    expect(confirmRefusalOf(new ConflictException({ message: 'x', errors: [] }))).toBeNull();
    expect(
      confirmRefusalOf(
        new InternalServerErrorException({ errors: [{ code: 'X', field: 'y', message: 'z' }] }),
      ),
    ).toBeNull();
  });
});

describe("MobileOrderService.create: the item's godown (user, 2026-11-20)", () => {
  const twoLines = () =>
    dto({
      items: [
        { soiItemId: ITEM, soiItemUnitId: UNIT, soiOrderQty: 2 },
        { soiItemId: ITEM, soiItemUnitId: UNIT, soiOrderQty: 1, soiGodownId: OWN_GODOWN },
      ],
    });

  it("saves a line with no godown in its item's godown; a line that names one keeps it", async () => {
    const { service, saved } = build({
      lineGodowns: new Map([[`${ITEM}|${UNIT}`, godown(ITEM_GODOWN)]]),
    });
    await service.create(twoLines());
    expect(saved[0].items?.map((i) => i.soiGodownId)).toEqual([ITEM_GODOWN, OWN_GODOWN]);
  });

  it('asks the shared sale-line rule for the blank lines only, in the branch the order is saved in', async () => {
    const { service } = build();
    await service.create({ ...twoLines(), soBranchId: PICKED_BRANCH });
    const resolve = jest.mocked(resolveDefaultSaleGodowns);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0][1]).toBe(PICKED_BRANCH);
    expect(resolve.mock.calls[0][2]).toEqual([{ itemId: ITEM, iucId: UNIT }]);
  });

  it('leaves the line without one when neither the item nor the branch gives a godown', async () => {
    const { service, saved } = build({ lineGodowns: new Map([[`${ITEM}|${UNIT}`, null]]) });
    await service.create(twoLines());
    expect(saved[0].items?.map((i) => i.soiGodownId)).toEqual([undefined, OWN_GODOWN]);
  });

  it('withLineGodowns fills only blank lines, per item and unit, and copies, never mutates', () => {
    const lines = [
      { soiItemId: ITEM, soiItemUnitId: UNIT, soiGodownId: null },
      { soiItemId: ITEM, soiItemUnitId: UNIT, soiGodownId: '' },
      { soiItemId: ITEM, soiItemUnitId: OTHER_UNIT },
      { soiItemId: ITEM, soiItemUnitId: UNIT, soiGodownId: OWN_GODOWN },
    ];
    const byLine = new Map([
      [`${ITEM}|${UNIT}`, godown(ITEM_GODOWN)],
      [`${ITEM}|${OTHER_UNIT}`, godown(OWN_GODOWN, 'karur')],
    ]);
    expect(withLineGodowns(lines, byLine).map((l) => l.soiGodownId)).toEqual([
      ITEM_GODOWN,
      ITEM_GODOWN,
      OWN_GODOWN,
      OWN_GODOWN,
    ]);
    expect(lines[0].soiGodownId).toBeNull();
    expect(withLineGodowns(lines, new Map())).toEqual(lines);
  });
});

describe('MobileOrderService.create: WhatsApp on Post (user, 2026-11-19)', () => {
  it('fires after the commit for an order this call confirmed, with waOnPost undefined', async () => {
    const block = { wmlId: 'w1', accYear: '2026-2027', status: 'SENDING' };
    const { service, whatsappAfterPost, prisma, postInTx } = build({
      whatsapp: async () => block,
    });
    const answer = await service.create(dto({ soBranchId: PICKED_BRANCH }));
    expect(whatsappAfterPost).toHaveBeenCalledTimes(1);
    expect(whatsappAfterPost).toHaveBeenCalledWith(
      { soId: SO_ID, soCompanyId: COMPANY, soBranchId: PICKED_BRANCH, soAccYear: '2026-2027' },
      undefined,
    );
    // After the transaction returned, not inside it.
    const txDone = (prisma.$transaction as jest.Mock).mock.results[0].value as Promise<unknown>;
    await txDone;
    expect(postInTx.mock.invocationCallOrder[0]).toBeLessThan(
      whatsappAfterPost.mock.invocationCallOrder[0],
    );
    expect(answer).toEqual(expect.objectContaining({ soStatus: 'CONFIRMED', whatsapp: block }));
  });

  it('answers no whatsapp block when the company setting asked for nothing', async () => {
    const { service } = build();
    const answer = await service.create(dto());
    expect(answer).not.toHaveProperty('whatsapp');
  });

  it('is not fired for a DRAFT kept by a refusal, an already confirmed order, or a resend', async () => {
    const refused = build({
      post: () =>
        Promise.reject(
          new ConflictException({
            message: 'Conflict',
            errors: [{ field: 'soOrderDate', code: 'SALES_DAY_CLOSED', message: 'closed' }],
          }),
        ),
    });
    await refused.service.create(dto());
    expect(refused.whatsappAfterPost).not.toHaveBeenCalled();

    // postInTx answering an order as it already was (no confirmedNow).
    const repeat = build({ post: async () => ({ soStatus: 'CONFIRMED', warnings: [] }) });
    await repeat.service.create(dto());
    expect(repeat.whatsappAfterPost).not.toHaveBeenCalled();

    const resend = build({
      stored: {
        soId: SO_ID,
        soOrderRefno: 'sor00042',
        soStatus: 'CONFIRMED',
        soAccYear: '2026-2027',
        soIsDeleted: false,
        soCustId: CUSTOMER,
      },
    });
    await resend.service.create(dto());
    expect(resend.whatsappAfterPost).not.toHaveBeenCalled();
  });

  it('never fails the upload, even if the step throws', async () => {
    const { service } = build({ whatsapp: () => Promise.reject(new Error('relay down')) });
    const answer = await service.create(dto());
    expect(answer).toEqual(expect.objectContaining({ soStatus: 'CONFIRMED', duplicate: false }));
    expect(answer).not.toHaveProperty('whatsapp');
  });
});

describe("MobileOrderService.create: the desktop's figures (user, 2026-11-20)", () => {
  /** BILL ITEM as sor00011 / sor00012 had it: 105 a box, GST 0 inclusive, MRP 150, cost 100. */
  const billItemLine = {
    soiItemId: ITEM,
    soiItemUnitId: UNIT,
    soiPriceLevel: 1,
    soiOrderQty: 2,
    soiNetQty: 2,
    soiRate: 105,
    soiMaxPrice: 150,
    soiIsTaxIncl: true,
    soiTaxPerc: 0,
    soiTaxAmt: 0,
    soiGrossAmt: 210,
    soiTaxableAmt: 210,
    soiNetAmt: 210,
  };
  const lookupAnswer = {
    sales_price: 105,
    cost_price: 100,
    cost_wot: 100,
    max_price: 150,
    min_price: 0,
    add_freight: true,
    service_item: 'N',
    barcode: '8901',
    hsn_code: '9999',
    iuc_uom_weight: 1.5,
    stock: 0,
  };

  it('asks the item lookup the desktop asks, per line, and fills the line as the desktop does', async () => {
    const { service, saved, getItemPriceLookup } = build({
      lineGodowns: new Map([[`${ITEM}|${UNIT}`, godown(ITEM_GODOWN)]]),
      itemPrice: async () => lookupAnswer,
    });
    await service.create(dto({ items: [billItemLine] }));
    expect(getItemPriceLookup).toHaveBeenCalledWith({
      item_id: ITEM,
      unit_id: UNIT,
      company_id: COMPANY,
      branch_id: DEVICE_BRANCH,
      customer_id: CUSTOMER,
      godown_id: ITEM_GODOWN,
      acccyear: '2026-2027',
      price_level: 1,
      doc_date: '2026-11-18',
      regional: false,
    });
    expect(saved[0].items?.[0]).toEqual(
      expect.objectContaining({
        soiGodownId: ITEM_GODOWN,
        soiIsRateLocked: false,
        soiActPrice: 105,
        soiRateDiff: 0,
        soiCostPrice: 100,
        soiCostPreTax: 100,
        soiRatePreTax: 105,
        soiNetGross: 210,
        soiChrgBeforeTax: 0,
        soiChrgAfterTax: 0,
        soiSoldPrice: 105,
        soiSoldPreTax: 105,
        soiItemProfit: 5,
        soiProfitPreTax: 5,
        soiMrpSavings: 90,
        soiMrpSavingsPerc: 30,
        soiHasFreight: true,
        soiIsService: false,
        soiEanCode: '8901',
        soiHsnCode: '9999',
        soiWeightQty: 1.5,
        soiAvailableStock: 0,
        soiMaxPrice: 150,
      }),
    );
  });

  it("fills the header: the customer's GST snapshot, the settings, cost / margin / savings", async () => {
    const { service, saved } = build({
      itemPrice: async () => lookupAnswer,
      settings: {
        'sales.freight_calc_type': 'manual',
        'sales.loading_calc_type': 'manual',
        'sales.disc_alter_base_rate': 'false',
        'sales.round_off_step': '1',
        'sales.default_delivery_mode': 'HOME_DELIVERY',
        'sales.something_else': 'x',
      },
    });
    await service.create(dto({ items: [billItemLine] }));
    expect(saved[0]).toEqual(
      expect.objectContaining({
        soCustGstType: 'UNREGISTERED',
        soCustStcd: '33',
        soPosStcd: '33',
        soStateName: 'Tamil Nadu',
        soAgentCommPerc: 0,
        soAgentCommAmt: 0,
        soFreightCalcType: 'manual',
        soLoadingCalcType: 'manual',
        soDiscAlterBase: false,
        soRoundOffStep: 1,
        soDeliveryMode: 'HOME_DELIVERY',
        soTotalCost: 200,
        soMarginAmt: 10,
        soMarginPerc: 4.76,
        soMrpSavings: 90,
        soMrpSavingsPerc: 30,
      }),
    );
  });

  it("keeps what the phone sent, and a line the lookup can't price still gets its own figures", async () => {
    const { service, saved } = build({ settings: {} });
    await service.create(
      dto({ soDeliveryMode: 'STORE_PICKUP', items: [{ ...billItemLine, soiIsRateLocked: true }] }),
    );
    const line = saved[0].items![0];
    expect(line.soiIsRateLocked).toBe(true);
    expect(line).toEqual(
      expect.objectContaining({ soiRatePreTax: 105, soiSoldPrice: 105, soiMrpSavings: 90 }),
    );
    // No cost without the lookup: no profit, no cost roll-up.
    expect(line.soiCostPrice).toBeUndefined();
    expect(line.soiItemProfit).toBeUndefined();
    expect(saved[0].soTotalCost).toBeUndefined();
    expect(saved[0].soDeliveryMode).toBe('STORE_PICKUP');
  });
});
