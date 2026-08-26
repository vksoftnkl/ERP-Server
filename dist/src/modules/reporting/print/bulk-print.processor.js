"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BulkPrintProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkPrintProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const print_constants_1 = require("./print.constants");
const report_render_service_1 = require("./report-render.service");
let BulkPrintProcessor = BulkPrintProcessor_1 = class BulkPrintProcessor extends bullmq_1.WorkerHost {
    renderer;
    logger = new common_1.Logger(BulkPrintProcessor_1.name);
    constructor(renderer) {
        super();
        this.renderer = renderer;
    }
    async process(job) {
        const startedAt = Date.now();
        const { docIds, docType, outputMode } = job.data;
        const jobId = String(job.id ?? 'unknown');
        const outputDir = (0, node_path_1.join)(resolveBulkOutputRoot(), jobId);
        await (0, promises_1.mkdir)(outputDir, { recursive: true });
        this.logger.log(`Bulk print ${jobId}: ${docIds.length} ${docType} document(s) as ${outputMode} -> ${outputDir}`);
        const documents = [];
        for (const [index, docId] of docIds.entries()) {
            try {
                const rendered = await this.renderer.render({
                    docType,
                    docId,
                    outputMode,
                    paperCode: job.data.paperCode,
                    companyId: job.data.companyId,
                    branchId: job.data.branchId,
                    accYear: job.data.accYear,
                    userId: job.data.userId,
                    templateId: job.data.templateId,
                    printerProfileCode: job.data.printerProfileCode,
                    params: job.data.params,
                });
                const fileName = `${String(index + 1).padStart(4, '0')}-${sanitise(docId)}.${rendered.extension}`;
                const filePath = (0, node_path_1.join)(outputDir, fileName);
                await (0, promises_1.writeFile)(filePath, rendered.bytes);
                documents.push({
                    docId,
                    ok: true,
                    file: filePath,
                    bytes: rendered.bytes.length,
                    pageCount: rendered.pageCount,
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Bulk print ${jobId}: ${docType}/${docId} failed — ${message}`);
                documents.push({ docId, ok: false, error: message });
            }
            await job.updateProgress(Math.round(((index + 1) / docIds.length) * 100));
        }
        const succeeded = documents.filter((document) => document.ok).length;
        const result = {
            jobId,
            requested: docIds.length,
            succeeded,
            failed: documents.length - succeeded,
            outputDir,
            documents,
            durationMs: Date.now() - startedAt,
        };
        this.logger.log(`Bulk print ${jobId} finished: ${succeeded}/${docIds.length} in ${result.durationMs}ms`);
        return result;
    }
};
exports.BulkPrintProcessor = BulkPrintProcessor;
exports.BulkPrintProcessor = BulkPrintProcessor = BulkPrintProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(print_constants_1.REPORT_QUEUE_NAMES.BULK_PRINT),
    __metadata("design:paramtypes", [report_render_service_1.ReportRenderService])
], BulkPrintProcessor);
const resolveBulkOutputRoot = () => {
    const configured = process.env.REPORT_BULK_OUTPUT_DIR?.trim();
    if (configured) {
        return (0, node_path_1.isAbsolute)(configured) ? configured : (0, node_path_1.resolve)(process.cwd(), configured);
    }
    return (0, node_path_1.resolve)(process.cwd(), 'artifacts/bulk-print');
};
const sanitise = (value) => value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
//# sourceMappingURL=bulk-print.processor.js.map