export declare const REPORT_QUEUE_NAMES: {
    readonly BULK_PRINT: "report-bulk-print";
};
export type ReportQueueName = (typeof REPORT_QUEUE_NAMES)[keyof typeof REPORT_QUEUE_NAMES];
export declare const BULK_PRINT_CONCURRENCY: number;
export declare const MAX_BULK_DOCUMENTS = 500;
