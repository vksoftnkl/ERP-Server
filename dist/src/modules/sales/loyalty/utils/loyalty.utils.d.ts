import { LoyaltyScheme, LoyaltySchemeBranch, LoyaltySchemeGift, LoyaltySchemeItem, LoyaltySchemeParty, LoyaltySchemeSlab } from '@prisma/client';
import { LoyaltySchemeBranchPayload, LoyaltySchemeGiftPayload, LoyaltySchemeItemPayload, LoyaltySchemePartyPayload, LoyaltySchemePayload, LoyaltySchemeSlabPayload, LoyaltySchemeSummaryPayload, PromotionLoyaltyPointsErrorDetail } from '../types/promotion-loyalty-points-api.types';
export declare const UUID_PATTERN: RegExp;
export declare const LSC_TYPES: readonly ["EARN", "REDEEM", "BOTH"];
export declare const LSC_STATUSES: readonly ["DRAFT", "APPROVED", "SUSPENDED", "CLOSED"];
export declare const LSC_APPLY_ON: readonly ["BILL_AMOUNT", "BILL_QTY", "ITEM_AMOUNT", "ITEM_QTY"];
export declare const LSC_CALC_ON: readonly ["GROSS_AMOUNT", "NET_AMOUNT", "TAXABLE_AMOUNT"];
export declare const LSC_BILL_TYPES: readonly ["ALL", "CASH", "CREDIT"];
export declare const LSC_ROUNDING: readonly ["FLOOR", "ROUND", "CEIL", "NONE"];
export declare const LSC_SCOPES: readonly ["ALL", "LIST"];
export declare const LSC_POOL_MODES: readonly ["COMPANY", "BRANCH"];
export declare const LSC_RETURN_MODES: readonly ["REVERSE", "IGNORE"];
export declare const LSC_EXPIRY_BASES: readonly ["NONE", "EARN_DATE", "MONTH_END", "YEAR_END", "SCHEME_END_DATE"];
export declare const LSP_KINDS: readonly ["CUSTOMER", "CUSTOMER_GROUP"];
export declare const LSI_KINDS: readonly ["ITEM", "ITEM_GROUP", "ITEM_CATEGORY", "ITEM_BRAND", "ITEM_SECTION"];
export declare const LSC_CODE_PATTERN: RegExp;
export declare const LSC_WEEKDAYS_PATTERN: RegExp;
export declare const LSP_DEFAULT_MATCH_PRIORITY: Record<string, number>;
export declare const LSI_DEFAULT_MATCH_PRIORITY: Record<string, number>;
export declare const SCHEME_LOOKUP: {
    readonly company: {
        readonly select: {
            readonly compName: true;
        };
    };
    readonly branch: {
        readonly select: {
            readonly brName: true;
        };
    };
};
export declare const BRANCH_LOOKUP: {
    readonly branch: {
        readonly select: {
            readonly brName: true;
            readonly brCode: true;
            readonly brShort: true;
        };
    };
};
export declare const PARTY_LOOKUP: {
    readonly customer: {
        readonly select: {
            readonly cusName: true;
            readonly cusCode: true;
        };
    };
    readonly customerGroup: {
        readonly select: {
            readonly cgrName: true;
            readonly cgrShort: true;
        };
    };
};
export declare const ITEM_LOOKUP: {
    readonly item: {
        readonly select: {
            readonly itemNameEn: true;
        };
    };
    readonly itemGroup: {
        readonly select: {
            readonly itgName: true;
        };
    };
    readonly itemCategory: {
        readonly select: {
            readonly categoryName: true;
        };
    };
    readonly itemBrand: {
        readonly select: {
            readonly brand_name: true;
        };
    };
    readonly itemSection: {
        readonly select: {
            readonly secName: true;
        };
    };
};
export declare const SLAB_LOOKUP: {
    readonly item: {
        readonly select: {
            readonly itemNameEn: true;
        };
    };
    readonly unit: {
        readonly select: {
            readonly unit: {
                readonly select: {
                    readonly unit_name: true;
                };
            };
        };
    };
};
export declare const GIFT_LOOKUP: {
    readonly item: {
        readonly select: {
            readonly itemNameEn: true;
        };
    };
    readonly unit: {
        readonly select: {
            readonly unit: {
                readonly select: {
                    readonly unit_name: true;
                };
            };
        };
    };
};
type UnitLookup = {
    unit: {
        unit_name: string;
    };
} | null;
export type BranchRow = LoyaltySchemeBranch & {
    branch?: {
        brName: string;
        brCode: string | null;
        brShort: string | null;
    } | null;
};
export type PartyRow = LoyaltySchemeParty & {
    customer?: {
        cusName: string | null;
        cusCode: string | null;
    } | null;
    customerGroup?: {
        cgrName: string;
        cgrShort: string | null;
    } | null;
};
export type ItemRow = LoyaltySchemeItem & {
    item?: {
        itemNameEn: string;
    } | null;
    itemGroup?: {
        itgName: string;
    } | null;
    itemCategory?: {
        categoryName: string;
    } | null;
    itemBrand?: {
        brand_name: string;
    } | null;
    itemSection?: {
        secName: string;
    } | null;
};
export type SlabRow = LoyaltySchemeSlab & {
    item?: {
        itemNameEn: string;
    } | null;
    unit?: UnitLookup;
};
export type GiftRow = LoyaltySchemeGift & {
    item?: {
        itemNameEn: string;
    } | null;
    unit?: UnitLookup;
};
export type SchemeRow = LoyaltyScheme & {
    company?: {
        compName: string;
    } | null;
    branch?: {
        brName: string;
    } | null;
};
export type SchemeWithChildren = SchemeRow & {
    branches: BranchRow[];
    parties: PartyRow[];
    items: ItemRow[];
    slabs: SlabRow[];
    gifts: GiftRow[];
};
export declare function throwBadRequest(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never;
export declare function throwConflict(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never;
export declare function fieldError(field: string, message: string): never;
export declare function toIsoDate(value: Date): string;
export declare function toNullableIsoDate(value: Date | null): string | null;
export declare function toIsoTime(value: Date | null): string | null;
export declare function normalizeNullableString(value: string | null | undefined): string | null;
export declare function resolveActor(...candidates: Array<string | null | undefined>): string | null;
export declare function resolveActorUuid(...candidates: Array<string | null | undefined>): string | null;
export declare function requireString(value: string | undefined | null, field: string): string;
export declare function requireUuid(value: string | undefined | null, field: string): string;
export declare function normalizeEnum(value: string | undefined | null): string;
export declare function requireNumber(value: number | undefined | null, field: string, minValue: number, maxValue?: number): number;
export declare function requireInteger(value: number | undefined | null, field: string, minValue: number, maxValue?: number): number;
export declare function parseDateOnly(value: string | undefined | null, field: string): Date;
export declare function parseNullableDateOnly(value: string | null | undefined, field: string): Date | null;
export declare function parseTimeToUtcDate(value: string, field: string): Date;
export declare function toBranchPayload(row: BranchRow): LoyaltySchemeBranchPayload;
export declare function toPartyPayload(row: PartyRow): LoyaltySchemePartyPayload;
export declare function toItemPayload(row: ItemRow): LoyaltySchemeItemPayload;
export declare function toSlabPayload(row: SlabRow): LoyaltySchemeSlabPayload;
export declare function toGiftPayload(row: GiftRow): LoyaltySchemeGiftPayload;
export declare function toSchemeSummaryPayload(scheme: SchemeRow): LoyaltySchemeSummaryPayload;
export declare function toSchemePayload(scheme: SchemeWithChildren): LoyaltySchemePayload;
export declare function handleLoyaltyWriteError(error: unknown): void;
export {};
