import { istTodayYmd, oldPendingDeliveries } from './bill-delivery-read';

/**
 * Delivery review N5 (2026-11-16): the BILL_OLD_PENDING_DELIVERY source fires
 * for bills pending MORE than `oldDays` days ("over 30", Q8 and grid 212's
 * OLD band), counted from the IST calendar day — not the DB session's
 * CURRENT_DATE.
 */
describe('oldPendingDeliveries (review N5)', () => {
  const run = async () => {
    const c = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await oldPendingDeliveries(c as never, { companyId: 'co', branchId: 'br', custId: 'cu', oldDays: 30, limit: 1 });
    const [strings, ...values] = c.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    return { sql: strings.join('?'), values };
  };

  it('is strictly over the old days: bill date < today − old days (a 30-day-old bill does not fire)', async () => {
    const { sql } = await run();
    expect(sql).toMatch(/sb_bill_date < \?::date - \?::int/);
    expect(sql).not.toMatch(/sb_bill_date <=/);
  });

  it('binds today as the IST date, in the filter and in the days it reports, never CURRENT_DATE', async () => {
    const { sql, values } = await run();
    expect(sql).not.toContain('CURRENT_DATE');
    expect(values.filter((v) => v === istTodayYmd())).toHaveLength(2);
    expect(values).toContain(30);
  });

  it('istTodayYmd reads the IST day (19:00 UTC is already tomorrow in India)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-14T19:00:00Z'));
    try {
      expect(istTodayYmd()).toBe('2026-11-15');
    } finally {
      jest.useRealTimers();
    }
  });
});
