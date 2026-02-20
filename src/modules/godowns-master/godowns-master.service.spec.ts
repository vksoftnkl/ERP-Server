import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GodownLocation, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListOrGetGodownQueryDto } from './dto/list-or-get-godown-query.dto';
import { SaveGodownDto } from './dto/save-godown.dto';
import { GodownsMasterService } from './godowns-master.service';

const GDL_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';
const PARENT_ID = '019c6f6c-be87-7a11-8905-36092c46fd09';
const OTHER_BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fd10';
const CHILD_ID = '019c6f6c-be87-7a11-8905-36092c46fd12';

type PrismaMock = {
  godownLocation: {
    create: jest.Mock<Promise<GodownLocation>, [Prisma.GodownLocationCreateArgs]>;
    findFirst: jest.Mock<Promise<GodownLocation | null>, [Prisma.GodownLocationFindFirstArgs]>;
    findMany: jest.Mock<Promise<GodownLocation[]>, [Prisma.GodownLocationFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.GodownLocationCountArgs]>;
    update: jest.Mock<Promise<GodownLocation>, [Prisma.GodownLocationUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.GodownLocationUpdateManyArgs]>;
  };
  gridDetails: {
    findFirst: jest.Mock<
      Promise<{ gridId: bigint; gridSql: string | null } | null>,
      [Prisma.GridDetailsFindFirstArgs]
    >;
  };
  gridColumn: {
    findMany: jest.Mock<
      Promise<Array<{ gridColumnName: string }>>,
      [Prisma.GridColumnFindManyArgs]
    >;
  };
  $queryRawUnsafe: jest.Mock<Promise<unknown>, [string, ...unknown[]]>;
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

const makeRecord = (overrides: Partial<GodownLocation> = {}): GodownLocation =>
  ({
    gdlId: GDL_ID,
    gdlGodownId: GODOWN_ID,
    gdlBranchId: BRANCH_ID,
    gdlName: 'Rack A1',
    gdlShort: 'A1',
    gdlCode: 'RACK-A1',
    gdlType: 'BIN',
    gdlParentId: null,
    gdlSort: 1,
    gdlLevel: 0,
    gdlPathIdsCache: [],
    gdlDelSheet: false,
    gdlSplitStock: false,
    gdlNegativeStock: false,
    gdlVolume: new Prisma.Decimal('10.0000'),
    gdlIsActive: true,
    gdlIsDeleted: false,
    gdlCreatedOn: new Date('2026-02-20T10:15:30.000Z'),
    gdlCreatedBy: 'system',
    gdlModifiedOn: new Date('2026-02-20T10:15:30.000Z'),
    gdlModifiedBy: 'system',
    gdlRemarks: null,
    ...overrides,
  }) as GodownLocation;

describe('GodownsMasterService', () => {
  let service: GodownsMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;

  beforeEach(() => {
    prisma = {
      godownLocation: {
        create: jest.fn<Promise<GodownLocation>, [Prisma.GodownLocationCreateArgs]>(),
        findFirst: jest.fn<Promise<GodownLocation | null>, [Prisma.GodownLocationFindFirstArgs]>(),
        findMany: jest.fn<Promise<GodownLocation[]>, [Prisma.GodownLocationFindManyArgs]>(),
        count: jest.fn<Promise<number>, [Prisma.GodownLocationCountArgs]>(),
        update: jest.fn<Promise<GodownLocation>, [Prisma.GodownLocationUpdateArgs]>(),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Prisma.GodownLocationUpdateManyArgs]>(),
      },
      gridDetails: {
        findFirst: jest.fn<
          Promise<{ gridId: bigint; gridSql: string | null } | null>,
          [Prisma.GridDetailsFindFirstArgs]
        >(),
      },
      gridColumn: {
        findMany: jest.fn<
          Promise<Array<{ gridColumnName: string }>>,
          [Prisma.GridColumnFindManyArgs]
        >(),
      },
      $queryRawUnsafe: jest.fn<Promise<unknown>, [string, ...unknown[]]>(),
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: Prisma.TransactionClient) => Promise<unknown>]
      >(),
    };

    prisma.gridDetails.findFirst.mockResolvedValue(null);
    prisma.gridColumn.findMany.mockResolvedValue([]);
    prisma.godownLocation.findMany.mockResolvedValue([]);

    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prisma as unknown as Prisma.TransactionClient),
    );

    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };

    service = new GodownsMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
    );
  });

  it('creates a godown location with minimal payload', async () => {
    const created = makeRecord();
    prisma.godownLocation.create.mockResolvedValue(created);

    const input: SaveGodownDto = {
      gdl_godown_id: GODOWN_ID,
      gdl_branch_id: BRANCH_ID,
      gdl_name: 'Rack A1',
    };

    const result = await service.save(input);

    expect(prisma.godownLocation.create).toHaveBeenCalledTimes(1);
    expect(result.gdl_id).toBe(GDL_ID);
    expect(result.gdl_name).toBe('Rack A1');
  });

  it('fails create when gdl_name is missing', async () => {
    await expect(
      service.save({
        gdl_godown_id: GODOWN_ID,
        gdl_branch_id: BRANCH_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails create when gdl_godown_id is missing', async () => {
    await expect(
      service.save({
        gdl_branch_id: BRANCH_ID,
        gdl_name: 'Rack A1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails create when parent location is not found', async () => {
    prisma.godownLocation.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.save({
        gdl_godown_id: GODOWN_ID,
        gdl_branch_id: BRANCH_ID,
        gdl_name: 'Rack A1',
        gdl_parent_id: PARENT_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails create when parent belongs to a different hierarchy', async () => {
    prisma.godownLocation.findFirst.mockResolvedValueOnce(
      makeRecord({
        gdlId: PARENT_ID,
        gdlBranchId: OTHER_BRANCH_ID,
      }),
    );

    await expect(
      service.save({
        gdl_godown_id: GODOWN_ID,
        gdl_branch_id: BRANCH_ID,
        gdl_name: 'Rack A1',
        gdl_parent_id: PARENT_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates a location when gdl_id exists', async () => {
    const existing = makeRecord();
    const updated = makeRecord({
      gdlName: 'Rack A2',
      gdlShort: 'A2',
      gdlVolume: new Prisma.Decimal('15.0000'),
      gdlIsActive: false,
    });

    prisma.godownLocation.findFirst.mockResolvedValueOnce(existing);
    prisma.godownLocation.update.mockResolvedValueOnce(updated);

    const result = await service.save({
      gdl_id: GDL_ID,
      gdl_name: 'Rack A2',
      gdl_short: 'A2',
      gdl_volume: 15,
      gdl_is_active: false,
    });

    expect(prisma.godownLocation.update).toHaveBeenCalledTimes(1);
    expect(result.gdl_name).toBe('Rack A2');
    expect(result.gdl_is_active).toBe(false);
  });

  it('fails update when gdl_id is unknown', async () => {
    prisma.godownLocation.findFirst.mockResolvedValue(null);

    await expect(
      service.save({
        gdl_id: GDL_ID,
        gdl_name: 'Rack A2',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails update when gdl_parent_id equals gdl_id', async () => {
    prisma.godownLocation.findFirst.mockResolvedValueOnce(makeRecord());

    await expect(
      service.save({
        gdl_id: GDL_ID,
        gdl_parent_id: GDL_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps unique constraint errors to conflict', async () => {
    prisma.godownLocation.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.save({
        gdl_godown_id: GODOWN_ID,
        gdl_branch_id: BRANCH_ID,
        gdl_name: 'Rack A1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps foreign key errors to bad request', async () => {
    prisma.godownLocation.create.mockRejectedValue({ code: 'P2003' });

    await expect(
      service.save({
        gdl_godown_id: GODOWN_ID,
        gdl_branch_id: BRANCH_ID,
        gdl_name: 'Rack A1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('list enforces soft-delete exclusion', async () => {
    prisma.godownLocation.count.mockResolvedValue(1);
    prisma.godownLocation.findMany.mockResolvedValue([makeRecord()]);

    await service.list({} as ListOrGetGodownQueryDto);

    const countArgs = prisma.godownLocation.count.mock.calls[0][0];
    const findArgs = prisma.godownLocation.findMany.mock.calls[0][0];
    expect(countArgs.where?.gdlIsDeleted).toBe(false);
    expect(findArgs.where?.gdlIsDeleted).toBe(false);
  });

  it('list applies search and active filters', async () => {
    prisma.godownLocation.count.mockResolvedValue(0);
    prisma.godownLocation.findMany.mockResolvedValue([]);

    await service.list({
      search: 'rack',
      gdl_is_active: true,
    });

    const findArgs = prisma.godownLocation.findMany.mock.calls[0][0];
    expect(findArgs.where?.gdlIsActive).toBe(true);
    expect(Array.isArray(findArgs.where?.OR)).toBe(true);
  });

  it('list returns pagination metadata', async () => {
    prisma.godownLocation.count.mockResolvedValue(25);
    prisma.godownLocation.findMany.mockResolvedValue([makeRecord()]);

    const result = await service.list({
      page: 2,
      limit: 10,
    });

    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      total_pages: 3,
    });
  });

  it('uses configured grid_sql even when filters and search are provided', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridId: BigInt(7),
      gridSql:
        'SELECT gdl_id AS "location id", gdl_name AS "location name", gdl_code AS "location code", gdl_godown_id, gdl_branch_id, gdl_is_active FROM godown_locations WHERE gdl_is_deleted = false',
    });
    prisma.gridColumn.findMany.mockResolvedValue([
      { gridColumnName: 'location name' },
      { gridColumnName: 'location code' },
    ]);
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ total: BigInt(1) }]).mockResolvedValueOnce([
      {
        'location id': GDL_ID,
        'location name': 'Rack A1',
        'location code': 'RACK-A1',
        gdl_godown_id: GODOWN_ID,
        gdl_branch_id: BRANCH_ID,
        gdl_is_active: true,
      },
    ]);

    const result = await service.list({
      gdl_godown_id: GODOWN_ID,
      gdl_branch_id: BRANCH_ID,
      gdl_is_active: true,
      search: 'rack',
      page: 1,
      limit: 20,
    });

    expect(prisma.godownLocation.findMany).not.toHaveBeenCalled();
    expect(prisma.godownLocation.count).not.toHaveBeenCalled();
    expect(prisma.gridColumn.findMany).toHaveBeenCalledWith({
      where: {
        gridId: BigInt(7),
        gridColumnIsDeleted: false,
        gridColumnFilter: true,
        grid: {
          gridIsDeleted: false,
        },
      },
      orderBy: [{ gridColumnNumber: 'asc' }, { gridSerialId: 'asc' }],
      select: {
        gridColumnName: true,
      },
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE grid_kv.key = $4'),
      GODOWN_ID,
      BRANCH_ID,
      true,
      'location name',
      '%rack%',
      'location code',
      '%rack%',
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $8 OFFSET $9'),
      GODOWN_ID,
      BRANCH_ID,
      true,
      'location name',
      '%rack%',
      'location code',
      '%rack%',
      20,
      0,
    );
    expect(result.meta.total).toBe(1);
  });

  it('rejects invalid configured grid_sql in list', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridId: BigInt(7),
      gridSql: 'DELETE FROM godown_locations',
    });

    await expect(service.list({})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('adds newly created child id to parent cache', async () => {
    const parent = makeRecord({
      gdlId: PARENT_ID,
      gdlParentId: null,
      gdlPathIdsCache: [PARENT_ID],
    });
    const createdChild = makeRecord({
      gdlId: CHILD_ID,
      gdlName: 'Rack B1',
      gdlParentId: PARENT_ID,
      gdlPathIdsCache: [],
    });
    const childWithPath = makeRecord({
      gdlId: CHILD_ID,
      gdlName: 'Rack B1',
      gdlParentId: PARENT_ID,
      gdlPathIdsCache: [CHILD_ID],
    });

    prisma.godownLocation.findFirst
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(childWithPath);
    prisma.godownLocation.create.mockResolvedValue(createdChild);
    prisma.godownLocation.findMany.mockResolvedValueOnce([createdChild]).mockResolvedValueOnce([
      parent,
    ]);
    prisma.godownLocation.update
      .mockResolvedValueOnce(childWithPath)
      .mockResolvedValueOnce(
        makeRecord({
          gdlId: PARENT_ID,
          gdlParentId: null,
          gdlPathIdsCache: [PARENT_ID, CHILD_ID],
        }),
      );

    const result = await service.save({
      gdl_godown_id: GODOWN_ID,
      gdl_branch_id: BRANCH_ID,
      gdl_name: 'Rack B1',
      gdl_parent_id: PARENT_ID,
    });

    expect(result.gdl_id).toBe(CHILD_ID);
    const parentUpdateArgs = prisma.godownLocation.update.mock.calls[1][0];
    expect(parentUpdateArgs.where.gdlId).toBe(PARENT_ID);
    expect(parentUpdateArgs.data.gdlPathIdsCache).toEqual([PARENT_ID, CHILD_ID]);
  });

  it('getById returns a location when it exists and is not deleted', async () => {
    prisma.godownLocation.findFirst.mockResolvedValue(makeRecord());

    const result = await service.getById(GDL_ID);

    expect(result.gdl_id).toBe(GDL_ID);
    expect(result.gdl_is_deleted).toBe(false);
  });

  it('getById throws not found for missing/deleted location', async () => {
    prisma.godownLocation.findFirst.mockResolvedValue(null);

    await expect(service.getById(GDL_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('softDelete marks location as deleted', async () => {
    prisma.godownLocation.findFirst.mockResolvedValue(makeRecord());
    prisma.godownLocation.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.softDelete(GDL_ID);

    expect(prisma.godownLocation.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.godownLocation.updateMany.mock.calls[0][0];
    expect(updateManyArgs.where).toEqual({
      gdlId: GDL_ID,
      gdlIsDeleted: false,
    });
    expect(updateManyArgs.data).toEqual(
      expect.objectContaining({
        gdlIsDeleted: true,
      }),
    );
    expect(updateManyArgs.data?.gdlModifiedOn).toBeInstanceOf(Date);
    expect(result).toEqual({
      gdl_id: GDL_ID,
      deleted: true,
    });
  });

  it('softDelete removes subtree ids from ancestor caches', async () => {
    const parent = makeRecord({
      gdlId: PARENT_ID,
      gdlParentId: null,
      gdlPathIdsCache: [PARENT_ID, GDL_ID, CHILD_ID],
    });
    const node = makeRecord({
      gdlId: GDL_ID,
      gdlParentId: PARENT_ID,
      gdlPathIdsCache: [GDL_ID, CHILD_ID],
    });
    const child = makeRecord({
      gdlId: CHILD_ID,
      gdlParentId: GDL_ID,
      gdlPathIdsCache: [CHILD_ID],
    });

    prisma.godownLocation.findFirst
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(node)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(parent);
    prisma.godownLocation.findMany.mockResolvedValueOnce([child]).mockResolvedValueOnce([]).mockResolvedValueOnce([
      parent,
    ]);
    prisma.godownLocation.updateMany.mockResolvedValue({ count: 1 });
    prisma.godownLocation.update.mockResolvedValueOnce(
      makeRecord({
        gdlId: PARENT_ID,
        gdlParentId: null,
        gdlPathIdsCache: [PARENT_ID],
      }),
    );

    await expect(service.softDelete(GDL_ID)).resolves.toEqual({
      gdl_id: GDL_ID,
      deleted: true,
    });
    expect(prisma.godownLocation.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.godownLocation.update).toHaveBeenCalledTimes(1);
    const ancestorUpdateArgs = prisma.godownLocation.update.mock.calls[0][0];
    expect(ancestorUpdateArgs.where.gdlId).toBe(PARENT_ID);
    expect(ancestorUpdateArgs.data.gdlPathIdsCache).toEqual([PARENT_ID]);
  });

  it('softDelete throws not found when location does not exist', async () => {
    prisma.godownLocation.findFirst.mockResolvedValue(null);

    await expect(service.softDelete(GDL_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
