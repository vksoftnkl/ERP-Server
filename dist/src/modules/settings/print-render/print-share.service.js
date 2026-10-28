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
var PrintShareService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintShareService = exports.PRINT_SHARE_TOKEN_PATTERN = exports.PRINT_SHARE_DEFAULT_TTL_DAYS = void 0;
exports.safeFileStem = safeFileStem;
exports.shareTtlDays = shareTtlDays;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const print_log_service_1 = require("./print-log.service");
const print_render_constants_1 = require("./print-render.constants");
const print_render_service_1 = require("./print-render.service");
exports.PRINT_SHARE_DEFAULT_TTL_DAYS = 30;
const MAX_TTL_DAYS = 366;
exports.PRINT_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;
function safeFileStem(raw) {
    return (raw ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'document';
}
function shareTtlDays(raw) {
    const days = Number.parseInt((raw ?? '').trim(), 10);
    if (!Number.isFinite(days) || days < 1)
        return exports.PRINT_SHARE_DEFAULT_TTL_DAYS;
    return Math.min(days, MAX_TTL_DAYS);
}
let PrintShareService = PrintShareService_1 = class PrintShareService {
    prisma;
    printRender;
    printLog;
    logger = new common_1.Logger(PrintShareService_1.name);
    constructor(prisma, printRender, printLog) {
        this.prisma = prisma;
        this.printRender = printRender;
        this.printLog = printLog;
    }
    async create(input) {
        const version = await this.prisma.printTemplateVersion.findUnique({
            where: { ptvId: input.versionId },
            select: { ptvId: true, ptvIsDeleted: true },
        });
        if (!version || version.ptvIsDeleted) {
            throw new common_1.NotFoundException('That print design revision does not exist.');
        }
        const named = input.accYear?.trim();
        const accYear = named && print_render_constants_1.ACC_YEAR_PATTERN.test(named)
            ? named
            : await this.printLog.currentAccYear(input.companyId, null);
        const token = (0, node_crypto_1.randomBytes)(16).toString('base64url');
        const filename = safeFileStem(input.filename);
        const expiresOn = new Date(Date.now() + shareTtlDays(process.env.PRINT_SHARE_TTL_DAYS) * 86_400_000);
        await this.prisma.printShareLink.create({
            data: {
                pslToken: token,
                pslVersionId: input.versionId,
                pslDocId: input.docId,
                pslCompanyId: input.companyId,
                pslBranchId: input.branchId,
                pslAccYear: accYear,
                pslDeviceId: input.deviceId,
                pslFilename: filename,
                pslExpiresOn: expiresOn,
                pslCreatedBy: input.userId,
            },
        });
        const path = `/print-share/${token}/${filename}.pdf`;
        const base = (process.env.PRINT_SHARE_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
        return {
            token,
            path,
            url: base ? `${base}${path}` : null,
            expiresAt: expiresOn.toISOString(),
        };
    }
    async open(token) {
        if (!exports.PRINT_SHARE_TOKEN_PATTERN.test(token)) {
            return { status: 'MISSING' };
        }
        const link = await this.prisma.printShareLink.findUnique({ where: { pslToken: token } });
        if (!link) {
            return { status: 'MISSING' };
        }
        if (link.pslExpiresOn.getTime() <= Date.now()) {
            return { status: 'EXPIRED', expiredOn: link.pslExpiresOn };
        }
        const context = {
            companyId: link.pslCompanyId,
            branchId: link.pslBranchId,
            accYear: link.pslAccYear.trim(),
            docId: link.pslDocId,
            userId: link.pslCreatedBy,
            deviceId: link.pslDeviceId,
        };
        const outcome = await this.printRender.preview({
            versionId: link.pslVersionId,
            context,
            params: {},
            docIds: [link.pslDocId],
            outputMode: 'PDF',
        });
        this.logger.log(`Shared document ${link.pslDocId} opened through link ${link.pslId}`);
        return { status: 'OK', outcome, filename: link.pslFilename };
    }
};
exports.PrintShareService = PrintShareService;
exports.PrintShareService = PrintShareService = PrintShareService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        print_render_service_1.PrintRenderService,
        print_log_service_1.PrintLogService])
], PrintShareService);
//# sourceMappingURL=print-share.service.js.map