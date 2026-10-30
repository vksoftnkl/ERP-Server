import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { PrintLogService } from './print-log.service';
import { ACC_YEAR_PATTERN } from './print-render.constants';
import { PrintRenderService } from './print-render.service';
import type { RenderContext, RenderOutcome } from './types/print-render-api.types';

/** How long a link opens, unless `PRINT_SHARE_TTL_DAYS` says otherwise. */
export const PRINT_SHARE_DEFAULT_TTL_DAYS = 30;
const MAX_TTL_DAYS = 366;

/** 16 random bytes, base64url: exactly 22 characters of [A-Za-z0-9_-]. */
export const PRINT_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export type CreatePrintShareInput = {
  versionId: string;
  docId: string;
  companyId: string;
  branchId: string | null;
  accYear: string | null;
  deviceId: string | null;
  userId: string | null;
  filename: string | null;
};

export type CreatedPrintShare = {
  token: string;
  /** Under the API's version root: `/print-share/<token>/<file>.pdf`. */
  path: string;
  /** `PRINT_SHARE_PUBLIC_BASE_URL` + path, when the server knows its public address. */
  url: string | null;
  expiresAt: string;
};

export type OpenedPrintShare =
  | { status: 'OK'; outcome: RenderOutcome; filename: string }
  | { status: 'MISSING' }
  | { status: 'EXPIRED'; expiredOn: Date };

/** The one place a file name stem is made safe for a URL and a header. */
export function safeFileStem(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'document';
}

/** Days from `PRINT_SHARE_TTL_DAYS`, clamped; the default for anything unreadable. */
export function shareTtlDays(raw: string | undefined): number {
  const days = Number.parseInt((raw ?? '').trim(), 10);
  if (!Number.isFinite(days) || days < 1) return PRINT_SHARE_DEFAULT_TTL_DAYS;
  return Math.min(days, MAX_TTL_DAYS);
}

/**
 * Documents handed out as a link — the sale bill's WhatsApp send.
 *
 * ── THE TOKEN IS THE AUTHORISATION ────────────────────────────────────────
 *
 * The open is public: a customer tapping a link in WhatsApp has no session.
 * What they hold is 128 random bits naming ONE row, and that row names one
 * revision of one document in one company's scope, until it expires. It cannot
 * be widened — the context is frozen at creation, from the authenticated
 * session that created it — and a guessed token is 2^128 to one.
 *
 * Creating one grants nothing the creator did not already have: `/preview`
 * renders the same revision of the same document for the same session. A link
 * only makes that render reachable by whoever the operator sends it to.
 *
 * ── RENDERED ON EVERY OPEN ────────────────────────────────────────────────
 *
 * The row is the render's context, not its bytes. A few hundred bytes a link
 * rather than a PDF each, nothing to clean up but expired rows, and an amended
 * bill opens as it now stands. The year is frozen, though: a link opened after
 * the year rolls over still reads the partition its document lives in.
 */
@Injectable()
export class PrintShareService {
  private readonly logger = new Logger(PrintShareService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly printRender: PrintRenderService,
    private readonly printLog: PrintLogService,
  ) {}

  async create(input: CreatePrintShareInput): Promise<CreatedPrintShare> {
    const version = await this.prisma.printTemplateVersion.findUnique({
      where: { ptvId: input.versionId },
      select: { ptvId: true, ptvIsDeleted: true },
    });
    if (!version || version.ptvIsDeleted) {
      throw new NotFoundException('That print design revision does not exist.');
    }

    // The DOCUMENT's year when the caller names it — the same rule the
    // renderer applies; `currentAccYear` would prefer the company's current
    // year over it.
    const named = input.accYear?.trim();
    const accYear =
      named && ACC_YEAR_PATTERN.test(named)
        ? named
        : await this.printLog.currentAccYear(input.companyId, null);

    const token = randomBytes(16).toString('base64url');
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

  /**
   * The PDF behind a token, or why there is none.
   *
   * A malformed token never reaches the database. A render that FAILS throws,
   * as it would for `/preview`; the controller turns that into a page a
   * customer can read.
   */
  async open(token: string): Promise<OpenedPrintShare> {
    if (!PRINT_SHARE_TOKEN_PATTERN.test(token)) {
      return { status: 'MISSING' };
    }
    const link = await this.prisma.printShareLink.findUnique({ where: { pslToken: token } });
    if (!link) {
      return { status: 'MISSING' };
    }
    if (link.pslExpiresOn.getTime() <= Date.now()) {
      return { status: 'EXPIRED', expiredOn: link.pslExpiresOn };
    }

    const context: RenderContext = {
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
}
