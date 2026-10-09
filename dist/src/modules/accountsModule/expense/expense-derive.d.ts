import { Prisma } from '@prisma/client';
import type { VoucherLeg } from "../../../common/posting/voucher-leg.types";
import { type ResolvedRoleLedger } from '../ledgerRole/ledger-map.helper';
import type { NormalisedPaymentTender } from '../payment/payment-lines';
import { type CompanyFacts, type LedgerFacts, type TaxRateFacts } from '../vouchers/voucher-facts';
import { type VoucherGuardContext } from '../vouchers/vouchers.errors';
import type { ExpenseDerivedPayload, ExpenseDraftLines } from './types/expense-api.types';
import { ExpenseMoneyFrom } from './types/expense-enum';
declare const GST_COMPONENTS: readonly ["CGST", "SGST", "IGST", "CESS"];
type GstComponent = (typeof GST_COMPONENTS)[number];
export interface ExpenseFacts {
    company: CompanyFacts;
    ledgers: Map<string, LedgerFacts>;
    expenseLedgerIds: ReadonlySet<string>;
    party: LedgerFacts | null;
    taxRates: Map<string, TaxRateFacts>;
    roleLedgers: Map<string, ResolvedRoleLedger | null>;
    tenders: NormalisedPaymentTender[];
    ledgerNames: Map<string, string>;
    cash: {
        moneyFrom: ExpenseMoneyFrom;
        ledgerId: string | null;
    };
}
export interface DerivedExpense {
    payload: Omit<ExpenseDerivedPayload, 'session' | 'safeName'>;
    legs: VoucherLeg[];
    costCentres: {
        rowNo: number;
        costCentreId: string;
    }[];
    gst: DerivedExpenseGst | null;
}
export interface DerivedExpenseGstLine {
    rowNo: number;
    ledgerId: string;
    ledgerName: string;
    hsn: string | null;
    isService: boolean;
    taxable: Prisma.Decimal;
    rate: TaxRateFacts;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    cess: Prisma.Decimal;
    itcEligibility: string;
    taxLedgers: Record<GstComponent, string | null>;
}
export interface DerivedExpenseGst {
    supplyNature: 'INTRA' | 'INTER';
    placeOfSupplyCode: string;
    supplierGstin: string;
    invoiceNo: string;
    invoiceDate: string;
    taxable: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    cess: Prisma.Decimal;
    lines: DerivedExpenseGstLine[];
}
export declare function deriveExpense(draft: ExpenseDraftLines, facts: ExpenseFacts, ctx: VoucherGuardContext): DerivedExpense;
export {};
