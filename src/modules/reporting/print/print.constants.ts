/**
 * Queue identity for the reporting module.
 *
 * Kept separate from common/queue/queue.constants.ts on purpose: that file is
 * the platform's shared queue registry, and a feature module adding its own
 * name there couples the two. The BullMQ queue name is a string either way.
 */
export const REPORT_QUEUE_NAMES = {
  BULK_PRINT: 'report-bulk-print',
} as const;

export type ReportQueueName = (typeof REPORT_QUEUE_NAMES)[keyof typeof REPORT_QUEUE_NAMES];

/**
 * Worker concurrency.
 *
 * Two. PDFKit is CPU-bound and synchronous, so each concurrent render occupies
 * a core outright; on a 4 GB / 2 vCPU VPS a third concurrent render buys
 * nothing and costs the API its responsiveness. Raise it only alongside the
 * hardware, and only after measuring.
 */
export const BULK_PRINT_CONCURRENCY = Number(process.env.REPORT_BULK_CONCURRENCY) || 2;

/** Documents per bulk job. Beyond this the caller should split the batch. */
export const MAX_BULK_DOCUMENTS = 500;
