import { mergeStatus, statusChanged, wacStateOf, type RelayStatus, type StatusRowState } from './wa-status';

const sending: StatusRowState = {
  status: 'SENT',
  sentOn: new Date('2026-11-17T10:00:00Z'),
  deliveredOn: null,
  readOn: null,
  failedOn: null,
  errorCode: null,
  metaErrorCode: null,
  errorText: null,
};
const at = (s: number) => new Date(Date.UTC(2026, 10, 17, 10, 0, s));
const apply = (events: [RelayStatus, number, number?][]) =>
  events.reduce((row, [status, s, code]) => mergeStatus(row, { status, at: at(s), metaErrorCode: code ?? null, metaErrorTitle: code ? 'Message undeliverable' : null }), sending);

const permutations = <T,>(xs: T[]): T[][] =>
  xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));

describe('status ranking (§5.2: idempotent, any order)', () => {
  it('READ before DELIVERED (and repeats) ends READ with both times, whatever the order', () => {
    const events: [RelayStatus, number][] = [
      ['DELIVERED', 10],
      ['READ', 20],
      ['SENT', 1],
      ['READ', 20],
    ];
    for (const order of permutations(events)) {
      const row = apply(order);
      expect(row.status).toBe('READ');
      expect(row.deliveredOn).toEqual(at(10));
      expect(row.readOn).toEqual(at(20));
    }
  });
  it('FAILED replaces only SENDING / SENT and records the Meta code', () => {
    const failed = apply([['FAILED', 5, 131026]]);
    expect(failed).toMatchObject({ status: 'FAILED', errorCode: 'WA_META_131026', metaErrorCode: 131026 });
    expect(apply([['READ', 9], ['FAILED', 5, 131026]]).status).toBe('READ');
    expect(apply([['FAILED', 5, 131026], ['SENT', 1]]).status).toBe('FAILED');
    expect(apply([['FAILED', 5, 999999]]).errorCode).toBe('WA_META_OTHER');
  });
  it('a repeat changes nothing; SKIPPED never moves', () => {
    const once = apply([['DELIVERED', 10]]);
    expect(statusChanged(once, mergeStatus(once, { status: 'DELIVERED', at: at(30) }))).toBe(false);
    const skipped = { ...sending, status: 'SKIPPED' as const };
    expect(mergeStatus(skipped, { status: 'READ', at: at(1) })).toBe(skipped);
  });
});

describe('review S3 / N4: the error fields follow the status that wins', () => {
  const failedByErp: StatusRowState = {
    status: 'FAILED',
    sentOn: null,
    deliveredOn: null,
    readOn: null,
    failedOn: at(1),
    errorCode: 'WA_RELAY_UNREACHABLE',
    metaErrorCode: null,
    errorText: 'The WhatsApp service could not be reached: no answer in 60 s',
  };
  it('a DELIVERED / READ that wins over an ERP-side FAILED clears the code and the text', () => {
    for (const s of ['DELIVERED', 'READ'] as const) {
      const row = mergeStatus(failedByErp, { status: s, at: at(9) });
      expect(row).toMatchObject({ status: s, errorCode: null, metaErrorCode: null, errorText: null });
      expect(statusChanged(failedByErp, row)).toBe(true);
    }
  });
  it('FAILED (Meta 131026) and READ in either order end in the same row', () => {
    const events: [RelayStatus, number, number?][] = [
      ['FAILED', 5, 131026],
      ['READ', 9],
      ['DELIVERED', 7],
    ];
    const outcomes = permutations(events).map((order) => {
      const r = apply(order);
      return [r.status, r.errorCode, r.metaErrorCode, r.errorText, r.failedOn?.getTime(), r.readOn?.getTime()];
    });
    expect(new Set(outcomes.map((o) => JSON.stringify(o))).size).toBe(1);
    expect(outcomes[0].slice(0, 4)).toEqual(['READ', null, null, null]);
  });
  it('a FAILED that wins still sets the Meta code and title', () => {
    expect(apply([['FAILED', 5, 131026]])).toMatchObject({ errorCode: 'WA_META_131026', metaErrorCode: 131026, errorText: 'Message undeliverable' });
  });
});

describe('wacStateOf (relay shop state → ck_wac_state)', () => {
  it('maps NEW / ACTIVE / CLOSED onto the ERP words', () => {
    expect(wacStateOf('NEW')).toBe('ACTIVATED');
    expect(wacStateOf('ACTIVE')).toBe('ACTIVATED');
    expect(wacStateOf('CONNECTING')).toBe('CONNECTING');
    expect(wacStateOf('CONNECTED')).toBe('CONNECTED');
    expect(wacStateOf('DISCONNECTED')).toBe('DISCONNECTED');
    expect(wacStateOf('SUSPENDED')).toBe('SUSPENDED');
    expect(wacStateOf('CLOSED')).toBe('SUSPENDED');
  });
});
