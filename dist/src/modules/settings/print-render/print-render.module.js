"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintRenderModule = void 0;
const common_1 = require("@nestjs/common");
const pg_module_1 = require("../../../database/pg/pg.module");
const print_template_assignment_module_1 = require("../print-template-assignment/print-template-assignment.module");
const dataset_runner_service_1 = require("./data/dataset-runner.service");
const print_data_provider_registry_1 = require("./data/print-data-provider.registry");
const branch_profile_provider_1 = require("./data/providers/branch-profile.provider");
const company_profile_provider_1 = require("./data/providers/company-profile.provider");
const sale_bill_header_provider_1 = require("./data/providers/sale-bill-header.provider");
const sale_bill_items_provider_1 = require("./data/providers/sale-bill-items.provider");
const sale_bill_tax_summary_provider_1 = require("./data/providers/sale-bill-tax-summary.provider");
const font_registry_1 = require("./engine/fonts/font.registry");
const layout_engine_1 = require("./engine/layout/layout.engine");
const text_measure_1 = require("./engine/layout/text-measure");
const escp_renderer_1 = require("./engine/renderers/grid/escp.renderer");
const escpos_renderer_1 = require("./engine/renderers/grid/escpos.renderer");
const barcode_factory_1 = require("./engine/renderers/barcode.factory");
const image_cache_1 = require("./engine/renderers/image.cache");
const pdfkit_renderer_1 = require("./engine/renderers/pdfkit.renderer");
const print_log_service_1 = require("./print-log.service");
const print_render_controller_1 = require("./print-render.controller");
const print_render_exception_filter_1 = require("./print-render-exception.filter");
const print_render_service_1 = require("./print-render.service");
let PrintRenderModule = class PrintRenderModule {
};
exports.PrintRenderModule = PrintRenderModule;
exports.PrintRenderModule = PrintRenderModule = __decorate([
    (0, common_1.Module)({
        imports: [pg_module_1.PgModule, print_template_assignment_module_1.PrintTemplateAssignmentModule],
        controllers: [print_render_controller_1.PrintRenderController],
        providers: [
            font_registry_1.FontRegistry,
            text_measure_1.TextMeasurer,
            layout_engine_1.LayoutEngine,
            image_cache_1.ImageCache,
            barcode_factory_1.BarcodeFactory,
            pdfkit_renderer_1.PdfKitRenderer,
            escpos_renderer_1.EscPosRenderer,
            escp_renderer_1.EscPRenderer,
            company_profile_provider_1.CompanyProfileProvider,
            branch_profile_provider_1.BranchProfileProvider,
            sale_bill_header_provider_1.SaleBillHeaderProvider,
            sale_bill_items_provider_1.SaleBillItemsProvider,
            sale_bill_tax_summary_provider_1.SaleBillTaxSummaryProvider,
            {
                provide: print_data_provider_registry_1.PRINT_DATA_PROVIDERS,
                useFactory: (...providers) => providers,
                inject: [
                    company_profile_provider_1.CompanyProfileProvider,
                    branch_profile_provider_1.BranchProfileProvider,
                    sale_bill_header_provider_1.SaleBillHeaderProvider,
                    sale_bill_items_provider_1.SaleBillItemsProvider,
                    sale_bill_tax_summary_provider_1.SaleBillTaxSummaryProvider,
                ],
            },
            print_data_provider_registry_1.PrintDataProviderRegistry,
            dataset_runner_service_1.DatasetRunnerService,
            print_log_service_1.PrintLogService,
            print_render_service_1.PrintRenderService,
            print_render_exception_filter_1.PrintRenderExceptionFilter,
        ],
        exports: [print_render_service_1.PrintRenderService],
    })
], PrintRenderModule);
//# sourceMappingURL=print-render.module.js.map