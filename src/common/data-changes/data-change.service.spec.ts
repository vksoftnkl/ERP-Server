import type { MessageEvent } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { DataChangeService } from './data-change.service';

const SID_A = 'sid-a';
const SID_B = 'sid-b';

describe('DataChangeService', () => {
  let service: DataChangeService;
  let received: MessageEvent[];
  let subscription: Subscription | undefined;

  const listen = (sessionId: string | null) => {
    subscription = service.streamFor(sessionId).subscribe((event) => received.push(event));
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-23T10:00:00.000Z') });
    service = new DataChangeService();
    received = [];
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
    jest.useRealTimers();
  });

  it('opens every stream with one `ready` carrying the boot id', () => {
    listen(SID_A);

    expect(received).toEqual([
      { type: 'ready', data: { bootId: expect.any(String), at: Date.now() } },
    ]);
  });

  it('hands every stream of one boot the same boot id, and a new boot a new one', () => {
    listen(SID_A);
    listen(SID_B);
    const [first, second] = received as { data: { bootId: string } }[];

    received = [];
    service = new DataChangeService();
    listen(SID_A);
    const restarted = received[0] as { data: { bootId: string } };

    expect(second.data.bootId).toBe(first.data.bootId);
    expect(restarted.data.bootId).not.toBe(first.data.bootId);
  });

  it("relays another session's write as `change`, without the writer's session", () => {
    listen(SID_A);
    service.publish({ resource: 'customers', method: 'POST', at: 123, originSessionId: SID_B });

    expect(received[1]).toEqual({
      type: 'change',
      data: { resource: 'customers', method: 'POST', at: 123 },
    });
  });

  it("drops the session's own writes — its tabs refreshed themselves", () => {
    listen(SID_A);
    service.publish({ resource: 'customers', method: 'POST', at: 1, originSessionId: SID_A });

    expect(received.map((e) => e.type)).toEqual(['ready']);
  });

  it('hears every write when the client has no session id', () => {
    listen(null);
    service.publish({ resource: 'items', method: 'PUT', at: 1, originSessionId: SID_A });
    service.publish({ resource: 'items', method: 'PUT', at: 2, originSessionId: null });

    expect(received.map((e) => e.type)).toEqual(['ready', 'change', 'change']);
  });

  it('does not replay a write published before the client connected', () => {
    service.publish({ resource: 'items', method: 'PUT', at: 1, originSessionId: SID_B });
    listen(SID_A);

    expect(received.map((e) => e.type)).toEqual(['ready']);
  });

  it('pings every 25 s so a proxy does not drop a quiet stream', () => {
    listen(SID_A);

    jest.advanceTimersByTime(24_999);
    expect(received.map((e) => e.type)).toEqual(['ready']);

    jest.advanceTimersByTime(1);
    jest.advanceTimersByTime(25_000);
    expect(received.map((e) => e.type)).toEqual(['ready', 'ping', 'ping']);
    expect(received[1]).toEqual({ type: 'ping', data: { at: expect.any(Number) } });
  });
});
