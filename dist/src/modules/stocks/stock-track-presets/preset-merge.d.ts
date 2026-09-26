import { Prisma, StockTrackPreset } from '@prisma/client';
export declare const PRESET_VISIBLE: {
    sptIsActive: true;
    sptIsDeleted: false;
};
export declare function presetScopeFilter(companyId: string | null): Prisma.StockTrackPresetWhereInput;
export declare function mergePresets<T extends Pick<StockTrackPreset, 'sptCode' | 'sptCompanyId'>>(rows: readonly T[]): T[];
