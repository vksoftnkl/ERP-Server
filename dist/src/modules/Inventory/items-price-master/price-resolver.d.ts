export interface BucketKey {
    mrp: number | null;
    salePrice: number | null;
}
export type PriceSource = 'BUCKET' | 'MASTER';
export type PriceScope = 'BRANCH' | 'CHAIN';
export declare const HEADLINE_KEY: Readonly<BucketKey>;
export declare const NO_BUCKET_KEY = -1;
type DecimalLike = number | string | {
    toString(): string;
};
type DateLike = Date | string;
export interface PriceRowScope {
    ipmCompanyId: string | null;
    ipmBranchId: string | null;
    ipmKeyMrp: DecimalLike | null;
    ipmKeySp: DecimalLike | null;
    ipmEffectiveFrom: DateLike;
    ipmEffectiveTo: DateLike;
    ipmIsDeleted: boolean;
}
export interface PriceCallerScope {
    companyId?: string | null;
    branchId?: string | null;
}
export interface ResolvedPrice<R> {
    row: R;
    source: PriceSource;
    scope: PriceScope;
}
export declare function resolveEffectivePrice<R extends PriceRowScope>(rows: readonly R[], key: BucketKey, onDate: string, caller?: PriceCallerScope): ResolvedPrice<R> | null;
export declare function livePriceRows<R extends PriceRowScope>(rows: readonly R[], onDate: string, caller?: PriceCallerScope): R[];
export declare function isHeadlineKey(key: BucketKey): boolean;
export declare function bucketKeyOfRow(row: Pick<PriceRowScope, 'ipmKeyMrp' | 'ipmKeySp'>): BucketKey;
export declare function normalizeBucketValue(value: DecimalLike | null | undefined): number | null;
export declare function sameBucket(a: BucketKey, b: BucketKey): boolean;
export declare function scopeOf(row: Pick<PriceRowScope, 'ipmBranchId'>): PriceScope;
export declare function toDay(value: DateLike): string;
export {};
