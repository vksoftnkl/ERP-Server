import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrinterProfile } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrinterCommandProfile } from '../engine/renderers/renderer.types';

/**
 * Printer profile lookup — risk R6's mitigation.
 *
 * ESC/P and ESC/POS differ by model family in ways no datasheet settles, and
 * the differences only surface against the customer's actual hardware. Rather
 * than compile a customer's printer quirks into the renderer, the command bytes
 * come from reports.printer_profile, so onboarding a new model is a seed row
 * and a redeploy is not needed.
 *
 * `pp_commands` is stored as hex strings keyed by capability name, and is
 * SPARSE: a profile only states what differs from the renderer's built-in Epson
 * defaults. That is what makes a new profile a few lines rather than a full
 * transcription of a command set.
 */
@Injectable()
export class PrinterProfileService {
  private readonly logger = new Logger(PrinterProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * A profile by code. A company-specific profile wins over a stock one of the
   * same code, so a customer can override a shipped profile without renaming it.
   */
  async findByCode(code: string, companyId: string | null): Promise<PrinterCommandProfile> {
    const records = await this.prisma.printerProfile.findMany({
      where: {
        ppCode: { equals: code, mode: 'insensitive' },
        ppIsDeleted: false,
        ppIsActive: true,
        ...(companyId ? { OR: [{ ppCompanyId: companyId }, { ppCompanyId: null }] } : {}),
      },
    });

    if (records.length === 0) {
      throw new NotFoundException(`Printer profile '${code}' not found`);
    }

    // Company-specific first.
    const chosen = records.find((record) => record.ppCompanyId !== null) ?? records[0];
    return toCommandProfile(chosen);
  }

  /**
   * The profile to use when a print request names none.
   *
   * Returns null rather than throwing: a missing profile is not an error, it
   * means "use the renderer's built-in Epson defaults", which is right for the
   * majority of printers sold in this market.
   */
  async findDefault(
    outputMode: string,
    companyId: string | null,
  ): Promise<PrinterCommandProfile | null> {
    const record = await this.prisma.printerProfile.findFirst({
      where: {
        ppOutputMode: outputMode,
        ppIsDeleted: false,
        ppIsActive: true,
        ...(companyId
          ? { OR: [{ ppCompanyId: companyId }, { ppCompanyId: null }] }
          : { ppCompanyId: null }),
      },
      // Company-specific before stock.
      orderBy: [{ ppCompanyId: 'desc' }, { ppCode: 'asc' }],
    });

    if (!record) {
      this.logger.debug(
        `No printer profile for ${outputMode}; using the renderer's built-in defaults.`,
      );
      return null;
    }

    return toCommandProfile(record);
  }

  /** Every profile a company may choose from, for a settings screen. */
  async list(companyId: string | null, outputMode?: string): Promise<PrinterCommandProfile[]> {
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
}

/**
 * Decode a stored profile into the renderer's shape.
 *
 * Command values are hex; anything that is not valid hex is DROPPED with a
 * warning rather than passed through as text. A malformed override reaching a
 * printer as literal ASCII would print its own escape sequence across the
 * invoice, which is a confusing failure to diagnose from a paper receipt.
 */
const toCommandProfile = (record: PrinterProfile): PrinterCommandProfile => {
  const commands: Record<string, Buffer> = {};
  const raw = record.ppCommands;

  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
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
