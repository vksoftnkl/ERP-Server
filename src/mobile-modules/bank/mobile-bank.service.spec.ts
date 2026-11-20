import { ForbiddenException } from '@nestjs/common';
import { MobileBankService } from './mobile-bank.service';

const DEVICE = { devId: 'd1', devCode: 'PH1', devCompanyId: null, devBranchId: null };
const BANKS = [
  { bankId: '019a0000-0000-7000-8000-000000000001', name: 'Indian Bank', shortName: null },
  { bankId: '019a0000-0000-7000-8000-000000000002', name: 'Karur Vysya Bank', shortName: 'KVB' },
];

function make(device: object | null) {
  const sqls: string[] = [];
  const prisma = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      sqls.push(sql);
      if (sql.includes('FROM fixed.device_master')) return device ? [device] : [];
      if (sql.includes('FROM fixed.bank_master')) return BANKS;
      throw new Error(`unscripted read: ${sql}`);
    }),
  };
  return { service: new MobileBankService(prisma as never), sqls };
}

describe('MobileBankService.list', () => {
  it('a registered phone gets the active, live banks by name, with the total', async () => {
    const { service, sqls } = make({
      ...DEVICE,
      devIsActive: true,
      devIsBlocked: false,
      devBlockReason: null,
    });
    await expect(service.list({ deviceUid: 'phone-1' })).resolves.toEqual({
      items: BANKS,
      total: 2,
    });
    const banks = sqls.find((q) => q.includes('FROM fixed.bank_master'))!;
    expect(banks).toContain('b.bnk_is_active = true');
    expect(banks).toContain('b.bnk_is_deleted = false');
    expect(banks).toContain('ORDER BY lower(btrim(b.bnk_name))');
  });

  it.each([
    ['not registered', null, 'MOBILE_DEVICE_NOT_REGISTERED'],
    [
      'blocked',
      { ...DEVICE, devIsActive: true, devIsBlocked: true, devBlockReason: 'lost' },
      'MOBILE_DEVICE_BLOCKED',
    ],
    [
      'switched off',
      { ...DEVICE, devIsActive: false, devIsBlocked: false, devBlockReason: null },
      'MOBILE_DEVICE_INACTIVE',
    ],
  ])('a phone %s is refused (403) before any bank is read', async (_what, device, code) => {
    const { service, sqls } = make(device);
    const error = await service.list({ deviceUid: 'phone-1' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(JSON.stringify((error as ForbiddenException).getResponse())).toContain(code);
    expect(sqls.some((q) => q.includes('FROM fixed.bank_master'))).toBe(false);
  });
});
