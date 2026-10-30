import { timeText } from './till-print.service';

describe('till print times (notes 121 §1)', () => {
  it('reads 12-hour on the shop’s clock (IST), zero-padded, with AM / PM', () => {
    expect(timeText('2026-10-15T18:35:00.000Z')).toBe('16-10-2026 12:05 AM'); // just after midnight IST
    expect(timeText('2026-10-15T06:35:00.000Z')).toBe('15-10-2026 12:05 PM'); // just after noon
    expect(timeText('2026-10-15T03:45:00.000Z')).toBe('15-10-2026 09:15 AM');
    expect(timeText('2026-10-15T13:00:00.000Z')).toBe('15-10-2026 06:30 PM');
    expect(timeText(null)).toBeNull();
  });
});
