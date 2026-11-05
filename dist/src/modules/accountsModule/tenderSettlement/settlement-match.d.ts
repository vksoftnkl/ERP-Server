import { Prisma } from '@prisma/client';
import { SettlementLineKind, SettlementMatchRule, SettlementMatchStatus } from './types/tender-settlement-enum';
export interface MatchLine {
    aslId: string;
    kind: SettlementLineKind;
    tenderId: string | null;
    refNo: string | null;
    authCode: string | null;
    cardLast4: string | null;
    gross: Prisma.Decimal;
    txnOn: Date | null;
}
export interface MatchCandidate {
    tdId: string;
    tdAccYear: string;
    tenderId: string;
    drCr: 'DR' | 'CR';
    settleStatus: string;
    refNo: string | null;
    authCode: string | null;
    cardLast4: string | null;
    amount: Prisma.Decimal;
    docDate: string;
    createdOn: Date;
}
export interface MatchVerdict {
    aslId: string;
    status: SettlementMatchStatus.MATCHED | SettlementMatchStatus.SUGGESTED | SettlementMatchStatus.UNMATCHED;
    rule: SettlementMatchRule | null;
    tdId: string | null;
    tdAccYear: string | null;
    diff: Prisma.Decimal;
}
export declare function matchLines(lines: readonly MatchLine[], candidates: readonly MatchCandidate[], options: {
    tolerance: Prisma.Decimal;
    windowMinutes: number;
    taken?: ReadonlySet<string>;
}): MatchVerdict[];
export declare function isCustomerKind(kind: SettlementLineKind): boolean;
export declare function kindTakes(kind: SettlementLineKind, c: Pick<MatchCandidate, 'drCr' | 'settleStatus'>): boolean;
