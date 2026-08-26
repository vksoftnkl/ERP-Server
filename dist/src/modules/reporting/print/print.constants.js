"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BULK_DOCUMENTS = exports.BULK_PRINT_CONCURRENCY = exports.REPORT_QUEUE_NAMES = void 0;
exports.REPORT_QUEUE_NAMES = {
    BULK_PRINT: 'report-bulk-print',
};
exports.BULK_PRINT_CONCURRENCY = Number(process.env.REPORT_BULK_CONCURRENCY) || 2;
exports.MAX_BULK_DOCUMENTS = 500;
//# sourceMappingURL=print.constants.js.map