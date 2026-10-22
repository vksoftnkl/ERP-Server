import { ItemGstUnits } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { ItemsGstUnitsMasterService } from './items-gst-units-master.service';

const CREATED_ON = new Date('2026-06-13T10:00:00.000Z');
const MODIFIED_ON = new Date('2026-06-14T11:30:00.000Z');

const unitRow = (overrides: Partial<ItemGstUnits> = {}): ItemGstUnits => ({
  itemGstUnitId: 1,
  itemGstUnitCode: 'NOS',
  itemGstUnitName: 'Numbers',
  itemGstUnitCreatedOn: CREATED_ON,
  itemGstUnitCreatedBy: null,
  itemGstUnitModifiedOn: MODIFIED_ON,
  itemGstUnitModifiedBy: null,
  itemGstUnitSyncDate: null,
  ...overrides,
});

describe('ItemsGstUnitsMasterService', () => {
  let prisma: { itemGstUnits: { findMany: jest.Mock } };
  let service: ItemsGstUnitsMasterService;

  beforeEach(() => {
    prisma = { itemGstUnits: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new ItemsGstUnitsMasterService(prisma as unknown as PrismaService);
  });

  it('lists every unit by name, then id, when no search is sent', async () => {
    await service.list({});

    expect(prisma.itemGstUnits.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ itemGstUnitName: 'asc' }, { itemGstUnitId: 'asc' }],
    });
  });

  it('searches code and name case-insensitively on the trimmed term', async () => {
    await service.list({ search: '  num  ' });

    expect(prisma.itemGstUnits.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { itemGstUnitCode: { contains: 'num', mode: 'insensitive' } },
            { itemGstUnitName: { contains: 'num', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('ignores a blank search', async () => {
    await service.list({ search: '   ' });

    expect(prisma.itemGstUnits.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('maps each row to the snake_case payload with ISO dates', async () => {
    const syncDate = new Date('2026-06-15T00:00:00.000Z');
    prisma.itemGstUnits.findMany.mockResolvedValue([
      unitRow(),
      unitRow({
        itemGstUnitId: 2,
        itemGstUnitCode: 'KGS',
        itemGstUnitName: 'Kilograms',
        itemGstUnitCreatedBy: 'seed',
        itemGstUnitModifiedBy: 'admin',
        itemGstUnitSyncDate: syncDate,
      }),
    ]);

    await expect(service.list({})).resolves.toEqual([
      {
        item_gst_unit_id: 1,
        item_gst_unit_code: 'NOS',
        item_gst_unit_name: 'Numbers',
        item_gst_unit_created_on: '2026-06-13T10:00:00.000Z',
        item_gst_unit_created_by: null,
        item_gst_unit_modified_on: '2026-06-14T11:30:00.000Z',
        item_gst_unit_modified_by: null,
        item_gst_unit_sync_date: null,
      },
      {
        item_gst_unit_id: 2,
        item_gst_unit_code: 'KGS',
        item_gst_unit_name: 'Kilograms',
        item_gst_unit_created_on: '2026-06-13T10:00:00.000Z',
        item_gst_unit_created_by: 'seed',
        item_gst_unit_modified_on: '2026-06-14T11:30:00.000Z',
        item_gst_unit_modified_by: 'admin',
        item_gst_unit_sync_date: '2026-06-15T00:00:00.000Z',
      },
    ]);
  });

  it('keeps a unit with no code or name', async () => {
    prisma.itemGstUnits.findMany.mockResolvedValue([
      unitRow({ itemGstUnitCode: null, itemGstUnitName: null }),
    ]);

    await expect(service.list({})).resolves.toEqual([
      expect.objectContaining({ item_gst_unit_code: null, item_gst_unit_name: null }),
    ]);
  });

  it('answers an empty list when no unit matches', async () => {
    await expect(service.list({ search: 'zzz' })).resolves.toEqual([]);
  });
});
