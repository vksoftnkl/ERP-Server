import type { AppSettingEffectiveItem } from "../../settings/appSettings/types/app-settings-api.types";
import { type BelowCostAction, type BelowCostPolicy } from './types/selling-price-bulk.types';
export declare function resolveBelowCostPolicy(effective: readonly AppSettingEffectiveItem[]): BelowCostPolicy;
export declare function resolveBelowCostAction(policy: BelowCostPolicy, confirmed: boolean): BelowCostAction;
