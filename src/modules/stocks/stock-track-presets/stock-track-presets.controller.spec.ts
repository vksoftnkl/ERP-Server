import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { StockTrackPresetsController } from './stock-track-presets.controller';
import { StockTrackPresetsService } from './stock-track-presets.service';
import { StockTrackPresetsPayload } from './types/stock-track-presets-api.types';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const SPT_ID = '01000000-0000-7000-8000-0000000000e1';

const PRESET = { spt_id: SPT_ID, spt_code: 'PHARMA' } as StockTrackPresetsPayload;

describe('StockTrackPresetsController', () => {
  let service: { get: jest.Mock; save: jest.Mock; deactivate: jest.Mock };
  let controller: StockTrackPresetsController;
  let rights: { um_can_create: boolean; um_can_edit: boolean } | null;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    service = {
      get: jest.fn().mockResolvedValue({
        items: [PRESET],
        meta: { company_id: COMPANY_ID, count: 1 },
      }),
      save: jest.fn().mockResolvedValue(PRESET),
      deactivate: jest.fn().mockResolvedValue({ ...PRESET, spt_is_active: false }),
    };
    rights = { um_can_create: true, um_can_edit: true };
    // loadRights reads one user_menus row.
    prisma = { $queryRaw: jest.fn(() => Promise.resolve(rights ? [rights] : [])) };
    controller = new StockTrackPresetsController(
      service as unknown as StockTrackPresetsService,
      prisma as unknown as PrismaService,
      { getUserId: () => '01000000-0000-7000-8000-0000000000a1' } as unknown as RequestContextService,
    );
  });

  it('lists the presets as data, with the meta beside them', async () => {
    const query = { company_id: COMPANY_ID };

    await expect(controller.get(query)).resolves.toEqual({
      success: true,
      message: 'Stock track presets fetched successfully',
      data: [PRESET],
      meta: { company_id: COMPANY_ID, count: 1 },
    });
    expect(service.get).toHaveBeenCalledWith(query);
  });

  it('words a fetch by spt_id in the singular', async () => {
    await expect(controller.get({ spt_id: SPT_ID })).resolves.toMatchObject({
      message: 'Stock track preset fetched successfully',
      data: [PRESET],
    });
  });

  it('passes a refusal from the service straight through', async () => {
    const refusal = new Error('not found');
    service.get.mockRejectedValue(refusal);

    await expect(controller.get({ spt_id: SPT_ID })).rejects.toBe(refusal);
  });

  it('does not judge the GET on menu 249: the item screens read it', async () => {
    rights = null;
    await controller.get({ company_id: COMPANY_ID });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('needs CREATE on 249 for a new preset and EDIT for an update', async () => {
    await expect(controller.save({ companyId: COMPANY_ID, code: 'DAIRY', name: 'Dairy' })).resolves.toMatchObject({
      message: 'Stock track preset created successfully',
      data: PRESET,
    });
    rights = { um_can_create: true, um_can_edit: false };
    const error = await controller.save({ companyId: COMPANY_ID, sptId: SPT_ID }).catch((e: unknown) => e);
    expect((error as { getStatus: () => number }).getStatus()).toBe(403);
    expect((error as { getResponse: () => unknown }).getResponse()).toMatchObject({
      errors: [{ code: 'SPT_RIGHT_EDIT' }],
    });
    expect(service.save).toHaveBeenCalledTimes(1);
  });

  it('refuses a create without CREATE', async () => {
    rights = { um_can_create: false, um_can_edit: true };
    const error = await controller.save({ companyId: COMPANY_ID, code: 'DAIRY', name: 'Dairy' }).catch((e: unknown) => e);
    expect((error as { getResponse: () => unknown }).getResponse()).toMatchObject({
      errors: [{ code: 'SPT_RIGHT_CREATE' }],
    });
    expect(service.save).not.toHaveBeenCalled();
  });

  it('deactivates on EDIT and words the result', async () => {
    await expect(controller.deactivate({ companyId: COMPANY_ID, sptId: SPT_ID })).resolves.toMatchObject({
      message: 'Stock track preset deactivated',
    });
    rights = null;
    const error = await controller.deactivate({ companyId: COMPANY_ID, sptId: SPT_ID }).catch((e: unknown) => e);
    expect((error as { getStatus: () => number }).getStatus()).toBe(403);
  });
});
