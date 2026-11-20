import { Prisma } from '@prisma/client';
import { type QtyPriceSettingReader, type SaleLinePriceClient } from '../../Inventory/items-price-master/sale-line-price';
import { type SalesRefusal } from '../posting/types/posting.types';
export declare const RATE_TOLERANCE: Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Prisma.Decimal | string | number | null | undefined;
export interface RateLockUser {
    usrId: string;
    editRate: boolean;
    maxDiscPerc: Dec | null;
}
export interface LockLine {
    lineNo: number;
    id: string | null;
    itemId: string;
    unitId: string;
    priceLevel: number;
    lotId: string | null;
    mrp: number | null;
    isTaxIncl: boolean;
    taxPerc: Dec;
    billQty: Dec;
    netQty: Dec;
    rate: Dec;
    ratePreTax: Dec;
    isFree: boolean;
    isPromo: boolean;
    srcDocType: string | null;
    srcItemId: string | null;
    itemDiscPerc: Dec;
    itemDiscQty: Dec;
    itemDiscAmt: Dec;
    splDiscPerc: Dec;
    splDiscQty: Dec;
    splDiscAmt: Dec;
    schDiscAmt: Dec;
    billSchAmt: Dec;
    netGross: Dec | null;
    netAmt: Dec;
}
export interface LockCharge {
    chgId: string | null;
    type: string;
    method: string | null;
    rate: Dec | null;
    amount: Dec;
    beforeTax: boolean;
    srcCdId: string | null;
}
export interface LockHeader {
    companyId: string;
    branchId: string;
    deviceId: string | null;
    custId: string | null;
    priceLevel: number;
    billDate: string;
    discAlterBase: boolean;
    headerDisc: Dec;
}
export interface LockInput {
    header: LockHeader;
    lines: LockLine[];
    charges: LockCharge[];
    priorLines: LockLine[];
    priorCharges: LockCharge[];
    priorHeaderDisc: Dec;
    priorHeaderLevel: number | null;
}
export interface LineNormal {
    rates: Dec[];
    skipRate: boolean;
    baselines: Array<{
        itemPerc: Dec;
        itemQty: Dec;
        splPerc: Dec;
        splQty: Dec;
    }>;
    sourceLevel: number | null;
}
export interface ChargeMasterRule {
    autoApply: boolean;
    defaultRate: Dec | null;
    method?: string | null;
}
export interface LockRefusal {
    code: string;
    message: string;
    field: string;
    line?: number;
    max?: string;
}
export declare function lineDiscountBase(line: LockLine, discAlterBase: boolean): Dec;
export declare function priorOf(line: LockLine, prior: readonly LockLine[]): LockLine | null;
export declare function linesNeedingNormal(user: RateLockUser, input: LockInput, allowedLevels?: ReadonlySet<number>): number[];
export declare function judgeRateDiscount(user: RateLockUser, input: LockInput, normals: ReadonlyMap<number, LineNormal | null>, chargeRules: ReadonlyMap<string, ChargeMasterRule>, allowedLevels?: ReadonlySet<number>, sourceCharges?: ReadonlyMap<string, Dec>): LockRefusal[];
export type LockClient = SaleLinePriceClient & Pick<Prisma.TransactionClient, 'userMaster' | 'chargeMaster' | 'customer' | 'transactionChargeDetail'>;
export declare function readRateLockUser(client: Pick<Prisma.TransactionClient, 'userMaster'>, usrId: string | null | undefined): Promise<RateLockUser | null>;
export declare function readLineNormals(client: LockClient, header: LockHeader, lines: readonly LockLine[], indexes: readonly number[], qtyPriceSetting?: QtyPriceSettingReader): Promise<Map<number, LineNormal | null>>;
export interface LockOptions {
    qtyPriceSetting?: QtyPriceSettingReader;
    defaultPriceLevel?: (header: LockHeader) => Promise<number | null>;
}
export declare function readAllowedLevels(client: Pick<Prisma.TransactionClient, 'customer'>, header: LockHeader, defaultPriceLevel?: (header: LockHeader) => Promise<number | null>): Promise<Set<number>>;
export declare function isLockExempt(user: RateLockUser | null): boolean;
export declare function rateDiscountRefusalsFor(client: LockClient, user: RateLockUser, input: LockInput, options?: LockOptions): Promise<LockRefusal[]>;
export declare function rateDiscountRefusals(client: LockClient, usrId: string | null | undefined, input: LockInput, options?: LockOptions): Promise<LockRefusal[]>;
export declare function throwRateDiscountRefusals(refusals: readonly LockRefusal[]): void;
export declare function asSalesRefusals(refusals: readonly LockRefusal[]): SalesRefusal[];
export interface StoredBillLine {
    sbiId: string;
    sbiLineNo: number;
    sbiItemId: string;
    sbiItemUnitId: string;
    sbiPriceLevel: number;
    sbiLotId: string | null;
    sbiMaxPrice: Prisma.Decimal | null;
    sbiIsTaxIncl: boolean;
    sbiTaxPerc: Prisma.Decimal;
    sbiBillQty: Prisma.Decimal;
    sbiNetQty: Prisma.Decimal;
    sbiRate: Prisma.Decimal;
    sbiRatePreTax: Prisma.Decimal;
    sbiIsFree: boolean;
    sbiIsPromo: boolean;
    sbiSchemeId: string | null;
    sbiPromoUsageId: string | null;
    sbiSrcDocType: string | null;
    sbiSrcItemId: string | null;
    sbiItemDiscPerc: Prisma.Decimal;
    sbiItemDiscQty: Prisma.Decimal;
    sbiItemDiscAmt: Prisma.Decimal;
    sbiSplDiscPerc: Prisma.Decimal;
    sbiSplDiscQty: Prisma.Decimal;
    sbiSplDiscAmt: Prisma.Decimal;
    sbiSchDiscAmt: Prisma.Decimal;
    sbiBillSchAmt: Prisma.Decimal;
    sbiNetGross: Prisma.Decimal | null;
    sbiNetAmt: Prisma.Decimal;
}
export declare function lockLineOfStored(row: StoredBillLine): LockLine;
export interface DtoBillLine {
    sbiId?: string;
    sbiLineNo?: number;
    sbiItemId: string;
    sbiItemUnitId: string;
    sbiPriceLevel?: number;
    sbiLotId?: string | null;
    sbiMaxPrice?: Num;
    sbiIsTaxIncl?: boolean;
    sbiTaxPerc?: Num;
    sbiBillQty?: Num;
    sbiNetQty?: Num;
    sbiRate?: Num;
    sbiRatePreTax?: Num;
    sbiIsFree?: boolean;
    sbiIsPromo?: boolean;
    sbiSchemeId?: string | null;
    sbiPromoUsageId?: string | null;
    sbiSrcDocType?: string | null;
    sbiSrcItemId?: string | null;
    sbiItemDiscPerc?: Num;
    sbiItemDiscQty?: Num;
    sbiItemDiscAmt?: Num;
    sbiSplDiscPerc?: Num;
    sbiSplDiscQty?: Num;
    sbiSplDiscAmt?: Num;
    sbiSchDiscAmt?: Num;
    sbiBillSchAmt?: Num;
    sbiNetGross?: Num;
    sbiNetAmt?: Num;
}
export declare function lockLineOfDto(row: DtoBillLine, index: number, headerLevel: number): LockLine;
export interface ChargeLike {
    cdChgId?: string | null;
    cdType?: string | null;
    cdMethod?: string | null;
    cdRate?: Num;
    cdAmount?: Num;
    cdBeforeTax?: boolean | null;
    cdSrcCdId?: string | null;
    cdIsDeleted?: boolean | null;
    cdIsActive?: boolean | null;
}
export declare function lockChargeOf(row: ChargeLike): LockCharge;
export declare function lockHeaderOf(bill: {
    sbCompanyId: string;
    sbBranchId: string;
    sbDeviceId?: string | null;
    sbPriceLevel?: number | null;
    sbCustId?: string | null;
    sbBillDate?: Date | string | null;
    sbDiscAlterBase?: boolean | null;
    sbAddlDisc1?: Num;
    sbAddlDisc2?: Num;
    sbCashDisc?: Num;
}): LockHeader;
export {};
