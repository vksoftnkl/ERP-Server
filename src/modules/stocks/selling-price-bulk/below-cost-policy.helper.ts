import type { AppSettingEffectiveItem } from 'src/modules/settings/appSettings/types/app-settings-api.types';
import {
  BELOW_COST_POLICIES,
  BELOW_COST_PRICE_SETTING_KEY,
  DEFAULT_BELOW_COST_POLICY,
  type BelowCostAction,
  type BelowCostPolicy,
} from './types/selling-price-bulk.types';

/**
 * Pick `inventory.below_cost_price` out of what
 * `AppSettingValueService.resolveEffective` answered.
 *
 * resolveEffective returns the WHOLE catalog with the five-layer precedence
 * (GLOBAL < COMPANY < BRANCH < DEVICE < USER) already applied, which is the
 * only reason this module may read a setting at all: re-merging that precedence
 * in TypeScript would make the pricing screen and the settings screen disagree
 * about what is allowed, which is worse than having no rule.
 *
 * An absent key, a blank value or a token outside the catalog's own three falls
 * back to the SEEDED default rather than to either extreme. `restrict` would
 * lock the screen over a data error the operator cannot see or fix; `allow`
 * would silently disable the rule. `warning` shows the rows and asks.
 */
export function resolveBelowCostPolicy(
  effective: readonly AppSettingEffectiveItem[],
): BelowCostPolicy {
  const item = effective.find((entry) => entry.asdKey === BELOW_COST_PRICE_SETTING_KEY);
  const value = item?.value?.trim().toLowerCase();
  return (BELOW_COST_POLICIES as readonly string[]).includes(value ?? '')
    ? (value as BelowCostPolicy)
    : DEFAULT_BELOW_COST_POLICY;
}

/**
 * §0.3's table — what the policy comes to for THIS request.
 *
 * `confirmed` is only ever consulted under `warning`. Under `restrict` there is
 * nothing to confirm: the setting says the price may not be entered, and a
 * confirm flag that overrode it would make `restrict` and `warning` the same
 * setting with two names.
 */
export function resolveBelowCostAction(
  policy: BelowCostPolicy,
  confirmed: boolean,
): BelowCostAction {
  switch (policy) {
    case 'restrict':
      return 'ABORT';
    case 'allow':
      return 'PROCEED';
    case 'warning':
    default:
      return confirmed ? 'PROCEED' : 'CONFIRM';
  }
}
