import type { PriceScope } from './types/selling-price-bulk.types';
export type ScopeOutcome = 'UPDATE' | 'INSERT';
export interface ScopeResolution {
    targetScope: PriceScope;
    targetBranchId: string | null;
    expected: ScopeOutcome;
    createsBranchOverride: boolean;
    switchIgnored: boolean;
    reason: string;
}
export declare function resolveTargetScope(requested: PriceScope, rowScope: PriceScope | null, branchId: string): ScopeResolution;
