"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printerProfilesSeed = void 0;
const STOCK_PROFILES = [
    {
        code: 'EPSON-LX-80',
        name: 'Epson LX / compatible, 80 column',
        outputMode: 'ESCP_DOTMATRIX',
        family: 'EPSON_ESCP',
        columns: 80,
        cpi: 10,
        paperWidthMm: null,
        codepage: 'CP437',
        supportsBold: true,
        supportsUnderline: true,
        supportsCut: false,
        supportsGraphics: true,
        commands: {},
    },
    {
        code: 'EPSON-LQ-132',
        name: 'Epson LQ / compatible, 132 column',
        outputMode: 'ESCP_DOTMATRIX',
        family: 'EPSON_ESCP',
        columns: 132,
        cpi: 10,
        paperWidthMm: null,
        codepage: 'CP437',
        supportsBold: true,
        supportsUnderline: true,
        supportsCut: false,
        supportsGraphics: true,
        commands: {},
    },
    {
        code: 'TVS-MSP-240',
        name: 'TVS MSP series, 80 column',
        outputMode: 'ESCP_DOTMATRIX',
        family: 'TVS_MSP',
        columns: 80,
        cpi: 10,
        paperWidthMm: null,
        codepage: 'CP437',
        supportsBold: true,
        supportsUnderline: true,
        supportsCut: false,
        supportsGraphics: true,
        commands: {},
    },
    {
        code: 'ESCPOS-80MM',
        name: 'Generic ESC/POS thermal, 80mm',
        outputMode: 'ESCPOS',
        family: 'EPSON_TM',
        columns: 48,
        cpi: null,
        paperWidthMm: 80,
        codepage: 'CP437',
        supportsBold: true,
        supportsUnderline: true,
        supportsCut: true,
        supportsGraphics: true,
        commands: {},
    },
    {
        code: 'ESCPOS-58MM',
        name: 'Generic ESC/POS thermal, 58mm',
        outputMode: 'ESCPOS',
        family: 'EPSON_TM',
        columns: 32,
        cpi: null,
        paperWidthMm: 58,
        codepage: 'CP437',
        supportsBold: true,
        supportsUnderline: true,
        supportsCut: false,
        supportsGraphics: true,
        commands: {},
    },
    {
        code: 'ESCPOS-80MM-NOCUT',
        name: 'ESC/POS thermal 80mm, no cutter',
        outputMode: 'ESCPOS',
        family: 'EPSON_TM',
        columns: 48,
        cpi: null,
        paperWidthMm: 80,
        codepage: 'CP437',
        supportsBold: true,
        supportsUnderline: true,
        supportsCut: false,
        supportsGraphics: true,
        commands: {},
    },
];
exports.printerProfilesSeed = {
    name: 'report-printer-profiles',
    version: '1.0.0',
    mode: 'always',
    description: 'Stock ESC/P and ESC/POS printer command profiles',
    async run(prisma) {
        for (const profile of STOCK_PROFILES) {
            const existing = await prisma.printerProfile.findFirst({
                where: { ppCode: profile.code, ppIsDeleted: false },
            });
            const data = {
                ppName: profile.name,
                ppOutputMode: profile.outputMode,
                ppFamily: profile.family,
                ppColumns: profile.columns,
                ppCpi: profile.cpi,
                ppPaperWidthMm: profile.paperWidthMm,
                ppCodepage: profile.codepage,
                ppSupportsBold: profile.supportsBold,
                ppSupportsUnderline: profile.supportsUnderline,
                ppSupportsCut: profile.supportsCut,
                ppSupportsGraphics: profile.supportsGraphics,
                ppCommands: profile.commands,
            };
            if (!existing) {
                await prisma.printerProfile.create({
                    data: { ppCompanyId: null, ppCode: profile.code, ppIsActive: true, ...data },
                });
                console.log(`[seed] printer profile '${profile.code}' created`);
                continue;
            }
            if (existing.ppCompanyId !== null) {
                continue;
            }
            await prisma.printerProfile.update({
                where: { ppId: existing.ppId },
                data: { ...data, ppModifiedOn: new Date() },
            });
        }
    },
};
//# sourceMappingURL=printer-profiles.seed.js.map