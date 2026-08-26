"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("../../database/prisma/prisma.module");
const layout_engine_1 = require("./engine/layout/layout.engine");
const text_measure_1 = require("./engine/layout/text-measure");
const font_registry_1 = require("./engine/fonts/font.registry");
const barcode_factory_1 = require("./engine/renderers/barcode.factory");
const escp_renderer_1 = require("./engine/renderers/grid/escp.renderer");
const escpos_renderer_1 = require("./engine/renderers/grid/escpos.renderer");
const image_cache_1 = require("./engine/renderers/image.cache");
const pdfkit_renderer_1 = require("./engine/renderers/pdfkit.renderer");
const bulk_print_processor_1 = require("./print/bulk-print.processor");
const print_controller_1 = require("./print/print.controller");
const print_constants_1 = require("./print/print.constants");
const printer_profile_service_1 = require("./print/printer-profile.service");
const report_render_service_1 = require("./print/report-render.service");
const branch_profile_provider_1 = require("./providers/impl/branch-profile.provider");
const company_profile_provider_1 = require("./providers/impl/company-profile.provider");
const invoice_batch_detail_provider_1 = require("./providers/impl/invoice-batch-detail.provider");
const invoice_header_provider_1 = require("./providers/impl/invoice-header.provider");
const invoice_lines_provider_1 = require("./providers/impl/invoice-lines.provider");
const invoice_tax_summary_provider_1 = require("./providers/impl/invoice-tax-summary.provider");
const party_outstanding_provider_1 = require("./providers/impl/party-outstanding.provider");
const report_data_provider_registry_1 = require("./providers/report-data-provider.registry");
const dynamic_dataset_source_1 = require("./providers/dynamic/dynamic-dataset.source");
const dataset_admin_guard_1 = require("./providers/dynamic/guards/dataset-admin.guard");
const report_dataset_sql_validator_1 = require("./providers/dynamic/report-dataset-sql.validator");
const report_datasets_controller_1 = require("./providers/dynamic/report-datasets.controller");
const report_datasets_service_1 = require("./providers/dynamic/report-datasets.service");
const template_migration_service_1 = require("./templates/template-migration.service");
const templates_controller_1 = require("./templates/templates.controller");
const templates_service_1 = require("./templates/templates.service");
let ReportingModule = class ReportingModule {
};
exports.ReportingModule = ReportingModule;
exports.ReportingModule = ReportingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            core_1.DiscoveryModule,
            prisma_module_1.PrismaModule,
            bullmq_1.BullModule.registerQueue({ name: print_constants_1.REPORT_QUEUE_NAMES.BULK_PRINT }),
        ],
        controllers: [templates_controller_1.TemplatesController, print_controller_1.PrintController, report_datasets_controller_1.ReportDatasetsController],
        providers: [
            font_registry_1.FontRegistry,
            text_measure_1.TextMeasurer,
            layout_engine_1.LayoutEngine,
            barcode_factory_1.BarcodeFactory,
            image_cache_1.ImageCache,
            pdfkit_renderer_1.PdfKitRenderer,
            escp_renderer_1.EscPRenderer,
            escpos_renderer_1.EscPosRenderer,
            template_migration_service_1.TemplateMigrationService,
            templates_service_1.TemplatesService,
            printer_profile_service_1.PrinterProfileService,
            report_render_service_1.ReportRenderService,
            bulk_print_processor_1.BulkPrintProcessor,
            report_data_provider_registry_1.ReportDataProviderRegistry,
            dynamic_dataset_source_1.DynamicDatasetSource,
            report_dataset_sql_validator_1.ReportDatasetSqlValidator,
            report_datasets_service_1.ReportDatasetsService,
            dataset_admin_guard_1.DatasetAdminGuard,
            company_profile_provider_1.CompanyProfileProvider,
            branch_profile_provider_1.BranchProfileProvider,
            invoice_header_provider_1.InvoiceHeaderProvider,
            invoice_lines_provider_1.InvoiceLinesProvider,
            invoice_tax_summary_provider_1.InvoiceTaxSummaryProvider,
            invoice_batch_detail_provider_1.InvoiceBatchDetailProvider,
            party_outstanding_provider_1.PartyOutstandingProvider,
        ],
        exports: [
            report_render_service_1.ReportRenderService,
            templates_service_1.TemplatesService,
            report_data_provider_registry_1.ReportDataProviderRegistry,
        ],
    })
], ReportingModule);
//# sourceMappingURL=reporting.module.js.map