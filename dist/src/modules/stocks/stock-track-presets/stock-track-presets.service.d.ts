import { StockTrackPreset } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { GetStockTrackPresetsQueryDto } from './dto/get-stock-track-presets-query.dto';
import type { StockErrorDetail } from '../stock-voucher/types/stock-voucher.types';
import { type DeactivateStockTrackPresetDto, type PresetTrackField, type SaveStockTrackPresetDto } from './dto/save-stock-track-preset.dto';
import { StockTrackPresetsGetMeta, StockTrackPresetsPayload } from './types/stock-track-presets-api.types';
export interface PresetValues {
    code: string;
    name: string;
    description: string | null;
    trackBatch: boolean;
    trackMrp: boolean;
    trackSalePrice: boolean;
    trackExpiry: boolean;
    trackSerial: boolean;
    trackSupplier: boolean;
    valuationMethod: string;
    issueStrategy: string;
    allowNegative: string;
    shelfLifeDays: number | null;
    nearExpiryDays: number;
    blockExpiredSale: boolean;
    ageingBasis: string;
    sortOrder: number;
    remarks: string | null;
}
interface PresetUsage {
    items: number;
    groups: number;
    activeItems: number;
    activeGroups: number;
}
export declare function valuationFor(values: Pick<PresetValues, PresetTrackField>): 'LOT_ACTUAL' | 'WAVG';
export declare function presetRuleErrors(values: PresetValues): StockErrorDetail[];
export declare function lockedFieldErrors(existing: StockTrackPreset, next: PresetValues, usage: PresetUsage): StockErrorDetail[];
export declare class StockTrackPresetsService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    get(queryDto: GetStockTrackPresetsQueryDto): Promise<{
        items: StockTrackPresetsPayload[];
        meta: StockTrackPresetsGetMeta;
    }>;
    private toPayload;
    save(dto: SaveStockTrackPresetDto): Promise<StockTrackPresetsPayload>;
    deactivate(dto: DeactivateStockTrackPresetDto): Promise<StockTrackPresetsPayload>;
    private ownPreset;
    private nextValues;
    private usageOf;
    private assertCodeFree;
    private throwCodeTaken;
    private author;
}
export {};
