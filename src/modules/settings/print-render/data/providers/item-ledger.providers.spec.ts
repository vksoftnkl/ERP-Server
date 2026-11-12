import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { ItemLedgerService } from '../../../../stocks/reports/item-ledger/item-ledger.service';
import type {
  ExportPayload,
  LedgerRow,
} from '../../../../stocks/reports/item-ledger/types/item-ledger.types';
import { ProviderRequest } from '../print-data-provider.types';
import {
  ITEM_LEDGER_PRINT_PROVIDERS,
  ItemLedgerHeadProvider,
  ItemLedgerPrintSource,
  ItemLedgerRowsProvider,
  headRow,
  ledgerPrintRow,
} from './item-ledger.providers';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const ITEM = '01a0d242-5613-71ef-93af-d41e1cca9f16';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';

const requestFor = (params: Record<string, unknown>, rowLimit = 500) =>
  ({
    context: {
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: null,
      docId: null,
      userId: USER,
      deviceId: null,
    },
    params,
    lang: 'en-IN',
    rowLimit,
  }) as ProviderRequest;

const row = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  rowId: 'r1',
  seq: 1,
  date: '2026-11-03',
  time: '11:20 AM',
  postedAt: '2026-11-03T11:20:41+05:30',
  type: 'SALE',
  typeLabel: 'Sale',
  kind: 'OUT',
  state: 'LIVE',
  docNo: 'bil00881',
  revision: null,
  doc: { kind: 'SALE_BILL', id: 'b1', accYear: '2026-2027', branchId: BRANCH },
  party: { id: null, label: 'Counter (cash)', walkIn: true },
  detail: '',
  godownId: GODOWN,
  godownName: 'Coimbatore',
  toGodownName: null,
  bucket: 'SALEABLE',
  toBucket: null,
  lotId: null,
  batchNo: 'BH2609A',
  expiry: null,
  receivedQty: null,
  issuedQty: '10.000',
  movedQty: null,
  freeQty: '0.000',
  balanceQty: '290.000',
  balanceValue: '8091.00',
  costRate: '27.90',
  costValue: '-279.00',
  docRate: '29.00',
  user: 'VKPOS1',
  reversal: null,
  reverses: null,
  ...over,
});

const payload = (rows: LedgerRow[]): ExportPayload => ({
  head: {
    companyId: COMPANY,
    companyName: 'Amazon Retail India Private Limited',
    branchId: BRANCH,
    branchName: 'Acme Foods - Coimbatore Branch',
    itemId: ITEM,
    itemCode: 'ZT-A',
    itemName: 'ZT-ITEM-A',
    from: '2026-11-01',
    to: '2026-11-10',
    godownId: null,
    godownName: null,
    bucket: 'SALEABLE',
    lotId: null,
    batchNo: null,
    unit: { unitId: 'u1', name: 'PCS', factor: '1.000000', isBase: true },
    valueAt: 'WITHOUT_TAX',
    order: 'asc',
    showReversed: true,
    types: [],
    revaluationsLeftOut: 0,
    rights: { print: true, export: true },
  },
  printedAs: 'ZT-ITEM-A · 01/11/2026 to 10/11/2026',
  opening: {
    date: '2026-11-01',
    closingOf: '2026-10-31',
    qty: '300.000',
    value: '8370.00',
    rate: '27.90',
    lots: 2,
  },
  closing: { date: '2026-11-10', qty: '290.000', value: '8091.00', rate: '27.90' },
  totals: {
    receivedQty: '0.000',
    issuedQty: '10.000',
    valueIn: '0.00',
    valueOut: '279.00',
    rows: 2,
    rowsShown: 1,
    docs: 1,
    internalMoves: 0,
    reversedPairs: 0,
    revaluations: 0,
  },
  rows,
  totalRows: rows.length,
});

function makeSource(result: ExportPayload | Error) {
  const exportFn = jest.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  const ledger = { export: exportFn } as unknown as ItemLedgerService;
  const prisma = {
    $queryRaw: jest.fn(async () => [{ name: 'VK POS' }]),
  } as unknown as PrismaService;
  return { source: new ItemLedgerPrintSource(ledger, prisma), exportFn };
}

describe('Item Ledger print providers', () => {
  it('registers two codes, head (one) and rows (many)', () => {
    const { source } = makeSource(payload([]));
    const [head, rows] = ITEM_LEDGER_PRINT_PROVIDERS.map((P) => new P(source));
    expect([head.code, head.cardinality, rows.code, rows.cardinality]).toEqual([
      'reports.item_ledger.head',
      'one',
      'reports.item_ledger.rows',
      'many',
    ]);
  });

  it('turns the prompts into the report’s own export query', async () => {
    const { source } = makeSource(payload([]));
    const q = await source.query(
      requestFor({
        item_id: ITEM,
        from_date: '2026-11-01',
        to_date: '2026-11-10',
        godown_id: GODOWN,
        bucket: 'all',
        types: 'sale,purchase',
        value_at: 'with_tax',
        show_reversed: false,
        order: 'DESC',
      }),
    );
    expect(q).toMatchObject({
      companyId: COMPANY,
      branchId: BRANCH,
      itemId: ITEM,
      from: '2026-11-01',
      to: '2026-11-10',
      godownId: GODOWN,
      bucket: 'ALL',
      types: ['SALE', 'PURCHASE'],
      valueAt: 'WITH_TAX',
      showReversed: false,
      order: 'desc',
    });
  });

  it('refuses prompts the report would refuse', async () => {
    const { source } = makeSource(payload([]));
    await expect(
      source.query(requestFor({ item_id: ITEM, from_date: '2026-11-01' })),
    ).rejects.toThrow(/not what the Item Ledger takes/);
  });

  it('passes the report’s refusal sentence through', async () => {
    const { source } = makeSource(
      new UnprocessableEntityException({
        errors: [
          {
            code: 'ITEM_LEDGER_TOO_MANY_ROWS',
            message: '20001 rows — Print and Excel take up to 20000.',
          },
        ],
      }),
    );
    const provider = new ItemLedgerRowsProvider(source);
    await expect(
      provider.resolve(
        requestFor({ item_id: ITEM, from_date: '2026-11-01', to_date: '2026-11-10' }),
      ),
    ).rejects.toThrow('20001 rows — Print and Excel take up to 20000.');
  });

  it('the head row', async () => {
    const { source } = makeSource(payload([row()]));
    const head = await new ItemLedgerHeadProvider(source).resolve(
      requestFor({ item_id: ITEM, from_date: '2026-11-01', to_date: '2026-11-10' }),
    );
    expect(head).toMatchObject({
      title: 'ITEM LEDGER',
      item_label: 'ZT-A · ZT-ITEM-A',
      period_text: '01/11/2026 to 10/11/2026',
      godown_name: 'All godowns',
      value_at_text: 'Cost without tax',
      opening_text: 'Opening balance · closing of 31/10/2026',
      opening_qty: 300,
      closing_qty: 290,
      issued_qty: 10,
      rows_note: '1 of 2 rows (filtered)',
      printed_by: 'VK POS',
    });
    expect(headRow(payload([]), null, new Date('2026-11-11T09:50:00Z')).printed_at).toBe(
      '11/11/2026 03:20 PM',
    );
  });

  it('the data rows, capped at the dataset’s row limit', async () => {
    const { source } = makeSource(
      payload([
        row(),
        row({ seq: 2, state: 'REVERSAL', issuedQty: '-10.000' }),
        row({
          seq: 3,
          kind: 'INTERNAL',
          typeLabel: 'Godown transfer',
          issuedQty: null,
          movedQty: '24.000',
          toGodownName: 'Trichy',
          party: null,
          detail: 'Coimbatore → Trichy',
        }),
      ]),
    );
    const rows = await new ItemLedgerRowsProvider(source).resolve(
      requestFor({ item_id: ITEM, from_date: '2026-11-01', to_date: '2026-11-10' }, 2),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sl_no: 1,
      date_text: '03/11/2026',
      type_label: 'Sale',
      state_chip: '',
      greyed: false,
      party_detail: 'Counter (cash)',
      issued_qty: 10,
      received_qty: null,
      balance_qty: 290,
      cost_value: -279,
    });
    expect(rows[1]).toMatchObject({ state_chip: 'REVERSAL', greyed: true, issued_qty: -10 });
    expect(
      ledgerPrintRow(
        row({
          kind: 'INTERNAL',
          movedQty: '24.000',
          toGodownName: 'Trichy',
          issuedQty: null,
          party: null,
          detail: 'Coimbatore → Trichy',
        }),
        0,
      ),
    ).toMatchObject({
      godown: 'Coimbatore → Trichy',
      moved_text: '24.000 ↔ internal',
      party_detail: 'Coimbatore → Trichy',
    });
  });
});
