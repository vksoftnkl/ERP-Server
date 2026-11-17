import { Prisma } from '@prisma/client';
export declare const BILL_BASE_VCHR_TYPE_ID: 3;
export declare const OFFER_BASE_BILL_TYPE_KEY = "sales.offer_base_bill_type";
export declare const BILL_VOUCHER_TYPE_KEY = "sales.bill_voucher_type";
export declare const DEFAULT_BILL_PRINT_PURPOSE = "SALE_INVOICE";
export declare const BILL_VOUCHER_TYPE_ERRORS: {
    readonly REQUIRED: "VT_BILL_TYPE_REQUIRED";
    readonly INVALID: "VT_BILL_TYPE_INVALID";
    readonly LOCKED: "VT_BILL_TYPE_LOCKED";
    readonly OFFLINE: "VT_OFFLINE";
};
export interface BillTypeSite {
    offlineSite?: boolean;
}
type RawClient = Pick<Prisma.TransactionClient, '$queryRaw'>;
export type BillSettingValues = (companyId: string, branchId: string, deviceId: string | null | undefined, keys: readonly string[]) => Promise<Record<string, string | null>>;
export interface OfferedBillType {
    vchrTypeId: number;
    vchrTypeCode: string;
    vchrTypeName: string;
    vchrTypeShort: string | null;
    vchrParentId: number | null;
    vchrNoPrefix: string | null;
    vchrSortOrder: number;
    vchrDeliveryMode: string | null;
}
export declare function billTypeDeliveryMode(own: string | null | undefined, baseMode: string | null | undefined, billMode?: string | null): 'INSTANT' | 'PICKUP' | 'DISPATCH';
export declare function billVoucherTypeOf(bill: {
    sbVchrTypeId?: number | null;
}): number;
export declare function billSeriesDeviceCode(p: {
    vchrTypeId: number;
    billMode: string | null | undefined;
    posSeriesPerDevice: boolean;
    deviceId: string | null | undefined;
}): string | null;
export declare function activeBillChildCount(client: RawClient, companyId: string): Promise<number>;
export declare function offeredBillTypes(client: RawClient, companyId: string, offerBase: boolean, offlineSite?: boolean): Promise<OfferedBillType[]>;
export declare function billTypeChoices(client: RawClient, values: BillSettingValues, scope: {
    companyId: string;
    branchId: string;
    deviceId?: string | null;
} & BillTypeSite): Promise<{
    offered: OfferedBillType[];
    defaultVchrTypeId: number | null;
    offerBase: boolean;
}>;
export interface BillTypeRefusal {
    field: 'sbVchrTypeId';
    code: (typeof BILL_VOUCHER_TYPE_ERRORS)[keyof typeof BILL_VOUCHER_TYPE_ERRORS];
    message: string;
}
export type BillTypeVerdict = {
    vchrTypeId: number;
    refusal: null;
} | {
    vchrTypeId: null;
    refusal: BillTypeRefusal;
};
export declare function judgeBillVoucherType(client: RawClient, values: BillSettingValues, dto: {
    sbCompanyId: string;
    sbBranchId: string;
    sbDeviceId?: string | null;
    sbVchrTypeId?: number | null;
}, site?: BillTypeSite): Promise<BillTypeVerdict>;
export declare function resolveBillVoucherType(client: RawClient, values: BillSettingValues, dto: Parameters<typeof judgeBillVoucherType>[2], site?: BillTypeSite): Promise<number>;
export declare function billOfflineTypeRefusal(existing: {
    sbVchrTypeId?: number | null;
    sbBillRefno?: string | null;
}, site: BillTypeSite): BillTypeRefusal | null;
export declare function assertBillTypeAtSite(existing: {
    sbVchrTypeId?: number | null;
    sbBillRefno?: string | null;
}, site: BillTypeSite): void;
export declare function billTypeLockRefusal(existing: {
    sbVchrTypeId?: number | null;
    sbBillRefno?: string | null;
}, requested: number | null | undefined): BillTypeRefusal | null;
export declare function assertBillTypeUnchanged(existing: {
    sbVchrTypeId?: number | null;
    sbBillRefno?: string | null;
}, requested: number | null | undefined): void;
export declare function billTypeRefusals(client: RawClient, values: BillSettingValues, dto: Parameters<typeof judgeBillVoucherType>[2] & {
    sbId?: string | null;
    sbAccYear?: string | null;
}, site?: BillTypeSite): Promise<BillTypeRefusal[]>;
export interface BillVoucherTypeBlock {
    vchrTypeId: number;
    vchrTypeName: string | null;
    vchrTypeShort: string | null;
    vchrParentId: number | null;
    printTitle: string | null;
    printPurposeCode: string;
    printAfterPost: boolean;
}
export interface DesignFacts {
    code: string | null;
    name: string | null;
    live: boolean | null;
    layout: boolean | null;
    assigned: boolean | null;
}
export declare function designUsable(d: DesignFacts): boolean;
export declare function billVoucherTypeBlock(client: RawClient, bill: {
    sbVchrTypeId?: number | null;
    sbCompanyId: string;
}): Promise<BillVoucherTypeBlock>;
export {};
