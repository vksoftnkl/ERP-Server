import { Prisma } from '@prisma/client';
import type { BillLineFacts } from '../../../../sales/delivery/core/delivery-pending.service';
import { decodeDeliveryQr } from '../../../../sales/delivery/core/delivery-qr';
import type { DeliveryLineView } from '../../../../sales/delivery/delivery-note-read.service';
import { ProviderRequest } from '../print-data-provider.types';
import {
  billDeliveryRow,
  DELIVERY_PRINT_PROVIDERS,
  DeliveryPrintSource,
  gatePassHeadRow,
  gatePassLineRows,
  GodownSlipLinesProvider,
  GodownSlipHeadProvider,
  type NotePayload,
  type OpenLine,
  pendingHeadRow,
  pendingRows,
  type PendingDbRow,
  pickListHeadRow,
  pickListRows,
  type PickLine,
  stillToComeRows,
} from './delivery.providers';

/**
 * Delivery tracking P5, test block R (plan §11.1 R + addendum §8.1 R): the gate
 * pass head / lines / still-to-come carry no price; came back after a goods back;
 * the godown slip is per godown; delivery_qr only on Pickup / Dispatch bills.
 */

const D = (v: string | number) => new Prisma.Decimal(v);
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const GD = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const GT = '019d2e48-7af3-7d5c-82a7-2eb57fdabf1c';
const NOTE = '01a1e303-8daa-7d8c-9275-f7f62f7107b4';
const BILL_A = '01a1e303-8b11-7f00-8c1c-111111111111';
const BILL_B = '01a1e303-8b22-7f00-8c1c-222222222222';
const AT = new Date('2026-11-16T06:22:00Z'); // 11:52 AM IST

/** Every key whose name smells of money. A gate pass / slip / list carries none (Q7, inset D). */
const PRICE_KEY = /rate|price|amount|amt|value|mrp|tax|disc|total_amt/i;
const priceKeys = (rows: readonly Record<string, unknown>[]) =>
  rows.flatMap((r) => Object.keys(r).filter((k) => PRICE_KEY.test(k)));

const line = (over: Partial<DeliveryLineView> = {}): DeliveryLineView => ({
  sdniId: 's1',
  lineNo: 1,
  billId: BILL_A,
  billAccYear: '2026-2027',
  billRefno: 'bil04539',
  billItemId: 'bi1',
  billLineNo: 1,
  itemId: 'i1',
  itemCode: null,
  itemName: 'ZTA-DLV-WT',
  unitId: 'u1',
  unitName: 'PCS',
  toBaseFactor: '1',
  billGodownId: GD,
  billGodownName: 'Coimbatore',
  godownId: GD,
  godownName: 'Coimbatore',
  billLotId: null,
  billLotNo: null,
  lotId: null,
  lotNo: null,
  bucket: 'SALEABLE',
  billedQty: '6.000',
  givenBeforeQty: '0.000',
  pendingQty: '3.000',
  qty: '4.000',
  baseQty: '4',
  unitKg: '20.000',
  weightKg: '80.000',
  scannedQty: '0.000',
  goodsBackQty: '1.000',
  lotSwap: false,
  otherGodown: false,
  otherGodownOk: false,
  shelfQty: '16.000',
  barcodes: [],
  lastGiven: null,
  lastGoodsBack: { at: '16-11-2026 11:50 AM', by: 'VKPOS', reason: 'refused' },
  remarks: null,
  ...over,
});

const payload = (over: Partial<NotePayload['note']> = {}, lines = [line()]): NotePayload => ({
  note: {
    sdnId: NOTE,
    sdnAccYear: '2026-2027',
    sdnRefno: 'DN/2026-2027/D9/00088',
    deviceCode: 'D9',
    sdnDate: '2026-11-16',
    sdnDatetime: '2026-11-16T06:20:00.000Z',
    sdnStatus: 'POSTED',
    sdnGodownId: GD,
    godownName: 'Coimbatore',
    sdnMode: 'SELF',
    sdnVehicleNo: null,
    vehicleCapacityKg: null,
    driverName: null,
    loadmanNames: [],
    supervisorName: null,
    sdnCollectedBy: 'ZT Collector',
    sdnCollectorPhone: '9000000005',
    transport: { transporterName: null, lrNo: null, lrDate: null },
    sdnRemarks: null,
    sdnPrintCount: 0,
    postedOn: '2026-11-16T06:20:00.000Z',
    postedBy: 'VKPOS',
    cancelledOn: null,
    cancelledBy: null,
    cancelReason: null,
    goodsBackPkgs: '1.000',
    qrToken: 'NXD1-01M7HG73DAFP694XFQYRQQ21XM-2627-5D',
    ...over,
  },
  bills: [
    {
      billId: BILL_A,
      billAccYear: '2026-2027',
      billRefno: 'bil04539',
      billDate: '2026-11-16',
      custId: 'c1',
      custName: 'ZTQ-DLV-CUST90',
      areaName: 'MUSIRI',
      cityName: 'Trichy',
      mode: 'PICKUP',
      salesmanNames: '',
      statusNow: 'PART',
      linesHere: 1,
      linesElsewhere: 1,
    },
  ],
  lines,
});

const open = (over: Partial<OpenLine> = {}): OpenLine => ({
  billId: BILL_A,
  billRefno: 'bil04539',
  billItemId: 'bi1',
  lineNo: 1,
  itemName: 'ZTA-DLV-WT',
  unitName: 'PCS',
  godownId: GD,
  godownName: 'Coimbatore',
  lotNo: null,
  pendingQty: D(3),
  ...over,
});

const facts = { companyName: 'Amazon Retail', branchName: 'Acme Foods - Coimbatore Branch', cameBackAt: AT, printedBy: 'VKPOS', at: AT };

describe('GATE_PASS (sales.delivery_note.*)', () => {
  it('head: the note, the crew rows, the QR and its 12-character caption, totals and came back — IST 12-hour', () => {
    const head = gatePassHeadRow(payload(), 2, facts);
    expect(head).toMatchObject({
      title: 'GATE PASS / DELIVERY NOTE',
      refno: 'DN/2026-2027/D9/00088',
      godown_name: 'Coimbatore',
      date_text: '16/11/2026 11:50 AM',
      info_1_label: 'Collected by',
      info_1_text: 'ZT Collector  9000000005',
      info_2_label: '',
      qr_token: 'NXD1-01M7HG73DAFP694XFQYRQQ21XM-2627-5D',
      qr_caption: '21XM-2627-5D',
      lines_count: 1,
      bills_count: 1,
      given_text: '4',
      weight_text: '80',
      totals_text: '1 line · 1 bill',
      came_back_pkgs: 1,
      came_back_text: '1 pkg came back on 16/11/2026 11:52 AM',
      still_count: 2,
      still_title: 'Still to come on these bills:',
      status_mark: '',
      copy_mark: '',
      printed_line: 'Printed 16/11/2026 11:52 AM · VKPOS · device D9',
    });
    expect(decodeDeliveryQr(head.qr_token as string)).toEqual({ kind: 'NOTE', id: NOTE, accYear: '2026-2027' });
    expect(priceKeys([head])).toEqual([]);
  });

  it('head: a reprint says DUPLICATE; a vehicle note lists vehicle, transporter and crew; draft / cancelled are marked', () => {
    const head = gatePassHeadRow(
      payload({
        sdnPrintCount: 1,
        sdnMode: 'VEHICLE',
        sdnVehicleNo: 'TN38AC2579',
        driverName: 'Mani',
        loadmanNames: ['Kumar', 'Ravi'],
        supervisorName: 'Bala',
        transport: { transporterName: 'ZT Lorry', lrNo: 'LR9', lrDate: '2026-11-15' },
        goodsBackPkgs: '0.000',
      }),
      0,
      facts,
    );
    expect(head).toMatchObject({
      is_reprint: true,
      copy_mark: 'DUPLICATE',
      info_1_label: 'Vehicle',
      info_1_text: 'TN38AC2579   Driver: Mani',
      info_2_label: 'Transporter',
      info_2_text: 'ZT Lorry   LR LR9 dt 15/11/2026',
      info_3_label: 'Loadmen',
      info_3_text: 'Kumar, Ravi   Supervisor: Bala',
      came_back_text: '',
      still_title: 'Nothing more to come on these bills.',
    });
    expect(gatePassHeadRow(payload({ sdnStatus: 'DRAFT' }), 0, facts)).toMatchObject({
      status_mark: 'DRAFT - NOT A GATE PASS',
      date_text: '16/11/2026',
    });
    expect(
      gatePassHeadRow(
        payload({ sdnStatus: 'CANCELLED', cancelledOn: '2026-11-16T07:00:00Z', cancelledBy: 'VKPOS', cancelReason: 'wrong lorry' }),
        0,
        facts,
      ),
    ).toMatchObject({ status_mark: 'CANCELLED', cancelled_text: 'Cancelled 16/11/2026 12:30 PM by VKPOS: wrong lorry' });
  });

  it('lines: only lines with something given, kg without trailing zeros, came back per line, no price', () => {
    const rows = gatePassLineRows(
      payload({}, [
        line(),
        line({ sdniId: 's2', lineNo: 2, qty: '0.000', weightKg: '0' }),
        line({
          sdniId: 's3',
          lineNo: 3,
          itemName: 'ZTA-DLV-ITEM',
          qty: '2.500',
          weightKg: '8.333',
          goodsBackQty: '0.000',
          lotSwap: true,
          lotNo: 'L2',
          billLotNo: 'L1',
          otherGodown: true,
          billGodownName: 'Trichy',
        }),
      ]),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sl_no: 1,
      bill_refno: 'bil04539',
      cust_name: 'ZTQ-DLV-CUST90',
      item_name: 'ZTA-DLV-WT',
      unit_name: 'PCS',
      qty: 4,
      qty_text: '4',
      weight_text: '80',
      came_back_qty: 1,
      came_back_text: 'Came back 1',
    });
    expect(rows[1]).toMatchObject({
      qty_text: '2.5',
      weight_text: '8.333',
      came_back_text: '',
      note_text: 'lot L2 for L1 · billed from Trichy',
    });
    expect(priceKeys(rows)).toEqual([]);
  });

  it('still to come: every open line of the bills (other godowns named), in bill then line order; a draft takes its own qty off', () => {
    const lines = [open({ lineNo: 2, billItemId: 'bi2', itemName: 'ZTA-DLV-ITEM', godownId: GT, godownName: 'Trichy', pendingQty: D(4) }), open()];
    const rows = stillToComeRows(payload(), lines);
    expect(rows.map((r) => r.text)).toEqual([
      'bil04539  ZTA-DLV-WT 3 PCS',
      'bil04539  ZTA-DLV-ITEM 4 PCS (Trichy godown)',
    ]);
    expect(priceKeys(rows)).toEqual([]);
    // A draft gives nothing yet: its own 3 come off the line's pending (3 - 3 = 0 → not listed).
    const draft = stillToComeRows(payload({ sdnStatus: 'DRAFT' }, [line({ qty: '3.000' })]), lines);
    expect(draft.map((r) => r.item_name)).toEqual(['ZTA-DLV-ITEM']);
  });
});

describe('SALE_INVOICE delivery_qr (sales.bill.delivery, Q10)', () => {
  const bill = (mode: string) => ({ sb_id: BILL_A, sb_acc_year: '2026-2027', sb_delivery_mode: mode, sb_delivery_status: 'PENDING' });

  it.each(['PICKUP', 'DISPATCH'])('%s: the Godown scan QR (NXB1-) and its caption', (mode) => {
    const row = billDeliveryRow(bill(mode));
    expect(decodeDeliveryQr(row.delivery_qr as string)).toEqual({ kind: 'BILL', id: BILL_A, accYear: '2026-2027' });
    expect(row.delivery_qr_caption).toBe((row.delivery_qr as string).slice(-12));
    expect(row.delivery_qr_label).toBe('Godown scan');
  });

  it('INSTANT (and a bill not found): empty, so the design prints no QR', () => {
    expect(billDeliveryRow(bill('INSTANT'))).toMatchObject({ delivery_qr: '', delivery_qr_caption: '', delivery_qr_label: '' });
    expect(billDeliveryRow(null)).toMatchObject({ delivery_qr: '', delivery_mode: '' });
  });
});

// ── the source, with its reads mocked ────────────────────────────────────────────

const fact = (over: Partial<BillLineFacts> = {}): BillLineFacts => ({
  billItemId: 'bi1',
  billAccYear: '2026-2027',
  billId: BILL_A,
  billRefno: 'bil04539',
  billDate: '2026-11-16',
  companyId: COMPANY,
  branchId: BRANCH,
  billStatus: 'POSTED',
  billDeleted: false,
  billMode: null,
  deliveryMode: 'PICKUP',
  deliveryStatus: 'PENDING',
  custId: 'c1',
  custName: 'ZTQ-DLV-CUST90',
  lineNo: 1,
  splitNo: 0,
  lineDeleted: false,
  isService: false,
  srcDocType: null,
  srcDocRefno: null,
  itemId: 'i1',
  unitId: 'u1',
  godownId: GD,
  lotId: null,
  bucket: 'SALEABLE',
  billedQty: D(6),
  factor: D(1),
  unitKg: D(20),
  settledQty: D(0),
  givenQty: D(0),
  pendingQty: D(6),
  settledBase: D(0),
  givenBase: D(0),
  pendingBase: D(6),
  eligible: true,
  ...over,
});

function source(opts: { bill?: Record<string, unknown>; facts?: BillLineFacts[]; rights?: { view: boolean; print: boolean } } = {}) {
  const rights = opts.rights ?? { view: true, print: true };
  const prisma = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (sql.includes('FROM public.user_menus')) {
        return [{ um_can_view: rights.view, um_can_print: rights.print }];
      }
      if (sql.includes('usr_display_name')) return [{ name: 'VKPOS' }];
      if (sql.includes('FROM sales.sale_bill b') && sql.includes('area_name')) {
        return opts.bill ? [opts.bill] : [];
      }
      if (sql.includes('FROM public.companys c')) return [{ comp_name: 'Amazon Retail', br_name: 'Coimbatore Branch' }];
      return [];
    }),
  };
  const pending = { linesOfBills: jest.fn(async () => opts.facts ?? []) };
  const reader = {
    names: jest.fn(async () => ({
      items: new Map([
        ['i1', { code: null, name: 'ZTA-DLV-WT', barcode: null }],
        ['i2', { code: 'C2', name: 'ZTA-DLV-ITEM', barcode: null }],
      ]),
      units: new Map([['u1', 'PCS']]),
      godowns: new Map([
        [GD, 'Coimbatore'],
        [GT, 'Trichy'],
      ]),
      lots: new Map(),
      eans: new Map(),
    })),
    godownName: jest.fn(async (_c: unknown, id: string) => (id === GD ? 'Coimbatore' : 'Trichy')),
  };
  const salesContext = { setting: jest.fn(async () => null) };
  return {
    src: new DeliveryPrintSource(prisma as never, reader as never, pending as never, salesContext as never),
    prisma,
    pending,
  };
}

const request = (params: Record<string, unknown>, docId: string | null = BILL_A, accYear: string | null = '2026-2027') =>
  ({
    context: { companyId: COMPANY, branchId: BRANCH, accYear, docId, userId: USER, deviceId: null },
    params,
    lang: 'en-IN',
    rowLimit: 500,
  }) as ProviderRequest;

const slipBill = (mode = 'PICKUP') => ({
  sb_id: BILL_A,
  sb_acc_year: '2026-2027',
  sb_bill_refno: 'bil04539',
  sb_bill_date: '2026-11-16',
  sb_bill_datetime: new Date('2026-11-16T06:20:00Z'),
  sb_status: 'POSTED',
  sb_delivery_mode: mode,
  sb_delivery_status: 'PENDING',
  sb_cust_name: 'ZTQ-DLV-CUST90',
  sb_cust_place: null,
  sb_cust_phone: null,
  sb_remarks: null,
  sb_vehicle_no: null,
  comp_name: 'Amazon Retail',
  br_name: 'Coimbatore Branch',
  area_name: 'MUSIRI',
  city_name: 'Trichy',
  salesmen: null,
});

describe('GODOWN_SLIP (sales.bill.godown_slip.*): one godown per slip', () => {
  const twoGodowns = [
    fact(),
    fact({ billItemId: 'bi2', lineNo: 2, itemId: 'i2', godownId: GT, unitKg: D(0), billedQty: D(4), pendingQty: D(4) }),
    fact({ billItemId: 'bi3', lineNo: 3, isService: true, eligible: false }),
    fact({ billItemId: 'bi4', lineNo: 4, pendingQty: D(0) }),
  ];

  it('godown_id = Coimbatore: only its open line, the bill QR, no price', async () => {
    const { src } = source({ bill: slipBill(), facts: twoGodowns });
    const req = request({ godown_id: GD });
    const head = await new GodownSlipHeadProvider(src).resolve(req);
    const lines = await new GodownSlipLinesProvider(src).resolve(req);
    expect(lines.map((l) => [l.item_name, l.qty_text, l.weight_text])).toEqual([['ZTA-DLV-WT', '6', '120']]);
    expect(head).toMatchObject({
      title: 'GODOWN SLIP',
      godown_name: 'Coimbatore',
      bill_refno: 'bil04539',
      bill_date_text: '16/11/2026 11:50 AM',
      cust_place: 'MUSIRI, Trichy',
      lines_count: 1,
      totals_text: '1 line · 6 pkgs · 120 kg',
      status_mark: '',
    });
    expect(decodeDeliveryQr(head.qr_token as string)?.id).toBe(BILL_A);
    expect(priceKeys([head, ...lines])).toEqual([]);
  });

  it('godown_id = Trichy: the other line; blank = every godown', async () => {
    const t = source({ bill: slipBill(), facts: twoGodowns });
    expect((await new GodownSlipLinesProvider(t.src).resolve(request({ godown_id: GT }))).map((l) => l.item_name)).toEqual([
      'ZTA-DLV-ITEM',
    ]);
    const all = source({ bill: slipBill(), facts: twoGodowns });
    const head = await new GodownSlipHeadProvider(all.src).resolve(request({ godown_id: null }));
    expect(head).toMatchObject({ godown_name: 'All godowns', lines_count: 2 });
  });

  it('an Instant bill prints no QR and says so', async () => {
    const { src } = source({ bill: slipBill('INSTANT'), facts: [] });
    expect(await new GodownSlipHeadProvider(src).resolve(request({ godown_id: GD }))).toMatchObject({
      qr_token: '',
      status_mark: 'INSTANT BILL - NOTHING TO GIVE',
    });
  });

  it('a bill not in the company is refused by name; a bad godown_id is refused', async () => {
    await expect(new GodownSlipHeadProvider(source({}).src).resolve(request({ godown_id: GD }))).rejects.toThrow(
      /No sale bill .* in this company/,
    );
    await expect(new GodownSlipHeadProvider(source({ bill: slipBill() }).src).resolve(request({ godown_id: 'x' }))).rejects.toThrow(
      /godown_id: 'x' is not a godown id/,
    );
  });
});

describe('PICK_LIST: one render over the ticked bills (godown → item, with sums)', () => {
  const pl = (over: Partial<PickLine>): PickLine => ({
    godownId: GD,
    godownName: 'Coimbatore',
    itemId: 'i1',
    itemCode: null,
    itemName: 'ZTA-DLV-WT',
    unitId: 'u1',
    unitName: 'PCS',
    billId: BILL_A,
    billRefno: 'bil04539',
    billDate: '2026-11-16',
    custName: 'ZTQ-DLV-CUST90',
    lineNo: 1,
    lotNo: null,
    pendingQty: D(3),
    unitKg: D(20),
    ...over,
  });

  it('groups by godown then item, each row carrying its group sums; no price', () => {
    const rows = pickListRows([
      pl({ godownId: GT, godownName: 'Trichy', billId: BILL_B, billRefno: 'bil04540' }),
      pl({}),
      pl({ godownId: GT, godownName: 'Trichy', itemId: 'i2', itemName: 'ZTA-DLV-ITEM', unitKg: D(0), pendingQty: D(4), lineNo: 2 }),
      pl({ billId: BILL_B, billRefno: 'bil04540', billDate: '2026-11-17', pendingQty: D('1.5') }),
    ]);
    expect(rows.map((r) => [r.godown_name, r.item_no, r.item_name, r.bill_refno, r.qty_text])).toEqual([
      ['Coimbatore', 1, 'ZTA-DLV-WT', 'bil04539', '3'],
      ['Coimbatore', 1, 'ZTA-DLV-WT', 'bil04540', '1.5'],
      ['Trichy', 2, 'ZTA-DLV-ITEM', 'bil04539', '4'],
      ['Trichy', 3, 'ZTA-DLV-WT', 'bil04540', '3'],
    ]);
    expect(rows[0]).toMatchObject({ godown_text: '2 lines · 1 item · 4.5 pkgs · 90 kg', item_text: '4.5 PCS · 90 kg · 2 bills' });
    expect(rows[2]).toMatchObject({ godown_text: '2 lines · 2 items · 7 pkgs · 60 kg', item_text: '4 PCS · 1 bill' });
    expect(priceKeys(rows)).toEqual([]);
    const head = pickListHeadRow(rows, [BILL_A, BILL_B, 'nothing-left'], new Map([[BILL_A, 'bil04539'], [BILL_B, 'bil04540'], ['nothing-left', 'bil00001']]), {
      companyName: 'Amazon Retail',
      branchName: 'Coimbatore',
      godownName: null,
      printedBy: 'VKPOS',
      at: AT,
    });
    expect(head).toMatchObject({
      godown_text: 'All godowns',
      bills_count: 2,
      bills_text: 'bil04539, bil04540',
      totals_text: '2 bills · 2 items · 4 lines · 11.5 pkgs · 150 kg',
      nothing_text: 'Nothing left to give on bil00001',
    });
  });

  it('reads the named bills of the render\'s company + branch (prompt bill_ids) and honours godown_id', async () => {
    const { src, prisma, pending } = source({
      facts: [fact(), fact({ billItemId: 'bi2', lineNo: 2, itemId: 'i2', godownId: GT })],
    });
    prisma.$queryRaw.mockImplementationOnce(async () => [{ um_can_view: true, um_can_print: true }]);
    prisma.$queryRaw.mockImplementationOnce(async () => [{ sb_id: BILL_A, sb_acc_year: '2026-2027', sb_bill_refno: 'bil04539' }]);
    const lines = await src.pickList(request({ bill_ids: `${BILL_A}, ${BILL_A.toUpperCase()}`, godown_id: GT }, COMPANY));
    expect(pending.linesOfBills).toHaveBeenCalledWith(null, [{ billId: BILL_A, billAccYear: '2026-2027' }]);
    expect(lines.lines.map((l) => l.godown_name)).toEqual(['Trichy']);
  });

  it('refusals: no bills, a junk id, no PRINT right on 304', async () => {
    await expect(source().src.pickList(request({ bill_ids: '' }, COMPANY))).rejects.toThrow(/tick at least one bill/);
    await expect(source().src.pickList(request({ bill_ids: 'bil04539' }, COMPANY))).rejects.toThrow(/'bil04539' is not an id/);
    await expect(
      source({ rights: { view: true, print: false } }).src.pickList(request({ bill_ids: BILL_A }, COMPANY)),
    ).rejects.toThrow(/may not print pick lists .*menu 304: um_can_print is not granted/);
  });
});

describe('PENDING_DELIVERIES: the bills as the screen lists them', () => {
  const db = (over: Partial<PendingDbRow>): PendingDbRow => ({
    row_kind: 'BILL',
    doc_id: BILL_A,
    doc_acc_year: '2026-2027',
    doc_refno: 'bil04539',
    doc_date: '2026-11-16',
    days_old: 0,
    cust_name: 'ZTQ-DLV-CUST90',
    area_name: 'MUSIRI',
    city_name: 'Trichy',
    salesman_names: null,
    delivery_mode: 'PICKUP',
    delivery_status: 'PART',
    godown_names: 'Coimbatore, Trichy',
    open_lines: 2,
    open_pkgs: '7.000',
    open_kg: '60.000',
    last_given_refno: 'DN/2026-2027/D9/00088',
    last_given_at: new Date('2026-11-16T06:20:00Z'),
    dc_note: null,
    ...over,
  });

  it('rows keep their order; age band by the company days; no money; head totals', () => {
    const rows = pendingRows(
      [db({}), db({ doc_refno: 'bil00001', days_old: 31, open_kg: '0', last_given_refno: null }), db({ row_kind: 'DC', doc_refno: 'DC/1', days_old: 9, dc_note: 'DC OPEN · open 2 of 5', open_pkgs: '2', open_lines: 1 })],
      7,
      30,
    );
    expect(rows.map((r) => [r.doc_refno, r.age_band, r.mode_text, r.status, r.open_pkgs_text, r.open_kg_text])).toEqual([
      ['bil04539', 'NEW', 'Pickup', 'PART', '7', '60'],
      ['bil00001', 'OLD', 'Pickup', 'PART', '7', ''],
      ['DC/1', 'AMBER', 'Challan', 'DC OPEN · open 2 of 5', '2', '60'],
    ]);
    expect(rows[0]).toMatchObject({ area_text: 'MUSIRI, Trichy', last_given_text: 'DN/2026-2027/D9/00088 · 16/11/2026' });
    expect(priceKeys(rows)).toEqual([]);
    expect(
      pendingHeadRow(rows, 4, { companyName: 'A', branchName: 'B', godownName: 'Coimbatore', filterText: 'Area MUSIRI', oldDays: 30, printedBy: 'VKPOS', at: AT }),
    ).toMatchObject({
      godown_text: 'Coimbatore',
      filter_text: 'Area MUSIRI',
      totals_text: '2 bills · 1 challan · 5 open lines · 16 pkgs · 120 kg · 1 over 30 days',
      skipped_text: '1 of the 4 documents sent had nothing left to give (not listed)',
    });
  });
});

describe('the registry list', () => {
  it('ten providers, unique dotted codes', () => {
    const src = source().src;
    const codes = DELIVERY_PRINT_PROVIDERS.map((P) => new (P as unknown as new (s: unknown) => { code: string })(src).code);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/);
  });
});
