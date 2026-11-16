import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../../database/prisma/prisma.service';
import type { RequestContextService } from '../../../../common/request-context/request-context.service';
import { GodownPositionService } from './godown-position.service';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const G1 = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const ITEM = '01a0d242-5613-71ef-93af-d41e1cca9f16';
const USER = '019e441b-0000-7000-8000-000000000001';

const dec = (v: number) => new Prisma.Decimal(v);

function flat(sql: unknown): string {
  if (Array.isArray(sql)) return (sql as string[]).join('?').replace(/\s+/g, ' ');
  if (sql && typeof sql === 'object' && typeof (sql as { sql?: unknown }).sql === 'string') {
    return (sql as { sql: string }).sql.replace(/\s+/g, ' ');
  }
  return String(sql);
}

function setup(rights: Partial<Record<string, boolean>> | null, lookup: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const answer = (text: string): unknown[] => {
    calls.push(text);
    if (text.includes('FROM public.user_menus')) {
      return rights
        ? [
            {
              um_can_view: false,
              um_can_print: false,
              um_can_export: false,
              ...Object.fromEntries(Object.entries(rights).map(([k, v]) => [`um_can_${k}`, v])),
            },
          ]
        : [];
    }
    if (text.includes('FROM (SELECT 1) x')) {
      return [
        {
          br_comp_id: COMPANY,
          br_name: 'Acme Foods - Coimbatore Branch',
          br_is_deleted: false,
          comp_name: 'Amazon Retail',
          gdl_branch_id: BRANCH,
          gdl_name: 'Coimbatore',
          gdl_is_deleted: false,
          itg_id: null,
          itg_name: null,
          itg_is_deleted: null,
          brand_id: null,
          brand_name: null,
          brand_is_deleted: null,
          item_id: ITEM,
          item_company_id: COMPANY,
          item_is_deleted: false,
          ...lookup,
        },
      ];
    }
    if (text.includes('AS d, to_char(now()')) return [{ d: '2026-11-15', at: '15/11/2026 07:42 PM' }];
    if (text.includes('k AS ( SELECT item_id, godown_id FROM own')) {
      return [
        {
          item_id: ITEM,
          godown_id: G1,
          owned: dec(487),
          reserved: dec(0),
          free: dec(487),
          bnd: dec(10),
          bnd_ev: dec(10),
          over_given: dec(0),
          bill_ids: ['b1'],
          dc_open: dec(0),
          dc_ids: [],
          last_refno: null,
          last_date: null,
          last_doc_id: null,
          last_doc_year: null,
        },
      ];
    }
    if (text.includes('AS kg_per_base')) {
      return [
        {
          item_id: ITEM,
          item_code: null,
          item_name: 'ZT-ITEM-A',
          barcode: null,
          sell_factor: dec(1),
          sell_unit: 'PCS',
          base_unit: 'PCS',
          kg_per_base: dec(0),
        },
      ];
    }
    if (text.includes('SELECT gdl_id, gdl_name, gdl_sort')) {
      return [{ gdl_id: G1, gdl_name: 'Coimbatore', gdl_sort: 1 }];
    }
    return [];
  };
  const $queryRaw = jest.fn(async (first: unknown) => answer(flat(first)));
  const tx = { $queryRaw, $executeRaw: jest.fn(async () => 0) };
  const prisma = {
    $queryRaw,
    $transaction: jest.fn(async (work: (t: unknown) => unknown) => work(tx)),
  };
  const service = new GodownPositionService(
    prisma as unknown as PrismaService,
    { getUserId: () => USER } as unknown as RequestContextService,
  );
  return { service, calls, tx };
}

describe('GodownPositionService', () => {
  it('403 GODOWN_POSITION_RIGHT_VIEW without view on menu 306, before any report SQL', async () => {
    const { service, calls } = setup({ view: false });
    await expect(service.show({ companyId: COMPANY, branchId: BRANCH })).rejects.toMatchObject({
      status: 403,
      response: { errors: [expect.objectContaining({ code: 'GODOWN_POSITION_RIGHT_VIEW' })] },
    });
    expect(calls.every((c) => c.includes('FROM public.user_menus'))).toBe(true);
  });

  it('/export also needs EXPORT (403 GODOWN_POSITION_RIGHT_EXPORT)', async () => {
    const { service } = setup({ view: true, print: true });
    await expect(service.export({ companyId: COMPANY, branchId: BRANCH })).rejects.toMatchObject({
      status: 403,
      response: { errors: [expect.objectContaining({ code: 'GODOWN_POSITION_RIGHT_EXPORT' })] },
    });
  });

  it('refuses a godown of another branch (422 GODOWN_POSITION_GODOWN_NOT_IN_BRANCH, params for the wording)', async () => {
    const { service } = setup({ view: true }, { gdl_branch_id: 'another-branch', gdl_name: 'Main Godown' });
    await expect(
      service.show({ companyId: COMPANY, branchId: BRANCH, godownId: G1 }),
    ).rejects.toMatchObject({
      status: 422,
      response: {
        errors: [
          expect.objectContaining({
            code: 'GODOWN_POSITION_GODOWN_NOT_IN_BRANCH',
            params: { godown: 'Main Godown', branch: 'Acme Foods - Coimbatore Branch' },
          }),
        ],
      },
    });
  });

  it('a branch of another company is refused first (STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY)', async () => {
    const { service } = setup({ view: true }, { br_comp_id: 'another-company', gdl_branch_id: 'x' });
    await expect(
      service.show({ companyId: COMPANY, branchId: BRANCH, godownId: G1 }),
    ).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'STOCK_SUMMARY_BRANCH_NOT_IN_COMPANY' })] },
    });
  });

  it('Show: read-only snapshot with custom plans; head, tiles, rows, totals, rights', async () => {
    const { service, tx } = setup({ view: true, print: true, export: false });
    const data = await service.show({ companyId: COMPANY, branchId: BRANCH, godownId: G1 });
    const exec = (tx.$executeRaw.mock.calls as unknown[][]).map((c) => flat(c[0]));
    expect(exec.join(' ')).toContain('SET TRANSACTION READ ONLY');
    expect(exec.join(' ')).toContain('plan_cache_mode = force_custom_plan');
    expect(data.head).toMatchObject({
      godownName: 'Coimbatore',
      asOf: '15/11/2026 07:42 PM',
      qtyIn: 'SELLING',
      bucket: 'SALEABLE',
      hideZero: true,
      onlyToGive: false,
    });
    expect(data.rows[0]).toMatchObject({ owned: '487.000', billedNotDelivered: '10.000', physical: '497.000', tie: true });
    expect(data.tiles.billedNotDelivered).toEqual({ kg: '0.000', pkgs: '10.000', bills: 1 });
    expect(data.rights).toEqual({ view: true, print: true, export: false });
  });

  it('/export: printedAs + every row', async () => {
    const { service } = setup({ view: true, export: true });
    const data = await service.export({ companyId: COMPANY, branchId: BRANCH, qtyIn: 'BASE', onlyToGive: true });
    expect(data.printedAs).toContain('qty in base unit');
    expect(data.printedAs).toContain('only with goods to give');
    expect(data.totalRows).toBe(1);
  });

  // Delivery tracking P5: the GODOWN_POSITION / COUNT_SHEET print providers.
  it('printData: VIEW + PRINT for the user the render names (403 GODOWN_POSITION_RIGHT_PRINT)', async () => {
    const { service } = setup({ view: true, export: true });
    await expect(service.printData({ companyId: COMPANY, branchId: BRANCH }, USER)).rejects.toMatchObject({
      status: 403,
      response: { errors: [expect.objectContaining({ code: 'GODOWN_POSITION_RIGHT_PRINT' })] },
    });
    await expect(service.printData({ companyId: COMPANY, branchId: BRANCH }, null)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'GODOWN_POSITION_RIGHT_VIEW' })] },
    });
  });

  it('printData: the /export body without EXPORT', async () => {
    const { service } = setup({ view: true, print: true, export: false });
    const data = await service.printData({ companyId: COMPANY, branchId: BRANCH, godownId: G1 }, USER);
    expect(data.printedAs).toContain('Coimbatore');
    expect(data.rows[0]).toMatchObject({ physical: '497.000' });
    expect(data.totalRows).toBe(1);
  });
});
