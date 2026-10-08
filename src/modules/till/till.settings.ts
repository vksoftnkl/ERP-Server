import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from '../settings/appSettings/types/app-settings-api.types';
import { TillFloatMode, TillSettingKey } from './types/till-enum';

/**
 * The `till.*` settings (47 §10.3, 48 §8), read through
 * `AppSettingValueService.resolveEffective` — GLOBAL < COMPANY < BRANCH <
 * DEVICE < USER — and never from app_setting_value directly, so the precedence
 * the screens show is the one the server acts on. Approval THRESHOLDS are not
 * here: they are till_approval_rule rows.
 */
export interface TillSettings {
  /** Billing on this device needs an open till session (DEVICE scope). */
  requireSession: boolean;
  /** 'HH:MM' — sales before it belong to the previous business date. */
  dayCutoff: string;
  /** The first session opens the business day; false = a manager's Day Open. */
  dayAutoOpen: boolean;
  /** How a session's opening float arrives when the open does not say. */
  floatMode: TillFloatMode.ISSUED | TillFloatMode.CARRIED;
  /** The cashier counts without seeing what the system expects. */
  blindClose: boolean;
  /** Recounts allowed before the variance stands (attempts = 1 + this). */
  maxRecounts: number;
  countPlace: 'COUNTER' | 'CASH_OFFICE';
  /** A cash gap up to this is WITHIN_TOLERANCE: posted, no approval. */
  cashTolerance: Prisma.Decimal;
  noncashTolerance: Prisma.Decimal;
  /** RELEASE = held bills go to the branch pool at end billing; BLOCK = refused. */
  closeWithHolds: 'BLOCK' | 'RELEASE';
  sessionMaxHours: number;
  /** Every approval allows self-approval (owner-cashier). */
  singleOperator: boolean;
  /** Receipts, payments and expenses carry the live session (48). */
  moneyDocsInSession: boolean;
  /**
   * 48 §2.3 — cash on a back-office device (no session) in a branch that runs a
   * till: SAFE = from / into the branch's default safe; REFUSE = not at all.
   */
  backofficeCashFrom: 'SAFE' | 'REFUSE';
  /**
   * Non-cash plan §4.1 (`tender.close_by_terminal`, BRANCH) — a card batch is
   * counted per terminal: a slip line must name its tender when the session
   * took that kind of money on more than one.
   */
  closeByTerminal: boolean;
}

export const TILL_SETTING_DEFAULTS: TillSettings = {
  requireSession: true,
  dayCutoff: '04:00',
  dayAutoOpen: true,
  floatMode: TillFloatMode.ISSUED,
  blindClose: true,
  maxRecounts: 1,
  countPlace: 'COUNTER',
  cashTolerance: new Prisma.Decimal(10),
  noncashTolerance: new Prisma.Decimal(0),
  closeWithHolds: 'RELEASE',
  sessionMaxHours: 14,
  singleOperator: false,
  moneyDocsInSession: true,
  backofficeCashFrom: 'SAFE',
  closeByTerminal: true,
};

export function readTillSettings(effective: readonly AppSettingEffectiveItem[]): TillSettings {
  const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));
  const d = TILL_SETTING_DEFAULTS;
  return {
    requireSession: pickBoolean(byKey.get(TillSettingKey.REQUIRE_SESSION), d.requireSession),
    dayCutoff: pickClock(byKey.get(TillSettingKey.DAY_CUTOFF), d.dayCutoff),
    dayAutoOpen: pickBoolean(byKey.get(TillSettingKey.DAY_AUTO_OPEN), d.dayAutoOpen),
    floatMode: pickEnum(
      byKey.get(TillSettingKey.FLOAT_MODE),
      [TillFloatMode.ISSUED, TillFloatMode.CARRIED] as const,
      d.floatMode,
    ),
    blindClose: pickBoolean(byKey.get(TillSettingKey.BLIND_CLOSE), d.blindClose),
    maxRecounts: pickInt(byKey.get(TillSettingKey.MAX_RECOUNTS), d.maxRecounts),
    countPlace: pickEnum(
      byKey.get(TillSettingKey.COUNT_PLACE),
      ['COUNTER', 'CASH_OFFICE'] as const,
      d.countPlace,
    ),
    cashTolerance: pickDecimal(byKey.get(TillSettingKey.CASH_TOLERANCE), d.cashTolerance),
    noncashTolerance: pickDecimal(byKey.get(TillSettingKey.NONCASH_TOLERANCE), d.noncashTolerance),
    closeWithHolds: pickEnum(
      byKey.get(TillSettingKey.CLOSE_WITH_HOLDS),
      ['BLOCK', 'RELEASE'] as const,
      d.closeWithHolds,
    ),
    sessionMaxHours: pickInt(byKey.get(TillSettingKey.SESSION_MAX_HOURS), d.sessionMaxHours),
    singleOperator: pickBoolean(byKey.get(TillSettingKey.SINGLE_OPERATOR), d.singleOperator),
    moneyDocsInSession: pickBoolean(
      byKey.get(TillSettingKey.MONEY_DOCS_IN_SESSION),
      d.moneyDocsInSession,
    ),
    backofficeCashFrom: pickEnum(
      byKey.get(TillSettingKey.BACKOFFICE_CASH_FROM),
      ['SAFE', 'REFUSE'] as const,
      d.backofficeCashFrom,
    ),
    closeByTerminal: pickBoolean(byKey.get(TillSettingKey.CLOSE_BY_TERMINAL), d.closeByTerminal),
  };
}

function pickEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const token = value?.trim().toUpperCase();
  return token && (allowed as readonly string[]).includes(token) ? (token as T) : fallback;
}

function pickBoolean(value: string | null | undefined, fallback: boolean): boolean {
  const token = value?.trim().toLowerCase();
  if (token === undefined || token === '') {
    return fallback;
  }
  if (['true', '1', 'yes', 'y', 'on'].includes(token)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(token)) {
    return false;
  }
  return fallback;
}

function pickInt(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt(value?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function pickDecimal(value: string | null | undefined, fallback: Prisma.Decimal): Prisma.Decimal {
  const token = value?.trim();
  if (!token) {
    return fallback;
  }
  try {
    const parsed = new Prisma.Decimal(token);
    return parsed.isNegative() || !parsed.isFinite() ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/** 'H:MM' / 'HH:MM', 00:00–23:59; anything else falls back. */
function pickClock(value: string | null | undefined, fallback: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? '');
  if (!match) {
    return fallback;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return fallback;
  }
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}
