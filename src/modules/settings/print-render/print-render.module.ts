import { Module } from '@nestjs/common';
import { PgModule } from 'src/database/pg/pg.module';
import { PrintTemplateAssignmentModule } from '../print-template-assignment/print-template-assignment.module';
import { DatasetRunnerService } from './data/dataset-runner.service';
import {
  PRINT_DATA_PROVIDERS,
  PrintDataProviderRegistry,
} from './data/print-data-provider.registry';
import { PrintDataProvider } from './data/print-data-provider.types';
import { BranchProfileProvider } from './data/providers/branch-profile.provider';
import { CompanyProfileProvider } from './data/providers/company-profile.provider';
import { SaleBillHeaderProvider } from './data/providers/sale-bill-header.provider';
import { SaleBillItemsProvider } from './data/providers/sale-bill-items.provider';
import { SaleBillTaxSummaryProvider } from './data/providers/sale-bill-tax-summary.provider';
import { FontRegistry } from './engine/fonts/font.registry';
import { LayoutEngine } from './engine/layout/layout.engine';
import { TextMeasurer } from './engine/layout/text-measure';
import { EscPRenderer } from './engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from './engine/renderers/grid/escpos.renderer';
import { BarcodeFactory } from './engine/renderers/barcode.factory';
import { ImageCache } from './engine/renderers/image.cache';
import { PdfKitRenderer } from './engine/renderers/pdfkit.renderer';
import { PrintLogService } from './print-log.service';
import { PrintRenderController } from './print-render.controller';
import { PrintRenderExceptionFilter } from './print-render-exception.filter';
import { PrintRenderService } from './print-render.service';

/**
 * §8 — the renderer, wired.
 *
 * ── THE PROVIDER LIST IS THE REGISTRY ──────────────────────────────────────
 *
 * Every dataset provider is named once, below, and collected under one token.
 * Explicit rather than a decorator scan: a stored template row points at a
 * provider BY STRING, so the set of valid codes must be a fact about this
 * build and not about which files an import graph happened to pull in. The
 * failure mode of the other design is a template that renders on one
 * deployment and 500s on another with no diff to look at.
 *
 * Adding one is three lines — the class, the import, the array — and the
 * registry refuses two providers claiming one code at boot rather than letting
 * array order decide.
 */
@Module({
  imports: [PgModule, PrintTemplateAssignmentModule],
  controllers: [PrintRenderController],
  providers: [
    // The engine. Restored intact from the reporting module that was removed on
    // 2026-08-27: the layout pass, both renderer families, the jexl expression
    // sandbox and the font registry are unchanged, because they were never the
    // part that was wrong — they were written against exactly the band/element
    // body the canvas still produces. What changed is everything ABOVE them:
    // the storage they read is print_template_version, not a reports table.
    FontRegistry,
    TextMeasurer,
    LayoutEngine,
    ImageCache,
    BarcodeFactory,
    PdfKitRenderer,
    EscPosRenderer,
    EscPRenderer,

    // The data layer.
    CompanyProfileProvider,
    BranchProfileProvider,
    SaleBillHeaderProvider,
    SaleBillItemsProvider,
    SaleBillTaxSummaryProvider,
    {
      provide: PRINT_DATA_PROVIDERS,
      useFactory: (...providers: PrintDataProvider[]): PrintDataProvider[] => providers,
      inject: [
        CompanyProfileProvider,
        BranchProfileProvider,
        SaleBillHeaderProvider,
        SaleBillItemsProvider,
        SaleBillTaxSummaryProvider,
      ],
    },
    PrintDataProviderRegistry,
    DatasetRunnerService,

    // The module itself.
    PrintLogService,
    PrintRenderService,
    PrintRenderExceptionFilter,
  ],
  exports: [PrintRenderService],
})
export class PrintRenderModule {}
