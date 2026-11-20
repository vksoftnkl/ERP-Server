import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type WaConnection } from '@prisma/client';
import { hostname } from 'node:os';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { isOfflineSite } from 'src/config/offline-site';
import { WaCryptoService } from './wa-crypto.service';
import { WaRelayError, waRefuse } from './wa-errors';
import type { TemplateMirror } from './wa-language';
import type { RelayConnection } from './wa-relay.client';
import { wacStateOf } from './wa-status';
import { WA_CODES, WA_POLL, type WacState } from './wa.constants';

const PURPOSES = ['BILL', 'ORDER', 'RECEIPT', 'REMINDER', 'TEST'];
const TPL_STATUSES = ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'NOT_SUBMITTED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The caller of one request, as the log rows record it. */
export interface WaActor {
  userId: string | null;
  userName: string;
  deviceId: string | null;
  branchId: string | null;
}

/**
 * The shared low-level pieces of the WhatsApp module: the company's
 * wa_connection row and its key, the template mirror, the rights gate, the
 * caller, "today" and the accounting year in IST. Every other WhatsApp
 * service builds on this one, so none of them needs another.
 */
@Injectable()
export class WaStore {
  private readonly logger = new Logger(WaStore.name);
  /** pid@host — the lease holder name (decision 20). */
  readonly processName = `${process.pid}@${hostname()}`.slice(0, 60);

  constructor(
    readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly crypto: WaCryptoService,
    private readonly config: ConfigService,
  ) {}

  // ── site, rights, caller ─────────────────────────────────────────────────

  offlineSite(): boolean {
    return isOfflineSite(this.config);
  }

  /** Q1 — WhatsApp is set up and sent from the main server only. */
  assertMainServer(): void {
    if (this.offlineSite()) {
      waRefuse(
        WA_CODES.SITE_OFFLINE,
        'This install is an offline site (CLOUD_SYNC_ENABLED): WhatsApp is set up and sent from the main server.',
      );
    }
  }

  userId(): string | null {
    const id = this.requestContext.getUserId();
    return id && UUID.test(id) ? id : null;
  }

  async right(menuId: number, right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.userId(),
      menuId,
      right,
      codePrefix: 'WA',
      action,
    });
  }

  async actor(): Promise<WaActor> {
    const userId = this.userId();
    let userName = 'SYSTEM';
    if (userId) {
      const [u] = await this.prisma.$queryRaw<{ name: string | null }[]>`
        SELECT usr_login_name AS name FROM public.user_master WHERE usr_id = ${userId}::uuid LIMIT 1`;
      userName = (u?.name ?? '').trim() || userId;
    }
    return {
      userId,
      userName: userName.slice(0, 60),
      deviceId: this.requestContext.getDeviceId(),
      branchId: this.requestContext.getBranchId(),
    };
  }

  // ── time ─────────────────────────────────────────────────────────────────

  /** YYYY-MM-DD in IST. */
  istToday(now = new Date()): string {
    return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  }

  /**
   * The company's accounting year on `date` (fiscal_years), else April–March of
   * it. Review N8: the fallback is said in the log, because a year with no
   * fiscal_years row usually has no wa_message_log partition either, and the
   * log row's insert then fails (WaSendService.writeRow names the document).
   */
  async accYearOn(companyId: string, date: string): Promise<string> {
    const [fy] = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT btrim(fy_year_name) AS name FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND ${date}::date BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_begin_date DESC LIMIT 1`;
    if (fy?.name && /^\d{4}-\d{4}$/.test(fy.name)) {
      return fy.name;
    }
    const d = new Date(`${date}T00:00:00Z`);
    const y = d.getUTCMonth() + 1 >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    this.logger.warn(
      `No fiscal year of company ${companyId} covers ${date}: the WhatsApp log uses ${y}-${y + 1}, ` +
        `which needs ensure_acc_year_partitions('${y}-${y + 1}')`,
    );
    return `${y}-${y + 1}`;
  }

  async companyExists(companyId: string): Promise<boolean> {
    const [c] = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT true AS ok FROM public.companys WHERE comp_id = ${companyId}::uuid AND comp_is_deleted = false LIMIT 1`;
    return c?.ok === true;
  }

  // ── the connection row ───────────────────────────────────────────────────

  row(companyId: string): Promise<WaConnection | null> {
    return this.prisma.waConnection.findFirst({ where: { wacCompanyId: companyId, wacIsDeleted: false } });
  }

  async rowOrRefuse(companyId: string): Promise<WaConnection> {
    const row = await this.row(companyId);
    if (!row) {
      waRefuse(WA_CODES.NOT_ACTIVATED, 'WhatsApp is not activated for this company: enter the activation code from VK first.', 'companyId');
    }
    return row;
  }

  /** The install key in clear, for one relay call. Never logged, never returned. */
  keyOf(row: WaConnection): string {
    return this.crypto.decrypt(row.wacKeyEnc);
  }

  /** WA_RELAY_URL at activation; later calls use the row's own relay. */
  relayUrlOrRefuse(): string {
    const raw = process.env.WA_RELAY_URL?.trim();
    if (!raw) {
      waRefuse(WA_CODES.RELAY_NOT_SET, 'WA_RELAY_URL is not set on this server.', 'WA_RELAY_URL');
    }
    return raw.replace(/\/+$/, '');
  }

  async setState(row: WaConnection, state: WacState, by: string): Promise<void> {
    if (row.wacState === state) return;
    await this.prisma.waConnection.update({
      where: { wacId: row.wacId },
      data: { wacState: state, wacModifiedOn: new Date(), wacModifiedBy: by.slice(0, 60) },
    });
    row.wacState = state;
  }

  /**
   * A relay refusal that says something about the CONNECTION moves the row
   * (plan §5.6): a revoked / unknown key and a suspended shop → SUSPENDED, a
   * shop that is not connected → DISCONNECTED.
   */
  async noteRelayError(row: WaConnection, error: unknown, by: string): Promise<void> {
    if (!(error instanceof WaRelayError)) return;
    try {
      if (error.waCode === WA_CODES.KEY_REVOKED || error.waCode === WA_CODES.SHOP_SUSPENDED) {
        await this.setState(row, 'SUSPENDED', by);
      } else if (error.waCode === WA_CODES.NOT_CONNECTED && row.wacState === 'CONNECTED') {
        await this.setState(row, 'DISCONNECTED', by);
      }
    } catch (e) {
      this.logger.warn(`could not record the relay's answer on wa_connection: ${String(e)}`);
    }
  }

  /** Decision 20 — poll every 10 s for 5 min after a send or a Connect. */
  async fastPoll(companyId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE public.wa_connection
         SET wac_fast_poll_until = GREATEST(COALESCE(wac_fast_poll_until, now()),
                                            now() + (${WA_POLL.FAST_WINDOW_MS / 1000}::int * interval '1 second'))
       WHERE wac_company_id = ${companyId}::uuid AND wac_is_deleted = false`;
  }

  /**
   * GET /v1/connection → wa_connection + wa_template. A template row whose
   * purpose / status / lang falls outside the CHECKs is skipped, not fatal (P1).
   * Templates the relay no longer lists are removed (it is a mirror).
   */
  async mirror(row: WaConnection, conn: RelayConnection, by: string): Promise<void> {
    const now = new Date();
    const limit = typeof conn.messagingLimit === 'number' ? conn.messagingLimit : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.waConnection.update({
        where: { wacId: row.wacId },
        data: {
          wacState: wacStateOf(conn.state),
          wacShopCode: (conn.shopCode ?? row.wacShopCode).slice(0, 12),
          wacDisplayName: conn.displayName?.slice(0, 150) ?? null,
          wacDisplayPhone: conn.displayPhone?.slice(0, 30) ?? null,
          wacWabaId: conn.wabaId?.slice(0, 40) ?? null,
          wacPhoneNumberId: conn.phoneNumberId?.slice(0, 40) ?? null,
          wacQuality: conn.qualityRating?.slice(0, 10) ?? null,
          wacMsgLimit: limit,
          wacConnectedOn: conn.connectedOn ? new Date(conn.connectedOn) : null,
          wacModifiedOn: now,
          wacModifiedBy: by.slice(0, 60),
        },
      });
      const keep: string[] = [];
      for (const t of conn.templates ?? []) {
        if (
          !PURPOSES.includes(t.purpose) ||
          !TPL_STATUSES.includes(t.status) ||
          !/^[a-z]{2}(_[A-Z]{2})?$/.test(t.lang ?? '') ||
          !t.name
        ) {
          this.logger.warn(`template ${t.name}/${t.lang} skipped: ${t.purpose} / ${t.status} is not in the mirror's lists`);
          continue;
        }
        keep.push(`${t.name}|${t.lang}`);
        const data = {
          watPurpose: t.purpose,
          watCategory: t.category?.slice(0, 20) ?? null,
          watStatus: t.status,
          watReason: t.reason?.slice(0, 300) ?? null,
          watBody: t.body ?? null,
          watParams: (t.params ?? []) as Prisma.InputJsonValue,
          watHeaderKind: t.headerKind === 'DOCUMENT' ? 'DOCUMENT' : 'NONE',
          watButtons: (t.buttons ?? []) as Prisma.InputJsonValue,
          watStatusOn: t.statusOn ? new Date(t.statusOn) : null,
          watPulledOn: now,
        };
        await tx.waTemplate.upsert({
          where: {
            watCompanyId_watName_watLang: { watCompanyId: row.wacCompanyId, watName: t.name, watLang: t.lang },
          },
          create: { watCompanyId: row.wacCompanyId, watName: t.name, watLang: t.lang, ...data },
          update: data,
        });
      }
      const existing = await tx.waTemplate.findMany({
        where: { watCompanyId: row.wacCompanyId },
        select: { watId: true, watName: true, watLang: true },
      });
      const gone = existing.filter((e) => !keep.includes(`${e.watName}|${e.watLang}`)).map((e) => e.watId);
      if (gone.length > 0) {
        await tx.waTemplate.deleteMany({ where: { watId: { in: gone } } });
      }
    });
    row.wacState = wacStateOf(conn.state);
  }

  async templates(companyId: string): Promise<TemplateMirror[]> {
    const rows = await this.prisma.waTemplate.findMany({
      where: { watCompanyId: companyId },
      orderBy: [{ watPurpose: 'asc' }, { watName: 'asc' }, { watLang: 'asc' }],
    });
    return rows.map((r) => ({
      name: r.watName,
      lang: r.watLang,
      status: r.watStatus,
      params: Array.isArray(r.watParams) ? (r.watParams as unknown[]).map(String) : [],
      headerKind: r.watHeaderKind,
    }));
  }

  /** The full template rows for /connection/get. */
  async templateRows(companyId: string) {
    const rows = await this.prisma.waTemplate.findMany({
      where: { watCompanyId: companyId },
      orderBy: [{ watPurpose: 'asc' }, { watName: 'asc' }, { watLang: 'asc' }],
    });
    return rows.map((r) => ({
      name: r.watName,
      lang: r.watLang,
      purpose: r.watPurpose,
      category: r.watCategory,
      status: r.watStatus,
      reason: r.watReason,
      body: r.watBody,
      params: r.watParams,
      headerKind: r.watHeaderKind,
      buttons: r.watButtons,
      statusOn: r.watStatusOn ? r.watStatusOn.toISOString() : null,
    }));
  }

  /** Unique numbers this company messaged since IST midnight (the 24-h tier counts new customers). */
  async usedToday(companyId: string): Promise<number> {
    const [r] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT wml_phone)::int AS n FROM public.wa_message_log
       WHERE wml_company_id = ${companyId}::uuid
         AND wml_status IN ('SENDING', 'SENT', 'DELIVERED', 'READ')
         AND wml_kind <> 'TEST'
         AND wml_created_on >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;
    return r?.n ?? 0;
  }
}
