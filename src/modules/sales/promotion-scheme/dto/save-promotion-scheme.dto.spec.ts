import { ValidationPipe } from '@nestjs/common';
import { SavePromotionSchemeDto } from './save-promotion-scheme.dto';

/**
 * The nested grids only work if the global ValidationPipe lets them through, so
 * the pipe under test is configured exactly as main.ts configures it — in
 * particular forbidNonWhitelisted, which rejects any key the DTO does not
 * declare.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const meta = { type: 'body' as const, metatype: SavePromotionSchemeDto };

const UUID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const header = {
  prm_comp_id: UUID,
  prm_code: 'DIWALI25',
  prm_name: 'Diwali 2025 — 10% off own brand',
  prm_start_date: '2025-10-01',
  prm_end_date: '2025-10-31',
};

const validate = (body: Record<string, unknown>): Promise<SavePromotionSchemeDto> =>
  pipe.transform(body, meta) as Promise<SavePromotionSchemeDto>;

describe('SavePromotionSchemeDto nested grids', () => {
  it('accepts the header and all four grids in one body', async () => {
    const dto = await validate({
      ...header,
      prm_benefit: 'DISC_PERC',
      branches: [{ prb_slno: 1, prb_branch_id: UUID }],
      parties: [{ prp_kind: 'CUSTOMER_GROUP', prp_scope_id: UUID }],
      items: [{ pri_kind: 'ITEM_BRAND', pri_scope_id: UUID }],
      slabs: [{ prs_exceeds: 1000, prs_disc_perc: 5 }],
    });

    expect(dto.branches).toHaveLength(1);
    expect(dto.parties?.[0].prp_kind).toBe('CUSTOMER_GROUP');
    expect(dto.items?.[0].pri_scope_id).toBe(UUID);
    expect(dto.slabs?.[0].prs_disc_perc).toBe(5);
  });

  it('leaves a grid undefined when its key is absent', async () => {
    const dto = await validate({ ...header });

    expect(dto.branches).toBeUndefined();
    expect(dto.slabs).toBeUndefined();
  });

  // An absent key means "leave the grid alone", [] means "empty the grid" — the
  // service keys off exactly this distinction, so the pipe must preserve it.
  it('keeps an explicit empty array distinguishable from an absent key', async () => {
    const dto = await validate({ ...header, items: [] });

    expect(dto.items).toEqual([]);
  });

  it('rejects a bad row inside a grid', async () => {
    await expect(
      validate({ ...header, items: [{ pri_kind: 'ITEM_BRAND', pri_scope_id: 'not-a-uuid' }] }),
    ).rejects.toThrow();
  });

  it('rejects an unknown key inside a grid row', async () => {
    await expect(
      validate({ ...header, branches: [{ prb_branch_id: UUID, prb_nonsense: 1 }] }),
    ).rejects.toThrow();
  });
});
