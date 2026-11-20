import { Injectable } from '@nestjs/common';
import { WaCryptoService } from './wa-crypto.service';
import { WA_HOUSE_CODES, WaRelayError, waRefuse } from './wa-errors';
import { WaEventsService } from './wa-events.service';
import { WaRelayClient } from './wa-relay.client';
import { WaSendService, type WaSendOutcome } from './wa-send.service';
import { WaSettingsService } from './wa-settings.service';
import { WaStore } from './wa-store.service';
import { WA_CODES, WA_MENU, type WaConnectionState } from './wa.constants';

/** Names go into the template text at Connect (relay rule): no braces, no line breaks. */
function cleanName(v: string | null | undefined, max: number): string | null {
  const t = (v ?? '').replace(/[{}\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}
const cut = (v: string | null | undefined, max: number): string | null => {
  const t = (v ?? '').trim();
  return t ? t.slice(0, max) : null;
};

/**
 * Plan §5.3 "307: connection and settings" — activate with VK's code, Connect
 * (a one-time link to the relay's Embedded Signup page), refresh, disconnect,
 * rotate the key, send a test. The relay's install key is stored encrypted
 * (WA_CRED_KEY) and never returned: only its first 8 characters.
 */
@Injectable()
export class WaConnectionService {
  constructor(
    private readonly store: WaStore,
    private readonly relay: WaRelayClient,
    private readonly crypto: WaCryptoService,
    private readonly events: WaEventsService,
    private readonly sends: WaSendService,
    private readonly settings: WaSettingsService,
  ) {}

  async get(companyId: string) {
    await this.store.right(WA_MENU.WHATSAPP, 'view', 'open WhatsApp settings');
    return this.view(companyId);
  }

  private async view(companyId: string) {
    const [row, settings] = await Promise.all([this.store.row(companyId), this.settings.read(companyId)]);
    const relayUrl = row?.wacRelayUrl ?? this.relay.configuredUrl();
    const [templates, usedToday, relayReachable] = await Promise.all([
      row ? this.store.templateRows(companyId) : Promise.resolve([]),
      row ? this.store.usedToday(companyId) : Promise.resolve(0),
      relayUrl ? this.relay.healthy(relayUrl) : Promise.resolve(false),
    ]);
    const state: WaConnectionState = row ? (row.wacState as WaConnectionState) : 'NOT_ACTIVATED';
    return {
      companyId,
      state,
      shopCode: row?.wacShopCode ?? null,
      keyPrefix: row?.wacKeyPrefix ?? null,
      displayName: row?.wacDisplayName ?? null,
      displayPhone: row?.wacDisplayPhone ?? null,
      wabaId: row?.wacWabaId ?? null,
      phoneNumberId: row?.wacPhoneNumberId ?? null,
      qualityRating: row?.wacQuality ?? null,
      messagingLimit: row?.wacMsgLimit ?? null,
      usedToday,
      connectedOn: row?.wacConnectedOn?.toISOString() ?? null,
      lastPollOn: row?.wacLastPollOn?.toISOString() ?? null,
      lastPollError: row?.wacLastPollError ?? null,
      relayReachable,
      fallbackClickToChat: settings.fallbackClickToChat,
      templates,
    };
  }

  /**
   * POST /connection/activate — VK's one-time code → the relay's install key.
   *
   * A company that already has a healthy (not SUSPENDED) row answers 409
   * WA_ALREADY_ACTIVATED *without spending the code*, unless the request says
   * `replace: true` — VK's re-key / recovery code (wa-relay-keys §1) then goes
   * through and the new key replaces the old one. A SUSPENDED row (key revoked,
   * shop paused) takes a new code without asking.
   */
  async activate(dto: { companyId: string; activationCode: string; replace?: boolean }) {
    await this.store.right(WA_MENU.WHATSAPP, 'edit', 'activate WhatsApp');
    this.store.assertMainServer();
    if (!(await this.store.companyExists(dto.companyId))) {
      // Review N9 — the house "Company not found" (404), not the WhatsApp document code.
      waRefuse(WA_HOUSE_CODES.COMPANY_NOT_FOUND, `No company ${dto.companyId}`, 'companyId');
    }
    const relayUrl = this.store.relayUrlOrRefuse();
    if (!this.crypto.isConfigured()) {
      waRefuse(WA_CODES.KEY_MISSING, 'WA_CRED_KEY is not set on this server', 'WA_CRED_KEY');
    }
    // Proves the key works before the relay hands out a key we could not store.
    this.crypto.encrypt('probe');
    const existing = await this.store.row(dto.companyId);
    if (existing && existing.wacState !== 'SUSPENDED' && dto.replace !== true) {
      waRefuse(
        WA_CODES.ALREADY_ACTIVATED,
        `WhatsApp is already activated here (shop ${existing.wacShopCode}, key ${existing.wacKeyPrefix}…). ` +
          'Send replace: true to use this code in its place (VK re-key / recovery).',
        'activationCode',
        { state: existing.wacState, shopCode: existing.wacShopCode },
      );
    }
    const actor = await this.store.actor();
    const company = await this.companyInfo(dto.companyId);
    const issued = await this.callRelay(null, () =>
      this.relay.activate(relayUrl, {
        activationCode: dto.activationCode,
        installLabel: cut(`${company.displayName ?? 'ERP'} · ERP server`, 100),
        erpVersion: cut(process.env.APP_VERSION, 40),
      }),
    );
    const keyEnc = this.crypto.encrypt(issued.apiKey);
    const now = new Date();
    const data = {
      wacState: 'ACTIVATED',
      wacRelayUrl: relayUrl.slice(0, 200),
      wacShopCode: issued.shopCode.slice(0, 12),
      wacInstallId: issued.installId,
      wacKeyEnc: keyEnc,
      wacKeyVersion: this.crypto.currentVersion(),
      wacKeyPrefix: issued.keyPrefix.slice(0, 12),
      wacKeyIssuedOn: now,
      wacLastPollError: null,
    };
    const row = existing
      ? await this.store.prisma.waConnection.update({
          where: { wacId: existing.wacId },
          data: {
            ...data,
            // A different install (a new shop) starts its own event stream.
            ...(existing.wacInstallId !== issued.installId ? { wacEventCursor: BigInt(0) } : {}),
            wacModifiedOn: now,
            wacModifiedBy: actor.userName,
          },
        })
      : await this.store.prisma.waConnection.create({
          data: { ...data, wacCompanyId: dto.companyId, wacCreatedOn: now, wacCreatedBy: actor.userName },
        });
    // The relay's own state (a re-keyed install may already be CONNECTED) and templates.
    try {
      const conn = await this.relay.connection(row.wacRelayUrl, issued.apiKey);
      await this.store.mirror(row, conn, actor.userName);
    } catch {
      /* the poller / refresh settles it */
    }
    const fresh = await this.store.row(dto.companyId);
    return { state: fresh?.wacState ?? 'ACTIVATED', shopCode: issued.shopCode, keyPrefix: issued.keyPrefix };
  }

  /** POST /connection/connect-start — a 15-minute link to the relay's Embedded Signup page. */
  async connectStart(dto: { companyId: string }) {
    await this.store.right(WA_MENU.WHATSAPP, 'edit', 'connect WhatsApp');
    this.store.assertMainServer();
    const row = await this.store.rowOrRefuse(dto.companyId);
    if (row.wacState === 'CONNECTED') {
      waRefuse(WA_CODES.ALREADY_CONNECTED, `This company's number ${row.wacDisplayPhone ?? ''} is already connected`, 'companyId');
    }
    const actor = await this.store.actor();
    const info = await this.companyInfo(dto.companyId);
    const key = this.store.keyOf(row);
    const res = await this.callRelay(row, () =>
      this.relay.connectCode(row.wacRelayUrl, key, {
        requestedBy: actor.userName.slice(0, 60),
        shopInfo: {
          legalName: info.legalName ?? info.displayName ?? 'Shop',
          displayName: info.displayName ?? info.legalName ?? 'Shop',
          addrLine: info.addrLine,
          city: info.city,
          state: info.state,
          pincode: info.pincode,
          phone: info.phone,
          email: info.email,
          website: info.website,
        },
      }),
    );
    await this.store.setState(row, 'CONNECTING', actor.userName);
    await this.store.fastPoll(dto.companyId);
    return { connectUrl: res.url, expiresAt: res.expiresAt };
  }

  /** POST /connection/refresh — pull the connection + events now; answers as /get. */
  async refresh(dto: { companyId: string }) {
    await this.store.right(WA_MENU.WHATSAPP, 'view', 'refresh WhatsApp');
    const row = await this.store.row(dto.companyId);
    if (row && !this.store.offlineSite()) {
      await this.callRelay(row, () => this.events.pullOnce(dto.companyId, { force: true }));
    }
    return this.view(dto.companyId);
  }

  async disconnect(dto: { companyId: string; reason?: string | null }) {
    await this.store.right(WA_MENU.WHATSAPP, 'edit', 'disconnect WhatsApp');
    this.store.assertMainServer();
    const row = await this.store.rowOrRefuse(dto.companyId);
    const actor = await this.store.actor();
    const key = this.store.keyOf(row);
    await this.callRelay(row, () =>
      this.relay.disconnect(row.wacRelayUrl, key, {
        requestedBy: actor.userName.slice(0, 60),
        reason: cut(dto.reason, 200),
      }),
    );
    await this.store.prisma.waConnection.update({
      where: { wacId: row.wacId },
      data: { wacState: 'DISCONNECTED', wacConnectedOn: null, wacModifiedOn: new Date(), wacModifiedBy: actor.userName },
    });
    return { state: 'DISCONNECTED' as const };
  }

  /** POST /connection/rotate-key — a new install key; the old one works 24 h at the relay. */
  async rotateKey(dto: { companyId: string }) {
    await this.store.right(WA_MENU.WHATSAPP, 'edit', 'rotate the WhatsApp key');
    this.store.assertMainServer();
    const row = await this.store.rowOrRefuse(dto.companyId);
    const actor = await this.store.actor();
    const key = this.store.keyOf(row);
    const res = await this.callRelay(row, () => this.relay.rotate(row.wacRelayUrl, key));
    const now = new Date();
    await this.store.prisma.waConnection.update({
      where: { wacId: row.wacId },
      data: {
        wacKeyEnc: this.crypto.encrypt(res.apiKey),
        wacKeyVersion: this.crypto.currentVersion(),
        wacKeyPrefix: res.keyPrefix.slice(0, 12),
        wacKeyIssuedOn: now,
        wacModifiedOn: now,
        wacModifiedBy: actor.userName,
      },
    });
    return { keyPrefix: res.keyPrefix, rotatedOn: now.toISOString(), oldKeyValidUntil: res.oldKeyValidUntil };
  }

  /** POST /connection/test — hello_world to a typed number (307 View, Q13), synchronous. */
  async test(dto: { companyId: string; phone: string }): Promise<WaSendOutcome> {
    await this.store.right(WA_MENU.WHATSAPP, 'view', 'send a WhatsApp test');
    this.store.assertMainServer();
    const actor = await this.store.actor();
    const prepared = await this.sends.prepareTest({ companyId: dto.companyId, phone: dto.phone, actor });
    return this.sends.deliverForAnswer(prepared);
  }

  /** A relay call whose failure is the route's refusal (with its ERP code); the row learns from it. */
  private async callRelay<T>(row: Parameters<WaStore['noteRelayError']>[0] | null, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof WaRelayError) {
        if (row) await this.store.noteRelayError(row, error, 'route');
        waRefuse(error.waCode, error.message, error.relay.field ?? 'request', {
          relayCode: error.relay.relayCode,
        });
      }
      throw error;
    }
  }

  /** The /shop page's facts, from companys (§4.3 connect-codes shopInfo). */
  private async companyInfo(companyId: string) {
    const [c] = await this.store.prisma.$queryRaw<
      {
        comp_name: string | null;
        comp_legal_name: string | null;
        addr: string | null;
        comp_city: string | null;
        comp_state: string | null;
        comp_pin: number | null;
        phone: string | null;
        email: string | null;
        comp_website_name: string | null;
      }[]
    >`
      SELECT comp_name, comp_legal_name,
             concat_ws(', ', NULLIF(btrim(comp_addr1), ''), NULLIF(btrim(comp_addr2), ''), NULLIF(btrim(comp_addr3), '')) AS addr,
             comp_city, comp_state, comp_pin,
             COALESCE(NULLIF(btrim(comp_phone), ''), NULLIF(btrim(comp_tel), '')) AS phone,
             COALESCE(NULLIF(btrim(comp_mail), ''), NULLIF(btrim(comp_support_email), '')) AS email,
             comp_website_name
        FROM public.companys WHERE comp_id = ${companyId}::uuid`;
    return {
      legalName: cleanName(c?.comp_legal_name ?? c?.comp_name, 150),
      displayName: cleanName(c?.comp_name ?? c?.comp_legal_name, 100),
      addrLine: cut(c?.addr, 300),
      city: cut(c?.comp_city, 60),
      state: cut(c?.comp_state, 60),
      pincode: c?.comp_pin ? String(c.comp_pin).slice(0, 10) : null,
      phone: cut(c?.phone, 20),
      email: cut(c?.email, 120),
      website: cut(c?.comp_website_name, 200),
    };
  }
}
