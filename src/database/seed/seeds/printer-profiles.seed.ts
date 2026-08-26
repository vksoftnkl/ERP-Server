import type { Prisma, PrismaClient } from '@prisma/client';
import type { TsSeed } from '../seed.types';

/**
 * Stock printer profiles — risk R6's starting point.
 *
 * Phase 0.4 of the plan calls for an inventory of the customer's actual
 * printers, and that inventory is an EXTERNAL dependency this repository cannot
 * satisfy: the exact TVS or Epson model on a counter in Salem is not knowable
 * from here. See docs/reporting-printer-inventory.md for the questionnaire.
 *
 * What this seed does instead is make that inventory cheap to act on. Each row
 * below is a family-level profile good enough to print with today, and adding a
 * customer's specific model is a row, not a code change — `pp_commands` is
 * sparse, so a profile only states the bytes that differ from the renderer's
 * built-in Epson defaults.
 *
 * Command values are HEX. `1B40` is ESC @.
 */

interface StockProfile {
  readonly code: string;
  readonly name: string;
  readonly outputMode: 'ESCPOS' | 'ESCP_DOTMATRIX';
  readonly family: string;
  readonly columns: number;
  readonly cpi: number | null;
  readonly paperWidthMm: number | null;
  readonly codepage: string;
  readonly supportsBold: boolean;
  readonly supportsUnderline: boolean;
  readonly supportsCut: boolean;
  readonly supportsGraphics: boolean;
  readonly commands: Record<string, string>;
}

const STOCK_PROFILES: readonly StockProfile[] = [
  // ── Dot matrix ────────────────────────────────────────────────────────
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
    // Nothing overridden: the renderer's defaults ARE the Epson command set.
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
    // The MSP series is ESC/P compatible in its default emulation. This row
    // exists so a site that finds a divergence has somewhere to record it
    // WITHOUT a code change: add the differing bytes to pp_commands here.
    commands: {},
  },

  // ── Thermal ───────────────────────────────────────────────────────────
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
    // Most 58mm counter-top units have no cutter; the renderer feeds past the
    // tear bar instead when this is false.
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

export const printerProfilesSeed: TsSeed = {
  name: 'report-printer-profiles',
  version: '1.0.0',
  mode: 'always',
  description: 'Stock ESC/P and ESC/POS printer command profiles',

  async run(prisma: PrismaClient): Promise<void> {
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
        ppCommands: profile.commands as Prisma.InputJsonValue,
      };

      if (!existing) {
        await prisma.printerProfile.create({
          data: { ppCompanyId: null, ppCode: profile.code, ppIsActive: true, ...data },
        });
        console.log(`[seed] printer profile '${profile.code}' created`);
        continue;
      }

      // A company-owned profile is a customer's own tuning and is never
      // overwritten; only the stock rows (ppCompanyId NULL) are refreshed.
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
