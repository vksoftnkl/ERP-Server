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
var PrinterProfileService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrinterProfileService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
let PrinterProfileService = PrinterProfileService_1 = class PrinterProfileService {
    prisma;
    logger = new common_1.Logger(PrinterProfileService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByCode(code, companyId) {
        const records = await this.prisma.printerProfile.findMany({
            where: {
                ppCode: { equals: code, mode: 'insensitive' },
                ppIsDeleted: false,
                ppIsActive: true,
                ...(companyId ? { OR: [{ ppCompanyId: companyId }, { ppCompanyId: null }] } : {}),
            },
        });
        if (records.length === 0) {
            throw new common_1.NotFoundException(`Printer profile '${code}' not found`);
        }
        const chosen = records.find((record) => record.ppCompanyId !== null) ?? records[0];
        return toCommandProfile(chosen);
    }
    async findDefault(outputMode, companyId) {
        const record = await this.prisma.printerProfile.findFirst({
            where: {
                ppOutputMode: outputMode,
                ppIsDeleted: false,
                ppIsActive: true,
                ...(companyId
                    ? { OR: [{ ppCompanyId: companyId }, { ppCompanyId: null }] }
                    : { ppCompanyId: null }),
            },
            orderBy: [{ ppCompanyId: 'desc' }, { ppCode: 'asc' }],
        });
        if (!record) {
            this.logger.debug(`No printer profile for ${outputMode}; using the renderer's built-in defaults.`);
            return null;
        }
        return toCommandProfile(record);
    }
    async list(companyId, outputMode) {
        const records = await this.prisma.printerProfile.findMany({
            where: {
                ppIsDeleted: false,
                ppIsActive: true,
                ...(outputMode ? { ppOutputMode: outputMode } : {}),
                ...(companyId ? { OR: [{ ppCompanyId: companyId }, { ppCompanyId: null }] } : {}),
            },
            orderBy: [{ ppOutputMode: 'asc' }, { ppCompanyId: 'desc' }, { ppName: 'asc' }],
        });
        return records.map(toCommandProfile);
    }
};
exports.PrinterProfileService = PrinterProfileService;
exports.PrinterProfileService = PrinterProfileService = PrinterProfileService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrinterProfileService);
const toCommandProfile = (record) => {
    const commands = {};
    const raw = record.ppCommands;
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [key, value] of Object.entries(raw)) {
            if (typeof value !== 'string') {
                continue;
            }
            const hex = value.replace(/[\s:_-]/g, '');
            if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
                continue;
            }
            commands[key] = Buffer.from(hex, 'hex');
        }
    }
    return {
        code: record.ppCode,
        name: record.ppName,
        family: record.ppFamily,
        columns: record.ppColumns,
        cpi: record.ppCpi,
        paperWidthMm: record.ppPaperWidthMm,
        codepage: record.ppCodepage,
        supportsBold: record.ppSupportsBold,
        supportsUnderline: record.ppSupportsUnderline,
        supportsCut: record.ppSupportsCut,
        supportsGraphics: record.ppSupportsGraphics,
        commands,
    };
};
//# sourceMappingURL=printer-profile.service.js.map