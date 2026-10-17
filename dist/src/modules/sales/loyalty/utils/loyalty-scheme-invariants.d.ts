import { PromotionLoyaltyPointsErrorDetail } from '../types/promotion-loyalty-points-api.types';
export interface EffectiveScheme {
    lscCode: string;
    lscType: string;
    lscStatus: string;
    lscApplyOn: string;
    lscCalcOnAmountType: string;
    lscBillType: string;
    lscRoundingMethod: string;
    lscBranchScope: string;
    lscCustScope: string;
    lscItemScope: string;
    lscPoolMode: string;
    lscReturnMode: string;
    lscExpiryBasis: string;
    lscPriority: number;
    lscPointsDecimals: number;
    lscActivationDays: number;
    lscPointsValidDays: number;
    lscMinBillAmount: number;
    lscMaxEarnPoints: number;
    lscAllowPointRedeem: boolean;
    lscRedeemValuePerPoint: number;
    lscMinRedeemPoints: number;
    lscMaxRedeemPoints: number;
    lscMaxRedeemPerc: number;
    lscRedeemMinBillAmount: number;
    lscRedeemMultiple: number;
    lscStartDate: Date;
    lscEndDate: Date;
    lscValidFromTime: Date | null;
    lscValidToTime: Date | null;
    lscValidWeekdays: string | null;
    lscApprovedBy: string | null;
}
export type SchemeInvariant = (scheme: EffectiveScheme) => PromotionLoyaltyPointsErrorDetail[];
export declare const ckLscCodeShape: SchemeInvariant;
export declare const ckLscType: SchemeInvariant;
export declare const ckLscStatus: SchemeInvariant;
export declare const ckLscApplyOn: SchemeInvariant;
export declare const ckLscCalcOn: SchemeInvariant;
export declare const ckLscBillType: SchemeInvariant;
export declare const ckLscRounding: SchemeInvariant;
export declare const ckLscBranchScope: SchemeInvariant;
export declare const ckLscCustScope: SchemeInvariant;
export declare const ckLscItemScope: SchemeInvariant;
export declare const ckLscPoolMode: SchemeInvariant;
export declare const ckLscReturnMode: SchemeInvariant;
export declare const ckLscExpiryBasis: SchemeInvariant;
export declare const ckLscExpiryDays: SchemeInvariant;
export declare const ckLscDates: SchemeInvariant;
export declare const ckLscTimePair: SchemeInvariant;
export declare const ckLscWeekdays: SchemeInvariant;
export declare const ckLscPriority: SchemeInvariant;
export declare const ckLscDecimals: SchemeInvariant;
export declare const ckLscActivation: SchemeInvariant;
export declare const ckLscEarnLimits: SchemeInvariant;
export declare const ckLscRedeemLimits: SchemeInvariant;
export declare const ckLscRedeemRate: SchemeInvariant;
export declare const ckLscApproved: SchemeInvariant;
export declare const SCHEME_INVARIANTS: ReadonlyMap<string, SchemeInvariant>;
export declare function collectSchemeInvariantErrors(scheme: EffectiveScheme): PromotionLoyaltyPointsErrorDetail[];
export interface EffectiveBranchRow {
    lsbSlno: number;
}
export type BranchInvariant = (row: EffectiveBranchRow) => PromotionLoyaltyPointsErrorDetail[];
export declare const ckLsbSlno: BranchInvariant;
export declare const BRANCH_INVARIANTS: ReadonlyMap<string, BranchInvariant>;
export declare function collectBranchInvariantErrors(row: EffectiveBranchRow): PromotionLoyaltyPointsErrorDetail[];
export interface EffectivePartyRow {
    lspSlno: number;
    lspKind: string;
    lspMatchPriority: number;
}
export type PartyInvariant = (row: EffectivePartyRow) => PromotionLoyaltyPointsErrorDetail[];
export declare const ckLspKind: PartyInvariant;
export declare const ckLspSlno: PartyInvariant;
export declare const ckLspMatchPriority: PartyInvariant;
export declare const PARTY_INVARIANTS: ReadonlyMap<string, PartyInvariant>;
export declare function collectPartyInvariantErrors(row: EffectivePartyRow): PromotionLoyaltyPointsErrorDetail[];
export interface EffectiveItemRow {
    lsiSlno: number;
    lsiKind: string;
    lsiIsExclude: boolean;
    lsiFactor: number;
    lsiPoints: number;
    lsiMaxPoints: number;
    lsiMatchPriority: number;
}
export type ItemInvariant = (row: EffectiveItemRow) => PromotionLoyaltyPointsErrorDetail[];
export declare const ckLsiKind: ItemInvariant;
export declare const ckLsiExclude: ItemInvariant;
export declare const ckLsiValues: ItemInvariant;
export declare const ckLsiSlno: ItemInvariant;
export declare const ckLsiMatchPriority: ItemInvariant;
export declare const ITEM_INVARIANTS: ReadonlyMap<string, ItemInvariant>;
export declare function collectItemInvariantErrors(row: EffectiveItemRow): PromotionLoyaltyPointsErrorDetail[];
export interface EffectiveSlabRow {
    lssSlno: number;
    lssExceeds: number;
    lssUpto: number | null;
    lssEach: number;
    lssPoints: number;
    lssFactor: number;
    lssMaxPoints: number;
}
export type SlabInvariant = (row: EffectiveSlabRow) => PromotionLoyaltyPointsErrorDetail[];
export declare const ckLssBand: SlabInvariant;
export declare const ckLssValues: SlabInvariant;
export declare const ckLssSlno: SlabInvariant;
export declare const SLAB_INVARIANTS: ReadonlyMap<string, SlabInvariant>;
export declare function collectSlabInvariantErrors(row: EffectiveSlabRow): PromotionLoyaltyPointsErrorDetail[];
export interface EffectiveGiftRow {
    lsgSlno: number;
    lsgItemQty: number;
    lsgRedeemPoints: number;
    lsgMaxQtyPerBill: number;
    lsgValidFrom: Date | null;
    lsgValidUpto: Date | null;
}
export type GiftInvariant = (row: EffectiveGiftRow) => PromotionLoyaltyPointsErrorDetail[];
export declare const ckLsgQty: GiftInvariant;
export declare const ckLsgPoints: GiftInvariant;
export declare const ckLsgValidity: GiftInvariant;
export declare const ckLsgSlno: GiftInvariant;
export declare const GIFT_INVARIANTS: ReadonlyMap<string, GiftInvariant>;
export declare function collectGiftInvariantErrors(row: EffectiveGiftRow): PromotionLoyaltyPointsErrorDetail[];
