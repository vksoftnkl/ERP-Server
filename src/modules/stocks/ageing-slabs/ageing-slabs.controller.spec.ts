import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { AgeingSlabsController } from './ageing-slabs.controller';
import { AgeingSlabsService } from './ageing-slabs.service';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const LADDER = { usingOwn: true, slabs: [{ slabNo: 1, label: 'All', fromDays: 0, toDays: null }] };

describe('AgeingSlabsController (menu 294)', () => {
  let service: { get: jest.Mock; save: jest.Mock; revert: jest.Mock };
  let rights: { um_can_view: boolean; um_can_edit: boolean } | null;
  let prisma: { $queryRaw: jest.Mock };
  let controller: AgeingSlabsController;

  beforeEach(() => {
    service = {
      get: jest.fn().mockResolvedValue(LADDER),
      save: jest.fn().mockResolvedValue(LADDER),
      revert: jest.fn().mockResolvedValue({ ...LADDER, usingOwn: false }),
    };
    rights = { um_can_view: true, um_can_edit: true };
    prisma = { $queryRaw: jest.fn(() => Promise.resolve(rights ? [rights] : [])) };
    controller = new AgeingSlabsController(
      service as unknown as AgeingSlabsService,
      prisma as unknown as PrismaService,
      { getUserId: () => '01000000-0000-7000-8000-0000000000a1' } as unknown as RequestContextService,
    );
  });

  const refusalCode = async (promise: Promise<unknown>) => {
    const error = (await promise.catch((e: unknown) => e)) as {
      getStatus: () => number;
      getResponse: () => { errors: Array<{ code: string }> };
    };
    return [error.getStatus(), error.getResponse().errors[0].code];
  };

  it('reads on VIEW', async () => {
    await expect(controller.get({ companyId: COMPANY_ID })).resolves.toEqual({
      success: true,
      message: 'Ageing slabs fetched successfully',
      data: LADDER,
    });
    expect(prisma.$queryRaw.mock.calls[0]).toContain(294);
  });

  it('refuses a read without VIEW', async () => {
    rights = { um_can_view: false, um_can_edit: true };
    expect(await refusalCode(controller.get({ companyId: COMPANY_ID }))).toEqual([403, 'AGE_RIGHT_VIEW']);
    expect(service.get).not.toHaveBeenCalled();
  });

  it('saves and reverts on EDIT only', async () => {
    await controller.save({ companyId: COMPANY_ID, slabs: LADDER.slabs });
    await expect(controller.revert({ companyId: COMPANY_ID })).resolves.toMatchObject({
      message: 'Ageing slabs reverted to the default',
    });
    rights = { um_can_view: true, um_can_edit: false };
    expect(await refusalCode(controller.save({ companyId: COMPANY_ID, slabs: LADDER.slabs }))).toEqual([
      403,
      'AGE_RIGHT_EDIT',
    ]);
    expect(await refusalCode(controller.revert({ companyId: COMPANY_ID }))).toEqual([403, 'AGE_RIGHT_EDIT']);
    expect(service.save).toHaveBeenCalledTimes(1);
    expect(service.revert).toHaveBeenCalledTimes(1);
  });

  it('gives a user with no row on 294 no rights', async () => {
    rights = null;
    expect(await refusalCode(controller.get({ companyId: COMPANY_ID }))).toEqual([403, 'AGE_RIGHT_VIEW']);
  });
});
