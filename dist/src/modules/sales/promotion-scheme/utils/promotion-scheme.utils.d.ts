import { PromotionScheme, PromotionSchemeBranch, PromotionSchemeItem, PromotionSchemeParty, PromotionSchemeSlab } from '@prisma/client';
import { PromotionSchemeBranchPayload, PromotionSchemeErrorDetail, PromotionSchemeItemPayload, PromotionSchemePartyPayload, PromotionSchemePayload, PromotionSchemeSlabPayload, PromotionSchemeSummaryPayload } from '../types/promotion-scheme-api.types';
export declare const UUID_PATTERN: RegExp;
export declare const PRM_STATUSES: readonly ["DRAFT", "APPROVED", "SUSPENDED", "CLOSED"];
export declare const PRM_APPLY_ON: readonly ["BILL_AMOUNT", "BILL_QTY", "ITEM_AMOUNT", "ITEM_QTY"];
export declare const PRM_BENEFITS: readonly ["FREE_ITEM", "DISC_PERC", "DISC_AMT", "FIXED_PRICE", "DISC_PER_ITEM"];
export declare const PRM_STACK_MODES: readonly ["EXCLUSIVE", "STACKABLE"];
export declare const PRM_CALC_ON: readonly ["GROSS_AMOUNT", "NET_AMOUNT", "TAXABLE_AMOUNT"];
export declare const PRM_BILL_TYPES: readonly ["ALL", "CASH", "CREDIT"];
export declare const PRM_SCOPES: readonly ["ALL", "LIST"];
export declare const PRP_KINDS: readonly ["CUSTOMER", "CUSTOMER_GROUP", "AREA", "CITY"];
export declare const PRI_KINDS: readonly ["ITEM", "ITEM_GROUP", "ITEM_CATEGORY", "ITEM_BRAND", "ITEM_SECTION"];
export declare const PRM_CODE_PATTERN: RegExp;
export declare const PRM_WEEKDAYS_PATTERN: RegExp;
export declare const PRP_DEFAULT_MATCH_PRIORITY: Record<string, number>;
export declare const PRI_DEFAULT_MATCH_PRIORITY: Record<string, number>;
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
    readonly area: {
        readonly select: {
            readonly armName: true;
            readonly armShort: true;
        };
    };
    readonly city: {
        readonly select: {
            readonly ctmName: true;
            readonly ctmShort: true;
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
export declare const SLAB_LOOKUP: {
    readonly freeItem: {
        readonly select: {
            readonly itemNameEn: true;
        };
    };
    readonly freeUnit: {
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
export type BranchRow = PromotionSchemeBranch & {
    branch?: {
        brName: string;
        brCode: string | null;
        brShort: string | null;
    } | null;
};
export type PartyRow = PromotionSchemeParty & {
    customer?: {
        cusName: string | null;
        cusCode: string | null;
    } | null;
    customerGroup?: {
        cgrName: string;
        cgrShort: string | null;
    } | null;
    area?: {
        armName: string;
        armShort: string | null;
    } | null;
    city?: {
        ctmName: string;
        ctmShort: string | null;
    } | null;
};
export type ItemRow = PromotionSchemeItem & {
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
    unit?: UnitLookup;
};
export type SlabRow = PromotionSchemeSlab & {
    freeItem?: {
        itemNameEn: string;
    } | null;
    freeUnit?: UnitLookup;
};
export type SchemeRow = PromotionScheme & {
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
};
export declare function throwBadRequest(message: string, errors: PromotionSchemeErrorDetail[]): never;
export declare function throwConflict(message: string, errors: PromotionSchemeErrorDetail[]): never;
export declare function fieldError(field: string, message: string): never;
export declare function toIsoDate(value: Date): string;
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
export declare function parseTimeToUtcDate(value: string, field: string): Date;
export declare function toBranchPayload(row: BranchRow): PromotionSchemeBranchPayload;
export declare function toPartyPayload(row: PartyRow): PromotionSchemePartyPayload;
export declare function toItemPayload(row: ItemRow): PromotionSchemeItemPayload;
export declare function toSlabPayload(row: SlabRow): PromotionSchemeSlabPayload;
export declare function toSchemeSummaryPayload(scheme: SchemeRow): PromotionSchemeSummaryPayload;
export declare function toSchemePayload(scheme: SchemeWithChildren): PromotionSchemePayload;
export declare function handlePromotionWriteError(error: unknown): void;
export {};
