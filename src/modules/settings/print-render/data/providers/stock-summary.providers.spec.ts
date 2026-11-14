import { GoneException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { StockSummaryService } from '../../../../stocks/reports/stock-summary/stock-summary.service';
import type {
  ExportPayload,
  SummaryRow,
} from '../../../../stocks/reports/stock-summary/types/stock-summary.types';
import { ProviderRequest } from '../print-data-provider.types';
import {
  STOCK_SUMMARY_PRINT_PROVIDERS,
  StockSummaryHeadProvider,
  StockSummaryPrintSource,
  StockSummaryRowsProvider,
  summaryHeadRow,
  summaryPrintRow,
} from './stock-summary.providers';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const SAW = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const RUN = '3009a76a-ac6c-49af-ac97-c7b5f4e3c3e6';
const GROUP = '019c8045-bbc9-77dd-9668-774331e02b4e';

const requestFor = (params: Record<string, unknown>, docId: string | null = null, rowLimit = 500) =>
  ({
    context: {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: null,
      docId,
      userId: USER,
      deviceId: null,
    },
    params,
    lang: 'en-IN',
    rowLimit,
  }) as ProviderRequest;

const row = (over: Partial<SummaryRow> = {}): SummaryRow => ({
  itemId: 'i1',
  code: 'SM-1',
  name: 'Samsung H1',
  barcode: null,
  sku: null,
  groupId: null,
  groupName: 'coffee powder',
  brandId: null,
  brandName: null,
  sectionId: null,
  sectionName: null,
  categoryId: null,
  categoryName: null,
  unit: { name: 'pcs', factor: '1.000000', isBase: true },
  defaultUnitId: null,
  valuation: 'WAVG',
  otherCompany: false,
  opening: '0.000',
  inward: '3320.000',
  outward: '0.000',
  closing: '3320.000',
  reserved: '10.000',
  available: '3310.000',
  inTransit: '0.000',
  rate: '23.83',
  value: '79130.77',
  openingValue: '0.00',
  inwardValue: '78844.47',
  outwardValue: '0.00',
  costAdj: '286.30',
  nonSaleableValue: '2383.46',
  lastSale: '2026-11-10',
  chips: [],
  tie: {
    equal: true,
    qtyEqual: true,
    valueEqual: true,
    stockNowQty: '3320.000',
    stockNowValue: '79130.77',
  },
  ...over,
});

const payload = (rows: SummaryRow[], todayOnly = true): ExportPayload => ({
  head: {
    runId: RUN,
    kind: 'ITEMS',
    asOf: '2026-11-14T14:47:30+05:30',
    expiresAt: '2026-11-14T15:02:30+05:30',
    companyId: COMPANY,
    companyName: 'Amazon Retail India Private Limited',
    branchId: BRANCH,
    branchName: 'Acme Foods - Coimbatore Branch',
    from: '2026-11-01',
    to: '2026-11-14',
    todayOnly,
    godownId: null,
    godownName: null,
    groupId: null,
    groupName: null,
    brandId: null,
    brandName: null,
    bucket: 'SALEABLE',
    valueAt: 'WITHOUT_TAX',
    qtyIn: 'BASE',
    noSaleDays: 60,
    rights: { print: true, export: true },
  },
  printedAs:
    'Acme Foods - Coimbatore Branch · 01/11/2026 → 14/11/2026 · All godowns · Saleable · cost without tax · hide zero',
  tab: 'ITEMS',
  rows,
  totals: {
    rows: 48,
    rowsShown: 38,
    openingValue: '141606.15',
    inwardValue: '159797.75',
    outwardValue: '123511.03',
    costAdj: '208.54',
    closingValue: '178101.41',
  },
  transitOut: {
    checked: true,
    source: 'STOCK_TRANSIT',
    transfers: 1,
    items: 1,
    value: '502.20',
    docs: [],
  },
  tie: { checked: true, items: 48, equal: 48, differ: 0, valueChecked: true },
  totalRows: rows.length,
});

function makeSource(result: ExportPayload | Error) {
  const printData = jest.fn(async (_input: unknown) => {
    if (result instanceof Error) throw result;
    return result;
  });
  const summary = { printData } as unknown as StockSummaryService;
  const prisma = {
    $queryRaw: jest.fn(async () => [{ name: 'VK POS' }]),
  } as unknown as PrismaService;
  return { source: new StockSummaryPrintSource(summary, prisma), printData };
}

describe('Stock Summary print providers', () => {
  it('registers two codes, head (one) and rows (many)', () => {
    const { source } = makeSource(payload([]));
    const [head, rows] = STOCK_SUMMARY_PRINT_PROVIDERS.map((P) => new P(source));
    expect([head.code, head.cardinality, rows.code, rows.cardinality]).toEqual([
      'reports.stock_summary.head',
      'one',
      'reports.stock_summary.rows',
      'many',
    ]);
  });

  it('turns the prompts into the report’s own Show query; the company is the docId when it is one', async () => {
    const { source } = makeSource(payload([]));
    const q = await source.query(
      requestFor(
        {
          from_date: '2026-11-01',
          to_date: '2026-11-14',
          group_id: GROUP,
          bucket: 'all',
          value_at: 'with_tax',
          qty_in: 'default',
          no_sale_days: 30,
          hide_zero: false,
          only_negative: true,
          show: 'negative',
          sort: 'VALUE',
          dir: 'DESC',
        },
        SAW,
      ),
    );
    expect(q).toMatchObject({
      companyId: SAW,
      branchId: BRANCH,
      from: '2026-11-01',
      to: '2026-11-14',
      groupId: GROUP,
      bucket: 'ALL',
      valueAt: 'WITH_TAX',
      qtyIn: 'DEFAULT',
      noSaleDays: 30,
      hideZero: false,
      onlyNegative: true,
      show: 'NEGATIVE',
      sort: 'value',
      dir: 'desc',
    });
    const plain = await source.query(
      requestFor({ from_date: '2026-11-01', to_date: '2026-11-14' }, 'not-a-uuid'),
    );
    expect(plain?.companyId).toBe(COMPANY);
  });

  it('run_id alone reads the run; with dates it may build one; bad prompts are refused', async () => {
    const { source, printData } = makeSource(payload([row()]));
    await new StockSummaryRowsProvider(source).resolve(requestFor({ run_id: RUN.toUpperCase() }));
    expect(printData).toHaveBeenLastCalledWith({ runId: RUN, query: null, view: {} });
    // run_id alone still carries the view and the group drill
    await source.data(
      requestFor({ run_id: RUN, group_by: 'brand', group_key: 'none', sort: 'VALUE' }),
    );
    expect(printData.mock.calls[1][0]).toMatchObject({
      runId: RUN,
      query: null,
      view: { groupBy: 'BRAND', groupKey: 'NONE', sort: 'value' },
    });
    await source.data(requestFor({ run_id: RUN, from_date: '2026-11-01', to_date: '2026-11-14' }));
    expect(printData.mock.calls[2][0]).toMatchObject({ runId: RUN, query: { from: '2026-11-01' } });
    await source.data(
      requestFor({
        from_date: '2026-11-01',
        to_date: '2026-11-14',
        group_by: 'GROUP',
        group_key: GROUP,
      }),
    );
    expect(printData.mock.calls[3][0]).toMatchObject({
      runId: null,
      query: { groupBy: 'GROUP', groupKey: GROUP },
      view: { groupBy: 'GROUP', groupKey: GROUP },
    });
    await expect(source.data(requestFor({ run_id: RUN, group_by: 'NOPE' }))).rejects.toThrow(
      /not what the Stock Summary takes/,
    );
    await expect(source.query(requestFor({ from_date: '2026-11-01' }))).rejects.toThrow(
      /not what the Stock Summary takes/,
    );
    await expect(source.data(requestFor({ run_id: 'x' }))).rejects.toThrow(/not a run/);
  });

  it('passes the report’s refusal sentence through', async () => {
    const { source } = makeSource(
      new GoneException({
        success: false,
        message: 'Stock Summary run expired',
        errors: [
          { code: 'STOCK_SUMMARY_RUN_EXPIRED', message: 'This report run is gone. Show again.' },
        ],
      }),
    );
    await expect(
      new StockSummaryHeadProvider(source).resolve(requestFor({ run_id: RUN })),
    ).rejects.toThrow('This report run is gone. Show again.');
  });

  it('the head row', async () => {
    const { source } = makeSource(payload([row()]));
    const head = await new StockSummaryHeadProvider(source).resolve(requestFor({ run_id: RUN }));
    expect(head).toMatchObject({
      title: 'STOCK SUMMARY',
      branch_name: 'Acme Foods - Coimbatore Branch',
      period_text: '01/11/2026 to 14/11/2026',
      as_of_text: 'as of 14/11/2026 02:47 PM',
      value_at_text: 'Cost without tax',
      qty_in_text: 'Qty in base unit',
      items_text: '38 of 48 items',
      closing_value: 178101.41,
      cost_adj: 208.54,
      transit_out_text:
        'Sent from this branch, not received yet: 1 item(s) on 1 transfer(s), value 502.20',
      tie_text: '= Stock now ✓ 48 of 48 items',
      printed_by: 'VK POS',
    });
    expect(
      summaryHeadRow(payload([], false), null, new Date('2026-11-14T09:50:00Z')).printed_at,
    ).toBe('14/11/2026 03:20 PM');
  });

  it('the data rows: as the grid, "—" columns off for a past to, capped at the row limit', async () => {
    const { source } = makeSource(
      payload([
        row(),
        row({
          itemId: 'i2',
          closing: '-12.000',
          value: '-1008.00',
          chips: [{ kind: 'NEGATIVE' }, { kind: 'NO_SALE', days: 61 }],
        }),
      ]),
    );
    const rows = await new StockSummaryRowsProvider(source).resolve(
      requestFor({ run_id: RUN }, null, 1),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sl_no: 1,
      name: 'Samsung H1',
      closing: 3320,
      value: 79130.77,
      last_sale: '10/11/2026',
      today_only: true,
      reserved: 10,
      negative: false,
    });
    const neg = summaryPrintRow(
      row({ closing: '-12.000', chips: [{ kind: 'NEGATIVE' }, { kind: 'NO_SALE', days: 61 }] }),
      1,
      false,
    );
    expect(neg).toMatchObject({
      sl_no: 2,
      closing: -12,
      chips_text: 'NEGATIVE · NO SALE 61 D',
      negative: true,
      today_only: false,
      reserved: null,
      available: null,
      in_transit: null,
    });
  });
});
