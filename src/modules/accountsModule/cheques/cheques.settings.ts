import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from 'src/modules/settings/appSettings/types/app-settings-api.types';
import { ChequeSettingKey, DEFAULT_BOUNCE_REASONS } from './types/cheque-enum';

/**
 * §2.2's two settings, picked out of what
 * `AppSettingValueService.resolveEffective` answered.
 *
 * Reading goes through the resolver and never through `app_setting_value`
 * directly — the same rule the receipt module states and for the same reason:
 * the resolver applies the GLOBAL < COMPANY < BRANCH < DEVICE < USER
 * precedence that `public.fn_app_settings_effective` defines, and re-merging it
 * here would make this screen and the settings screen disagree about what is
 * configured, which is worse than having no setting at all.
 *
 * Both getters fall back to the SEEDED default rather than to an extreme. A
 * blank value, a malformed JSON array, or a key on a database one migration
 * behind must not stop an operator recording a bounce the bank has already
 * made.
 *
 * ── `accounts.pdc_posting_mode` is NOT read here ──────────────────────────
 * Deliberately, and it is §5's second rule: the posting mode is honoured PER
 * ROW, off `apd_posting_mode`, not per setting. A cheque taken in March under
 * ON_RECEIPT keeps posting that way after somebody flips the setting in April,
 * because the receipt that took it in has already posted. Reading the setting
 * here would make every cheque in the drawer change behaviour on the day the
 * setting changed.
 */

export interface ChequeSettings {
  /** Pre-filled into the bounce panel's "charge the party" box. */
  bounceChargeToParty: Prisma.Decimal;
  /** Offered by the bounce panel. A PRE-FILL, not a whitelist — see below. */
  bounceReasons: string[];
}

export const CHEQUE_SETTING_DEFAULTS: ChequeSettings = {
  // Zero, not a figure: a charge the customer was never told about is a
  // dispute, so the safe end of this setting is the one where a human types it
  // every time. Raising it is a deliberate act.
  bounceChargeToParty: new Prisma.Decimal(0),
  bounceReasons: [...DEFAULT_BOUNCE_REASONS],
};

export function readChequeSettings(effective: readonly AppSettingEffectiveItem[]): ChequeSettings {
  const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));

  return {
    bounceChargeToParty: pickDecimal(
      byKey.get(ChequeSettingKey.BOUNCE_CHARGE_TO_PARTY),
      CHEQUE_SETTING_DEFAULTS.bounceChargeToParty,
    ),
    bounceReasons: pickStringList(
      byKey.get(ChequeSettingKey.BOUNCE_REASONS),
      CHEQUE_SETTING_DEFAULTS.bounceReasons,
    ),
  };
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

/**
 * `public.app_setting_value` stores everything as text, so a JSON setting
 * arrives as the text of an array.
 *
 * A value that will not parse, or parses to something that is not a list of
 * non-blank strings, falls back to the seeded list rather than to an empty
 * one. An empty dropdown is indistinguishable from a broken screen, and the
 * operator would have nothing to pick — while the seeded seven are right for
 * almost every bounce that actually happens.
 */
function pickStringList(value: string | null | undefined, fallback: string[]): string[] {
  const token = value?.trim();
  if (!token) {
    return [...fallback];
  }
  try {
    const parsed: unknown = JSON.parse(token);
    if (!Array.isArray(parsed)) {
      return [...fallback];
    }
    const reasons = parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return reasons.length > 0 ? reasons : [...fallback];
  } catch {
    return [...fallback];
  }
}
