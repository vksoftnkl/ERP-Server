import { PrismaService } from '../../../database/prisma/prisma.service';
import { DocumentNumberQueryDto } from '../dto/document-number-query.dto';
import { DocumentNumberPayload } from '../types/master-lookup-api.types';
export declare class DocumentNumberLookup {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDocumentByNumber(query: DocumentNumberQueryDto): Promise<DocumentNumberPayload>;
}
