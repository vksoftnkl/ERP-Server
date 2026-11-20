import { WaEventsService } from './wa-events.service';

const conn = { wacCompanyId: 'co' } as never;

describe('events applied by the poller', () => {
  it('typed STOP: every ledger of the company with that number (any of the three) stops all WhatsApp, audited', async () => {
    const queries: string[] = [];
    const tx = {
      $queryRaw: jest.fn(async (strings: string[]) => {
        queries.push(strings.join('?'));
        return [
          { led_id: 'L1', led_name: 'A', led_whatsapp_no: '98653 22154', led_phone1: null, led_phone2: null, led_wa_all_off_on: null },
          { led_id: 'L2', led_name: 'B', led_whatsapp_no: null, led_phone1: '04222322154', led_phone2: '+91 9865322154', led_wa_all_off_on: new Date() },
          // last 10 digits match but the number is a landline after normalising: not the same number
          { led_id: 'L3', led_name: 'C', led_whatsapp_no: '0 9865322154 9', led_phone1: null, led_phone2: null, led_wa_all_off_on: null },
        ];
      }),
      $executeRaw: jest.fn(async (..._args: unknown[]) => 1),
    };
    const audit = { logEntityChange: jest.fn() };
    const events = new WaEventsService({} as never, {} as never, audit as never, {} as never);
    const changed = await events.apply(tx as never, conn, {
      id: 12, kind: 'STOP', clientRef: null, wamid: null, status: null, at: '2026-11-17T10:00:00Z',
      metaErrorCode: null, metaErrorTitle: null, reply: 'STOP_ALL', fromPhone: '919865322154', detail: null,
    });
    expect(changed).toBe(true);
    expect(queries[0]).toContain('right(regexp_replace');
    // L1 stopped and audited; L2 already stopped (no second write); both get STOP_ALL on their latest row; L3 untouched.
    expect(audit.logEntityChange).toHaveBeenCalledTimes(1);
    expect(audit.logEntityChange.mock.calls[0][0]).toMatchObject({ pk: 'L1', tableName: 'acc_ledger_master' });
    const writes = tx.$executeRaw.mock.calls.map((c) => (c[0] as unknown as string[]).join('?'));
    expect(writes.filter((s) => s.includes('led_wa_all_off_on'))).toHaveLength(1);
    expect(writes.filter((s) => s.includes("wml_reply = 'STOP_ALL'"))).toHaveLength(2);
  });

  it('a STATUS for a message of another company (or none) changes nothing', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]), $executeRaw: jest.fn() };
    const events = new WaEventsService({} as never, {} as never, {} as never, {} as never);
    await expect(
      events.apply(tx as never, conn, {
        id: 1, kind: 'STATUS', clientRef: '01a1e9ef-bb41-7016-a8b9-ac751d576673', wamid: 'w', status: 'READ', at: null,
        metaErrorCode: null, metaErrorTitle: null, reply: null, fromPhone: null, detail: null,
      }),
    ).resolves.toBe(false);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('a STATUS moves the row by rank only (READ, then a late DELIVERED keeps READ)', async () => {
    let row = { wml_id: 'w', wml_acc_year: '2026-2027', wml_status: 'SENT', wml_sent_on: new Date(), wml_delivered_on: null, wml_read_on: null, wml_failed_on: null, wml_error_code: null, wml_meta_error_code: null, wml_error_text: null, wml_party_id: null, wml_party_name: null } as Record<string, unknown>;
    const tx = {
      $queryRaw: jest.fn(async () => [row]),
      $executeRaw: jest.fn(async (_s: string[], status: string, _sent: Date, delivered: Date, read: Date) => {
        row = { ...row, wml_status: status, wml_delivered_on: delivered, wml_read_on: read };
        return 1;
      }),
    };
    const events = new WaEventsService({} as never, {} as never, {} as never, {} as never);
    const ev = (status: string, at: string) => ({ id: 1, kind: 'STATUS', clientRef: '01a1e9ef-bb41-7016-a8b9-ac751d576673', wamid: 'w', status, at, metaErrorCode: null, metaErrorTitle: null, reply: null, fromPhone: null, detail: null });
    await events.apply(tx as never, conn, ev('READ', '2026-11-17T10:00:20Z'));
    await events.apply(tx as never, conn, ev('DELIVERED', '2026-11-17T10:00:10Z'));
    await events.apply(tx as never, conn, ev('DELIVERED', '2026-11-17T10:00:10Z'));
    expect(row.wml_status).toBe('READ');
    expect(row.wml_delivered_on).toEqual(new Date('2026-11-17T10:00:10Z'));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('N5: a STOP that finds the ledger already stopped (the UPDATE changed no row) writes no audit row', async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [
        { led_id: 'L1', led_name: 'A', led_whatsapp_no: '9865322154', led_phone1: null, led_phone2: null, led_wa_all_off_on: null },
      ]),
      // the ledger was stopped by another pull between the read and the write
      $executeRaw: jest.fn(async (strings: string[]) => (strings.join('?').includes('led_wa_all_off_on') ? 0 : 1)),
    };
    const audit = { logEntityChange: jest.fn() };
    const events = new WaEventsService({} as never, {} as never, audit as never, {} as never);
    await events.apply(tx as never, conn, {
      id: 13, kind: 'STOP', clientRef: null, wamid: null, status: null, at: '2026-11-17T10:00:00Z',
      metaErrorCode: null, metaErrorTitle: null, reply: 'STOP_ALL', fromPhone: '919865322154', detail: null,
    });
    expect(audit.logEntityChange).not.toHaveBeenCalled();
  });

  it('S3: a row still SENDING (an unconfirmed send) that an event settles is handed back for its status step', async () => {
    const base = { wml_id: 'w1', wml_acc_year: '2026-2027', wml_sent_on: null, wml_delivered_on: null, wml_read_on: null, wml_failed_on: null, wml_error_code: null, wml_meta_error_code: null, wml_error_text: null, wml_party_id: null, wml_party_name: null };
    const ev = (status: string) => ({ id: 1, kind: 'STATUS', clientRef: '01a1e9ef-bb41-7016-a8b9-ac751d576673', wamid: 'w', status, at: '2026-11-17T10:00:10Z', metaErrorCode: status === 'FAILED' ? 131026 : null, metaErrorTitle: null, reply: null, fromPhone: null, detail: null });
    const events = new WaEventsService({} as never, {} as never, {} as never, {} as never);
    const settled: unknown[] = [];
    const sending = { $queryRaw: jest.fn(async () => [{ ...base, wml_status: 'SENDING' }]), $executeRaw: jest.fn(async () => 1) };
    await events.apply(sending as never, conn, ev('DELIVERED'), settled as never);
    expect(settled).toEqual([{ wmlId: 'w1', accYear: '2026-2027', result: 'SENT' }]);
    const failing = { $queryRaw: jest.fn(async () => [{ ...base, wml_status: 'SENDING' }]), $executeRaw: jest.fn(async () => 1) };
    await events.apply(failing as never, conn, ev('FAILED'), settled as never);
    expect(settled[1]).toEqual({ wmlId: 'w1', accYear: '2026-2027', result: 'FAILED' });
    // a SENT row going DELIVERED filed its step on the send path already
    const sent = { $queryRaw: jest.fn(async () => [{ ...base, wml_status: 'SENT' }]), $executeRaw: jest.fn(async () => 1) };
    await events.apply(sent as never, conn, ev('DELIVERED'), settled as never);
    expect(settled).toHaveLength(2);
  });
});
