import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemTaxMaster, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { ListItemTaxQueryDto } from './dto/list-item-tax-query.dto';
import { SaveItemTaxDto } from './dto/save-item-tax.dto';
import { ItemsTaxMasterService } from './items-tax-master.service';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';

type PrismaMock = {
  itemTaxMaster: {
    create: jest.Mock<Promise<ItemTaxMaster>, [Prisma.ItemTaxMasterCreateArgs]>;
    findFirst: jest.Mock<Promise<ItemTaxMaster | null>, [Prisma.ItemTaxMasterFindFirstArgs]>;
    findMany: jest.Mock<Promise<ItemTaxMaster[]>, [Prisma.ItemTaxMasterFindManyArgs]>;
    count: jest.Mock<Promise<number>, [Prisma.ItemTaxMasterCountArgs]>;
    update: jest.Mock<Promise<ItemTaxMaster>, [Prisma.ItemTaxMasterUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Prisma.ItemTaxMasterUpdateManyArgs]>;
  };
  gridDetails: {
    findFirst: jest.Mock<
      Promise<{ gridSql: string | null } | null>,
      [Prisma.GridDetailsFindFirstArgs]
    >;
  };
  $queryRawUnsafe: jest.Mock<Promise<unknown>, [string, ...unknown[]]>;
  $transaction: jest.Mock<Promise<unknown>, [(tx: Prisma.TransactionClient) => Promise<unknown>]>;
};

type ConfiguredGridSqlServiceMock = {
  loadCandidates: jest.Mock;
  filterPrimaryFromTable: jest.Mock;
  validateBaseSql: jest.Mock;
  runPagedQuery: jest.Mock;
};

const makeRecord = (overrides: Partial<ItemTaxMaster> = {}): ItemTaxMaster =>
  ({
    taxId: TAX_ID,
    taxName: 'GST 18%',
    taxCode: 'GST18',
    taxTaxabilityType: 'TAXABLE',
    taxIsReverseCharge: false,
    taxCgstPerc: new Prisma.Decimal('9'),
    taxSgstPerc: new Prisma.Decimal('9'),
    taxIgstPerc: new Prisma.Decimal('18'),
    taxCgstPurPerc: new Prisma.Decimal('9'),
    taxSgstPurPerc: new Prisma.Decimal('9'),
    taxIgstPurPerc: new Prisma.Decimal('18'),
    taxCessType: 'NONE',
    taxCessPerc: new Prisma.Decimal('0'),
    taxCessUnit: new Prisma.Decimal('0'),
    taxCessPurPerc: new Prisma.Decimal('0'),
    taxCessPurUnit: new Prisma.Decimal('0'),
    taxGstRateTotal: new Prisma.Decimal('18'),
    taxSalesLedgerId: null,
    taxSalesReturnLedgerId: null,
    taxPurchaseLedgerId: null,
    taxPurchaseReturnLedgerId: null,
    taxCgstOutputLedgerId: null,
    taxSgstOutputLedgerId: null,
    taxIgstOutputLedgerId: null,
    taxCessOutputLedgerId: null,
    taxCgstInputLedgerId: null,
    taxSgstInputLedgerId: null,
    taxIgstInputLedgerId: null,
    taxCessInputLedgerId: null,
    taxIsActive: true,
    taxIsDeleted: false,
    taxSyncDate: null,
    taxCreatedOn: new Date('2026-02-20T10:00:00.000Z'),
    taxCreatedBy: 'system',
    taxModifiedOn: new Date('2026-02-20T10:00:00.000Z'),
    taxModifiedBy: 'system',
    ...overrides,
  }) as ItemTaxMaster;

describe('ItemsTaxMasterService', () => {
  let service: ItemsTaxMasterService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let configuredGridSqlService: ConfiguredGridSqlServiceMock;

  beforeEach(() => {
    prisma = {
      itemTaxMaster: {
        create: jest.fn<Promise<ItemTaxMaster>, [Prisma.ItemTaxMasterCreateArgs]>(),
        findFirst: jest.fn<Promise<ItemTaxMaster | null>, [Prisma.ItemTaxMasterFindFirstArgs]>(),
        findMany: jest.fn<Promise<ItemTaxMaster[]>, [Prisma.ItemTaxMasterFindManyArgs]>(),
        count: jest.fn<Promise<number>, [Prisma.ItemTaxMasterCountArgs]>(),
        update: jest.fn<Promise<ItemTaxMaster>, [Prisma.ItemTaxMasterUpdateArgs]>(),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Prisma.ItemTaxMasterUpdateManyArgs]>(),
      },
      gridDetails: {
        findFirst: jest.fn<
          Promise<{ gridSql: string | null } | null>,
          [Prisma.GridDetailsFindFirstArgs]
        >(),
      },
      $queryRawUnsafe: jest.fn<Promise<unknown>, [string, ...unknown[]]>(),
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: Prisma.TransactionClient) => Promise<unknown>]
      >(),
    };

    prisma.gridDetails.findFirst.mockResolvedValue(null);
    prisma.itemTaxMaster.findMany.mockResolvedValue([]);

    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prisma as unknown as Prisma.TransactionClient),
    );

    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };
    configuredGridSqlService = {
      loadCandidates: jest.fn().mockImplementation(async (options: { tableName: string }) => {
        const configuredGrid = await prisma.gridDetails.findFirst({
          where: {
            gridIsDeleted: false,
            gridStatus: true,
            gridSql: {
              not: null,
              contains: options.tableName,
              mode: 'insensitive',
            },
          },
          orderBy: [{ gridSortOrder: 'asc' }, { gridId: 'desc' }],
          select: {
            gridSql: true,
          },
        });
        if (!configuredGrid?.gridSql) {
          return [];
        }

        return [
          {
            gridId: BigInt(1),
            gridSql: configuredGrid.gridSql,
          },
        ];
      }),
      filterPrimaryFromTable: jest.fn().mockImplementation((candidates: Array<unknown>) => candidates),
      validateBaseSql: jest
        .fn()
        .mockImplementation((options: { sql: string; tableName: string }) => {
          const normalizedSql = options.sql.trim().replace(/;+\s*$/g, '');
          if (!/^select\b/i.test(normalizedSql)) {
            return {
              isValid: false,
              message: 'Only SELECT query is allowed',
            };
          }
          if (normalizedSql.includes(';')) {
            return {
              isValid: false,
              message: 'Multiple statements are not allowed',
            };
          }
          if (/--|\/\*/.test(normalizedSql)) {
            return {
              isValid: false,
              message: 'Comments are not allowed in configured query',
            };
          }
          if (!new RegExp(`\\b${options.tableName}\\b`, 'i').test(normalizedSql)) {
            return {
              isValid: false,
              message: `Configured query must reference ${options.tableName} table`,
            };
          }
          return {
            isValid: true,
            normalizedSql,
          };
        }),
      runPagedQuery: jest.fn().mockImplementation(
        async (options: {
          baseSql: string;
          alias: string;
          params?: unknown[];
          limit: number;
          skip: number;
        }) => {
          const params = options.params ?? [];
          const countSql = `SELECT COUNT(*)::bigint AS total FROM (${options.baseSql}) AS ${options.alias}_count`;
          const rowsSql = `SELECT * FROM (${options.baseSql}) AS ${options.alias}_rows LIMIT $${
            params.length + 1
          } OFFSET $${params.length + 2}`;
          const [countResult, rows] = await Promise.all([
            prisma.$queryRawUnsafe(countSql, ...params),
            prisma.$queryRawUnsafe(rowsSql, ...params, options.limit, options.skip),
          ]);
          const totalRaw = (countResult as Array<{ total: bigint | number | string }>)[0]?.total;
          if (typeof totalRaw === 'bigint') {
            return { items: rows as unknown[], total: Number(totalRaw) };
          }
          if (typeof totalRaw === 'number') {
            return { items: rows as unknown[], total: Number.isFinite(totalRaw) ? totalRaw : 0 };
          }
          if (typeof totalRaw === 'string') {
            const parsed = Number(totalRaw);
            return { items: rows as unknown[], total: Number.isFinite(parsed) ? parsed : 0 };
          }
          return { items: rows as unknown[], total: 0 };
        },
      ),
    };
    service = new ItemsTaxMasterService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      configuredGridSqlService as unknown as ConfiguredGridSqlService,
    );
  });
  it('creates an item tax with minimal payload', async () => {
    const created = makeRecord();
    prisma.itemTaxMaster.create.mockResolvedValue(created);
    const input: SaveItemTaxDto = {
      tax_name: 'GST 18%',
    };
    const result = await service.save(input);
    expect(prisma.itemTaxMaster.create).toHaveBeenCalledTimes(1);
    expect(result.tax_id).toBe(TAX_ID);
    expect(result.tax_name).toBe('GST 18%');
  });
  it('fails create when tax_name is missing', async () => {
    await expect(
      service.save({
        tax_name: '' as unknown as string,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('updates an item tax when tax_id exists', async () => {
    const existing = makeRecord();
    const updated = makeRecord({
      taxName: 'GST 12%',
      taxCode: 'GST12',
      taxGstRateTotal: new Prisma.Decimal('12'),
    });
    prisma.itemTaxMaster.findFirst.mockResolvedValueOnce(existing);
    prisma.itemTaxMaster.update.mockResolvedValueOnce(updated);
    const result = await service.save({
      tax_id: TAX_ID,
      tax_name: 'GST 12%',
      tax_code: 'GST12',
      tax_gst_rate_total: 12,
    });
    expect(prisma.itemTaxMaster.update).toHaveBeenCalledTimes(1);
    expect(result.tax_name).toBe('GST 12%');
    expect(result.tax_gst_rate_total).toBe(12);
  });
  it('fails update when tax_id is unknown', async () => {
    prisma.itemTaxMaster.findFirst.mockResolvedValue(null);
    await expect(
      service.save({
        tax_id: TAX_ID,
        tax_name: 'GST 18%',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('maps unique constraint errors to conflict', async () => {
    prisma.itemTaxMaster.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.save({
        tax_name: 'GST 18%',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('list enforces soft-delete exclusion', async () => {
    prisma.itemTaxMaster.count.mockResolvedValue(1);
    prisma.itemTaxMaster.findMany.mockResolvedValue([makeRecord()]);
    await service.list({} as ListItemTaxQueryDto);
    const countArgs = prisma.itemTaxMaster.count.mock.calls[0][0];
    const findArgs = prisma.itemTaxMaster.findMany.mock.calls[0][0];
    expect(countArgs.where?.taxIsDeleted).toBe(false);
    expect(findArgs.where?.taxIsDeleted).toBe(false);
  });
  it('list applies search and active filters', async () => {
    prisma.itemTaxMaster.count.mockResolvedValue(0);
    prisma.itemTaxMaster.findMany.mockResolvedValue([]);
    await service.list({
      search: 'gst',
      tax_is_active: true,
      tax_is_reverse_charge: false,
      tax_taxability_type: 'TAXABLE',
    });
    const findArgs = prisma.itemTaxMaster.findMany.mock.calls[0][0];
    expect(findArgs.where?.taxIsActive).toBe(true);
    expect(findArgs.where?.taxIsReverseCharge).toBe(false);
    expect(Array.isArray(findArgs.where?.OR)).toBe(true);
  });
  it('list returns pagination metadata', async () => {
    prisma.itemTaxMaster.count.mockResolvedValue(25);
    prisma.itemTaxMaster.findMany.mockResolvedValue([makeRecord()]);
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
  it('uses configured grid_sql for plain get-all list', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql:
        'SELECT tax_id AS "taxId", tax_name AS "taxName" FROM item_tax_master WHERE tax_is_deleted = false',
    });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ total: BigInt(1) }])
      .mockResolvedValueOnce([{ taxId: TAX_ID, taxName: 'GST 18%' }]);
    const result = await service.list({});
    expect(prisma.itemTaxMaster.findMany).not.toHaveBeenCalled();
    expect(prisma.itemTaxMaster.count).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('COUNT(*)::bigint AS total'),
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT $1 OFFSET $2'),
      20,
      0,
    );
    expect(result).toEqual({
      items: [{ taxId: TAX_ID, taxName: 'GST 18%' }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });
  it('falls back to prisma list when configured grid_sql is invalid', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql: 'DELETE FROM item_tax_master',
    });

    prisma.itemTaxMaster.count.mockResolvedValue(1);
    prisma.itemTaxMaster.findMany.mockResolvedValue([makeRecord()]);

    const result = await service.list({});

    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.itemTaxMaster.count).toHaveBeenCalledTimes(1);
    expect(prisma.itemTaxMaster.findMany).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.tax_id).toBe(TAX_ID);
  });
  it('falls back to prisma list when configured grid_sql execution fails', async () => {
    prisma.gridDetails.findFirst.mockResolvedValue({
      gridSql:
        'SELECT tax_id AS "taxId", tax_name AS "taxName" FROM item_tax_master WHERE tax_is_deleted = false',
    });
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('broken configured SQL'));
    prisma.itemTaxMaster.count.mockResolvedValue(1);
    prisma.itemTaxMaster.findMany.mockResolvedValue([makeRecord()]);

    const result = await service.list({});

    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    expect(prisma.itemTaxMaster.count).toHaveBeenCalledTimes(1);
    expect(prisma.itemTaxMaster.findMany).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.tax_id).toBe(TAX_ID);
  });
  it('getById returns an item tax when it exists and is not deleted', async () => {
    prisma.itemTaxMaster.findFirst.mockResolvedValue(makeRecord());
    const result = await service.getById(TAX_ID);
    expect(result.tax_id).toBe(TAX_ID);
    expect(result.tax_is_deleted).toBe(false);
  });
  it('getById throws not found for missing/deleted tax', async () => {
    prisma.itemTaxMaster.findFirst.mockResolvedValue(null);
    await expect(service.getById(TAX_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('softDelete marks tax as deleted', async () => {
    prisma.itemTaxMaster.findFirst.mockResolvedValue(makeRecord());
    prisma.itemTaxMaster.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.softDelete(TAX_ID);
    expect(prisma.itemTaxMaster.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArgs = prisma.itemTaxMaster.updateMany.mock.calls[0][0];
    expect(updateManyArgs.where).toEqual({
      taxId: TAX_ID,
      taxIsDeleted: false,
    });
    expect(updateManyArgs.data).toEqual(
      expect.objectContaining({
        taxIsDeleted: true,
      }),
    );
    expect(updateManyArgs.data?.taxModifiedOn).toBeInstanceOf(Date);
    expect(result).toEqual({
      tax_id: TAX_ID,
      deleted: true,
    });
  });
  it('softDelete throws not found when tax does not exist', async () => {
    prisma.itemTaxMaster.findFirst.mockResolvedValue(null);
    await expect(service.softDelete(TAX_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
