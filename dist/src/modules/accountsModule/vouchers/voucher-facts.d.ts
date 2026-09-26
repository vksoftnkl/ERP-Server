import { Prisma } from '@prisma/client';
import { type ResolvedRoleLedger, type SupplyNature } from '../ledgerRole/ledger-map.helper';
export interface CompanyFacts {
    companyId: string;
    name: string;
    stateCode: string;
    gstin: string | null;
    einvoiceApplicable: boolean;
}
export interface LedgerFacts {
    ledId: string;
    name: string;
    isActive: boolean;
    isDeleted: boolean;
    groupId: string;
    groupName: string;
    groupPath: string[];
    groupNames: string[];
    isParty: boolean;
    isBillByBill: boolean;
    taxId: string | null;
    itcEligibility: string | null;
    isTdsApplicable: boolean;
    tdsSection: string | null;
    tdsDeducteeType: string | null;
    pan: string | null;
    gstin: string | null;
    gstType: string | null;
    stateCode: string | null;
    stateName: string | null;
    addr1: string | null;
    addr2: string | null;
    addr3: string | null;
    city: string | null;
    pin: string | null;
}
export interface TaxRateFacts {
    taxId: string;
    name: string;
    ratePerc: Prisma.Decimal;
    cgstPerc: Prisma.Decimal;
    sgstPerc: Prisma.Decimal;
    igstPerc: Prisma.Decimal;
    cessPerc: Prisma.Decimal;
    cessBasis: string;
    taxability: string;
    isReverseCharge: boolean;
    isActive: boolean;
}
export interface TdsRateFacts {
    section: string;
    sectionName: string;
    deducteeType: string;
    rate: Prisma.Decimal;
    noPanRate: Prisma.Decimal;
    thresholdSingle: Prisma.Decimal;
    thresholdAnnual: Prisma.Decimal;
}
export interface BillFacts {
    ablId: string;
    ablAccYear: string;
    partyId: string;
    billType: string;
    docRefno: string;
    docDate: Date;
    side: 'DR' | 'CR';
    billAmount: Prisma.Decimal;
    pendingAmount: Prisma.Decimal;
    isDeleted: boolean;
    isActive: boolean;
    companyId: string;
}
export declare function loadCompanyFacts(tx: Prisma.TransactionClient, companyId: string): Promise<CompanyFacts | null>;
export declare function loadLedgerFacts(tx: Prisma.TransactionClient, companyId: string, ledgerIds: readonly string[]): Promise<Map<string, LedgerFacts>>;
export declare function isMoneyLedger(l: Pick<LedgerFacts, 'groupNames'>): boolean;
export declare function loadInstrumentLedgers(tx: Prisma.TransactionClient, companyId: string): Promise<Set<string>>;
export declare function loadTaxRates(tx: Prisma.TransactionClient, taxIds: readonly string[]): Promise<Map<string, TaxRateFacts>>;
export declare const GENERATED_ROLES: readonly ["INPUT_CGST", "INPUT_SGST", "INPUT_IGST", "INPUT_CESS", "OUTPUT_CGST", "OUTPUT_SGST", "OUTPUT_IGST", "OUTPUT_CESS", "RCM_CGST_PAYABLE", "RCM_SGST_PAYABLE", "RCM_IGST_PAYABLE", "TDS_PAYABLE"];
export declare function loadGeneratedRoleLedgers(tx: Prisma.TransactionClient, companyId: string, branchId: string): Promise<Set<string>>;
export interface RoleLedgerAsk {
    role: string;
    taxId: string | null;
    supplyNature: SupplyNature | null;
}
export declare function resolveRoleLedgerMap(tx: Prisma.TransactionClient, companyId: string, branchId: string, asks: readonly RoleLedgerAsk[]): Promise<Map<string, ResolvedRoleLedger | null>>;
export declare function loadTdsRate(tx: Prisma.TransactionClient, companyId: string, section: string, deducteeType: string | null, onDate: string): Promise<TdsRateFacts | null>;
export declare function loadTdsAnnualBase(tx: Prisma.TransactionClient, companyId: string, partyId: string, accYear: string, section: string): Promise<Prisma.Decimal>;
export declare function loadPartyCreditDays(tx: Prisma.TransactionClient, partyId: string): Promise<number>;
export declare function loadStateName(tx: Prisma.TransactionClient, stateCode: string | null): Promise<string | null>;
export declare function loadBills(tx: Prisma.TransactionClient, bills: readonly {
    billId: string;
    billAccYear: string;
}[], lock: boolean): Promise<Map<string, BillFacts>>;
export declare function billKey(billId: string, accYear: string): string;
export declare function itcClassOf(ledgerItc: string | null | undefined): string | null;
