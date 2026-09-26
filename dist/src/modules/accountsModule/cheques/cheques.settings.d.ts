import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from "../../settings/appSettings/types/app-settings-api.types";
export interface ChequeSettings {
    bounceChargeToParty: Prisma.Decimal;
    bounceReasons: string[];
}
export declare const CHEQUE_SETTING_DEFAULTS: ChequeSettings;
export declare function readChequeSettings(effective: readonly AppSettingEffectiveItem[]): ChequeSettings;
