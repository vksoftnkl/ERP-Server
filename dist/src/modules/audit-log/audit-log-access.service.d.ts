import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
export type AuditReadScope = {
    screenIds: number[] | null;
};
export declare class AuditLogAccessService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    resolveReadScope(query: ListAuditLogQueryDto): Promise<AuditReadScope>;
    private namedScreens;
    private assertScreenHistoryRight;
    private viewableScreenIds;
    private callerReadsUnmappedScreens;
}
