import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { TxnAdjacentQueryDto } from './dto/txn-adjacent-query.dto';
import { type TxnDocType } from './txn-adjacent.registry';
export interface TxnAdjacentDoc {
    docId: string;
    companyId: string;
    branchId: string;
    accYear: string;
    typeCode: string;
    refno: string | null;
    date: string;
    status: string;
}
export interface TxnAdjacentPayload {
    docType: TxnDocType;
    direction: 'prev' | 'next';
    fromDocId: string | null;
    doc: TxnAdjacentDoc | null;
}
export declare class TxnAdjacentService {
    private readonly prisma;
    private readonly requestContext;
    constructor(prisma: PrismaService, requestContext: RequestContextService);
    adjacent(q: TxnAdjacentQueryDto): Promise<TxnAdjacentPayload>;
    private assertCanView;
}
