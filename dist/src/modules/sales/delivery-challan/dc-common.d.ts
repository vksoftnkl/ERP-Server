import { Prisma } from '@prisma/client';
import type { RegisterDetailLine, RegisterTaxability } from '../../../common/posting/doc-register.types';
import type { StatutoryService } from '../../../common/posting/statutory.service';
import type { SalesContextService } from '../posting/sales-context.service';
import type { SaleOrderLineRef } from '../sale-order/types/sale-order-api.types';
import { type SalesGuardContext } from '../posting/types/posting.types';
type Client = Prisma.TransactionClient;
declare const D: (v: Prisma.Decimal.Value | null | undefined) => Prisma.Decimal;
declare const UUID: RegExp;
export declare function allocateDcDocNumber(tx: Client, q: {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceId: string | null | undefined;
    documentDate: Date;
    field: string;
}): Promise<{
    lastNo: bigint;
    refno: string;
}>;
export declare function nextRegisterVoucherNo(tx: Client, q: {
    companyId: string;
    branchId: string;
    accYear: string;
    voucherTypeId: number;
}): Promise<bigint>;
export type DcAgeLevel = '' | 'AMBER' | 'RED';
export type StatutorySource = 'COMPANY' | 'SHIPPED';
export interface DcReturnWindow {
    days: number;
    source: StatutorySource;
    effectiveFrom: string | null;
}
export interface DcAgeing {
    ageDays: number;
    ageLevel: DcAgeLevel;
    returnWindow: DcReturnWindow | null;
    pastWindow: boolean;
}
export declare function daysBetween(docDate: string, today: string): number;
export declare function ageLevelOf(purpose: string | null | undefined, ageDays: number, limits: {
    amberDays: number;
    oldDays: number;
    windowDays: number | null;
}, status: string): DcAgeLevel;
export declare function isPastReturnWindow(purpose: string | null | undefined, ageDays: number, windowDays: number | null, status: string): boolean;
export declare function dcReturnWindowOf(statutory: Pick<StatutoryService, 'limit'>, companyId: string, docDate: string): Promise<DcReturnWindow | null>;
export declare function dcAgeing(salesContext: Pick<SalesContextService, 'values'>, statutory: Pick<StatutoryService, 'limit'>, q: {
    companyId: string;
    branchId: string;
    purpose: string | null | undefined;
    docDate: string;
    status: string;
    today: string;
    open?: boolean;
}): Promise<DcAgeing>;
export interface DcEwayFacts {
    needed: boolean;
    supplyNature: 'INTRA_STATE' | 'INTER_STATE';
    fromStateCode: string | null;
    fromStateName: string | null;
    toStateCode: string | null;
    toStateName: string | null;
    posFromCompany: boolean;
    value: string;
    onDate: string;
    limit: {
        value: string | null;
        appliesTo: string;
        source: StatutorySource;
        effectiveFrom: string | null;
    } | null;
    transportMissing: boolean;
}
export declare function dcEwayStateOf(companyStateCode: string | null | undefined, posStateCode: string | null | undefined): {
    stateCode: string | null;
    posFromCompany: boolean;
};
export declare function dcEwayVerdict(c: Client, statutory: Pick<StatutoryService, 'ewayApplicable'>, q: {
    companyId: string;
    companyStateCode: string | null | undefined;
    posStateCode: string | null | undefined;
    value: Prisma.Decimal.Value | null | undefined;
    docDate: string;
}): Promise<Omit<DcEwayFacts, 'transportMissing'>>;
export declare function dcPartBMissing(band: Record<string, unknown> | null | undefined, row: Record<string, unknown>): boolean;
export interface DcLineNames {
    itemName: string | null;
    itemCode: string | null;
    unitName: string | null;
    godownName: string | null;
    lotNo: string | null;
    unitKg: string;
}
export declare function dcLineNames(c: Client, lines: readonly {
    itemId: unknown;
    itemUnitId: unknown;
    godownId: unknown;
    lotId: unknown;
}[]): Promise<(l: {
    itemId: unknown;
    itemUnitId: unknown;
    godownId: unknown;
    lotId: unknown;
}) => DcLineNames>;
export declare function assertNoCharges(charges: unknown): void;
export declare const DC_ZERO_CHARGE_FIELDS: readonly ["sdcOtherAmt", "sdcFreightAmt", "sdcLoadAmt", "sdcUnloadAmt"];
export interface OrderLineFree {
    isFree: boolean;
    freeType: string | null;
}
export declare function dcOrderLineOf(l: Record<string, unknown>): string | null;
export declare function orderLineFreeOf(tx: Client, soiIds: readonly string[]): Promise<Map<string, OrderLineFree>>;
export declare function checkDcFreeLines(g: SalesGuardContext, lines: readonly Record<string, unknown>[], orderFree: ReadonlyMap<string, OrderLineFree>): void;
export declare const DC_ORDER_REF_FIELDS: {
    readonly docId: "sdiSrcItemId";
    readonly accYear: "sdiSrcDocAccYear";
    readonly lineNo: "sdiSrcLineNo";
};
export declare function orderLineRefsOf(tx: Client, soiIds: readonly (string | null | undefined)[]): Promise<SaleOrderLineRef[]>;
export declare function orderLineKeysOf(tx: Client, soiIds: readonly (string | null | undefined)[]): Promise<Map<string, number[]>>;
export declare function applyDcLineLevels(dto: {
    sdcPriceLevel?: number | null;
    items?: {
        sdiPriceLevel?: number | null;
    }[];
}): void;
export declare function orderLinesOfDcLines(tx: Client, sdiIds: readonly (string | null | undefined)[]): Promise<string[]>;
export declare function dcSourceOrdersOfLines(tx: Client, sdiIds: readonly (string | null | undefined)[]): Promise<{
    orderIds: string[];
    orderLineIds: string[];
}>;
export declare function lockChallansOfLines(tx: Client, sdiIds: readonly (string | null | undefined)[]): Promise<void>;
export declare function lockDcLines(tx: Client, dcId: string, accYear: string): Promise<void>;
export declare function dcQtyInOrderTerms(l: Record<string, unknown>, o: {
    soi_item_unit_id?: string | null;
    soi_to_base_factor?: Prisma.Decimal.Value | null;
}): Prisma.Decimal;
export declare function dcFreeTypeOf(l: Record<string, unknown>, orderFree: ReadonlyMap<string, OrderLineFree>): string | null;
export declare function checkDcMoney(g: SalesGuardContext, header: Record<string, unknown>, lines: readonly Record<string, unknown>[], nature?: 'INTRA' | 'INTER'): void;
export declare function dcTotals(header: Record<string, unknown>, lines: readonly Record<string, unknown>[], unitKgOf: (l: Record<string, unknown>) => Prisma.Decimal): {
    lines: number;
    pkgs: string;
    weightKg: string;
    taxable: string;
    tax: string;
    value: string;
};
export type RegisterLineTaxFigures = Pick<RegisterDetailLine, 'totalTaxRate' | 'cgstRate' | 'sgstRate' | 'igstRate' | 'cessRate' | 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'cessAmount'>;
export declare function registerLineTaxability(l: RegisterLineTaxFigures): 'TAXABLE' | 'EXEMPT';
export declare function registerDocTaxability(lines: readonly Pick<RegisterDetailLine, 'taxability'>[]): RegisterTaxability;
export { D as dec, UUID as UUID_PATTERN };
