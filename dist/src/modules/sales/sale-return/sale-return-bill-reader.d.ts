import { Prisma } from '@prisma/client';
import { type BillChargeFacts, type BillLineFacts, type Dec, type PriorBack, type TodayPriceFacts } from './sale-return-money';
type Client = Prisma.TransactionClient;
export interface BillHeaderFacts {
    sbId: string;
    accYear: string;
    status: string;
    refno: string | null;
    date: string;
    companyId: string;
    branchId: string;
    billType: string | null;
    billMode: string | null;
    payMode: string | null;
    custId: string | null;
    custName: string | null;
    custAddr: string | null;
    custPlace: string | null;
    custPin: string | null;
    custPhone: string | null;
    custGstin: string | null;
    custGstType: string | null;
    custStcd: string | null;
    posStcd: string | null;
    stateName: string | null;
    priceLevel: number | null;
    billAmt: Dec;
    taxable: Dec;
    cashDisc: Dec;
    roundOff: Dec;
    roundOffStep: Dec | null;
    returnedAmt: Dec;
    returnStatus: string | null;
    salesmanIds: string[];
    loadmanIds: string[];
    agentId: string | null;
    driverId: string | null;
    supervisorId: string | null;
    vehicleId: string | null;
    vehicleNo: string | null;
    hasFreight: boolean;
    hasLoad: boolean;
    hasUnload: boolean;
    freightCalcType: string | null;
    loadingCalcType: string | null;
    loyaltyMemberId: string | null;
    loyaltyEarnPoints: Dec;
    agentCommAmt: Dec;
}
export interface BillLineView extends BillLineFacts {
    itemName: string | null;
    unitName: string | null;
    allowReturn: boolean;
    godownId: string;
    unitWeight: Dec | null;
    lotBatchNo: string | null;
    lotExpiry: string | null;
    chrgAfterTax: Dec;
    netAmt: Dec;
}
export interface UnitRow {
    itemUnitId: string;
    itemId: string;
    unitName: string | null;
    factor: Dec;
    weight: Dec | null;
    isBase: boolean;
}
export interface PriorHeader {
    roundOff: Dec;
    cashDisc: Dec;
    refund: Dec;
    pointsBackAmt: Dec;
    voucherShare: Dec;
    agentComm: Dec;
    loyaltyReversed: Dec;
    pointsBack: Dec;
}
export interface LoyaltyRule {
    lscId: string;
    decimals: number;
    rounding: string | null;
    returnMode: string | null;
}
export interface DraftHold {
    base: Dec;
    refnos: string[];
}
export interface BillTenderFacts {
    money: Dec;
    points: Dec;
    pointsUnits: Dec;
    voucher: Dec;
    credit: Dec;
}
export interface OpenBillFacts {
    ablId: string;
    ablAccYear: string;
    billType: string;
    refno: string | null;
    docDate: string | null;
    dueDate: string | null;
    billAmount: Dec;
    pending: Dec;
    alloc: Dec;
    srcDocType: string | null;
    srcDocId: string | null;
    srcAccYear: string | null;
}
export interface UnwindAddBack {
    bills: ReadonlyMap<string, Dec>;
    balance: Dec;
    partyId: string | null;
}
export interface BillTenderRow {
    tdId: string;
    tenderId: string | null;
    tenderTypeId: number;
    name: string | null;
    ledgerId: string | null;
    amount: Dec;
    unitsUsed: Dec;
    conversionRate: Dec;
}
export interface ReturnApprovalRow {
    tapId: string;
    accYear: string;
    event: string;
    status: string;
    amount: Dec;
    requestedBy: string | null;
    requestedByName: string | null;
    requestedOn: Date | null;
    requestNote: string | null;
    decidedBy: string | null;
    decidedByName: string | null;
    decidedOn: Date | null;
    decisionNote: string | null;
    usedOn: string | null;
}
export interface SchemeFacts {
    prmId: string;
    code: string | null;
    name: string | null;
    applyOn: string | null;
    benefit: string | null;
    includeTax: boolean;
    minQty: Dec;
    minBillAmount: Dec;
    slabs: {
        exceeds: Dec;
        upto: Dec;
        benefit: string | null;
    }[];
}
export interface ReturnChargeRow {
    cdId: string;
    cdSrcCdId: string | null;
    cdSrcAccYear: string | null;
    cdCarryBasis: string | null;
    cdAmount: Dec;
    cdCarriedAmt: Dec;
}
export interface LotFacts {
    lotId: string;
    batchNo: string | null;
    expiryDate: string | null;
}
type LineRow = Record<string, unknown>;
export declare function lineFactsOf(r: LineRow): BillLineFacts;
export declare class SaleReturnBillReader {
    billHeader(c: Client, sbId: string, accYear: string): Promise<BillHeaderFacts | null>;
    billLines(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>): Promise<BillLineView[]>;
    lockBillLines(tx: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>): Promise<number>;
    lockBillCharges(tx: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>): Promise<number>;
    priorBack(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>, excludeSrId: string | null): Promise<Map<string, PriorBack>>;
    priorHeader(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>, excludeSrId: string | null): Promise<PriorHeader>;
    billLoyaltyRules(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>): Promise<{
        earn: LoyaltyRule | null;
        redeem: LoyaltyRule | null;
    }>;
    onDrafts(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>, excludeSrId: string | null): Promise<Map<string, DraftHold>>;
    billCharges(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>, excludeSrId: string | null): Promise<BillChargeFacts[]>;
    returnCharges(c: Client, srId: string | null | undefined): Promise<ReturnChargeRow[]>;
    openBills(c: Client, q: {
        companyId: string;
        branchId: string;
        partyId: string;
        firstSbId: string | null;
        sort: string | null;
        lock?: boolean;
        addBack?: ReadonlyMap<string, Dec> | null;
    }): Promise<OpenBillFacts[]>;
    unwindAddBack(c: Client, srId: string | null | undefined): Promise<UnwindAddBack | null>;
    billTenderRows(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>): Promise<BillTenderRow[]>;
    receivedLater(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>): Promise<Dec>;
    closedYears(c: Client, companyId: string, years: readonly string[]): Promise<Set<string>>;
    customerBalance(c: Client, companyId: string, partyId: string): Promise<Dec>;
    approvalsOf(c: Client, srId: string | null | undefined): Promise<ReturnApprovalRow[]>;
    sessionOf(c: Client, sessionId: string | null | undefined): Promise<{
        status: string;
        sessionNo: string | null;
    } | null>;
    schemes(c: Client, ids: readonly string[]): Promise<Map<string, SchemeFacts>>;
    units(c: Client, unitIds: readonly string[]): Promise<Map<string, UnitRow>>;
    lineNames(c: Client, lines: readonly {
        itemId: unknown;
        itemUnitId: unknown;
        godownId: unknown;
    }[]): Promise<{
        items: Map<string, string>;
        units: Map<string, string>;
        godowns: Map<string, string>;
    }>;
    itemUnits(c: Client, itemIds: readonly string[]): Promise<Map<string, UnitRow[]>>;
    barcodes(c: Client, itemIds: readonly string[]): Promise<Map<string, {
        code: string;
        itemUnitId: string | null;
    }[]>>;
    lots(c: Client, lotIds: readonly string[]): Promise<Map<string, LotFacts>>;
    billTenders(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>): Promise<BillTenderFacts>;
    billDue(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>, addBack?: ReadonlyMap<string, Dec> | null): Promise<Dec>;
    lastSale(c: Client, q: {
        companyId: string;
        custId: string;
        itemId: string;
        windowDays: number;
        returnDate: string;
        srcItemId?: string | null;
        srcAccYear?: string | null;
    }): Promise<{
        facts: BillLineFacts;
        refno: string | null;
        date: string;
    } | null>;
    todayPrice(c: Client, q: {
        companyId: string;
        branchId: string;
        itemId: string;
        itemUnitId: string;
        priceLevel: number | null;
    }, askFactor: Dec): Promise<TodayPriceFacts>;
    company(c: Client, companyId: string): Promise<{
        stateCode: string | null;
        einvoice: boolean;
    }>;
    reason(c: Client, reasonId: string | null | undefined): Promise<{
        refundCharges: boolean | null;
        defaultCondition: string | null;
    } | null>;
}
export {};
