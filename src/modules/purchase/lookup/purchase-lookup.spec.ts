import { msmeDueDays } from './purchase-lookup';

// The MSME pay-within rule (analysis §5, R27): micro / small manufacturers and service
// providers only; 15 days without a written agreement, the agreed days up to 45 with one.
describe('msmeDueDays', () => {
  it('micro manufacturer, no agreement → 15', () => expect(msmeDueDays('Micro', 'MANUFACTURER', false, null)).toBe(15));
  it('small service provider with an agreement of 30 → 30', () => expect(msmeDueDays('SMALL', 'Service', true, 30)).toBe(30));
  it('an agreement above 45 is capped at 45', () => expect(msmeDueDays('Micro', 'Manufacturer', true, 60)).toBe(45));
  it('an agreement without days → 45', () => expect(msmeDueDays('Small', 'Manufacturer', true, null)).toBe(45));
  it('medium enterprises are outside the rule', () => expect(msmeDueDays('Medium', 'Manufacturer', false, null)).toBeNull());
  it('traders are outside the rule', () => expect(msmeDueDays('Micro', 'TRADER', false, null)).toBeNull());
  it('activity not recorded → no date', () => expect(msmeDueDays('Micro', null, false, null)).toBeNull());
  it('not MSME → no date', () => expect(msmeDueDays(null, 'Manufacturer', false, null)).toBeNull());
});
