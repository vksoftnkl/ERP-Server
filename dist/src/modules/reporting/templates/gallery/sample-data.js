"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMPLE_DATASETS_LONG = exports.SAMPLE_DATASETS = void 0;
const company_profile_provider_1 = require("../../providers/impl/company-profile.provider");
const branch_profile_provider_1 = require("../../providers/impl/branch-profile.provider");
const invoice_batch_detail_provider_1 = require("../../providers/impl/invoice-batch-detail.provider");
const invoice_header_provider_1 = require("../../providers/impl/invoice-header.provider");
const invoice_lines_provider_1 = require("../../providers/impl/invoice-lines.provider");
const invoice_tax_summary_provider_1 = require("../../providers/impl/invoice-tax-summary.provider");
const party_outstanding_provider_1 = require("../../providers/impl/party-outstanding.provider");
const noPrisma = null;
exports.SAMPLE_DATASETS = {
    company: new company_profile_provider_1.CompanyProfileProvider(noPrisma).sampleData(),
    branch: new branch_profile_provider_1.BranchProfileProvider(noPrisma).sampleData(),
    invoice: {
        ...new invoice_header_provider_1.InvoiceHeaderProvider(noPrisma).sampleData(),
        irnSignedQr: `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${'e30'.repeat(180)}.signature`,
    },
    items: new invoice_lines_provider_1.InvoiceLinesProvider(noPrisma).sampleData(),
    taxes: new invoice_tax_summary_provider_1.InvoiceTaxSummaryProvider(noPrisma).sampleData(),
    batches: new invoice_batch_detail_provider_1.InvoiceBatchDetailProvider(noPrisma).sampleData(),
    outstanding: new party_outstanding_provider_1.PartyOutstandingProvider(noPrisma).sampleData(),
};
exports.SAMPLE_DATASETS_LONG = (() => {
    const base = new invoice_lines_provider_1.InvoiceLinesProvider(noPrisma).sampleData();
    const items = Array.from({ length: 60 }, (_unused, index) => {
        const template = base[index % base.length];
        return { ...template, __index: index + 1, lineNo: index + 1 };
    });
    return { ...exports.SAMPLE_DATASETS, items };
})();
//# sourceMappingURL=sample-data.js.map