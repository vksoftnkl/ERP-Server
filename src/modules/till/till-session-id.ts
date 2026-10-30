/**
 * till-session-id.ts — the one helper the sales module calls to decide whether the session id a
 * client sent is a till session at all (notes 122 §3). Flow: a bill / sale order save →
 * tillSessionIdOrNull(id) → the id when till_session has it, null when not, undefined left as it
 * is so an update does not touch the column.
 */
import type { Prisma } from '@prisma/client';

/**
 * Notes 122 §3 — the session id a sales document keeps: the id when it names a
 * till session, else null. A client with no till open sends something else
 * there (the React web client its LOGIN session id, the old Qt client a random
 * uuid per run); stored, it read as a till session to every reader. Left out
 * (undefined) stays left out, so an update does not touch the column.
 *
 * DI-free so the sales services can call it without importing the till module.
 */
export async function tillSessionIdOrNull(
  client: Pick<Prisma.TransactionClient, 'tillSession'>,
  sessionId: string | null | undefined,
): Promise<string | null | undefined> {
  if (sessionId === undefined || sessionId === null) {
    return sessionId;
  }
  const session = await client.tillSession.findFirst({
    where: { tssId: sessionId, tssIsDeleted: false },
    select: { tssId: true },
  });
  return session ? sessionId : null;
}
