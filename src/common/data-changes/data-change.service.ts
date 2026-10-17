import { randomUUID } from 'node:crypto';
import { Injectable, type MessageEvent } from '@nestjs/common';
import { Observable, Subject, defer, filter, interval, map, merge, of } from 'rxjs';

/**
 * One successful write, as the clients hear about it. Deliberately carries no
 * data: a client only learns that something changed and re-reads what it has
 * on screen through the normal (authorised, company-scoped) routes.
 */
export type DataChangeEvent = {
  /** First path segment after `/api/v<n>/`, e.g. `customers`, `sale-bills`. */
  resource: string;
  method: string;
  at: number;
  /** The writer's auth session (`sid`). Its own tabs already refreshed themselves. */
  originSessionId: string | null;
};

/**
 * Proxies (nginx's `proxy_read_timeout` defaults to 60 s, load balancers often
 * less) drop a stream that stays silent; a ping well inside that keeps it open.
 */
const HEARTBEAT_MS = 25_000;

/**
 * In-process change feed behind `GET /data-changes/stream`.
 *
 * The API runs as a single process (ecosystem.config.js: `instances: 1`), so a
 * Subject is the whole fan-out. Running more than one instance would need a
 * Redis pub/sub hop in `publish`, or a client would only hear the writes that
 * landed on its own instance.
 */
@Injectable()
export class DataChangeService {
  private readonly changes = new Subject<DataChangeEvent>();
  /**
   * Sent in `ready`. A client that reconnects to the SAME boot may have missed
   * writes while it was cut off and re-reads once; a new boot means the server
   * restarted, and no write lands while it is down.
   */
  private readonly bootId = randomUUID();

  publish(event: DataChangeEvent): void {
    this.changes.next(event);
  }

  /** The event stream for one connected client, minus its own session's writes. */
  streamFor(sessionId: string | null): Observable<MessageEvent> {
    const ready = defer(() =>
      of<MessageEvent>({ type: 'ready', data: { bootId: this.bootId, at: Date.now() } }),
    );
    const changes = this.changes.pipe(
      filter((event) => !sessionId || event.originSessionId !== sessionId),
      map(
        (event): MessageEvent => ({
          type: 'change',
          data: { resource: event.resource, method: event.method, at: event.at },
        }),
      ),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: { at: Date.now() } })),
    );
    return merge(ready, changes, heartbeat);
  }
}
