import { Prisma } from '@prisma/client';
import { type WaDocType, type WaKind } from './wa.constants';
type Raw = Pick<Prisma.TransactionClient, '$queryRaw'>;
export interface DocFacts {
    docType: WaDocType;
    kind: WaKind;
    docId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    refno: string;
    date: string;
    amount: Prisma.Decimal;
    status: string;
    posted: boolean;
    cancelled: boolean;
    partyId: string | null;
    docPartyName: string | null;
    docPhone: string | null;
    vchrTypeId: number | null;
    deviceId: string | null;
    printPurposeCode: string;
}
export interface PartyFacts {
    partyId: string;
    name: string;
    whatsapp: string | null;
    phone1: string | null;
    phone2: string | null;
    lang: string | null;
    remindersOffOn: Date | null;
    allOffOn: Date | null;
}
export declare function readDocFacts(client: Raw, p: {
    companyId: string;
    docType: WaDocType;
    docId: string;
    accYear: string;
}): Promise<DocFacts>;
export declare function readParty(client: Raw, partyId: string): Promise<PartyFacts | null>;
export declare function shopPhone(client: Raw, companyId: string, branchId: string | null): Promise<string | null>;
export declare function inr(v: Prisma.Decimal | number | string): string;
export declare function dmy(isoDate: string | null | undefined): string;
export declare function templateParams(names: readonly string[], values: Record<string, string | null | undefined>): Record<string, string>;
export declare function pdfName(prefix: string, ref: string): string;
export {};
