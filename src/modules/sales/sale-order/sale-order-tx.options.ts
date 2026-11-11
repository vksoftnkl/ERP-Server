/**
 * The interactive-transaction options of every order-side write: the save,
 * the confirm, the amend, the cancel and the desk's hold / priority / close /
 * merge (review, 2026-11-11). Prisma's default (timeout 5 s) is too short once
 * an order re-reserves its lines (release, a FEFO read and an insert per lot,
 * the balance refresh) and has to wait on the per-item advisory locks a
 * concurrent bill or transfer holds. One constant for all of them.
 */
export const ORDER_TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;
