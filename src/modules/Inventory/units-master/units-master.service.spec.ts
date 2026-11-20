import { Prisma, Unit } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { NEW_UNIT_DECIMAL_COUNT } from './dto/save-unit.dto';
import { UnitsMasterService } from './units-master.service';

/** Inventory masters review (user, 2026-11-20), point 38.3: a new unit's decimals. */

const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';

const makeUnit = (overrides: Partial<Unit> = {}): Unit =>
  ({
    unit_id: UNIT_ID,
    unit_name: 'ZT Tin',
    unit_alias: null,
    unit_code: null,
    unit_description: null,
    unit_decimal_count: 0,
    unit_weight: null,
    unit_loading: null,
    unit_unloading: null,
    unit_attach_charge: null,
    unit_is_pack_unit: false,
    unit_base_unit_id: null,
    unit_conversion: null,
    unit_is_active: true,
    unit_is_deleted: false,
    unit_sync_date: null,
    unit_created_on: new Date('2026-11-20T05:00:00.000Z'),
    unit_created_by: 'tester',
    unit_modified_on: new Date('2026-11-20T05:00:00.000Z'),
    unit_modified_by: 'tester',
    ...overrides,
  }) as Unit;

describe('UnitsMasterService — decimals of a new unit (inventory review 11-20)', () => {
  let prisma: {
    unit: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let service: UnitsMasterService;

  beforeEach(() => {
    prisma = {
      unit: {
        create: jest.fn(({ data }: { data: Partial<Unit> }) => Promise.resolve(makeUnit(data))),
        findFirst: jest.fn().mockResolvedValue(makeUnit({ unit_decimal_count: 2 })),
        update: jest.fn(({ data }: { data: Partial<Unit> }) =>
          Promise.resolve(makeUnit({ unit_decimal_count: 2, ...data })),
        ),
      },
      // The name lock, then no clash.
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((fn: (tx: Prisma.TransactionClient) => unknown) =>
        fn(prisma as unknown as Prisma.TransactionClient),
      ),
    };
    service = new UnitsMasterService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService,
      { getUserId: jest.fn().mockReturnValue(null) } as never,
    );
  });

  const createdDecimals = () =>
    (prisma.unit.create.mock.calls[0] as [{ data: Partial<Unit> }])[0].data.unit_decimal_count;

  it('a new unit given no decimals takes 3', async () => {
    expect(NEW_UNIT_DECIMAL_COUNT).toBe(3);
    const saved = await service.save({ unit_name: 'ZT Tin' });
    expect(createdDecimals()).toBe(3);
    expect(saved.unit_decimal_count).toBe(3);
  });

  it('a blank (null) count on a create also takes 3', async () => {
    await service.save({ unit_name: 'ZT Tin', unit_decimal_count: null as unknown as number });
    expect(createdDecimals()).toBe(3);
  });

  it('a count given on a create is kept, 0 included', async () => {
    await service.save({ unit_name: 'ZT Tin', unit_decimal_count: 0 });
    expect(createdDecimals()).toBe(0);
  });

  it('an edit never changes a stored count it was not given', async () => {
    await service.save({ unit_id: UNIT_ID, unit_name: 'ZT Tin' });
    await service.save({
      unit_id: UNIT_ID,
      unit_name: 'ZT Tin',
      unit_decimal_count: null as unknown as number,
    });
    for (const [{ data }] of prisma.unit.update.mock.calls as [{ data: Partial<Unit> }][]) {
      expect(data).not.toHaveProperty('unit_decimal_count');
    }
  });
});
