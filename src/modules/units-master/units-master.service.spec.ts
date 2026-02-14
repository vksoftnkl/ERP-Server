import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListUnitQueryDto } from './dto/list-unit-query.dto';
import { SaveUnitDto } from './dto/save-unit.dto';
import { UnitsMasterService } from './units-master.service';

const UNIT_ID = 1;
const BASE_UNIT_ID = 2;

type PrismaMock = {
  unit: {
    create: jest.Mock<Promise<Unit>, [Prisma.UnitCreateArgs]>;
    findFirst: jest.Mock<Promise<Unit | null>, [Prisma.UnitFindFirstArgs]>;
    findMany: jest.Mock<Promise<Unit[]>, [Prisma.UnitFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.UnitCountArgs]>;
    update: jest.Mock<Promise<Unit>, [Prisma.UnitUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.UnitUpdateManyArgs]>;
  };
};

const makeRecord = (overrides: Partial<Unit> = {}): Unit =>
  ({
    unit_id: UNIT_ID,
    unit_name: 'PCS',
    unit_alias: 'Pieces',
    unit_code: 'PC001',
    unit_description: 'Individual pieces',
    unit_decimal_count: 0,
    unit_weight: new Prisma.Decimal('0.5'),
    unit_loading: new Prisma.Decimal('5'),
    unit_unloading: new Prisma.Decimal('5'),
    unit_attach_charge: new Prisma.Decimal('2'),
    unit_is_pack_unit: false,
    unit_base_unit_id: null,
    unit_conversion: null,
    unit_is_active: true,
    unit_is_deleted: false,
    unit_sync_date: null,
    unit_created_on: new Date('2026-02-14T10:00:00.000Z'),
    unit_created_by: 'tester',
    unit_modified_on: new Date('2026-02-14T10:00:00.000Z'),
    unit_modified_by: 'tester',
    ...overrides,
  }) as Unit;

describe('UnitsMasterService', () => {
  let service: UnitsMasterService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      unit: {
        create: jest.fn<Promise<Unit>, [Prisma.UnitCreateArgs]>(),
        findFirst: jest.fn<Promise<Unit | null>, [Prisma.UnitFindFirstArgs]>(),
        findMany: jest.fn<Promise<Unit[]>, [Prisma.UnitFindManyArgs]>(),
        count: jest.fn<Promise<number>, [Prisma.UnitCountArgs]>(),
        update: jest.fn<Promise<Unit>, [Prisma.UnitUpdateArgs]>(),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Prisma.UnitUpdateManyArgs]>(),
      },
    };

    service = new UnitsMasterService(prisma as unknown as PrismaService);
  });

  it('creates a unit when unit_id is not provided', async () => {
    prisma.unit.create.mockResolvedValue(makeRecord());

    const input: SaveUnitDto = {
      unit_name: 'PCS',
    };

    const result = await service.save(input);

    expect(prisma.unit.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.unit.create.mock.calls[0][0];
    expect(createArgs.data.unit_name).toBe('PCS');
    expect(result.unit_id).toBe(UNIT_ID);
  });

  it('updates a unit when unit_id is provided', async () => {
    prisma.unit.findFirst.mockResolvedValue(makeRecord());
    prisma.unit.update.mockResolvedValue(makeRecord({ unit_name: 'BOX' }));

    const input: SaveUnitDto = {
      unit_id: UNIT_ID,
      unit_name: 'BOX',
    };

    const result = await service.save(input);

    expect(prisma.unit.update).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.unit.update.mock.calls[0][0];
    expect(updateArgs.where.unit_id).toBe(UNIT_ID);
    expect(updateArgs.data.unit_name).toBe('BOX');
    expect(updateArgs.data.unit_modified_by).toBe('system');
    expect(result.unit_name).toBe('BOX');
  });

  it('rejects duplicate name with 409', async () => {
    prisma.unit.create.mockRejectedValue({ code: 'P2002' });

    const input: SaveUnitDto = {
      unit_name: 'PCS',
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects save when base unit is set but conversion is missing', async () => {
    const input: SaveUnitDto = {
      unit_name: 'BOX',
      unit_base_unit_id: BASE_UNIT_ID,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects save when conversion is set without base unit id', async () => {
    const input: SaveUnitDto = {
      unit_name: 'BOX',
      unit_conversion: 10,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects self-base updates', async () => {
    prisma.unit.findFirst.mockResolvedValue(makeRecord());

    const input: SaveUnitDto = {
      unit_id: UNIT_ID,
      unit_name: 'PCS',
      unit_base_unit_id: UNIT_ID,
      unit_conversion: 10,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 in getById when row is missing or soft deleted', async () => {
    prisma.unit.findFirst.mockResolvedValue(null);

    await expect(service.getById(UNIT_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.unit.findFirst).toHaveBeenCalledTimes(1);
    const findFirstArgs = prisma.unit.findFirst.mock.calls[0][0];
    expect(findFirstArgs.where?.unit_id).toBe(UNIT_ID);
    expect(findFirstArgs.where?.unit_is_deleted).toBe(false);
  });

  it('excludes deleted rows in list', async () => {
    prisma.unit.count.mockResolvedValue(1);
    prisma.unit.findMany.mockResolvedValue([makeRecord()]);

    const query: ListUnitQueryDto = {};

    await service.list(query);

    expect(prisma.unit.count).toHaveBeenCalledTimes(1);
    const countArgs = prisma.unit.count.mock.calls[0][0];
    expect(countArgs.where?.unit_is_deleted).toBe(false);
  });

  it('applies pagination and search filters correctly', async () => {
    prisma.unit.count.mockResolvedValue(35);
    prisma.unit.findMany.mockResolvedValue([makeRecord()]);

    const query: ListUnitQueryDto = {
      unit_is_active: true,
      search: 'pc',
      page: 2,
      limit: 10,
    };

    const result = await service.list(query);

    expect(prisma.unit.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.unit.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
    expect(findManyArgs.where?.unit_is_deleted).toBe(false);
    expect(findManyArgs.where?.unit_is_active).toBe(true);
    expect(findManyArgs.where?.OR).toEqual([
      { unit_name: { contains: 'pc', mode: 'insensitive' } },
      { unit_alias: { contains: 'pc', mode: 'insensitive' } },
      { unit_code: { contains: 'pc', mode: 'insensitive' } },
      { unit_description: { contains: 'pc', mode: 'insensitive' } },
    ]);

    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      total_pages: 4,
    });
  });

  it('soft deletes units instead of physical removal', async () => {
    prisma.unit.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.softDelete(UNIT_ID)).resolves.toEqual({
      unit_id: UNIT_ID,
      deleted: true,
    });

    expect(prisma.unit.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.unit.updateMany.mock.calls[0][0];
    if (!updateManyArgs.where) {
      throw new Error('Expected updateMany where clause');
    }
    expect(updateManyArgs.where.unit_id).toBe(UNIT_ID);
    expect(updateManyArgs.where.unit_is_deleted).toBe(false);
    expect(updateManyArgs.data.unit_is_deleted).toBe(true);
    expect(updateManyArgs.data.unit_modified_by).toBe('system');
  });

  it('validates parent unit exists when base unit id is provided', async () => {
    prisma.unit.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeRecord({ unit_id: UNIT_ID, unit_base_unit_id: null }));

    const input: SaveUnitDto = {
      unit_name: 'BOX',
      unit_base_unit_id: BASE_UNIT_ID,
      unit_conversion: 10,
    };

    await expect(service.save(input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
