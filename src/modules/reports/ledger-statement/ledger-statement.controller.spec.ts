import { LedgerStatementController } from './ledger-statement.controller';
import { LedgerStatementService } from './ledger-statement.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b102';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46b105';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46b111';

const scope = { companyId: COMPANY_ID, accYear: '2026-2027', ledgerId: LEDGER_ID };
const range = { ...scope, fromDate: '2026-08-01', toDate: '2026-09-25' };

describe('LedgerStatementController', () => {
  let service: Record<
    'ledgers' | 'header' | 'vouchers' | 'voucherLegs' | 'daily' | 'monthly' | 'export',
    jest.Mock
  >;
  let controller: LedgerStatementController;

  beforeEach(() => {
    service = {
      ledgers: jest.fn().mockResolvedValue({ items: [{}, {}] }),
      header: jest.fn().mockResolvedValue({ ledger: {}, period: {} }),
      vouchers: jest.fn().mockResolvedValue({ rows: [], page: { totalRows: 41 } }),
      voucherLegs: jest.fn().mockResolvedValue({ legs: [{}, {}, {}] }),
      daily: jest.fn().mockResolvedValue({ days: [{}] }),
      monthly: jest.fn().mockResolvedValue({ months: new Array(12).fill({}) }),
      export: jest.fn().mockResolvedValue({ rows: [], totalRows: 7 }),
    };
    controller = new LedgerStatementController(service as unknown as LedgerStatementService);
  });

  it.each([
    ['ledgers', () => controller.ledgers({ companyId: COMPANY_ID }), '2 ledger(s)'],
    ['header', () => controller.header(range), 'Ledger statement header'],
    ['vouchers', () => controller.vouchers(range), '41 voucher(s)'],
    [
      'voucherLegs',
      () =>
        controller.voucherLegs({
          companyId: COMPANY_ID,
          accYear: '2026-2027',
          voucherId: VOUCHER_ID,
          ledgerId: LEDGER_ID,
        }),
      '3 leg(s)',
    ],
    ['daily', () => controller.daily(range), '1 day(s)'],
    ['monthly', () => controller.monthly(scope), '12 month(s)'],
    ['export', () => controller.export(range), '7 voucher(s)'],
  ] as const)('wraps %s and says how much came back', async (method, call, message) => {
    const result = await call();

    expect(result).toEqual({
      success: true,
      message,
      data: await service[method].mock.results[0].value,
    });
    expect(service[method]).toHaveBeenCalledTimes(1);
  });

  it('hands the query to the service unchanged', async () => {
    await controller.daily(range);

    expect(service.daily).toHaveBeenCalledWith(range);
  });
});
