import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
export type TransportDocType = 'SALE_BILL' | 'DELIVERY_CHALLAN' | 'SALE_RETURN' | 'DC_RETURN' | 'STOCK_TRANSFER';
export interface TransportEnd {
    godownId?: string | null;
    branchId?: string | null;
    addrId?: string | null;
    name?: string | null;
    addr?: string | null;
    place?: string | null;
    pin?: string | null;
    phone?: string | null;
    stcd?: string | null;
    gstin?: string | null;
}
export interface TransportBandInput {
    direction: 'OUTWARD' | 'INWARD';
    from?: TransportEnd | null;
    to?: TransportEnd | null;
    mode?: string | null;
    transporterId?: string | null;
    transporterName?: string | null;
    transporterGstin?: string | null;
    lrNo?: string | null;
    lrDate?: string | null;
    distanceKm?: number | null;
    remarks?: string | null;
}
export interface TransportBandRow extends TransportBandInput {
    ttdId: string;
    from: TransportEnd;
    to: TransportEnd;
}
export interface TransportDocRef {
    docType: TransportDocType;
    docId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    docRefno?: string | null;
}
export declare class TransportBandService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    read(ref: Pick<TransportDocRef, 'docType' | 'docId' | 'accYear'>, client?: Prisma.TransactionClient): Promise<TransportBandRow | null>;
    write(tx: Prisma.TransactionClient, ref: TransportDocRef, input: TransportBandInput, actor: string, opts: {
        gdrId: string | null;
        now?: Date;
    }): Promise<TransportBandRow>;
    remove(tx: Prisma.TransactionClient, ref: Pick<TransportDocRef, 'docType' | 'docId' | 'accYear'>, actor: string): Promise<void>;
    static hasContent(input: TransportBandInput | null | undefined): boolean;
}
