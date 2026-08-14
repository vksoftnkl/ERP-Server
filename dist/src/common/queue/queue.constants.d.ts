export declare const QUEUE_NAMES: {
    readonly AUDIT_LOG_ARCHIVAL: "audit-log-archival";
    readonly STOCK_RECONCILIATION: "stock-reconciliation";
};
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
