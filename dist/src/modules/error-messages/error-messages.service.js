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
var ErrorMessageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorMessageService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const error_wording_1 = require("../../common/error-wording/error-wording");
const REFRESH_MS = 60_000;
let ErrorMessageService = ErrorMessageService_1 = class ErrorMessageService {
    prisma;
    logger = new common_1.Logger(ErrorMessageService_1.name);
    timer = null;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        await this.reload().catch((error) => this.logger.warn(`Error wording not loaded: ${String(error)}`));
        this.timer = setInterval(() => {
            void this.refreshIfChanged().catch(() => undefined);
        }, REFRESH_MS);
        this.timer.unref();
    }
    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
    async reload() {
        const [catalogue, rows] = await Promise.all([
            this.prisma.errorMessageCatalogue.findUnique({ where: { emcId: 1 } }),
            this.activeRows(),
        ]);
        (0, error_wording_1.setErrorWording)(rows, catalogue?.emcVersion ?? null);
    }
    async refreshIfChanged() {
        const catalogue = await this.prisma.errorMessageCatalogue.findUnique({
            where: { emcId: 1 },
            select: { emcVersion: true },
        });
        if ((catalogue?.emcVersion ?? null) !== (0, error_wording_1.errorWordingVersion)()) {
            await this.reload();
        }
    }
    async catalogue(lang, since) {
        const catalogue = await this.prisma.errorMessageCatalogue.findUnique({ where: { emcId: 1 } });
        const version = catalogue?.emcVersion ?? null;
        if (since && version && since === version) {
            return { version, lang, unchanged: true, rows: [] };
        }
        let rows = await this.activeRows(lang);
        let served = lang;
        if (rows.length === 0 && lang !== 'en') {
            rows = await this.activeRows('en');
            served = 'en';
        }
        return { version, lang: served, unchanged: false, rows };
    }
    async activeRows(lang) {
        const rows = await this.prisma.errorMessage.findMany({
            where: { ermIsActive: true, ...(lang ? { ermLang: lang } : {}) },
            orderBy: [{ ermCode: 'asc' }, { ermVariant: 'asc' }, { ermLang: 'asc' }],
            select: {
                ermCode: true,
                ermVariant: true,
                ermLang: true,
                ermTitle: true,
                ermLine: true,
                ermTodo: true,
            },
        });
        return rows.map((r) => ({
            code: r.ermCode,
            variant: r.ermVariant,
            lang: r.ermLang,
            title: r.ermTitle,
            line: r.ermLine,
            todo: r.ermTodo,
        }));
    }
};
exports.ErrorMessageService = ErrorMessageService;
exports.ErrorMessageService = ErrorMessageService = ErrorMessageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ErrorMessageService);
//# sourceMappingURL=error-messages.service.js.map