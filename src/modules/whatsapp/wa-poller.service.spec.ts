import { WaEventsService } from './wa-events.service';
import { WaPollerService, pollDue } from './wa-poller.service';

const NOW = Date.UTC(2026, 10, 17, 10, 0, 0);
const row = (over: Partial<Parameters<typeof pollDue>[0]> = {}) => ({
  wac_company_id: 'co',
  wac_state: 'CONNECTED',
  wac_last_poll_on: new Date(NOW - 61_000),
  wac_fast_poll_until: null,
  ...over,
});

describe('pollDue (decision 20)', () => {
  it('every 60 s while CONNECTED / CONNECTING; never otherwise', () => {
    expect(pollDue(row(), 0, NOW)).toBe(true);
    expect(pollDue(row({ wac_last_poll_on: new Date(NOW - 20_000) }), 0, NOW)).toBe(false);
    expect(pollDue(row({ wac_state: 'CONNECTING' }), 0, NOW)).toBe(true);
    expect(pollDue(row({ wac_state: 'ACTIVATED' }), 0, NOW)).toBe(false);
    expect(pollDue(row({ wac_state: 'SUSPENDED' }), 0, NOW)).toBe(false);
  });
  it('every 10 s inside the fast window after a send / Connect', () => {
    const fast = row({ wac_last_poll_on: new Date(NOW - 10_000), wac_fast_poll_until: new Date(NOW + 60_000) });
    expect(pollDue(fast, 0, NOW)).toBe(true);
    expect(pollDue({ ...fast, wac_last_poll_on: new Date(NOW - 4_000) }, 0, NOW)).toBe(false);
  });
  it('5 minutes after 3 failed pulls in a row', () => {
    expect(pollDue(row({ wac_last_poll_on: new Date(NOW - 120_000) }), 3, NOW)).toBe(false);
    expect(pollDue(row({ wac_last_poll_on: new Date(NOW - 301_000) }), 3, NOW)).toBe(true);
  });
});

describe('the lease (two API processes on one DB)', () => {
  it('a process that does not get the lease pulls nothing and calls the relay not at all', async () => {
    const store = {
      processName: '2@box',
      row: jest.fn().mockResolvedValue({ wacId: 'w', wacState: 'CONNECTED', wacEventCursor: BigInt(7), wacRelayUrl: 'x' }),
      prisma: { $queryRaw: jest.fn().mockResolvedValue([]) },
      keyOf: jest.fn(),
    };
    const relay = { events: jest.fn(), ack: jest.fn(), connection: jest.fn() };
    const events = new WaEventsService(store as never, relay as never, {} as never, {} as never);
    await expect(events.pullOnce('co')).resolves.toMatchObject({ pulled: false, error: 'lease held elsewhere', cursor: '7' });
    expect(relay.events).not.toHaveBeenCalled();
    expect(store.keyOf).not.toHaveBeenCalled();
  });
  it('N5: the lease UPDATE takes only a free or expired lease — not re-entrant, not even for this process', async () => {
    const store = { processName: '1@box', prisma: { $queryRaw: jest.fn().mockResolvedValue([{ wac_id: 'w' }]) } };
    const events = new WaEventsService(store as never, {} as never, {} as never, {} as never);
    await expect(events.takeLease('w')).resolves.toBe(true);
    const [strings, ...values] = store.prisma.$queryRaw.mock.calls[0];
    const sql = (strings as string[]).join('?');
    expect(sql).toContain('wac_poll_lease_until IS NULL OR wac_poll_lease_until < now()');
    expect(sql.slice(sql.indexOf('WHERE'))).not.toContain('wac_poll_lease_by');
    expect(values[0]).toBe(300);
  });
  it('N5: the lease outlives a worst-case pull (budget + one page + a connection read)', () => {
    const { WA_POLL, WA_RELAY_TIMEOUT_MS } = jest.requireActual('./wa.constants');
    expect(WA_POLL.LEASE_SECONDS * 1000).toBeGreaterThan(WA_POLL.PULL_BUDGET_MS + 3 * WA_RELAY_TIMEOUT_MS);
  });
  it('N5: a pull starts no new page once its budget is spent', async () => {
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
      const store = {
        processName: '1@box',
        row: jest.fn().mockResolvedValue({ wacId: 'w', wacState: 'CONNECTED', wacEventCursor: BigInt(0), wacRelayUrl: 'x', wacShopCode: 'S' }),
        prisma: {
          $queryRaw: jest.fn().mockResolvedValue([{ wac_id: 'w' }]),
          $executeRaw: jest.fn().mockResolvedValue(1),
          $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({ $executeRaw: jest.fn() })),
        },
        keyOf: jest.fn().mockReturnValue('k'),
      };
      let id = 0;
      const relay = {
        events: jest.fn(async () => {
          t += 70_000; // each page is slow
          id += 1;
          return { events: [{ id, kind: 'OTHER' }], more: true };
        }),
        ack: jest.fn(),
        connection: jest.fn(),
      };
      const events = new WaEventsService(store as never, relay as never, {} as never, { statusStepForRow: jest.fn() } as never);
      (events as unknown as { lastConnectionRead: Map<string, number> }).lastConnectionRead.set('co', t);
      await events.pullOnce('co');
      expect(relay.events).toHaveBeenCalledTimes(2); // 70 s, 140 s: the third page would start past 120 s
    } finally {
      Date.now = realNow;
    }
  });
});

describe('the SENDING sweeper (risk 6)', () => {
  it('fails rows SENDING for 10 minutes as WA_SEND_INTERRUPTED, leaving this process\'s live sends alone', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ wml_id: 'a' }]);
    const sends = { inFlight: new Set(['live-1']), statusStepForRow: jest.fn() };
    const poller = new WaPollerService({ prisma: { $queryRaw } } as never, {} as never, sends as never, {} as never, {} as never);
    await expect(poller.sweepSending()).resolves.toBe(1);
    const [strings, ...values] = $queryRaw.mock.calls[0];
    const sql = (strings as string[]).join('?');
    expect(sql).toContain("wml_status = 'SENDING'");
    expect(sql).toContain('NOT (wml_id = ANY(');
    expect(values).toEqual(expect.arrayContaining(['WA_SEND_INTERRUPTED', 10, ['live-1']]));
    expect(sends.statusStepForRow).not.toHaveBeenCalled(); // a row with no document (a test send)
  });
  it('N6: a swept document send files its WHATSAPP_FAILED step, as the send path does', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([
      { wml_id: 'a', wml_acc_year: '2026-2027', wml_src_doc_id: 'so-1' },
      { wml_id: 'b', wml_acc_year: '2026-2027', wml_src_doc_id: null },
    ]);
    const sends = { inFlight: new Set<string>(), statusStepForRow: jest.fn() };
    const poller = new WaPollerService({ prisma: { $queryRaw } } as never, {} as never, sends as never, {} as never, {} as never);
    await expect(poller.sweepSending()).resolves.toBe(2);
    expect(sends.statusStepForRow).toHaveBeenCalledTimes(1);
    expect(sends.statusStepForRow).toHaveBeenCalledWith('a', '2026-2027', 'FAILED');
  });
});

describe('retention (F21)', () => {
  it('purges per company after its own whatsapp.log_retention_years', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ id: 'co' }]);
    const $executeRaw = jest.fn().mockResolvedValue(4);
    const settings = { read: jest.fn().mockResolvedValue({ logRetentionYears: 2 }) };
    const poller = new WaPollerService({ prisma: { $queryRaw, $executeRaw } } as never, {} as never, {} as never, settings as never, {} as never);
    await expect(poller.purge()).resolves.toBe(4);
    const [strings, ...values] = $executeRaw.mock.calls[0];
    const sql = (strings as string[]).join('?');
    expect(sql).toContain('wml_phone = NULL, wml_params = NULL, wml_meta_message_id = NULL');
    expect(values).toEqual(['co', 2]);
  });
});
