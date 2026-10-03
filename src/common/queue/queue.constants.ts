export const QUEUE_NAMES = {
  AUDIT_LOG_ARCHIVAL: 'audit-log-archival',
  STOCK_RECONCILIATION: 'stock-reconciliation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
