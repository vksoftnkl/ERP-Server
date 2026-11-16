import { ForbiddenException } from '@nestjs/common';
import type {
  PositionExportPayload,
  PositionRow,
} from '../../../../stocks/reports/godown-position/types/godown-position.types';
import { ProviderRequest } from '../print-data-provider.types';
import {
  GODOWN_POSITION_PRINT_PROVIDERS,
  GodownPositionHeadProvider,
  GodownPositionPrintSource,
  GodownPositionRowsProvider,
  positionHeadRow,
  positionPrintRow,
} from './godown-position.providers';

/**
 * Delivery tracking P5: GODOWN_POSITION (A4 landscape) and COUNT_SHEET read the
 * 306 report's own run through GodownPositionService.printData (VIEW + PRINT).
 */

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const GD = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const AT = new Date('2026-11-16T06:22:00Z');

const row = (over: Partial<PositionRow> = {}): PositionRow => ({
  itemId: 'i1',
  itemCode: null,
  itemName: 'ZTA-DLV-WT',
  godownId: GD,
  godownName: 'Coimbatore',
  unitName: 'PCS',
  unitFactor: '1.000000',
  physical: '16.000',
  billedNotDelivered: '3.000',
  owned: '13.000',
  reserved: '0.000',
  freeToSell: '13.000',
  onVehicle: null,
  challanOut: '0.000',
  physicalKg: '320.000',
  lastGiven: { refno: 'DN/2026-2027/D9/00088', date: '2026-11-16', sdnId: 'n1', accYear: '2026-2027' },
  short: '0.000',
  overGiven: '0.000',
  tie: true,
  ...over,
});

const payload = (rows: PositionRow[] = [row()]): PositionExportPayload => ({
  head: {
    companyId: COMPANY,
    companyName: 'Amazon Retail',
    branchId: BRANCH,
    branchName: 'Acme Foods - Coimbatore Branch',
    godownId: null,
    godownName: null,
    groupId: null,
    groupName: null,
    brandId: null,
    brandName: null,
    asOf: '16/11/2026 11:52 AM',
    today: '2026-11-16',
    qtyIn: 'SELLING',
    bucket: 'SALEABLE',
    onlyToGive: false,
    hideZero: true,
    find: 'ZTA-DLV',
  },
  printedAs: 'Acme Foods - Coimbatore Branch · All godowns · qty in the selling unit · saleable · hide zero · find "ZTA-DLV" · as of 16/11/2026 11:52 AM',
  tiles: {
    physical: { kg: '520.000', pkgs: '36.000', rows: 3 },
    billedNotDelivered: { kg: '120.000', pkgs: '10.000', bills: 2 },
    owned: { kg: '400.000', pkgs: '26.000' },
    reserved: { kg: '0.000', pkgs: '0.000', items: 0 },
    short: { items: 0, first: null },
    challanOut: { kg: '0.000', pkgs: '0.000', challans: 0 },
  },
  rows,
  totals: { physicalKg: '520.000', bndKg: '120.000', ownedKg: '400.000', reservedKg: '0.000', freeKg: '400.000', challanKg: '0.000', rows: rows.length, tie: true },
  totalRows: rows.length,
});

const request = (params: Record<string, unknown>) =>
  ({
    context: { companyId: COMPANY, branchId: BRANCH, accYear: '2026-2027', docId: COMPANY, userId: USER, deviceId: null },
    params,
    lang: 'en-IN',
    rowLimit: 500,
  }) as ProviderRequest;

describe('positionHeadRow / positionPrintRow', () => {
  it('head: tiles as text without trailing zeros, the scope line, tie', () => {
    expect(positionHeadRow(payload(), 'VKPOS', AT)).toMatchObject({
      godown_text: 'All godowns',
      physical_text: '36 pkgs · 520 kg',
      bnd_text: '10 pkgs · 120 kg · 2 bills',
      owned_text: '26 pkgs · 400 kg',
      reserved_text: '0 pkgs · 0 items',
      short_text: 'None short',
      challan_text: '0 pkgs · 0 challans',
      physical_kg_text: '520',
      rows_text: '1 row',
      tie_text: 'Physical = Owned + Billed not delivered on every row',
      qty_in_text: 'Qty in the selling unit',
      bucket_text: 'Saleable',
      as_of_text: 'as of 16/11/2026 11:52 AM',
      printed_line: 'Printed 16/11/2026 11:52 AM · VKPOS',
    });
  });

  it('row: blank zeros, flags for short / over-given / not tied, the count-sheet note', () => {
    expect(positionPrintRow(row(), 0)).toMatchObject({
      sl_no: 1,
      physical_text: '16',
      bnd_text: '3',
      owned_text: '13',
      reserved_text: '',
      challan_text: '',
      physical_kg_text: '320',
      flags_text: '',
      is_red: false,
      last_given_text: 'DN/2026-2027/D9/00088 · 16/11/2026',
      count_note: 'incl. 3 billed, not yet given',
    });
    expect(
      positionPrintRow(row({ short: '2.500', overGiven: '1.000', tie: false, billedNotDelivered: '0.000', lastGiven: null }), 4),
    ).toMatchObject({
      sl_no: 5,
      flags_text: 'SHORT 2.5 · over-given 1 · does not tie',
      is_short: true,
      is_red: true,
      bnd_text: '',
      last_given_text: '',
      count_note: '',
    });
  });
});

describe('GodownPositionPrintSource', () => {
  const make = (printData: jest.Mock) => {
    const position = { printData };
    const prisma = { $queryRaw: jest.fn(async () => [{ name: 'VKPOS' }]) };
    return new GodownPositionPrintSource(position as never, prisma as never);
  };

  it('maps the 306 prompts onto the report DTO (Qt sends booleans and blanks) and runs ONE report for head + rows', async () => {
    const printData = jest.fn(async () => payload([row(), row({ itemName: 'ZTA-DLV-ITEM' })]));
    const source = make(printData);
    const params = {
      branch_id: BRANCH,
      godown_id: GD,
      group_id: null,
      brand_id: '',
      qty_in: 'selling',
      bucket: 'saleable',
      only_to_give: false,
      hide_zero: true,
      find: ' ZTA-DLV ',
    };
    const [head, rows] = await Promise.all([
      new GodownPositionHeadProvider(source).resolve(request(params)),
      new GodownPositionRowsProvider(source).resolve(request(params)),
    ]);
    expect(printData).toHaveBeenCalledTimes(1);
    const [q, userId] = printData.mock.calls[0] as unknown as [Record<string, unknown>, string];
    expect(userId).toBe(USER);
    expect({ ...q }).toEqual({
      companyId: COMPANY,
      branchId: BRANCH,
      godownId: GD,
      qtyIn: 'SELLING',
      bucket: 'SALEABLE',
      onlyToGive: false,
      hideZero: true,
      find: 'ZTA-DLV',
    });
    expect(head.rows_count).toBe(2);
    expect(rows.map((r) => r.item_name)).toEqual(['ZTA-DLV-WT', 'ZTA-DLV-ITEM']);
  });

  it('a blank branch_id takes the render\'s branch; a bad qty_in is refused by the report DTO', async () => {
    const printData = jest.fn(async () => payload());
    const source = make(printData);
    await new GodownPositionRowsProvider(source).resolve(request({}));
    expect((printData.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({ companyId: COMPANY, branchId: BRANCH });
    await expect(new GodownPositionRowsProvider(make(printData)).resolve(request({ qty_in: 'KG' }))).rejects.toThrow(
      /not what the Godown Stock Position takes: .*qtyIn/,
    );
  });

  it('the service refusal (no PRINT on 306) comes back in its own words', async () => {
    const source = make(
      jest.fn(async () => {
        throw new ForbiddenException({
          message: 'x',
          errors: [{ code: 'GODOWN_POSITION_RIGHT_PRINT', message: 'This user may not print the Godown Stock Position (menu 306: um_can_print is not granted)' }],
        });
      }),
    );
    await expect(new GodownPositionHeadProvider(source).resolve(request({}))).rejects.toThrow(/menu 306: um_can_print is not granted/);
  });

  it('two providers, unique codes', () => {
    const codes = GODOWN_POSITION_PRINT_PROVIDERS.map((P) => new (P as unknown as new (s: unknown) => { code: string })(null).code);
    expect(codes).toEqual(['reports.godown_position.head', 'reports.godown_position.rows']);
  });
});
