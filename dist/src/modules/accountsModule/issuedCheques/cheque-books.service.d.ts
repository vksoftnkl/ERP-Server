import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
export declare const CHEQUE_BOOKS_MENU_ID = 263;
import type { ChequeBookKeysDto, CloseChequeBookDto, SaveChequeBookDto } from './dto/issued-cheques.dto';
import type { ChequeBookPayload } from './types/issued-cheques-api.types';
export declare class ChequeBooksService {
    private readonly prisma;
    private readonly requestContext;
    constructor(prisma: PrismaService, requestContext: RequestContextService);
    private caller;
    private require;
    get(q: ChequeBookKeysDto): Promise<ChequeBookPayload>;
    save(dto: SaveChequeBookDto): Promise<ChequeBookPayload>;
    close(dto: CloseChequeBookDto): Promise<ChequeBookPayload>;
    private load;
}
