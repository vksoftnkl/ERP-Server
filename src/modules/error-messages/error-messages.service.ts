import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  errorWordingVersion,
  setErrorWording,
  type ErrorWordingRow,
} from '../../common/error-wording/error-wording';
import type { ErrorMessageCataloguePayload } from './error-messages.types';

/** How often a running server looks for a newer catalogue (a seed run elsewhere). */
const REFRESH_MS = 60_000;

/**
 * Notes 120 — fixed.error_message in memory. Loaded at boot, and again
 * whenever fixed.error_message_catalogue carries another version (the seed
 * `error-messages` loaded a new file, on this process or another), so the
 * exception filters word errors from the catalogue without a query per error.
 */
@Injectable()
export class ErrorMessageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ErrorMessageService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload().catch((error: unknown) =>
      this.logger.warn(`Error wording not loaded: ${String(error)}`),
    );
    this.timer = setInterval(() => {
      void this.refreshIfChanged().catch(() => undefined);
    }, REFRESH_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** Every active row and the version, into the registry the filters read. */
  async reload(): Promise<void> {
    const [catalogue, rows] = await Promise.all([
      this.prisma.errorMessageCatalogue.findUnique({ where: { emcId: 1 } }),
      this.activeRows(),
    ]);
    setErrorWording(rows, catalogue?.emcVersion ?? null);
  }

  private async refreshIfChanged(): Promise<void> {
    const catalogue = await this.prisma.errorMessageCatalogue.findUnique({
      where: { emcId: 1 },
      select: { emcVersion: true },
    });
    if ((catalogue?.emcVersion ?? null) !== errorWordingVersion()) {
      await this.reload();
    }
  }

  /**
   * GET /error-messages: the rows of one language (English for a language
   * with none yet) and the version. `since` = the version the app holds: the
   * same answers `unchanged` and no rows.
   */
  async catalogue(lang: string, since?: string | null): Promise<ErrorMessageCataloguePayload> {
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

  private async activeRows(lang?: string): Promise<ErrorWordingRow[]> {
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
}
