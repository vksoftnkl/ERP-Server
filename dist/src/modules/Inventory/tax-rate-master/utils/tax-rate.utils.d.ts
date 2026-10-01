import { TaxRateLedger, TaxRateMaster } from '@prisma/client';
import { ModuleErrorDetail } from "../../../../common/utils/module-service.utils";
import { TaxRateErrorDetail, TaxRateLedgerPayload, TaxRatePayload } from '../types/tax-rate-api.types';
export declare const TAX_TAXABILITIES: readonly ["TAXABLE", "EXEMPT", "NIL_RATED", "NON_GST", "ZERO_RATED"];
export declare const ZERO_ONLY_TAXABILITIES: readonly ["EXEMPT", "NIL_RATED", "NON_GST"];
export declare const CESS_BASES: readonly ["NONE", "PERCENT", "PER_UNIT", "BOTH"];
export { SUPPLY_NATURES, isSupplyNature, } from '../../../accountsModule/ledgerRole/ledger-map.helper';
export type { SupplyNature } from '../../../accountsModule/ledgerRole/ledger-map.helper';
export declare const MAX_TAX_RATE_PERC = 100;
export declare const TAX_RATE_LOOKUP: {
    readonly supersedes: {
        readonly select: {
            readonly taxName: true;
        };
    };
};
export declare const LEDGER_LINE_LOOKUP: {
    readonly role: {
        readonly select: {
            readonly alrLabel: true;
        };
    };
    readonly ledger: {
        readonly select: {
            readonly ledName: true;
        };
    };
};
export type TaxRateLedgerRow = TaxRateLedger & {
    role?: {
        alrLabel: string;
    } | null;
    ledger?: {
        ledName: string;
    } | null;
};
export type TaxRateRow = TaxRateMaster & {
    supersedes?: {
        taxName: string;
    } | null;
    ledgerOverrides?: TaxRateLedgerRow[];
};
export declare function toLedgerLinePayload(row: TaxRateLedgerRow): TaxRateLedgerPayload;
export declare function toTaxRatePayload(row: TaxRateRow): TaxRatePayload;
export declare function throwTaxRateBadRequest(message: string, errors: TaxRateErrorDetail[]): never;
export declare function throwTaxRateConflict(message: string, errors: TaxRateErrorDetail[]): never;
export declare function handleTaxRateWriteError(error: unknown): void;
export declare function pushError(errors: ModuleErrorDetail[], field: string, message: string): void;
