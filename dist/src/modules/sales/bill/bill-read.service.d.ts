import { Prisma, SaleBill } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { LoyaltyLedgerService } from '../posting/loyalty-ledger.service';
import { SalesContextService } from '../posting/sales-context.service';
import { SalesDocBlocksService } from '../posting/sales-doc-blocks.service';
import { StatutoryService } from '../posting/statutory.service';
import { TransportBandService } from '../posting/transport-band.service';
import type { BillPayload } from './types/bill-api.types';
export declare class BillReadService {
    private readonly prisma;
    private readonly salesContext;
    private readonly docBlocks;
    private readonly transportBand;
    private readonly statutory;
    private readonly loyalty;
    constructor(prisma: PrismaService, salesContext: SalesContextService, docBlocks: SalesDocBlocksService, transportBand: TransportBandService, statutory: StatutoryService, loyalty: LoyaltyLedgerService);
    decorate(bill: SaleBill, payload: BillPayload, client?: Prisma.TransactionClient): Promise<BillPayload>;
    lockCounts(c: Prisma.TransactionClient, bill: SaleBill): Promise<{
        returns: number;
        allocations: number;
    }>;
    private sources;
    private tempCredits;
    private adjustments;
    openSources(q: {
        companyId: string;
        branchId: string;
        partyId: string;
        kind: 'DC' | 'ORDER';
        accYear?: string | null;
    }): Promise<OpenSourceDoc[]>;
    private openChallans;
    private openOrders;
    partyContext(q: {
        partyId: string;
        companyId: string;
        branchId: string;
        accYear: string;
        billDate?: string | null;
    }): Promise<Record<string, unknown>>;
    tenderContext(keys: {
        sbId: string;
        sbCompanyId: string;
        sbBranchId: string;
        sbAccYear: string;
    }): Promise<Record<string, unknown>>;
}
export interface OpenSourceDoc {
    docId: string;
    accYear: string;
    refno: string | null;
    date: string | null;
    purpose: string | null;
    ageDays: number;
    pastWindow: boolean;
    convertRequired?: boolean;
    lines: {
        lineId: string;
        lineNo: number;
        itemId: string;
        itemName: string | null;
        unitId: string | null;
        unitName: string | null;
        lotId: string | null;
        batchNo: string | null;
        godownId: string | null;
        docQty: number;
        openQty: number;
        freeQty: number;
        rate: number;
        taxId: string | null;
        taxPerc: number;
        hsnCode: string | null;
    }[];
}
