import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from '../settings/appSettings/types/app-settings-api.types';
import { TillFloatMode } from './types/till-enum';
export interface TillSettings {
    requireSession: boolean;
    dayCutoff: string;
    dayAutoOpen: boolean;
    floatMode: TillFloatMode.ISSUED | TillFloatMode.CARRIED;
    blindClose: boolean;
    maxRecounts: number;
    countPlace: 'COUNTER' | 'CASH_OFFICE';
    cashTolerance: Prisma.Decimal;
    noncashTolerance: Prisma.Decimal;
    closeWithHolds: 'BLOCK' | 'RELEASE';
    sessionMaxHours: number;
    singleOperator: boolean;
    moneyDocsInSession: boolean;
    backofficeCashFrom: 'SAFE' | 'REFUSE';
    closeByTerminal: boolean;
}
export declare const TILL_SETTING_DEFAULTS: TillSettings;
export declare function readTillSettings(effective: readonly AppSettingEffectiveItem[]): TillSettings;
