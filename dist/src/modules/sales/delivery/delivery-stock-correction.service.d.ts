import { Prisma } from '@prisma/client';
import { StockPostingService } from '../../stocks/posting/stock-posting.service';
import type { StockVoucherTypeRules } from '../../stocks/stock-voucher/types/stock-voucher.types';
export interface CorrectionLine {
    lineNo: number;
    itemId: string;
    iucId: string;
    factor: Prisma.Decimal;
    qty: Prisma.Decimal;
    givingGodownId: string;
    billGodownId: string;
    givenLotId: string | null;
    billLotId: string | null;
    bucket: string;
}
export interface CorrectionDoc {
    sdnId: string;
    noteAccYear: string;
    shadowAccYear: string;
    companyId: string;
    branchId: string;
    tenantId: string | null;
    deviceId: string;
    refno: string;
    docDate: string;
    docDatetime: Date;
}
export interface CorrectionResult {
    kind: 'LOT_SWAP' | 'GODOWN_MOVE';
    svhId: string;
    svhRefno: string;
    lineNos: number[];
    undo?: true;
}
export declare const DN_TRANSFER_RULES: StockVoucherTypeRules;
export declare const DN_RELOT_RULES: StockVoucherTypeRules;
export declare class DeliveryStockCorrectionService {
    private readonly stockPosting;
    constructor(stockPosting: StockPostingService);
    static needs(l: CorrectionLine): {
        move: boolean;
        swap: boolean;
    };
    post(tx: Prisma.TransactionClient, doc: CorrectionDoc, lines: readonly CorrectionLine[], actor: string, opts: {
        undo: boolean;
    }): Promise<CorrectionResult[]>;
    cancelAll(tx: Prisma.TransactionClient, q: {
        sdnId: string;
        companyId: string;
        branchId: string;
    }, actor: string, reason: string, cancelledOn: Date): Promise<number>;
    private postShadow;
    private mapEngineRefusal;
    private reasonIds;
    private units;
    private writeShadow;
}
