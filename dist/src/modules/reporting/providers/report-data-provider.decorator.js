"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportDataProvider = exports.REPORT_DATA_PROVIDER_METADATA = void 0;
const common_1 = require("@nestjs/common");
exports.REPORT_DATA_PROVIDER_METADATA = 'reporting:data-provider';
const ReportDataProvider = (token, options = {}) => (0, common_1.SetMetadata)(exports.REPORT_DATA_PROVIDER_METADATA, {
    token,
    ...options,
});
exports.ReportDataProvider = ReportDataProvider;
//# sourceMappingURL=report-data-provider.decorator.js.map