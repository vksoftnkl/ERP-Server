import { Prisma } from '@prisma/client';
import { SettlementLineKind, SettlementSource } from './types/tender-settlement-enum';
export interface StatementFormat {
    version: 1;
    source: SettlementSource;
    provider: string;
    columns: StatementColumns;
    kindMap?: Partial<Record<SettlementLineKind, string[]>>;
    dateFormat?: string;
    negativeIsRefund?: boolean;
}
export interface StatementColumns {
    gross: string;
    txnOn?: string;
    kind?: string;
    terminalId?: string;
    vpa?: string;
    refNo?: string;
    authCode?: string;
    cardLast4?: string;
    payer?: string;
    fee?: string;
    tax?: string;
    net?: string;
    payoutRef?: string;
    payoutDate?: string;
}
export declare function validateStatementFormat(raw: unknown): {
    format: StatementFormat | null;
    problems: string[];
};
export interface ParsedStatementLine {
    lineNo: number;
    kind: SettlementLineKind;
    txnOn: Date | null;
    terminalId: string | null;
    vpa: string | null;
    refNo: string | null;
    authCode: string | null;
    cardLast4: string | null;
    payer: string | null;
    gross: Prisma.Decimal;
    fee: Prisma.Decimal;
    tax: Prisma.Decimal;
    net: Prisma.Decimal;
    payoutRef: string | null;
    payoutDate: string | null;
    raw: Record<string, string>;
}
export interface ParsedStatement {
    lines: ParsedStatementLine[];
    problems: {
        lineNo: number;
        message: string;
    }[];
}
export declare function parseStatementCsv(text: string, format: StatementFormat): ParsedStatement;
export declare function parseAmount(value: string | null): Prisma.Decimal | null;
export declare function parseDateTime(value: string, format?: string): Date | null;
export declare function istDate(d: Date): string;
export declare function groupByPayout(lines: readonly ParsedStatementLine[], fallback: {
    payoutRef: string | null;
    payoutDate: string | null;
}): {
    payoutRef: string | null;
    payoutDate: string | null;
    lines: ParsedStatementLine[];
}[];
