import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { itemChildDisplayName } from './audit-item-history';

/**
 * Item master review 2026-11-20, Q12 step 1 (user: recommended): the Item History —
 * asked by screen_id 25, as the Qt History button does — brings the item's unit
 * conversion, price, barcode and reorder rows too, names them by unit, and leaves
 * out "update" rows that changed nothing.
 */

const ITEM_ID = '019d6f6c-be87-7a11-8905-36092c46fe01';
const IUC_BAG = '019d6f6c-be87-7a11-8905-36092c46fe02';
const IUC_PC = '019d6f6c-be87-7a11-8905-36092c46fe03';
const IPM_ID = '019d6f6c-be87-7a11-8905-36092c46fe04';
const EAN_ID = '019d6f6c-be87-7a11-8905-36092c46fe05';
const IR_ID = '019d6f6c-be87-7a11-8905-36092c46fe06';
const UNIT_BAG = '019d6f6c-be87-7a11-8905-36092c46fe07';
const BRANCH_ID = '019d6f6c-be87-7a11-8905-36092c46fe08';

type Mock = jest.Mock;
type PrismaMock = Record<string, Record<string, Mock>>;

describe('AuditLogService — the Item History (item master review 11-20, Q12 step 1)', () => {
  let prisma: PrismaMock;
  let service: AuditLogService;

  beforeEach(() => {
    const findMany = () => jest.fn().mockResolvedValue([]);
    prisma = {
      auditScreen: { findFirst: jest.fn().mockResolvedValue({ screenName: 'Item Master' }) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
      itemUnitConversion: {
        findMany: jest.fn((args: { select?: { iucId?: boolean; unit?: unknown } }) =>
          Promise.resolve(
            args.select?.unit
              ? [
                  { iucId: IUC_BAG, unit: { unit_name: 'Bag' } },
                  { iucId: IUC_PC, unit: { unit_name: 'PCS' } },
                ]
              : [{ iucId: IUC_BAG }, { iucId: IUC_PC }],
          ),
        ),
      },
      itemPriceMaster: { findMany: jest.fn().mockResolvedValue([{ ipmId: IPM_ID }]) },
      itemEanCode: { findMany: jest.fn().mockResolvedValue([{ eanId: EAN_ID }]) },
      itemReorder: { findMany: jest.fn().mockResolvedValue([{ irId: IR_ID }]) },
      itemMaster: { findMany: jest.fn().mockResolvedValue([{ itemId: ITEM_ID, itemNameEn: 'ZT Rice' }]) },
      unit: { findMany: jest.fn().mockResolvedValue([{ unit_id: UNIT_BAG, unit_name: 'Bag' }]) },
      userMaster: { findMany: findMany() },
      branchMaster: { findMany: jest.fn().mockResolvedValue([{ brId: BRANCH_ID, brName: 'Coimbatore' }]) },
      company: { findMany: findMany() },
      godownLocation: { findMany: findMany() },
    };
    const requestContext = {
      getIpAddress: jest.fn().mockReturnValue(null),
      getUserId: jest.fn().mockReturnValue(null),
      getDeviceId: jest.fn().mockReturnValue(null),
    };
    service = new AuditLogService(
      prisma as unknown as PrismaService,
      requestContext as unknown as RequestContextService,
    );
  });

  const whereOfFirstList = (): Record<string, unknown> =>
    (prisma.auditLog.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;

  it('asked by screen_id, it brings the four child screens; the id narrows only the item rows', async () => {
    await service.list({ screen_id: 25, record_pk: ITEM_ID, page: 1, limit: 20 });
    const where = whereOfFirstList();
    // At the top level screen 25 would drop every child row.
    expect(where.logScreenId).toBeUndefined();
    expect(where.AND).toEqual([
      {
        OR: [
          { logScreenId: 25, logPk: ITEM_ID },
          {
            auditScreen: { is: { screenName: 'Item Unit Conversion Master' } },
            logPk: { in: [IUC_BAG, IUC_PC] },
          },
          { auditScreen: { is: { screenName: 'Item Price Master' } }, logPk: { in: [IPM_ID] } },
          { auditScreen: { is: { screenName: 'Item EAN Code Master' } }, logPk: { in: [EAN_ID] } },
          { auditScreen: { is: { screenName: 'Item Reorder Master' } }, logPk: { in: [IR_ID] } },
        ],
      },
    ]);
  });

  it('a screen without child screens still filters by screen_id at the top level', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({ screenName: 'Item Brand Master' });
    await service.list({ screen_id: 3, record_pk: ITEM_ID, page: 1, limit: 20 });
    expect(whereOfFirstList()).toEqual({ logScreenId: 3, AND: [{ logPk: ITEM_ID }] });
  });

  const row = (
    logId: string,
    screenName: string,
    logAction: string,
    records: { original?: unknown; modified?: unknown; changed?: unknown },
    logDisplayName: string,
  ) => ({
    logId,
    logDate: new Date('2026-11-20T11:00:00.000Z'),
    logAction,
    logScreenId: 0,
    logTableName: screenName,
    logPk: ITEM_ID,
    logDisplayName,
    logOriginalRecord: records.original ?? null,
    logModifiedRecord: records.modified ?? null,
    logChangedFields: records.changed ?? null,
    logUserId: null,
    logBranchId: null,
    logNotes: null,
    logEntityId: null,
    logRevNo: null,
    logDeviceName: null,
    auditScreen: { screenName, screenType: 'master' },
  });

  it('names the child rows by unit and drops the update rows that changed nothing', async () => {
    const raw = `${ITEM_ID}:${UNIT_BAG}:${UNIT_BAG}`;
    prisma.auditLog.findMany.mockResolvedValue([
      // An empty header row (every card save wrote one), JSON null and {} alike.
      row('01', 'Item Master', 'update', { changed: null }, 'ZT Rice'),
      row('02', 'Item Master', 'update', { changed: {} }, 'ZT Rice'),
      // Only noise stamps moved: dropped on read too.
      row('03', 'Item Master', 'update', { changed: { 'Modified On': { from: 1, to: 2 } } }, 'ZT Rice'),
      row(
        '04',
        'Item Unit Conversion Master',
        'update',
        {
          modified: { 'Item ID': ITEM_ID, 'Unit ID': UNIT_BAG, 'Is Base Unit': true },
          changed: { 'Unit Factor': { from: 1, to: 10 } },
        },
        raw,
      ),
      row(
        '05',
        'Item Price Master',
        'insert',
        {
          original: {
            'Unit ID': IUC_PC,
            'Branch ID': BRANCH_ID,
            'Godown ID': null,
            'MRP Bucket': 150,
          },
        },
        `${ITEM_ID}:${IUC_PC}:${BRANCH_ID}:ALL_GODOWNS`,
      ),
      row('06', 'Item Master', 'update', { changed: { 'Item Name': { from: 'a', to: 'b' } } }, 'ZT Rice'),
    ]);

    const result = await service.list({ screen_id: 25, record_pk: ITEM_ID, page: 1, limit: 6 });

    expect(result.items.map((item) => [item.log_id, item.log_display_name])).toEqual([
      ['04', 'Unit Bag (base)'],
      ['05', 'Price PCS · Coimbatore · MRP 150'],
      ['06', 'ZT Rice'],
    ]);
    // Paging walks the stored rows: a full stored page (6) still hands on its cursor,
    // though only 3 of its rows are shown.
    expect(result.meta.next_cursor).toBe('06');
  });

  it('keeps every row of a plain (non-composite) history, empty ones included', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({ screenName: 'Item Brand Master' });
    prisma.auditLog.findMany.mockResolvedValue([
      row('01', 'Item Brand Master', 'update', { changed: null }, 'ZT Brand'),
    ]);
    const result = await service.list({ screen_id: 3, record_pk: ITEM_ID, page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
  });
});

describe('itemChildDisplayName', () => {
  it('reads each child screen the way the item card shows it', () => {
    expect(itemChildDisplayName('Item Unit Conversion Master', { 'Unit ID': 'PCS' })).toBe(
      'Unit PCS',
    );
    expect(
      itemChildDisplayName('Item Price Master', { 'Unit ID': 'Bag', 'Godown ID': 'Main' }),
    ).toBe('Price Bag · Main');
    expect(
      itemChildDisplayName('Item EAN Code Master', { 'EAN / Barcode': '8901234', 'Unit ID': 'PCS' }),
    ).toBe('Barcode 8901234 (PCS)');
    expect(itemChildDisplayName('Item Reorder Master', { 'Branch ID': 'Coimbatore' })).toBe(
      'Reorder any unit · Coimbatore',
    );
  });

  it('leaves every other screen to the stored name', () => {
    expect(itemChildDisplayName('Item Master', { 'Unit ID': 'PCS' })).toBeNull();
  });
});
