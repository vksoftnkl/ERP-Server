import { Prisma } from '@prisma/client';
import { ProviderRequest } from '../print-data-provider.types';
import {
  dashDate,
  dashInstant,
  DC_PRINT_PROVIDERS,
  dcHeadRow,
  DcHeaderProvider,
  type DcHeadDb,
  DcItemsProvider,
  dcLineRows,
  type DcLineDb,
  DcPrintSource,
  dcrHeadRow,
  type DcrHeadDb,
  DcrHeaderProvider,
  DcrItemsProvider,
  dcrLineRows,
  type DcrLineDb,
  purposeText,
} from './delivery-challan.providers';

/**
 * Sales DC P5 (plan sales/plan-dc-dc-return-2026-11-16.md §10): the challan and
 * challan return print datasets. A free line prints rate 0 and the FREE mark;
 * quantities / kg without trailing zeros; dates dd-MM-yyyy, times IST 12-hour;
 * the GST pair follows the company state vs the place of supply; VIEW + PRINT on
 * 182 / 251.
 */

const D = (v: string | number) => new Prisma.Decimal(v);
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const DC = '01a1e7cb-c786-75fd-b973-21b78e6a7a0e';
const DR = '01a1e7cc-59e6-795f-84b5-af4f21d62775';
const AT = new Date('2026-11-17T06:22:00Z'); // 11:52 AM IST

const company = {
  comp_name: 'Acme Foods',
  comp_legal_name: 'Acme Foods Pvt Ltd',
  comp_addr1: 'Unit 2',
  comp_addr2: null,
  comp_addr3: null,
  comp_city: 'Coimbatore',
  comp_state: 'Tamil Nadu',
  comp_state_code: '33',
  comp_pin: '641001',
  comp_gstin_no: '33AAPCA6346P1Z2',
  comp_phone: '+91-9876543210',
  comp_mail: 'info@acmefoods.com',
  comp_state_by_code: 'Tamil Nadu',
  br_name: 'Coimbatore Branch',
  br_gstin_no: null,
};

const move = {
  vehicle_no: 'TN38ZT0001',
  driver_name: 'ZT Driver',
  supervisor_name: null,
  loadman_names: 'ZT Load 1, ZT Load 2',
  salesman_names: null,
  ttd_transport_mode: 'ROAD',
  ttd_transporter_name: 'ZTA-DC-TPT',
  ttd_transporter_gstin: null,
  ttd_lr_no: 'ZTA-LR-1',
  ttd_lr_date: new Date('2026-11-17T00:00:00Z'),
  ttd_distance_km: 25,
  gdw_no: null,
  gdw_status: null,
  gdw_generated_on: null,
  gdw_valid_upto: null,
};

const dcHead = (over: Partial<DcHeadDb> = {}): DcHeadDb => ({
  ...company,
  ...move,
  sdc_id: DC,
  sdc_acc_year: '2026-2027',
  sdc_branch_id: BRANCH,
  sdc_dc_refno: 'DC2627D14-00149',
  sdc_dc_date: new Date('2026-11-17T00:00:00Z'),
  sdc_purpose: 'SUPPLY',
  sdc_status: 'POSTED',
  sdc_print_count: 0,
  sdc_src_doc_type: 'SALES_ORDER',
  sdc_src_doc_refno: 'sor00747',
  sdc_src_doc_date: new Date('2026-11-16T00:00:00Z'),
  sdc_usr_refno: null,
  sdc_usr_refdate: null,
  sdc_cust_name: 'ZTA-DC-CUST',
  sdc_cust_addr: '12, Main Road',
  sdc_cust_place: 'Coimbatore',
  sdc_cust_pin: '641002',
  sdc_cust_phone: null,
  sdc_cust_gstin: '33ABCDE1234F1Z5',
  sdc_cust_gst_type: 'REGULAR',
  sdc_cust_stcd: '33',
  sdc_pos_stcd: '33',
  sdc_state_name: null,
  cust_state_by_code: 'Tamil Nadu',
  pos_state_name: 'Tamil Nadu',
  sdc_gross_amt: D('210.00'),
  sdc_disc_amt: D(0),
  sdc_taxable_amt: D('210.00'),
  sdc_cgst_amt: D('5.25'),
  sdc_sgst_amt: D('5.25'),
  sdc_igst_amt: D(0),
  sdc_cess_amt: D(0),
  sdc_tax_amt: D('10.50'),
  sdc_round_off: D(0),
  sdc_dc_amt: D('220.50'),
  sdc_remarks: 'ZTA-DC P5',
  sdc_created_by: USER,
  ttd_to_name: null,
  ttd_to_addr: null,
  ttd_to_place: null,
  ttd_to_pin: null,
  ttd_to_godown_name: null,
  ...over,
});

const dcLine = (over: Partial<DcLineDb> = {}): DcLineDb => ({
  sdi_line_no: 1,
  sdi_split_no: 1,
  sdi_item_id: 'i-b',
  item_code: null,
  item_name_en: 'ZT-ITEM-B',
  item_name_ta: null,
  hsn_code: '09041100',
  sdi_batch_no: null,
  lot_no: null,
  godown_name: 'Coimbatore',
  unit_name: 'PCS',
  unit_code: 'PCS',
  unit_kg: D('2.500000'),
  sdi_dc_qty: D('2.000'),
  sdi_free_qty: D(0),
  sdi_weight_qty: D(0),
  sdi_is_free: false,
  sdi_free_type: null,
  sdi_src_doc_type: 'SALES_ORDER',
  sdi_src_doc_refno: 'sor00747',
  sdi_rate: D('105.0000'),
  sdi_rate_pre_tax: D('105.0000'),
  sdi_disc_amt: D(0),
  sdi_gross_amt: D('210.00'),
  sdi_taxable_amt: D('210.00'),
  sdi_tax_perc: D('5.0000'),
  sdi_cgst_perc: D('2.5000'),
  sdi_cgst_amt: D('5.25'),
  sdi_sgst_perc: D('2.5000'),
  sdi_sgst_amt: D('5.25'),
  sdi_igst_perc: D(0),
  sdi_igst_amt: D(0),
  sdi_cess_perc: D(0),
  sdi_cess_amt: D(0),
  sdi_tax_amt: D('10.50'),
  sdi_net_amt: D('220.50'),
  sdi_remarks: null,
  ...over,
});

/** The order's free scheme line: rate 0, taxable 0, the item's 18 % kept. */
const freeLine = dcLine({
  sdi_line_no: 2,
  sdi_item_id: 'i-a',
  item_name_en: 'ZT-ITEM-A',
  hsn_code: '33049990',
  unit_kg: D(0),
  sdi_dc_qty: D('1.000'),
  sdi_is_free: true,
  sdi_free_type: 'SCHEME',
  sdi_rate: D('0.0000'),
  sdi_rate_pre_tax: D(0),
  sdi_gross_amt: D(0),
  sdi_taxable_amt: D(0),
  sdi_tax_perc: D('18.0000'),
  sdi_cgst_perc: D('9.0000'),
  sdi_cgst_amt: D(0),
  sdi_sgst_perc: D('9.0000'),
  sdi_sgst_amt: D(0),
  sdi_tax_amt: D(0),
  sdi_net_amt: D(0),
});

const facts = { preparedBy: 'VKPOS', printedBy: 'VKPOS', at: AT };

describe('text helpers', () => {
  it('dates print dd-MM-yyyy and instants IST 12-hour, as the Tax Invoice A5', () => {
    expect(dashDate(new Date('2026-11-17T00:00:00Z'))).toBe('17-11-2026');
    expect(dashDate('2026-04-01')).toBe('01-04-2026');
    expect(dashDate(null)).toBe('');
    expect(dashInstant(AT)).toBe('17-11-2026 11:52 AM');
  });

  it('purposes read as dropdown 57 names them', () => {
    expect(purposeText('SUPPLY')).toBe('Supply');
    expect(purposeText('JOB_WORK')).toBe('Job Work');
    expect(purposeText(null)).toBe('');
  });
});

describe('DELIVERY_CHALLAN (sales.dc.*)', () => {
  it('lines: a free line prints rate 0 and the FREE mark, never a blank; qty / kg without trailing zeros', () => {
    const rows = dcLineRows([dcLine(), freeLine]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sl_no: 1,
      item_name: 'ZT-ITEM-B',
      hsn_code: '09041100',
      qty: 2,
      qty_text: '2',
      unit_name: 'PCS',
      rate: 105,
      taxable_amt: 210,
      tax_perc: 5,
      net_amt: 220.5,
      weight_kg: 5,
      weight_text: '5',
      is_free: false,
      free_mark: '',
      description: 'ZT-ITEM-B',
    });
    expect(rows[1]).toMatchObject({
      sl_no: 2,
      is_free: true,
      free_type: 'SCHEME',
      free_mark: 'FREE',
      description: 'ZT-ITEM-A (FREE)',
      rate: 0,
      taxable_amt: 0,
      tax_perc: 18,
      net_amt: 0,
      weight_text: '',
    });
    // 0, not null: the design's fmt('##,##,##0.00') prints 0.00 on the free line.
    expect(rows[1].rate).not.toBeNull();
  });

  it('lines: a separate free qty is named, the batch shown, kg from the stored weight when there is one', () => {
    const [row] = dcLineRows([
      dcLine({ sdi_free_qty: D('1.000'), sdi_batch_no: 'ZTA-L1', sdi_weight_qty: D('12.345') }),
    ]);
    expect(row).toMatchObject({
      description: 'ZT-ITEM-B · ZTA-L1 + 1 free',
      pkgs: 3,
      pkgs_text: '3',
      free_qty_text: '1',
      weight_text: '12.345',
    });
  });

  it('lines: a Tamil revision prints the Tamil name where there is one', () => {
    const [ta, en] = dcLineRows(
      [dcLine({ item_name_ta: 'மிளகு' }), dcLine({ item_name_en: 'ZT-ITEM-C' })],
      true,
    );
    expect(ta.item_name).toBe('மிளகு');
    expect(en.item_name).toBe('ZT-ITEM-C');
  });

  it('head: number, date, purpose, consignee, POS, order ref, transport, totals from the lines', () => {
    const lines = dcLineRows([dcLine(), freeLine]);
    const h = dcHeadRow(dcHead(), lines, facts);
    expect(h).toMatchObject({
      title: 'DELIVERY CHALLAN',
      company_name: 'Acme Foods',
      company_state_code: '33',
      refno: 'DC2627D14-00149',
      dc_date: '2026-11-17',
      dc_date_text: '17-11-2026',
      purpose_text: 'Supply',
      status_mark: '',
      cust_name: 'ZTA-DC-CUST',
      cust_place_text: 'Coimbatore - 641002',
      cust_gstin: '33ABCDE1234F1Z5',
      cust_state_text: 'Tamil Nadu (33)',
      pos_text: 'Tamil Nadu (33)',
      pos_from_company: false,
      is_interstate: false,
      order_ref_text: 'sor00747 dt 16-11-2026',
      ship_to_text: 'Same as consignee',
      transport_text:
        'Vehicle TN38ZT0001 · Driver ZT Driver · By road · Transporter ZTA-DC-TPT · LR ZTA-LR-1 dt 17-11-2026 · 25 km',
      crew_text: 'Loadmen: ZT Load 1, ZT Load 2',
      ewb_no: '',
      ewb_text: '',
      lines_count: 2,
      pkgs_text: '3',
      weight_text: '5',
      free_lines: 1,
      totals_text: '2 lines · 3 pkgs · 5 kg · 1 free',
      taxable_amt: 210,
      cgst_amt: 5.25,
      sgst_amt: 5.25,
      igst_amt: 0,
      dc_amt: 220.5,
      print_count: 0,
      reprint_mark: '',
      prepared_line: 'Prepared by VKPOS',
      printed_at: '17-11-2026 11:52 AM',
      printed_line: 'Printed 17-11-2026 11:52 AM · VKPOS',
    });
  });

  it('head: inter-state by the place of supply; a blank POS prints the company state; ship-to from the band', () => {
    const lines = dcLineRows([dcLine()]);
    const inter = dcHeadRow(
      dcHead({ sdc_pos_stcd: '29', pos_state_name: 'Karnataka' }),
      lines,
      facts,
    );
    expect(inter).toMatchObject({ is_interstate: true, pos_text: 'Karnataka (29)' });
    const blankPos = dcHeadRow(
      dcHead({
        sdc_pos_stcd: null,
        pos_state_name: null,
        ttd_to_name: 'ZTA-DC-CUST',
        ttd_to_place: 'Tiruppur',
        ttd_to_pin: '641601',
      }),
      lines,
      facts,
    );
    expect(blankPos).toMatchObject({
      is_interstate: false,
      pos_text: 'Tamil Nadu (33)',
      pos_from_company: true,
      ship_to_text: 'ZTA-DC-CUST, Tiruppur 641601',
    });
  });

  it('head: e-way bill, their ref, reprint, cancelled mark, no transport', () => {
    const h = dcHeadRow(
      dcHead({
        ...{
          vehicle_no: null,
          driver_name: null,
          loadman_names: null,
          ttd_transport_mode: null,
          ttd_transporter_name: null,
          ttd_lr_no: null,
          ttd_lr_date: null,
          ttd_distance_km: null,
        },
        gdw_no: '181234567890',
        gdw_status: 'GENERATED',
        gdw_generated_on: new Date('2026-11-17T05:00:00Z'),
        gdw_valid_upto: new Date('2026-11-18T18:29:00Z'),
        sdc_usr_refno: 'PO-77',
        sdc_usr_refdate: new Date('2026-11-15T00:00:00Z'),
        sdc_print_count: 2,
        sdc_status: 'CANCELLED',
      }),
      [],
      facts,
    );
    expect(h).toMatchObject({
      ewb_no: '181234567890',
      ewb_text: '181234567890 dt 17-11-2026',
      ewb_valid_text: 'valid till 18-11-2026 11:59 PM',
      their_ref_text: 'PO-77 dt 15-11-2026',
      reprint_mark: 'REPRINT (printed 2 times before)',
      status_mark: 'CANCELLED',
      transport_text: '-',
      crew_text: '',
      totals_text: '0 lines · 0 pkgs',
    });
  });

  it('head: order refs come from the lines when the header names none', () => {
    const lines = dcLineRows([dcLine(), dcLine({ sdi_line_no: 2, sdi_src_doc_refno: 'sor00748' })]);
    const h = dcHeadRow(
      dcHead({ sdc_src_doc_type: null, sdc_src_doc_refno: null, sdc_src_doc_date: null }),
      lines,
      facts,
    );
    expect(h.order_ref_text).toBe('sor00747, sor00748');
  });
});

const dcrHead = (over: Partial<DcrHeadDb> = {}): DcrHeadDb => ({
  ...company,
  ...move,
  sdr_id: DR,
  sdr_acc_year: '2026-2027',
  sdr_branch_id: BRANCH,
  sdr_return_refno: 'DR2627D14-00067',
  sdr_return_date: new Date('2026-11-17T00:00:00Z'),
  sdr_status: 'POSTED',
  sdr_print_count: 0,
  sdr_dc_refno: 'DC2627D14-00150',
  sdr_dc_date: new Date('2026-11-16T00:00:00Z'),
  sdr_return_reason: null,
  sdr_usr_refno: null,
  sdr_usr_refdate: null,
  sdr_cust_name: 'ZTA-DC-CUST',
  sdr_cust_gstin: '33ABCDE1234F1Z5',
  sdr_cust_stcd: '33',
  sdr_pos_stcd: '33',
  sdc_cust_addr: '12, Main Road',
  sdc_cust_place: 'Coimbatore',
  sdc_cust_pin: null,
  sdc_cust_phone: null,
  sdc_cust_gst_type: 'REGULAR',
  sdc_state_name: null,
  sdc_purpose: 'APPROVAL',
  reason_code: 'DCR_OTHER',
  reason_name: 'Other',
  cust_state_by_code: 'Tamil Nadu',
  pos_state_name: 'Tamil Nadu',
  sdr_taxable_amt: D('315.00'),
  sdr_tax_amt: D('15.76'),
  sdr_return_amt: D('330.76'),
  sdr_remarks: null,
  sdr_created_by: 'VKPOS',
  ...over,
});

const dcrLine = (over: Partial<DcrLineDb> = {}): DcrLineDb => ({
  sdri_line_no: 1,
  sdri_dc_line_no: 1,
  sdri_item_id: 'i-b',
  item_code: null,
  item_name_en: 'ZT-ITEM-B',
  item_name_ta: null,
  hsn_code: '09041100',
  sdri_batch_no: null,
  lot_no: null,
  godown_name: 'Coimbatore',
  unit_name: 'PCS',
  unit_code: 'PCS',
  unit_kg: D(0),
  sdri_return_qty: D('3.000'),
  sdri_free_qty: D(0),
  sdri_weight_qty: null,
  sdri_condition: 'RESTOCK',
  sdri_bucket: 'SALEABLE',
  is_free: false,
  free_type: null,
  sdri_rate: D('105.0000'),
  sdri_rate_pre_tax: D('105.0000'),
  sdri_gross_amt: D('315.00'),
  sdri_taxable_amt: D('315.00'),
  sdri_tax_perc: D('5.0000'),
  sdri_cgst_perc: D('2.5000'),
  sdri_cgst_amt: D('7.88'),
  sdri_sgst_perc: D('2.5000'),
  sdri_sgst_amt: D('7.88'),
  sdri_igst_perc: D(0),
  sdri_igst_amt: D(0),
  sdri_cess_perc: D(0),
  sdri_cess_amt: D(0),
  sdri_tax_amt: D('15.76'),
  sdri_net_amt: D('330.76'),
  sdri_remarks: null,
  ...over,
});

describe('DC_RETURN (sales.dcr.*)', () => {
  it('lines: condition and bucket in words; a free challan line comes back at rate 0 with the FREE mark', () => {
    const rows = dcrLineRows([
      dcrLine(),
      dcrLine({
        sdri_line_no: 2,
        sdri_dc_line_no: 2,
        item_name_en: 'ZT-ITEM-A',
        sdri_return_qty: D('1.000'),
        sdri_condition: 'SCRAP',
        sdri_bucket: 'QUARANTINE',
        godown_name: 'Trichy',
        is_free: true,
        free_type: 'SCHEME',
        sdri_rate: D(0),
        sdri_taxable_amt: D(0),
        sdri_tax_perc: D('18.0000'),
        sdri_cgst_amt: D(0),
        sdri_sgst_amt: D(0),
        sdri_tax_amt: D(0),
        sdri_net_amt: D(0),
      }),
    ]);
    expect(rows[0]).toMatchObject({
      qty_text: '3',
      condition_text: 'Restock',
      bucket_text: 'Saleable',
      condition_bucket_text: 'Restock → Saleable',
      rate: 105,
      net_amt: 330.76,
      free_mark: '',
    });
    expect(rows[1]).toMatchObject({
      condition_text: 'Scrap',
      condition_bucket_text: 'Scrap → Quarantine',
      is_free: true,
      free_mark: 'FREE',
      description: 'ZT-ITEM-A (FREE)',
      rate: 0,
      tax_perc: 18,
    });
  });

  it('head: the challan it returns, the reason, the GST split summed from the lines, received into', () => {
    const lines = dcrLineRows([
      dcrLine(),
      dcrLine({ sdri_line_no: 2, godown_name: 'Trichy', sdri_return_qty: D('0.500') }),
    ]);
    const h = dcrHeadRow(dcrHead({ sdr_return_reason: 'customer changed the order' }), lines, {
      ...facts,
      preparedBy: 'VKPOS',
    });
    expect(h).toMatchObject({
      title: 'CHALLAN RETURN',
      refno: 'DR2627D14-00067',
      return_date_text: '17-11-2026',
      dc_text: 'DC2627D14-00150 dt 16-11-2026',
      dc_purpose_text: 'Approval',
      reason_text: 'Other: customer changed the order',
      cust_name: 'ZTA-DC-CUST',
      cust_addr: '12, Main Road',
      cust_state_text: 'Tamil Nadu (33)',
      is_interstate: false,
      godown_text: 'Coimbatore, Trichy',
      qty_text: '3.5',
      totals_text: '2 lines · 3.5 back',
      taxable_amt: 315,
      cgst_amt: 15.76,
      sgst_amt: 15.76,
      tax_amt: 15.76,
      return_amt: 330.76,
      prepared_line: 'Prepared by VKPOS',
    });
  });
});

// ── the source, over a mocked PrismaService ───────────────────────────────────────

const request = (over: Partial<ProviderRequest['context']> = {}): ProviderRequest => ({
  context: {
    companyId: COMPANY,
    branchId: BRANCH,
    accYear: '2026-2027',
    docId: DC,
    userId: USER,
    deviceId: null,
    ...over,
  },
  params: {},
  lang: 'en-IN',
  rowLimit: 5000,
});

/** The rights row loadRights reads, then the document reads in order. */
const rightsRow = (view: boolean, print: boolean) => ({
  um_can_view: view,
  um_can_create: true,
  um_can_edit: true,
  um_can_delete: true,
  um_can_print: print,
  um_can_export: true,
  um_can_post: true,
  um_can_cancel: true,
  um_can_amend: true,
  um_can_override: true,
  um_can_retender: false,
});

function sourceWith(answers: unknown[][]) {
  const $queryRaw = jest.fn();
  for (const a of answers) $queryRaw.mockResolvedValueOnce(a);
  $queryRaw.mockResolvedValue([{ name: 'VKPOS' }]);
  const source = new DcPrintSource({ $queryRaw } as never);
  return { source, $queryRaw };
}

describe('DcPrintSource', () => {
  it('one read per render: header and items share it; menu 182 rights are checked', async () => {
    const { source, $queryRaw } = sourceWith([
      [rightsRow(true, true)],
      [dcHead()],
      [dcLine(), freeLine],
    ]);
    // Together, as the dataset runner resolves a render's datasets (Promise.all).
    const [head, items] = await Promise.all([
      new DcHeaderProvider(source).resolve(request()),
      new DcItemsProvider(source).resolve(request()),
    ]);
    expect(head).toMatchObject({ refno: 'DC2627D14-00149', lines_count: 2, prepared_by: 'VKPOS' });
    expect(items).toHaveLength(2);
    // rights + head + lines + two user names; the items provider reused the memo.
    expect($queryRaw).toHaveBeenCalledTimes(5);
    const sqls = $queryRaw.mock.calls.map((c) => (c[0] as readonly string[]).join('?'));
    expect(sqls[0]).toMatch(/user_menus/);
    expect($queryRaw.mock.calls[0]).toContain(182);
    // The partition key on the challan and on its lines.
    expect(sqls[1]).toMatch(/d\.sdc_acc_year = \?::bpchar/);
    expect(sqls[2]).toMatch(/i\.sdi_acc_year = \?::bpchar/);
  });

  it('a reprint reads again: the next render sees the print count a recorded print bumped', async () => {
    const { source } = sourceWith([
      [rightsRow(true, true)],
      [dcHead({ sdc_print_count: 0 })],
      [dcLine()],
      [{ name: 'VKPOS' }],
      [{ name: 'VKPOS' }],
      [rightsRow(true, true)],
      [dcHead({ sdc_print_count: 1 })],
      [dcLine()],
    ]);
    const first = await new DcHeaderProvider(source).resolve(request());
    // The memo keeps nothing once a read has settled (keepMs 0): one timer tick later.
    await new Promise((done) => setTimeout(done, 5));
    const second = await new DcHeaderProvider(source).resolve(request());
    expect(first).toMatchObject({ print_count: 0, reprint_mark: '' });
    expect(second).toMatchObject({
      print_count: 1,
      is_reprint: true,
      reprint_mark: 'REPRINT (printed 1 time before)',
    });
  });

  it('refuses without PRINT on 182, and a challan not in the company by name', async () => {
    const noPrint = sourceWith([[rightsRow(true, false)]]);
    await expect(
      noPrint.source.challan(request({ docId: DC.replace('5fd', '5fe') }), 'sales.dc.header'),
    ).rejects.toThrow(
      'This user may not print delivery challans (menu 182: um_can_print is not granted).',
    );
    const missing = sourceWith([[rightsRow(true, true)], []]);
    await expect(
      missing.source.challan(request({ docId: DC.replace('5fd', '5ff') }), 'sales.dc.header'),
    ).rejects.toThrow(/^No delivery challan 01a1e7cb-c786-75ff/);
  });

  it('the return reads VIEW + PRINT on 251 and refuses a render that names no year', async () => {
    const { source, $queryRaw } = sourceWith([[rightsRow(true, true)], [dcrHead()], [dcrLine()]]);
    const [head, items] = await Promise.all([
      new DcrHeaderProvider(source).resolve(request({ docId: DR })),
      new DcrItemsProvider(source).resolve(request({ docId: DR })),
    ]);
    expect(head).toMatchObject({ refno: 'DR2627D14-00067', lines_count: 1 });
    expect(items).toHaveLength(1);
    expect($queryRaw.mock.calls[0]).toContain(251);
    await expect(
      source.dcReturn(request({ docId: DR, accYear: null }), 'sales.dcr.header'),
    ).rejects.toThrow(/sales\.dcr\.header reads a table partitioned by accounting year/);
  });
});

describe('the registry list', () => {
  it('four providers, unique dotted codes, header one / items many', () => {
    const source = new DcPrintSource({} as never);
    const providers = DC_PRINT_PROVIDERS.map((P) => new P(source));
    expect(providers.map((p) => [p.code, p.cardinality])).toEqual([
      ['sales.dc.header', 'one'],
      ['sales.dc.items', 'many'],
      ['sales.dcr.header', 'one'],
      ['sales.dcr.items', 'many'],
    ]);
  });
});
