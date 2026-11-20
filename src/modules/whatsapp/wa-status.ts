import { waMetaCode, type WaStatus } from './wa.constants';

/** A relay STATUS event's status (wa-relay-keys §1, GET /v1/events). */
export type RelayStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

/**
 * Plan §5.2 "Events applied by the poller" — statuses arrive in ANY order and
 * each at most once per (install, wamid, status), but a pull may repeat after a
 * crash before the cursor was stored, so applying is idempotent too.
 *
 * The rule is a rank, so the outcome is the same whatever the order:
 *   SENDING 0 < SENT 1 < FAILED 2 < DELIVERED 3 < READ 4.
 * - DELIVERED / READ outrank SENT (READ before DELIVERED leaves READ);
 * - FAILED replaces only SENDING / SENT (the plan's rule): a FAILED after READ is
 *   ignored, a READ after FAILED wins (Meta could not have read an undelivered
 *   message, so the FAILED was not the last word);
 * - SKIPPED never changes (no message went).
 * Each status's own time is set once (the first one seen, COALESCE).
 *
 * Review S3 / N4 — the error fields follow the status that wins: a FAILED that
 * wins sets them, a DELIVERED / READ that wins clears them (an ERP-side
 * "No internet" on a message that did go, or a FAILED that READ overtook), so
 * FAILED-then-READ and READ-then-FAILED end in the same row.
 */
const RANK: Record<string, number> = { SENDING: 0, SENT: 1, FAILED: 2, DELIVERED: 3, READ: 4 };

export interface StatusRowState {
  status: WaStatus;
  sentOn: Date | null;
  deliveredOn: Date | null;
  readOn: Date | null;
  failedOn: Date | null;
  errorCode: string | null;
  metaErrorCode: number | null;
  errorText: string | null;
}

export interface StatusEvent {
  status: RelayStatus;
  at: Date;
  metaErrorCode?: number | null;
  metaErrorTitle?: string | null;
}

export function mergeStatus(row: StatusRowState, ev: StatusEvent): StatusRowState {
  if (row.status === 'SKIPPED') {
    return row;
  }
  const next: StatusRowState = { ...row };
  switch (ev.status) {
    case 'SENT':
      next.sentOn = row.sentOn ?? ev.at;
      break;
    case 'DELIVERED':
      next.deliveredOn = row.deliveredOn ?? ev.at;
      break;
    case 'READ':
      next.readOn = row.readOn ?? ev.at;
      break;
    case 'FAILED':
      next.failedOn = row.failedOn ?? ev.at;
      break;
  }
  if ((RANK[ev.status] ?? -1) > (RANK[row.status] ?? -1)) {
    next.status = ev.status;
    if (ev.status === 'FAILED') {
      next.errorCode = waMetaCode(ev.metaErrorCode ?? null);
      next.metaErrorCode = ev.metaErrorCode ?? null;
      next.errorText = (ev.metaErrorTitle ?? null)?.slice(0, 300) ?? null;
    } else if (ev.status === 'DELIVERED' || ev.status === 'READ') {
      next.errorCode = null;
      next.metaErrorCode = null;
      next.errorText = null;
    }
  }
  return next;
}

/** True when merging changed anything worth writing. */
export function statusChanged(a: StatusRowState, b: StatusRowState): boolean {
  const t = (d: Date | null) => (d ? d.getTime() : null);
  return (
    a.status !== b.status ||
    t(a.sentOn) !== t(b.sentOn) ||
    t(a.deliveredOn) !== t(b.deliveredOn) ||
    t(a.readOn) !== t(b.readOn) ||
    t(a.failedOn) !== t(b.failedOn) ||
    a.errorCode !== b.errorCode ||
    a.metaErrorCode !== b.metaErrorCode ||
    a.errorText !== b.errorText
  );
}

/** ERP wac_state from the relay's shop state (P1 "P3 must know"). */
export function wacStateOf(relayState: string | null | undefined): 'ACTIVATED' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'SUSPENDED' {
  switch ((relayState ?? '').toUpperCase()) {
    case 'CONNECTING':
      return 'CONNECTING';
    case 'CONNECTED':
      return 'CONNECTED';
    case 'DISCONNECTED':
      return 'DISCONNECTED';
    case 'SUSPENDED':
    case 'CLOSED':
      return 'SUSPENDED';
    case 'NEW':
    case 'ACTIVE':
    default:
      return 'ACTIVATED';
  }
}
