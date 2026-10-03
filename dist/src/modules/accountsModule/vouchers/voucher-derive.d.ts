import { Prisma } from '@prisma/client';
import type { ResolvedRoleLedger, SupplyNature } from '../ledgerRole/ledger-map.helper';
import type { DerivedInstrument, DerivedVoucher, DrCr, LegSource, VoucherTypeRules } from './types/vouchers-api.types';
import type { BillFacts, CompanyFacts, LedgerFacts, TaxRateFacts, TdsRateFacts, TenderFacts } from './voucher-facts';
import { type VoucherGuardContext } from './vouchers.errors';
import { type ChequeBookFacts } from './cheque-book.helper';
export interface InstrumentInput {
    tenderId: string;
    refNo: string | null;
    instrumentDate: string | null;
    bankName: string | null;
    cheque: {
        drawerName: string | null;
        bankBranch: string | null;
        ifsc: string | null;
        micr: string | null;
    } | null;
    bankLedgerId?: string | null;
    chequeBookId?: string | null;
    favouring?: string | null;
    acPayee?: boolean | null;
}
export interface TypedLineInput {
    rowNo: number;
    drCr: DrCr;
    ledgerId: string;
    amount: Prisma.Decimal;
    remarks: string | null;
    gst: {
        taxId: string;
        hsn: string | null;
        itcEligibility: string | null;
    } | null;
    tdsBase: boolean | null;
    instrument?: InstrumentInput | null;
}
export interface AllocationInput {
    index: number;
    lineRowNo: number;
    billId: string;
    billAccYear: string;
    amount: Prisma.Decimal;
}
export interface DeriveInput {
    type: VoucherTypeRules;
    header: {
        date: string;
        partyId: string | null;
        posStcd: string | null;
        reverseCharge: boolean;
        docRefno: string | null;
    };
    lines: TypedLineInput[];
    allocations: AllocationInput[];
    newBill: {
        dueDays: number | null;
    } | null;
    company: CompanyFacts;
    ledgers: ReadonlyMap<string, LedgerFacts>;
    instrumentLedgers: ReadonlySet<string>;
    generatedRoleLedgers: ReadonlySet<string>;
    taxRates: ReadonlyMap<string, TaxRateFacts>;
    roleLedgers: ReadonlyMap<string, ResolvedRoleLedger | null>;
    party: LedgerFacts | null;
    creditDaysByLedger: ReadonlyMap<string, number>;
    tds: {
        rate: TdsRateFacts | null;
        annualBaseSoFar: Prisma.Decimal;
    } | null;
    tdsByParty?: ReadonlyMap<string, {
        rate: TdsRateFacts | null;
        annualBaseSoFar: Prisma.Decimal;
    }>;
    bills: ReadonlyMap<string, BillFacts>;
    docRefnoClash: 'INDEX' | 'OTHER' | null;
    backdateMode: 'OFF' | 'WARN' | 'REFUSE';
    allowAdvance?: boolean;
    today: string;
    ctx: VoucherGuardContext;
    tenders?: ReadonlyMap<string, TenderFacts>;
    registeredCheques?: ReadonlySet<string>;
    closedYears?: ReadonlyMap<string, string>;
    chequeBooks?: ReadonlyMap<string, ChequeBookFacts>;
}
export interface InternalLeg {
    rowNo: number;
    lineRowNo: number | null;
    drCr: DrCr;
    ledger: LedgerFacts | {
        ledId: string;
        name: string;
        groupName: string | null;
    };
    amount: Prisma.Decimal;
    generated: boolean;
    source: LegSource;
    role: string | null;
    remarks: string | null;
    fromRows: number[];
    gst: {
        taxId: string;
        hsn: string | null;
        itcEligibility: string | null;
    } | null;
    isTdsBase: boolean;
    oppLedgerId: string | null;
    postDated: boolean;
    postsOn: string | null;
    instrument: InternalInstrument | null;
}
export interface InternalInstrument {
    lineRowNo: number;
    tender: TenderFacts;
    ledgerId: string;
    ledgerName: string;
    refNo: string | null;
    instrumentDate: string | null;
    bankName: string | null;
    isCheque: boolean;
    isPostDated: boolean;
    postsOn: string | null;
    cheque: InstrumentInput['cheque'];
    settlementMode: string;
    issued: boolean;
    bankLedgerId: string | null;
    chequeBook: ChequeBookFacts | null;
    nextLeaf: string | null;
    favouring: string | null;
    acPayee: boolean;
}
export interface InternalPostDated {
    lineRowNo: number;
    partyLegRowNo: number;
    instrumentLegRowNo: number;
    extraLegRowNos: number[];
    party: LedgerFacts;
    amount: Prisma.Decimal;
    postsOn: string;
    accYear: string;
    instrument: InternalInstrument;
}
export interface InternalGstLine {
    rowNo: number;
    lineRowNo: number;
    taxableLedgerId: string;
    rate: TaxRateFacts;
    hsn: string | null;
    isService: boolean;
    itcEligibility: string | null;
    taxable: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    cess: Prisma.Decimal;
    cgstLedgerId: string | null;
    sgstLedgerId: string | null;
    igstLedgerId: string | null;
    cessLedgerId: string | null;
}
export interface InternalGst {
    register: string;
    side: 'INPUT' | 'OUTPUT';
    docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'OTHER';
    tranNature: 'PURCHASE' | 'SALE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'OTHER';
    docFlow: 'INWARD' | 'OUTWARD' | 'INTERNAL';
    docSign: 1 | -1;
    supplyNature: SupplyNature;
    posStcd: string;
    reverseCharge: boolean;
    taxable: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    cess: Prisma.Decimal;
    lines: InternalGstLine[];
}
export interface InternalTds {
    section: string;
    sectionName: string;
    deducteeType: string;
    registerDeductee: 'COMPANY' | 'NON_COMPANY';
    rate: Prisma.Decimal;
    rateSource: 'MASTER' | 'NO_PAN' | 'BELOW_THRESHOLD';
    base: Prisma.Decimal;
    tax: Prisma.Decimal;
    deducted: boolean;
    reason: string | null;
    fromRows: number[];
    ledgerId: string | null;
    party: LedgerFacts;
    lineRowNo: number | null;
}
export interface InternalBill {
    lineRowNo: number;
    legRowNo: number;
    party: LedgerFacts;
    billType: string;
    side: DrCr;
    amount: Prisma.Decimal;
    docRefno: string | null;
    dueDays: number;
    dueDate: string | null;
    isAdvance: boolean;
}
export interface InternalAllocation {
    index: number;
    lineRowNo: number;
    legRowNo: number;
    party: LedgerFacts;
    bill: BillFacts;
    amount: Prisma.Decimal;
    adjType: 'ALLOCATION' | 'ADVANCE_ADJUST' | 'NOTE_ADJUST' | 'TRANSFER';
    settlementMode: string;
    postDated: boolean;
    adjDate: string;
    instrumentLineRowNo: number | null;
}
export interface DerivedInternal {
    legs: InternalLeg[];
    totals: {
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        difference: Prisma.Decimal;
    };
    party: {
        ledger: LedgerFacts;
        side: DrCr;
        amount: Prisma.Decimal;
        rowNo: number;
    } | null;
    gst: InternalGst | null;
    tds: InternalTds | null;
    tdsLines: InternalTds[];
    bills: InternalBill[];
    allocations: InternalAllocation[];
    postDated: InternalPostDated[];
}
export declare function round2(v: Prisma.Decimal): Prisma.Decimal;
export declare function opposite(side: DrCr): DrCr;
export declare function roleKey(role: string, taxId: string | null, supplyNature: string | null): string;
export type SideVerdict = 'OK' | 'GROUPS' | 'MONEY_ONLY' | 'NO_MONEY';
export declare function moneySideOf(nature: string): DrCr | null;
export declare function sideVerdict(type: VoucherTypeRules, side: DrCr, ledger: LedgerFacts): SideVerdict;
export declare function legalOnSide(type: VoucherTypeRules, side: DrCr, ledger: LedgerFacts): boolean;
export declare function addDays(iso: string, days: number): string;
export declare function accYearOfDate(iso: string): string;
export declare function derive(input: DeriveInput): DerivedInternal;
export declare function registerDeductee(ledgerType: string | null | undefined): 'COMPANY' | 'NON_COMPANY';
export declare function toWire(typeCode: string, date: string, d: DerivedInternal): DerivedVoucher;
export declare function instrumentToWire(i: InternalInstrument): DerivedInstrument;
