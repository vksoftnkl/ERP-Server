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
var PrintLogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintLogService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const print_render_constants_1 = require("./print-render.constants");
let PrintLogService = PrintLogService_1 = class PrintLogService {
    prisma;
    logger = new common_1.Logger(PrintLogService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async currentAccYear(companyId, fallback) {
        try {
            const current = await this.prisma.fiscalYear.findFirst({
                where: { compId: companyId, fyIsCurrent: true, isDeleted: false },
                select: { fyYearName: true },
            });
            if (current?.fyYearName && print_render_constants_1.ACC_YEAR_PATTERN.test(current.fyYearName.trim())) {
                return current.fyYearName.trim();
            }
        }
        catch (error) {
            this.logger.warn(`Could not read the current fiscal year for company ${companyId}: ` +
                `${error instanceof Error ? error.message : String(error)}`);
        }
        if (fallback && print_render_constants_1.ACC_YEAR_PATTERN.test(fallback))
            return fallback;
        const now = new Date();
        const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        return `${startYear}-${startYear + 1}`;
    }
    async record(entries) {
        if (entries.length === 0)
            return [];
        try {
            return await this.insert(entries);
        }
        catch (error) {
            if (this.isMissingPartition(error)) {
                const accYear = entries[0].accYear;
                this.logger.warn(`public.print_log has no partition for ${accYear} — creating it and retrying. ` +
                    'A new accounting year needs fn_create_printing_partitions before its first print.');
                try {
                    await this.createPartition(accYear);
                    return await this.insert(entries);
                }
                catch (retryError) {
                    this.reportSwallowed(entries, retryError);
                    return [];
                }
            }
            this.reportSwallowed(entries, error);
            return [];
        }
    }
    async insert(entries) {
        const written = await this.prisma.$transaction(entries.map((entry) => this.prisma.printLog.create({
            data: {
                plgAccYear: entry.accYear,
                plgCompanyId: entry.companyId,
                plgBranchId: entry.branchId,
                plgDeviceId: entry.deviceId,
                plgSrcModule: entry.srcModule,
                plgSrcDocType: entry.srcDocType,
                plgSrcDocId: entry.srcDocId,
                plgSrcAccYear: entry.srcAccYear,
                plgPurposeId: entry.purposeId,
                plgTemplateId: entry.templateId,
                plgVersionId: entry.versionId,
                plgPrinterId: entry.printerId,
                plgOutputMode: entry.outputMode,
                plgCopyNo: entry.copyNo,
                plgCopyLabel: entry.copyLabel,
                plgLang: entry.lang,
                plgParams: (entry.params ?? client_1.Prisma.JsonNull),
                plgStatus: entry.status,
                plgError: entry.error,
                plgPageCount: entry.pageCount,
                plgByteCount: entry.byteCount,
                plgDurationMs: entry.durationMs,
                plgPrintedBy: entry.printedBy,
            },
            select: { plgId: true },
        })));
        return written.map((row) => row.plgId);
    }
    async createPartition(accYear) {
        if (!print_render_constants_1.ACC_YEAR_PATTERN.test(accYear)) {
            throw new Error(`'${accYear}' is not an accounting year, so no partition can be made for it`);
        }
        await this.prisma
            .$executeRaw `SELECT public.fn_create_printing_partitions(${accYear}::character(9))`;
    }
    isMissingPartition(error) {
        const message = error instanceof Error ? error.message : String(error);
        return /no partition of relation .*print_log.* found/i.test(message);
    }
    reportSwallowed(entries, error) {
        const first = entries[0];
        this.logger.error(`print_log could not be written for ${entries.length} copy/copies of ` +
            `${first.srcModule}/${first.srcDocType}/${first.srcDocId ?? '-'} ` +
            `(version ${first.versionId}, ${first.outputMode}): ` +
            `${error instanceof Error ? error.message : String(error)}. ` +
            'The render itself succeeded and the paper is out; this is a hole in the print history, ' +
            'not a failed print.', error instanceof Error ? error.stack : undefined);
    }
};
exports.PrintLogService = PrintLogService;
exports.PrintLogService = PrintLogService = PrintLogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrintLogService);
//# sourceMappingURL=print-log.service.js.map