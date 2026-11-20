import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AppSettingValueService } from '../settings/appSettings/app-setting-value.service';
import { AppSettingScope, type AppSettingEffectiveItem } from '../settings/appSettings/types/app-settings-api.types';
import { waRefuseMany, type WaErrorDetail } from './wa-errors';
import { WA_CODES, WA_ON_POST_SERVED, WA_SETTING, WA_TEMPLATE_OF_KIND } from './wa.constants';

/**
 * §5.3 /whatsapp/settings — the whatsapp.* company settings this build uses.
 * Scope cut 17/11: the reminder settings (gap, hours, bulk size) stay seeded
 * but are not read or offered until payment reminders are built.
 */
export interface WaSettings {
  defaultLanguage: 'en' | 'ta';
  ratePerMessage: Prisma.Decimal;
  rateGstPercent: Prisma.Decimal;
  fallbackClickToChat: boolean;
  logRetentionYears: number;
}

export interface WaOnPostType {
  vchrTypeId: number;
  vchrTypeName: string;
  vchrParentId: number | null;
  kind: 'ORDER';
  templateName: string;
  on: boolean;
}

/** The catalogue defaults (app_setting_def), used when a stored value is unusable. */
export const WA_SETTING_DEFAULTS: WaSettings = {
  defaultLanguage: 'en',
  ratePerMessage: new Prisma.Decimal('0.115'),
  rateGstPercent: new Prisma.Decimal('18'),
  fallbackClickToChat: true,
  logRetentionYears: 2,
};

function intIn(v: unknown, min: number, max: number): number | null {
  const raw = String(v ?? '').trim();
  const t = typeof v === 'number' ? v : Number(raw);
  return raw !== '' && Number.isInteger(t) && t >= min && t <= max ? t : null;
}

function decIn(v: unknown, min: number, max: number | null, places: number): Prisma.Decimal | null {
  const t = String(v ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const d = new Prisma.Decimal(t);
  if (d.lessThan(min) || (max !== null && d.greaterThan(max)) || d.decimalPlaces() > places) return null;
  return d;
}

function boolOf(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const t = String(v ?? '').trim().toLowerCase();
  return t === 'true' || t === '1' ? true : t === 'false' || t === '0' ? false : null;
}

/**
 * Review S7 — a stored whatsapp.on_post_types value: a JSON array of voucher
 * type ids, e.g. "[4]". Anything else (empty, not JSON, not an array, a
 * non-integer member) reads as no type rather than failing a post.
 */
export function parseOnPostTypes(raw: string | null | undefined): number[] {
  const t = (raw ?? '').trim();
  if (!t) return [];
  let v: unknown;
  try {
    v = JSON.parse(t);
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  const ids = v.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0);
  return [...new Set(ids)].sort((a, b) => a - b);
}

/** The company's "WhatsApp on Post" list, and whether the setting exists on this database at all. */
export interface WaOnPostSetting {
  ids: number[];
  /** False until migration 20261119190000_whatsapp_on_post_company is applied (no app_setting_def row). */
  defined: boolean;
}

@Injectable()
export class WaSettingsService {
  private readonly logger = new Logger(WaSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettings: AppSettingValueService,
  ) {}

  /**
   * The company's effective whatsapp.* values. A value App Settings (246) let
   * through that this module cannot use reads as the default rather than
   * failing a send.
   */
  async read(companyId: string): Promise<WaSettings> {
    return this.valuesOf(await this.appSettings.resolveEffective({ companyId }));
  }

  private valuesOf(effective: AppSettingEffectiveItem[]): WaSettings {
    const v = (key: string) => effective.find((i) => i.asdKey === key)?.value ?? null;
    const d = WA_SETTING_DEFAULTS;
    const lang = (v(WA_SETTING.DEFAULT_LANGUAGE) ?? '').trim().toLowerCase();
    return {
      defaultLanguage: lang === 'ta' ? 'ta' : 'en',
      ratePerMessage: decIn(v(WA_SETTING.RATE), 0, null, 4) ?? d.ratePerMessage,
      rateGstPercent: decIn(v(WA_SETTING.GST), 0, 100, 2) ?? d.rateGstPercent,
      fallbackClickToChat: boolOf(v(WA_SETTING.FALLBACK)) ?? d.fallbackClickToChat,
      logRetentionYears: intIn(v(WA_SETTING.RETENTION_YEARS), 1, 10) ?? d.logRetentionYears,
    };
  }

  /**
   * Review S7 — the voucher types this company sends on post: the COMPANY
   * value of whatsapp.on_post_types, else the GLOBAL one, else the default []
   * (fn_app_settings_effective's precedence). A missing def (migration not
   * applied) or a value that is not an int array is [] — never an error.
   */
  async onPostSetting(companyId: string): Promise<WaOnPostSetting> {
    return this.onPostOf(await this.appSettings.resolveEffective({ companyId }));
  }

  private onPostOf(effective: AppSettingEffectiveItem[]): WaOnPostSetting {
    const item = effective.find((i) => i.asdKey === WA_SETTING.ON_POST_TYPES);
    if (!item) return { ids: [], defined: false };
    const ids = parseOnPostTypes(item.value);
    if (ids.length === 0 && (item.value ?? '').trim() !== '' && (item.value ?? '').replace(/\s/g, '') !== '[]') {
      this.logger.warn(`${WA_SETTING.ON_POST_TYPES} = ${item.value} is not a list of voucher type ids: read as []`);
    }
    return { ids, defined: true };
  }

  /** The on-post ticks this build serves (Sales Order (4) only, scope cut 17/11), each with the company's choice. */
  async onPostTypes(companyId: string, setting?: WaOnPostSetting): Promise<WaOnPostType[]> {
    const { ids } = setting ?? (await this.onPostSetting(companyId));
    const rows = await this.prisma.$queryRaw<
      { vchr_type_id: number; vchr_type_name: string; vchr_parent_id: number | null }[]
    >`
      SELECT vchr_type_id, vchr_type_name, vchr_parent_id
        FROM accounts.acc_voucher_types
       WHERE vchr_type_id = ANY(${[...WA_ON_POST_SERVED]}::int[])
       ORDER BY vchr_type_id`;
    return rows.map((r) => ({
      vchrTypeId: r.vchr_type_id,
      vchrTypeName: r.vchr_type_name,
      vchrParentId: r.vchr_parent_id,
      kind: 'ORDER' as const,
      templateName: WA_TEMPLATE_OF_KIND.ORDER,
      on: ids.includes(r.vchr_type_id),
    }));
  }

  /** The /get answer. */
  async get(companyId: string) {
    const effective = await this.appSettings.resolveEffective({ companyId });
    const onPostTypes = await this.onPostTypes(companyId, this.onPostOf(effective));
    return { companyId, ...this.view(this.valuesOf(effective)), onPostTypes };
  }

  view(s: WaSettings) {
    return {
      defaultLanguage: s.defaultLanguage,
      ratePerMessage: s.ratePerMessage.toFixed(4),
      rateGstPercent: s.rateGstPercent.toFixed(2),
      fallbackClickToChat: s.fallbackClickToChat,
      logRetentionYears: s.logRetentionYears,
    };
  }

  /**
   * POST /whatsapp/settings/save — every key optional; each bad one is a
   * WA_SETTING_INVALID with `field` = the key (the wording variants
   * field=<key>). All are judged before anything is written. Every value,
   * the on-post ticks included (review S7: whatsapp.on_post_types, a JSON
   * list of voucher type ids), is a COMPANY override written in ONE
   * AppSettingValueService.save — one transaction, audited there; an update
   * re-dirties asv_sync_date (zz_sync_mark_dirty).
   */
  async save(
    companyId: string,
    dto: Record<string, unknown> & { onPostTypes?: { vchrTypeId: number; on: boolean }[] },
  ) {
    const bad: WaErrorDetail[] = [];
    const say = (field: string, message: string) => bad.push({ field, code: WA_CODES.SETTING_INVALID, message });
    const writes: { key: string; value: string }[] = [];
    const has = (k: string) => dto[k] !== undefined;

    if (has('defaultLanguage')) {
      const l = String(dto.defaultLanguage ?? '').trim().toLowerCase();
      if (l !== 'en' && l !== 'ta') say('defaultLanguage', 'Message language must be en or ta');
      else writes.push({ key: WA_SETTING.DEFAULT_LANGUAGE, value: l });
    }
    if (has('ratePerMessage')) {
      const r = decIn(dto.ratePerMessage, 0, 9999, 4);
      if (r === null) say('ratePerMessage', 'Rate per message must be 0 or more, at most 4 decimals');
      else writes.push({ key: WA_SETTING.RATE, value: r.toString() });
    }
    if (has('rateGstPercent')) {
      const g = decIn(dto.rateGstPercent, 0, 100, 2);
      if (g === null) say('rateGstPercent', 'GST % must be from 0 to 100, at most 2 decimals');
      else writes.push({ key: WA_SETTING.GST, value: g.toString() });
    }
    if (has('fallbackClickToChat')) {
      const b = boolOf(dto.fallbackClickToChat);
      if (b === null) say('fallbackClickToChat', 'fallbackClickToChat must be true or false');
      else writes.push({ key: WA_SETTING.FALLBACK, value: String(b) });
    }
    if (has('logRetentionYears')) {
      const n = intIn(dto.logRetentionYears, 1, 10);
      if (n === null) say('logRetentionYears', 'Keep message details for 1 to 10 years');
      else writes.push({ key: WA_SETTING.RETENTION_YEARS, value: String(n) });
    }
    if (dto.onPostTypes !== undefined) {
      const current = await this.onPostSetting(companyId);
      const allowed = await this.onPostTypes(companyId, current);
      const next = new Set(current.ids);
      for (const [i, t] of (dto.onPostTypes ?? []).entries()) {
        const hit = allowed.find((a) => a.vchrTypeId === t?.vchrTypeId);
        if (!hit) {
          say(
            'onPostTypes',
            `onPostTypes[${i}]: voucher type ${String(t?.vchrTypeId)} cannot send WhatsApp on post in this version (allowed: ${allowed
              .map((a) => a.vchrTypeId)
              .join(', ')})`,
          );
        } else if (t.on) {
          next.add(hit.vchrTypeId);
        } else {
          next.delete(hit.vchrTypeId);
        }
      }
      if (!current.defined) {
        say(
          'onPostTypes',
          `WhatsApp on Post cannot be saved yet: the setting ${WA_SETTING.ON_POST_TYPES} is not on this database ` +
            '(migration 20261119190000_whatsapp_on_post_company)',
        );
      } else {
        // Types this build does not serve (set in App Settings) stay in the list as they are.
        const ids = [...next].sort((a, b) => a - b);
        if (ids.join(',') !== current.ids.join(',')) {
          writes.push({ key: WA_SETTING.ON_POST_TYPES, value: JSON.stringify(ids) });
        }
      }
    }
    if (bad.length > 0) {
      waRefuseMany('WhatsApp settings not saved', bad);
    }
    if (writes.length > 0) {
      await this.appSettings.save(
        writes.map((w) => ({
          asvSettingKey: w.key,
          asvScope: AppSettingScope.COMPANY,
          asvCompanyId: companyId,
          asvValue: w.value,
          asvRemarks: 'WhatsApp settings (307)',
        })),
      );
    }
    return this.get(companyId);
  }
}
