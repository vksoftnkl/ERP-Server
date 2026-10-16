import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import type { NoTenderQueryDto, TenderDayBookQueryDto } from './tender-day-book.dto';
import { type NoTenderPayload, type TenderDayBookPayload } from './tender-day-book.types';
export declare class TenderDayBookService {
    private readonly prisma;
    private readonly requestContext;
    constructor(prisma: PrismaService, requestContext: RequestContextService);
    dayBook(q: TenderDayBookQueryDto): Promise<TenderDayBookPayload>;
    noTender(q: NoTenderQueryDto): Promise<NoTenderPayload>;
    private linesScope;
    private rows;
    private snapshot;
    private assertMenuRight;
    private resolveScope;
}
