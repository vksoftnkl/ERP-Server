import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from '../../settings/appSettings/types/app-settings-api.types';
export interface TenderSettings {
    duplicateRef: 'BLOCK' | 'WARN';
    closeByTerminal: boolean;
    matchWindowMinutes: number;
    matchAmountTolerance: Prisma.Decimal;
    settleGraceDays: number;
}
export declare const TENDER_SETTING_DEFAULTS: TenderSettings;
export declare function readTenderSettings(effective: readonly AppSettingEffectiveItem[]): TenderSettings;
