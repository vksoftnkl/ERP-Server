import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { LayoutEngine } from './engine/layout/layout.engine';
import { TextMeasurer } from './engine/layout/text-measure';
import { FontRegistry } from './engine/fonts/font.registry';
import { BarcodeFactory } from './engine/renderers/barcode.factory';
import { EscPRenderer } from './engine/renderers/grid/escp.renderer';
import { EscPosRenderer } from './engine/renderers/grid/escpos.renderer';
import { ImageCache } from './engine/renderers/image.cache';
import { PdfKitRenderer } from './engine/renderers/pdfkit.renderer';
import { BulkPrintProcessor } from './print/bulk-print.processor';
import { PrintController } from './print/print.controller';
import { REPORT_QUEUE_NAMES } from './print/print.constants';
import { PrinterProfileService } from './print/printer-profile.service';
import { ReportRenderService } from './print/report-render.service';
import { BranchProfileProvider } from './providers/impl/branch-profile.provider';
import { CompanyProfileProvider } from './providers/impl/company-profile.provider';
import { InvoiceBatchDetailProvider } from './providers/impl/invoice-batch-detail.provider';
import { InvoiceHeaderProvider } from './providers/impl/invoice-header.provider';
import { InvoiceLinesProvider } from './providers/impl/invoice-lines.provider';
import { InvoiceTaxSummaryProvider } from './providers/impl/invoice-tax-summary.provider';
import { PartyOutstandingProvider } from './providers/impl/party-outstanding.provider';
import { ReportDataProviderRegistry } from './providers/report-data-provider.registry';
import { DynamicDatasetSource } from './providers/dynamic/dynamic-dataset.source';
import { DatasetAdminGuard } from './providers/dynamic/guards/dataset-admin.guard';
import { ReportDatasetSqlValidator } from './providers/dynamic/report-dataset-sql.validator';
import { ReportDatasetsController } from './providers/dynamic/report-datasets.controller';
import { ReportDatasetsService } from './providers/dynamic/report-datasets.service';
import { TemplateMigrationService } from './templates/template-migration.service';
import { TemplatesController } from './templates/templates.controller';
import { TemplatesService } from './templates/templates.service';

/**
 * The reporting module: template storage, the render engine, and printing.
 *
 * ── Why the providers are listed here despite being discovered ──────────────
 * ReportDataProviderRegistry finds providers by metadata scan, which means a
 * provider that exists is a provider the designer can see. But discovery only
 * scans what Nest has INSTANTIATED — a provider class nobody registers is not
 * in the container to be found. So the list below is what makes them exist; the
 * decorator is what makes them findable. Adding a provider means both.
 *
 * ── Compiled providers vs runtime datasets ──────────────────────────────────
 * The list below is the COMPILED half. The runtime half lives in
 * reports.report_dataset and needs no entry here: DynamicDatasetSource loads it
 * at boot, and ReportDataProviderRegistry falls back to it on lookup. That is
 * the whole point of the table — a new dataset is an INSERT, not an edit here
 * followed by a deploy.
 *
 * ── Queue registration ──────────────────────────────────────────────────────
 * The bulk-print queue is registered here rather than in common/queue, so the
 * platform's shared queue registry stays free of feature-module names. BullMQ's
 * root connection comes from QueueModule, which app.module already imports.
 */
@Module({
  imports: [
    // Required by ReportDataProviderRegistry to enumerate decorated providers.
    DiscoveryModule,
    PrismaModule,
    BullModule.registerQueue({ name: REPORT_QUEUE_NAMES.BULK_PRINT }),
  ],
  controllers: [TemplatesController, PrintController, ReportDatasetsController],
  providers: [
    // ── Engine ──────────────────────────────────────────────────────────
    FontRegistry,
    TextMeasurer,
    LayoutEngine,
    BarcodeFactory,
    ImageCache,
    PdfKitRenderer,
    EscPRenderer,
    EscPosRenderer,

    // ── Templates ───────────────────────────────────────────────────────
    TemplateMigrationService,
    TemplatesService,

    // ── Print ───────────────────────────────────────────────────────────
    PrinterProfileService,
    ReportRenderService,
    BulkPrintProcessor,

    // ── Data providers ──────────────────────────────────────────────────
    ReportDataProviderRegistry,

    // Runtime datasets. DynamicDatasetSource is what the registry falls back
    // to, so it must be here even though nothing else injects it directly.
    DynamicDatasetSource,
    ReportDatasetSqlValidator,
    ReportDatasetsService,
    DatasetAdminGuard,

    CompanyProfileProvider,
    BranchProfileProvider,
    InvoiceHeaderProvider,
    InvoiceLinesProvider,
    InvoiceTaxSummaryProvider,
    InvoiceBatchDetailProvider,
    PartyOutstandingProvider,
  ],
  exports: [
    // Exported so other modules can render a document without going through
    // HTTP — e.g. attaching a PDF invoice to an e-mail or an e-invoice payload.
    ReportRenderService,
    TemplatesService,
    ReportDataProviderRegistry,
  ],
})
export class ReportingModule {}
