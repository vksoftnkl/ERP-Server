import { ItemPriceMaster } from '@prisma/client';
import { PriceRowWithUnit, UnitCycleRow } from '../types/master-lookup-internal.types';
export declare function preferBranchPriceRows(priceRows: PriceRowWithUnit[], branchId?: string): PriceRowWithUnit[];
export declare function selectUnitRate(priceRows: PriceRowWithUnit[], isRetailItem: boolean, unitId?: string): PriceRowWithUnit | null;
export declare function nextIucIdInCycle(rows: UnitCycleRow[], requestedIucId: string): string;
export declare function priceForLevel(rate: ItemPriceMaster, priceLevel: number): number;
